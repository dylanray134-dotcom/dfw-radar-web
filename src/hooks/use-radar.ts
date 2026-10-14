"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyPalette } from "@/lib/radar/colorize";
import { apiUrl, isOverlayOn, parseScene } from "@/lib/radar/parse";
import type { EnhanceTable, Overlay, Scene } from "@/lib/radar/types";

async function fetchText(path: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(apiUrl(path), { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.text();
}

async function fetchScene(regionId: string, signal: AbortSignal): Promise<Scene> {
  const dataText = await fetchText(`${regionId}/Latestdatafiles.txt`, signal);
  const configText = await fetchText(`${regionId}/Latestconfig.txt`, signal);
  let enhanceText: string;
  try {
    enhanceText = await fetchText(`${regionId}/enhance_radar.txt`, signal);
  } catch {
    enhanceText = await fetchText("metro40/enhance_radar.txt", signal);
  }
  return parseScene(regionId, configText, dataText, enhanceText);
}

function makeCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function paintBitmap(
  source: ImageBitmap,
  lut: EnhanceTable["lut"] | null,
  clutterCutoff: number | null,
  legend: Overlay["legend"],
): Promise<ImageBitmap> {
  const canvas = makeCanvas(source.width, source.height);
  const context = canvas.getContext("2d", { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, source.width, source.height);
  applyPalette(image.data, source.width, source.height, lut, clutterCutoff, legend);
  context.putImageData(image, 0, 0);
  return createImageBitmap(canvas);
}

function needsPaint(overlay: Overlay): boolean {
  return overlay.enhanceIndex != null || overlay.legend != null;
}

function paintKey(
  path: string,
  overlay: Overlay,
  tables: EnhanceTable[],
  hideClutter: boolean,
): string {
  const table = overlay.enhanceIndex == null ? null : tables[overlay.enhanceIndex];
  const cutoff = hideClutter && table?.clutterCutoff != null ? String(table.clutterCutoff) : "off";
  const legend = overlay.legend ? `${overlay.legend.x0}` : "";
  return `${path}|${overlay.enhanceIndex ?? "raw"}|${cutoff}|${legend}`;
}

function closeAll(bitmaps: Map<string, ImageBitmap>) {
  for (const bitmap of bitmaps.values()) bitmap.close();
  bitmaps.clear();
}

function retain(scene: Scene, raw: Map<string, ImageBitmap>, colored: Map<string, ImageBitmap>) {
  const keep = new Set<string>();
  keep.add(scene.bg);
  for (const level of scene.hires) {
    if (level.bg) keep.add(level.bg);
    if (level.fg) keep.add(level.fg);
  }
  for (const frame of scene.frames) {
    for (const file of frame.files) {
      if (file) keep.add(file);
    }
  }
  for (const [path, bitmap] of raw) {
    if (!keep.has(path)) {
      bitmap.close();
      raw.delete(path);
    }
  }
  for (const [key, bitmap] of colored) {
    const path = key.slice(0, key.indexOf("|"));
    if (!keep.has(path)) {
      bitmap.close();
      colored.delete(key);
    }
  }
}

export function useRadar(
  regionId: string | null,
  layerOverrides: Record<string, boolean>,
  hideClutter: boolean,
  zoom: number,
) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [progress, setProgress] = useState(0);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const cache = useRef(new Map<string, ImageBitmap>());
  const painted = useRef(new Map<string, ImageBitmap>());
  const sceneRef = useRef<Scene | null>(null);
  const frameRef = useRef(0);
  frameRef.current = frameIndex;
  sceneRef.current = scene;

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    if (!regionId) return;
    const controller = new AbortController();
    const previous = sceneRef.current;
    const sameRegion = previous?.regionId === regionId;
    if (!sameRegion) {
      setScene(null);
      setStatus("loading");
      setError(null);
      setProgress(0);
    } else {
      setRefreshing(true);
    }
    setRefreshError(null);

    void (async () => {
      try {
        const next = await fetchScene(regionId, controller.signal);
        if (controller.signal.aborted) return;
        let nextFrame = Math.max(0, next.frames.length - 1);
        if (previous && previous.regionId === regionId && previous.frames.length > 0) {
          const prevFrame = previous.frames[Math.min(frameRef.current, previous.frames.length - 1)];
          const prevTime = prevFrame?.time?.getTime();
          const match =
            prevTime == null ? -1 : next.frames.findIndex((frame) => frame.time?.getTime() === prevTime);
          const wasAtEnd = frameRef.current >= previous.frames.length - 1;
          if (match >= 0) nextFrame = match;
          else if (!wasAtEnd) nextFrame = Math.min(frameRef.current, Math.max(0, next.frames.length - 1));
        }
        if (!sameRegion) {
          closeAll(cache.current);
          closeAll(painted.current);
        } else {
          retain(next, cache.current, painted.current);
        }
        setScene(next);
        setFrameIndex(nextFrame);
        setSyncedAt(new Date());
        setStatus("ready");
        setRefreshing(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Could not load radar";
        if (sameRegion && previous) {
          setRefreshError("Couldn't refresh frames. Showing the last loop.");
          setRefreshing(false);
        } else {
          setError(message);
          setStatus("error");
          setRefreshing(false);
        }
      }
    })();

    return () => controller.abort();
  }, [regionId, refreshToken]);

  const activeIds = scene
    ? scene.overlays.filter((overlay) => isOverlayOn(overlay, layerOverrides)).map((overlay) => overlay.id)
    : [];
  const activeKey = activeIds.join("|");
  const hiresKey = scene
    ? scene.hires
        .filter((level) => zoom + 0.05 >= level.zoom * 0.8)
        .flatMap((level) => [level.bg, level.fg])
        .filter((path): path is string => Boolean(path))
        .join("|")
    : "";

  useEffect(() => {
    if (!scene) return;
    const controller = new AbortController();
    const tables = scene.tables;
    const wanted: { path: string; overlay: Overlay | null }[] = [{ path: scene.bg, overlay: null }];
    if (hiresKey) {
      for (const path of hiresKey.split("|")) wanted.push({ path, overlay: null });
    }
    const active = new Set(activeKey ? activeKey.split("|") : []);
    for (const overlay of scene.overlays) {
      if (!active.has(overlay.id)) continue;
      const unique = new Set<string>();
      for (const frame of scene.frames) {
        const path = frame.files[overlay.index];
        if (path) unique.add(path);
      }
      for (const path of unique) wanted.push({ path, overlay });
    }

    const isReady = (item: { path: string; overlay: Overlay | null }) => {
      if (!cache.current.has(item.path)) return false;
      if (!item.overlay || !needsPaint(item.overlay)) return true;
      return painted.current.has(paintKey(item.path, item.overlay, tables, hideClutter));
    };

    let done = wanted.filter(isReady).length;
    setProgress(wanted.length === 0 ? 1 : done / wanted.length);
    const queue = wanted.filter((item) => !isReady(item));
    let cursor = 0;

    const bump = () => {
      if (controller.signal.aborted) return;
      setProgress(wanted.length === 0 ? 1 : Math.min(1, done / wanted.length));
      setRevision((value) => value + 1);
    };

    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor];
        cursor += 1;
        if (controller.signal.aborted) return;
        try {
          let raw = cache.current.get(item.path);
          if (!raw) {
            const response = await fetch(apiUrl(item.path), { signal: controller.signal });
            if (!response.ok) throw new Error(String(response.status));
            raw = await createImageBitmap(await response.blob());
            cache.current.set(item.path, raw);
          }
          if (item.overlay && needsPaint(item.overlay)) {
            const key = paintKey(item.path, item.overlay, tables, hideClutter);
            if (!painted.current.has(key)) {
              const table =
                item.overlay.enhanceIndex == null ? null : (tables[item.overlay.enhanceIndex] ?? null);
              const cutoff = hideClutter && table ? table.clutterCutoff : null;
              const bitmap = await paintBitmap(raw, table?.lut ?? null, table ? cutoff : null, item.overlay.legend);
              painted.current.set(key, bitmap);
            }
          }
        } catch {
          if (controller.signal.aborted) return;
        }
        done += 1;
        bump();
      }
    };

    const poolSize = Math.min(4, queue.length);
    if (poolSize === 0) bump();
    else void Promise.all(Array.from({ length: poolSize }, () => worker()));

    return () => controller.abort();
  }, [scene, activeKey, hideClutter, hiresKey]);

  const getRaw = useCallback((path: string | null | undefined) => {
    if (!path) return null;
    return cache.current.get(path) ?? null;
  }, []);

  const getOverlayBitmap = useCallback(
    (overlay: Overlay, index: number) => {
      if (!scene) return null;
      const path = scene.frames[index]?.files[overlay.index];
      if (!path) return null;
      if (needsPaint(overlay)) {
        return painted.current.get(paintKey(path, overlay, scene.tables, hideClutter)) ?? null;
      }
      return cache.current.get(path) ?? null;
    },
    [scene, hideClutter],
  );

  return {
    scene,
    status,
    error,
    refreshing,
    refreshError,
    frameIndex,
    setFrameIndex,
    revision,
    progress,
    syncedAt,
    refresh,
    getRaw,
    getOverlayBitmap,
  };
}
