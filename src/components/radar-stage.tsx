"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compositeOverlays } from "@/lib/radar/composite";
import { boundsAspect, letterbox, minZoomForBounds } from "@/lib/radar/geo";
import { frameBounds, imageToLatLon, projectToImage, type GeoBounds } from "@/lib/radar/project";
import type { HiresLevel, Overlay, Scene, ViewState } from "@/lib/radar/types";
import { BASE_FRAME, MAX_VIEW_ZOOM } from "@/lib/radar/types";
import { concealRadarCanvas, warpToMercator } from "@/lib/radar/warp";
import { createRadarMap } from "@/lib/map/create-map";
import type { MapCamera, RadarMap } from "@/lib/map/types";
import "leaflet/dist/leaflet.css";

type Props = {
  scene: Scene | null;
  frameIndex: number;
  revision: number;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  getRaw: (path: string | null | undefined) => ImageBitmap | null;
  getOverlayBitmap: (overlay: Overlay, frameIndex: number) => ImageBitmap | null;
  activeOverlays: Overlay[];
  /** Browser geolocation fix. Null unless location permission produced coordinates. */
  location: { lat: number; lon: number } | null;
};

type GeoFrame = {
  bounds: GeoBounds;
  size: { width: number; height: number };
  minZoom: number;
  maxZoom: number;
  projection: NonNullable<Scene["projection"]>;
  regionId: string;
};

function pickHires(levels: HiresLevel[], zoom: number): HiresLevel | null {
  let best: HiresLevel | null = null;
  for (const level of levels) {
    if (zoom + 0.05 < level.zoom * 0.8) continue;
    if (!best || level.zoom > best.zoom) best = level;
  }
  return best;
}

function nearly(a: ViewState, b: ViewState): boolean {
  return Math.abs(a.zoom - b.zoom) < 0.02 && Math.abs(a.cx - b.cx) < 0.003 && Math.abs(a.cy - b.cy) < 0.003;
}

function viewFromCamera(camera: MapCamera, geo: GeoFrame): ViewState {
  const pixel = projectToImage(geo.projection, camera.lat, camera.lng);
  const cx = pixel ? Math.min(1, Math.max(0, pixel.x / BASE_FRAME.width)) : 0.5;
  const cy = pixel ? Math.min(1, Math.max(0, pixel.y / BASE_FRAME.height)) : 0.5;
  const zoom = Math.min(MAX_VIEW_ZOOM, Math.max(1, 2 ** (camera.zoom - geo.minZoom)));
  return { zoom, cx, cy };
}

function cameraFromView(view: ViewState, geo: GeoFrame): MapCamera {
  const point = imageToLatLon(
    geo.projection,
    Math.min(1, Math.max(0, view.cx)) * BASE_FRAME.width,
    Math.min(1, Math.max(0, view.cy)) * BASE_FRAME.height,
  );
  const lat = point?.lat ?? (geo.bounds.north + geo.bounds.south) / 2;
  const lng = point?.lon ?? (geo.bounds.east + geo.bounds.west) / 2;
  const zoom = Math.min(geo.maxZoom, Math.max(geo.minZoom, geo.minZoom + Math.log2(Math.max(1, view.zoom))));
  return { lat, lng, zoom };
}

export function RadarStage({
  scene,
  frameIndex,
  revision,
  view,
  onViewChange,
  getRaw,
  getOverlayBitmap,
  activeOverlays,
  location,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<RadarMap | null>(null);
  const creatingRef = useRef<Promise<RadarMap | null> | null>(null);
  const aliveRef = useRef(true);
  const viewRef = useRef(view);
  const geoRef = useRef<GeoFrame | null>(null);
  const locationRef = useRef(location);
  const onViewChangeRef = useRef(onViewChange);
  /** Programmatic setCamera/setRestriction also emit camera events. Ignore those so they cannot write a stale zoom back. */
  const applyingRef = useRef(false);
  viewRef.current = view;
  locationRef.current = location;
  onViewChangeRef.current = onViewChange;

  const [box, setBox] = useState({ width: 0, height: 0 });
  const [provider, setProvider] = useState<"google" | "leaflet" | null>(null);

  const geo = useMemo<GeoFrame | null>(() => {
    if (!scene?.projection || box.width < 2 || box.height < 2) return null;
    const bounds = frameBounds(scene.projection, BASE_FRAME.width, BASE_FRAME.height);
    if (!bounds) return null;
    const size = letterbox(box.width, box.height, boundsAspect(bounds));
    const minZoom = minZoomForBounds(bounds, size.width, size.height);
    const maxZoom = Math.min(21, minZoom + Math.log2(MAX_VIEW_ZOOM));
    return { bounds, size, minZoom, maxZoom, projection: scene.projection, regionId: scene.regionId };
  }, [scene, box.width, box.height]);
  geoRef.current = geo;
  const detailLevel = scene ? (pickHires(scene.hires, view.zoom)?.zoom ?? 0) : 0;

  const placeMarker = () => {
    const marker = markerRef.current;
    const mapEl = mapRef.current;
    const wrap = wrapRef.current;
    const engine = engineRef.current;
    const fix = locationRef.current;
    if (!marker || !mapEl || !wrap || !engine || !fix) {
      if (marker) {
        marker.style.display = "none";
        marker.setAttribute("aria-hidden", "true");
      }
      return;
    }
    const point = engine.containerPoint(fix.lat, fix.lon);
    const mapBox = mapEl.getBoundingClientRect();
    const wrapBox = wrap.getBoundingClientRect();
    if (!point || point.x < -12 || point.y < -12 || point.x > mapBox.width + 12 || point.y > mapBox.height + 12) {
      marker.style.display = "none";
      marker.setAttribute("aria-hidden", "true");
      return;
    }
    marker.style.display = "block";
    marker.style.transform = `translate(${mapBox.left - wrapBox.left + point.x}px, ${mapBox.top - wrapBox.top + point.y}px)`;
    marker.setAttribute("aria-hidden", "false");
  };
  const placeMarkerRef = useRef(placeMarker);
  placeMarkerRef.current = placeMarker;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    aliveRef.current = true;
    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    });
    observer.observe(wrap);
    return () => {
      aliveRef.current = false;
      observer.disconnect();
      engineRef.current?.destroy();
      engineRef.current = null;
      creatingRef.current = null;
    };
  }, []);

  useEffect(() => {
    const frame = geo;
    const el = mapRef.current;
    if (!frame || !el) return;
    el.style.width = `${frame.size.width}px`;
    el.style.height = `${frame.size.height}px`;
    let dead = false;

    const ensure = () => {
      if (engineRef.current) return Promise.resolve(engineRef.current);
      if (creatingRef.current) return creatingRef.current;
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      creatingRef.current = createRadarMap(el, canvas).then((engine) => {
        if (!aliveRef.current) {
          engine.destroy();
          return null;
        }
        engineRef.current = engine;
        setProvider(engine.provider);
        engine.onCamera(() => {
          placeMarkerRef.current();
          if (applyingRef.current) return;
          const current = geoRef.current;
          const live = engine.getCamera();
          if (!current || !live) return;
          const next = viewFromCamera(live, current);
          if (nearly(next, viewRef.current)) return;
          onViewChangeRef.current(next);
        });
        return engine;
      });
      return creatingRef.current;
    };

    void (async () => {
      const engine = await ensure();
      if (dead || !engine || !aliveRef.current) return;
      applyingRef.current = true;
      try {
        engine.resize();
        engine.setRestriction(frame.bounds, frame.minZoom, frame.maxZoom);
        engine.setOverlayBounds(frame.bounds);
        const live = engine.getCamera();
        if (!live || !nearly(viewFromCamera(live, frame), viewRef.current)) {
          engine.setCamera(cameraFromView(viewRef.current, frame));
        }
        engine.redraw();
      } finally {
        applyingRef.current = false;
      }
      placeMarkerRef.current();
    })();

    return () => {
      dead = true;
    };
  }, [geo]);

  useEffect(() => {
    const engine = engineRef.current;
    const frame = geoRef.current;
    if (!engine || !frame) return;
    const live = engine.getCamera();
    if (live && nearly(viewFromCamera(live, frame), view)) return;
    applyingRef.current = true;
    try {
      engine.setCamera(cameraFromView(view, frame));
    } finally {
      applyingRef.current = false;
    }
  }, [view]);

  useEffect(() => {
    placeMarker();
  }, [location, geo, provider]);

  useEffect(() => {
    const frame = geo;
    const projection = scene?.projection;
    if (!frame || !projection || !scene) return;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    const hires = pickHires(scene.hires, viewRef.current.zoom);
    const hiresBitmap = hires?.fg ? getRaw(hires.fg) : null;
    const ordered = [...activeOverlays].sort((a, b) => a.drawOrder - b.drawOrder);
    const layers = [];
    let width = BASE_FRAME.width;
    let height = BASE_FRAME.height;
    if (hiresBitmap && hiresBitmap.width > width && hiresBitmap.height > height) {
      width = hiresBitmap.width;
      height = hiresBitmap.height;
    }
    for (const overlay of ordered) {
      const bitmap =
        hires && hiresBitmap && overlay.index === hires.fgOverlayIndex
          ? hiresBitmap
          : getOverlayBitmap(overlay, frameIndex);
      if (!bitmap) continue;
      layers.push({ source: bitmap, opacity: overlay.opacity });
    }
    if (layers.length === 0) {
      concealRadarCanvas(canvas);
      engineRef.current?.redraw();
      return;
    }
    const stacked = compositeOverlays(width, height, layers);
    warpToMercator(
      canvas,
      stacked,
      stacked.width,
      stacked.height,
      projection,
      frame.bounds,
      BASE_FRAME.width,
      BASE_FRAME.height,
    );
    engineRef.current?.redraw();
  }, [scene, frameIndex, revision, detailLevel, activeOverlays, geo, getRaw, getOverlayBitmap]);

  return (
    <div ref={wrapRef} className="radar-stage absolute inset-0" data-basemap={provider ?? "pending"}>
      <div ref={mapRef} className="radar-map" role="application" aria-label="DFW radar map" />
      <div
        ref={markerRef}
        className="pointer-events-none absolute top-0 left-0 z-[500]"
        style={{ display: "none" }}
        data-location-dot=""
        role="img"
        aria-label="Your location"
        aria-hidden="true"
      >
        <span className="absolute top-0 left-0 size-12 -translate-x-1/2 -translate-y-1/2">
          <span className="location-halo block size-full rounded-full bg-[#4285F4]/35" />
        </span>
        <span className="absolute top-0 left-0 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#4285F4] shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_1px_4px_rgba(0,0,0,0.45)]" />
      </div>
    </div>
  );
}
