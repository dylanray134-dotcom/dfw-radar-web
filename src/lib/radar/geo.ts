import type { GeoBounds } from "./project";

/** Web Mercator Y in radians. Latitude is clamped away from the poles. */
export function mercatorY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat));
  const s = Math.sin((clamped * Math.PI) / 180);
  return Math.log((1 + s) / (1 - s)) / 2;
}

export function boundsAspect(bounds: GeoBounds): number {
  const width = ((bounds.east - bounds.west) * Math.PI) / 180;
  const height = Math.abs(mercatorY(bounds.north) - mercatorY(bounds.south));
  if (!(width > 0) || !(height > 0)) return 1;
  return width / height;
}

/** Largest rectangle of `aspect` (width / height) that fits in the viewport. */
export function letterbox(
  viewportWidth: number,
  viewportHeight: number,
  aspect: number,
): { width: number; height: number } {
  const safeAspect = aspect > 0 ? aspect : 1;
  const vw = Math.max(1, viewportWidth);
  const vh = Math.max(1, viewportHeight);
  let width = vw;
  let height = width / safeAspect;
  if (height > vh) {
    height = vh;
    width = height * safeAspect;
  }
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

export type CoverageZoom = {
  /** Zoom where the bounds fit entirely inside the viewport. One axis may show area outside the bounds. */
  fit: number;
  /** Zoom where the viewport stays inside the bounds. This is the widest view that does not reveal anything past the data. */
  strict: number;
};

/**
 * Google/Leaflet zoom levels for a viewport of `widthPx` by `heightPx`.
 * World width at zoom z is 256 * 2^z pixels.
 */
export function coverageZoom(bounds: GeoBounds, widthPx: number, heightPx: number): CoverageZoom {
  const latFraction = Math.abs(mercatorY(bounds.north) - mercatorY(bounds.south)) / (2 * Math.PI);
  const lngFraction = Math.abs(bounds.east - bounds.west) / 360;
  const width = Math.max(1, widthPx);
  const height = Math.max(1, heightPx);
  const zLng = Math.log2(width / (Math.max(1e-12, lngFraction) * 256));
  const zLat = Math.log2(height / (Math.max(1e-12, latFraction) * 256));
  return { fit: Math.min(zLng, zLat), strict: Math.max(zLng, zLat) };
}

/** Widest zoom that keeps the viewport inside the region bounds. */
export function minZoomForBounds(bounds: GeoBounds, widthPx: number, heightPx: number): number {
  return coverageZoom(bounds, widthPx, heightPx).strict;
}

/** Pixel in a Web Mercator image that spans `bounds`. */
export function mercatorPixel(
  bounds: GeoBounds,
  lat: number,
  lon: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = ((lon - bounds.west) / (bounds.east - bounds.west)) * width;
  const yNorth = mercatorY(bounds.north);
  const ySouth = mercatorY(bounds.south);
  const y = ((yNorth - mercatorY(lat)) / (yNorth - ySouth)) * height;
  return { x, y };
}
