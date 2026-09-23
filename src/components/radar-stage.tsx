"use client";

import { useEffect, useRef } from "react";
import type { HiresLevel, Overlay, Scene, ViewState } from "@/lib/radar/types";
import { BASE_FRAME, DEFAULT_VIEW } from "@/lib/radar/types";

type Props = {
  scene: Scene | null;
  frameIndex: number;
  revision: number;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  getRaw: (path: string | null | undefined) => ImageBitmap | null;
  getOverlayBitmap: (overlay: Overlay, frameIndex: number) => ImageBitmap | null;
  activeOverlays: Overlay[];
};

function clampView(view: ViewState, cssW: number, cssH: number, imgW: number, imgH: number): ViewState {
  const zoom = Math.min(8, Math.max(1, view.zoom));
  if (zoom <= 1.001 || cssW <= 0 || cssH <= 0) return DEFAULT_VIEW;
  const fit = Math.min(cssW / imgW, cssH / imgH);
  const scale = fit * zoom;
  const halfX = cssW / scale / imgW / 2;
  const halfY = cssH / scale / imgH / 2;
  return {
    zoom,
    cx: halfX >= 0.5 ? 0.5 : Math.min(1 - halfX, Math.max(halfX, view.cx)),
    cy: halfY >= 0.5 ? 0.5 : Math.min(1 - halfY, Math.max(halfY, view.cy)),
  };
}

function pickHires(levels: HiresLevel[], zoom: number): HiresLevel | null {
  let best: HiresLevel | null = null;
  for (const level of levels) {
    if (zoom + 0.05 < level.zoom * 0.8) continue;
    if (!best || level.zoom > best.zoom) best = level;
  }
  return best;
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
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: "none" | "pan" | "pinch";
    lastX: number;
    lastY: number;
    lastDist: number;
    moved: boolean;
  }>({ mode: "none", lastX: 0, lastY: 0, lastDist: 0, moved: false });

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#071018";
      context.fillRect(0, 0, width, height);
      if (!scene) return;

      const bg = getRaw(scene.bg);
      const imgW = bg?.width || BASE_FRAME.width;
      const imgH = bg?.height || BASE_FRAME.height;
      const current = clampView(viewRef.current, rect.width, rect.height, imgW, imgH);
      const fit = Math.min(rect.width / imgW, rect.height / imgH);
      const scale = fit * current.zoom * dpr;
      const panX = (rect.width / 2 - current.cx * imgW * fit * current.zoom) * dpr;
      const panY = (rect.height / 2 - current.cy * imgH * fit * current.zoom) * dpr;
      context.setTransform(scale, 0, 0, scale, panX, panY);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const hires = pickHires(scene.hires, current.zoom);
      const hiresBg = hires?.bg ? getRaw(hires.bg) : null;
      if (hiresBg) context.drawImage(hiresBg, 0, 0, imgW, imgH);
      else if (bg) context.drawImage(bg, 0, 0, imgW, imgH);

      const ordered = [...activeOverlays].sort((a, b) => a.drawOrder - b.drawOrder);
      for (const overlay of ordered) {
        const hiresFg =
          hires?.fg && overlay.index === hires.fgOverlayIndex ? getRaw(hires.fg) : null;
        const bitmap = hiresFg ?? getOverlayBitmap(overlay, frameIndex);
        if (!bitmap) continue;
        context.globalAlpha = overlay.opacity;
        context.drawImage(bitmap, 0, 0, imgW, imgH);
        context.globalAlpha = 1;
      }
    };

    draw();
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.08 : 0.92;
      const box = {
        cssW: rect.width,
        cssH: rect.height,
        imgW: (scene ? getRaw(scene.bg) : null)?.width || BASE_FRAME.width,
        imgH: (scene ? getRaw(scene.bg) : null)?.height || BASE_FRAME.height,
      };
      const current = clampView(viewRef.current, box.cssW, box.cssH, box.imgW, box.imgH);
      const fit = Math.min(box.cssW / box.imgW, box.cssH / box.imgH);
      const scale = fit * current.zoom;
      const panX = box.cssW / 2 - current.cx * box.imgW * scale;
      const panY = box.cssH / 2 - current.cy * box.imgH * scale;
      const ix = (sx - panX) / scale;
      const iy = (sy - panY) / scale;
      const zoom = Math.min(8, Math.max(1, current.zoom * factor));
      const newScale = fit * zoom;
      onViewChange(
        clampView(
          {
            zoom,
            cx: (box.cssW / 2 - (sx - ix * newScale)) / newScale / box.imgW,
            cy: (box.cssH / 2 - (sy - iy * newScale)) / newScale / box.imgH,
          },
          box.cssW,
          box.cssH,
          box.imgW,
          box.imgH,
        ),
      );
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      wrap.removeEventListener("wheel", onWheel);
    };
  }, [scene, frameIndex, revision, view, activeOverlays, getRaw, getOverlayBitmap, onViewChange]);

  function point(event: { clientX: number; clientY: number }) {
    const rect = wrapRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  }

  function size() {
    const rect = wrapRef.current?.getBoundingClientRect();
    const bg = scene ? getRaw(scene.bg) : null;
    return {
      cssW: rect?.width ?? 1,
      cssH: rect?.height ?? 1,
      imgW: bg?.width || BASE_FRAME.width,
      imgH: bg?.height || BASE_FRAME.height,
    };
  }

  function updateView(next: ViewState) {
    const box = size();
    onViewChange(clampView(next, box.cssW, box.cssH, box.imgW, box.imgH));
  }

  function zoomAt(sx: number, sy: number, nextZoom: number) {
    const box = size();
    const current = clampView(viewRef.current, box.cssW, box.cssH, box.imgW, box.imgH);
    const fit = Math.min(box.cssW / box.imgW, box.cssH / box.imgH);
    const scale = fit * current.zoom;
    const panX = box.cssW / 2 - current.cx * box.imgW * scale;
    const panY = box.cssH / 2 - current.cy * box.imgH * scale;
    const ix = (sx - panX) / scale;
    const iy = (sy - panY) / scale;
    const zoom = Math.min(8, Math.max(1, nextZoom));
    const newScale = fit * zoom;
    const newPanX = sx - ix * newScale;
    const newPanY = sy - iy * newScale;
    updateView({
      zoom,
      cx: (box.cssW / 2 - newPanX) / newScale / box.imgW,
      cy: (box.cssH / 2 - newPanY) / newScale / box.imgH,
    });
  }

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 touch-none"
      onPointerDown={(event) => {
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        const at = point(event);
        pointers.current.set(event.pointerId, at);
        gesture.current.moved = false;
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          gesture.current.mode = "pinch";
          gesture.current.lastDist = Math.hypot(a.x - b.x, a.y - b.y);
        } else {
          gesture.current.mode = "pan";
          gesture.current.lastX = at.x;
          gesture.current.lastY = at.y;
        }
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return;
        const at = point(event);
        pointers.current.set(event.pointerId, at);
        const box = size();
        if (pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          if (gesture.current.lastDist > 0) {
            zoomAt(midX, midY, viewRef.current.zoom * (dist / gesture.current.lastDist));
          }
          gesture.current.lastDist = dist;
          gesture.current.moved = true;
          return;
        }
        if (gesture.current.mode !== "pan") return;
        const dx = at.x - gesture.current.lastX;
        const dy = at.y - gesture.current.lastY;
        if (Math.hypot(dx, dy) > 2) gesture.current.moved = true;
        gesture.current.lastX = at.x;
        gesture.current.lastY = at.y;
        if (viewRef.current.zoom <= 1.001) return;
        const fit = Math.min(box.cssW / box.imgW, box.cssH / box.imgH);
        const scale = fit * viewRef.current.zoom;
        updateView({
          zoom: viewRef.current.zoom,
          cx: viewRef.current.cx - dx / scale / box.imgW,
          cy: viewRef.current.cy - dy / scale / box.imgH,
        });
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) gesture.current.lastDist = 0;
        if (pointers.current.size === 0) gesture.current.mode = "none";
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        gesture.current.mode = "none";
      }}
      onDoubleClick={(event) => {
        const at = point(event);
        if (viewRef.current.zoom > 1.05) onViewChange(DEFAULT_VIEW);
        else zoomAt(at.x, at.y, 2);
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" role="img" aria-label="Live DFW weather radar" />
    </div>
  );
}
