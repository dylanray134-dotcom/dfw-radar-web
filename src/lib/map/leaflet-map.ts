import type { Map as LeafletMap, LatLngBoundsExpression } from "leaflet";
import type { GeoBounds } from "@/lib/radar/project";
import type { RadarMap } from "./types";

function toLeafletBounds(bounds: GeoBounds): LatLngBoundsExpression {
  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ];
}

export async function createLeafletMap(container: HTMLElement, canvas: HTMLCanvasElement): Promise<RadarMap> {
  const leaflet = await import("leaflet");
  const L = leaflet.default ?? leaflet;
  container.replaceChildren();
  const map: LeafletMap = L.map(container, {
    zoomControl: false,
    attributionControl: true,
    keyboard: false,
    boxZoom: false,
    zoomSnap: 0,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 80,
    zoomAnimation: false,
    fadeAnimation: false,
    inertia: true,
    maxBoundsViscosity: 1,
    minZoom: 4,
    maxZoom: 20,
  });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
    detectRetina: true,
  }).addTo(map);
  map.setView([32.99, -97.03], 8);

  canvas.style.position = "absolute";
  canvas.style.pointerEvents = "none";
  canvas.style.display = "none";
  map.getPanes().overlayPane.appendChild(canvas);

  let bounds: GeoBounds | null = null;
  const place = () => {
    if (!bounds || canvas.dataset.radar !== "1" || canvas.width < 2) {
      canvas.style.display = "none";
      return;
    }
    const nw = map.latLngToLayerPoint([bounds.north, bounds.west]);
    const se = map.latLngToLayerPoint([bounds.south, bounds.east]);
    canvas.style.display = "block";
    canvas.style.left = `${nw.x}px`;
    canvas.style.top = `${nw.y}px`;
    canvas.style.width = `${Math.max(1, se.x - nw.x)}px`;
    canvas.style.height = `${Math.max(1, se.y - nw.y)}px`;
  };

  const listeners = new Set<() => void>();
  const notify = () => {
    place();
    for (const listener of listeners) listener();
  };
  map.on("move zoom viewreset resize", notify);

  return {
    provider: "leaflet",
    setRestriction(next, minZoom, maxZoom) {
      bounds = next;
      map.setMinZoom(minZoom);
      map.setMaxZoom(maxZoom);
      map.setMaxBounds(toLeafletBounds(next));
      map.options.maxBoundsViscosity = 1;
      place();
    },
    setCamera(camera) {
      const zoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), camera.zoom));
      map.setView([camera.lat, camera.lng], zoom, { animate: false });
    },
    getCamera() {
      const center = map.getCenter();
      return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
    },
    setOverlayBounds(next) {
      bounds = next;
      place();
    },
    redraw() {
      place();
    },
    containerPoint(lat, lng) {
      const point = map.latLngToContainerPoint([lat, lng]);
      return { x: point.x, y: point.y };
    },
    onCamera(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resize() {
      map.invalidateSize({ animate: false });
    },
    destroy() {
      map.off("move zoom viewreset resize", notify);
      listeners.clear();
      canvas.remove();
      map.remove();
      container.replaceChildren();
    },
  };
}
