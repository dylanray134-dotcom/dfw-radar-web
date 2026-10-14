import { mercatorPixel } from "./geo";
import { imageToLatLon, type GeoBounds, type LambertProjection } from "./project";

type Point = { x: number; y: number };

export function concealRadarCanvas(canvas: HTMLCanvasElement) {
  canvas.dataset.radar = "0";
}

const COLS = 24;
const ROWS = 14;

function drawTriangle(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point,
) {
  const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denom) < 1e-6) return;
  const m11 = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom;
  const m12 = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom;
  const m21 = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom;
  const m22 = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom;
  const dx =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom;
  const dy =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom;
  context.save();
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.setTransform(m11, m21, m12, m22, dx, dy);
  context.drawImage(image, 0, 0);
  context.restore();
}

function inflate(a: Point, b: Point, c: Point): [Point, Point, Point] {
  const cx = (a.x + b.x + c.x) / 3;
  const cy = (a.y + b.y + c.y) / 3;
  const push = (point: Point): Point => {
    const dx = point.x - cx;
    const dy = point.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: point.x + (dx / len) * 0.75, y: point.y + (dy / len) * 0.75 };
  };
  return [push(a), push(b), push(c)];
}

/**
 * Paint `source` into `dest` so a lat/lng rectangle GroundOverlay matches the Lambert frame.
 * `frameWidth` / `frameHeight` are the projection's pixel size (the 750×422 product).
 */
export function warpToMercator(
  dest: HTMLCanvasElement,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  projection: LambertProjection,
  bounds: GeoBounds,
  frameWidth: number,
  frameHeight: number,
): void {
  const outW = Math.max(1, Math.round(sourceWidth));
  const outH = Math.max(1, Math.round(sourceHeight));
  if (dest.width !== outW || dest.height !== outH) {
    dest.width = outW;
    dest.height = outH;
  }
  const context = dest.getContext("2d");
  if (!context || !(sourceWidth > 0) || !(sourceHeight > 0)) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, outW, outH);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const src: Point[][] = [];
  const dst: (Point | null)[][] = [];
  for (let row = 0; row <= ROWS; row += 1) {
    const sy = (sourceHeight * row) / ROWS;
    const frameY = (frameHeight * row) / ROWS;
    src[row] = [];
    dst[row] = [];
    for (let col = 0; col <= COLS; col += 1) {
      const sx = (sourceWidth * col) / COLS;
      const frameX = (frameWidth * col) / COLS;
      src[row][col] = { x: sx, y: sy };
      const ll = imageToLatLon(projection, frameX, frameY);
      dst[row][col] = ll ? mercatorPixel(bounds, ll.lat, ll.lon, outW, outH) : null;
    }
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const s00 = src[row][col];
      const s10 = src[row][col + 1];
      const s01 = src[row + 1][col];
      const s11 = src[row + 1][col + 1];
      const d00 = dst[row][col];
      const d10 = dst[row][col + 1];
      const d01 = dst[row + 1][col];
      const d11 = dst[row + 1][col + 1];
      if (!d00 || !d10 || !d01 || !d11) continue;
      const [a0, b0, c0] = inflate(d00, d10, d01);
      const [a1, b1, c1] = inflate(d10, d11, d01);
      drawTriangle(context, source, s00, s10, s01, a0, b0, c0);
      drawTriangle(context, source, s10, s11, s01, a1, b1, c1);
    }
  }
  dest.dataset.radar = "1";
}
