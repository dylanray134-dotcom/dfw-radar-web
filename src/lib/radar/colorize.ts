import type { Rect, Rgba } from "./types";
import { BASE_FRAME } from "./types";

/**
 * Colorize grayscale reflectivity in place.
 * Gray pixels below clutterCutoff become transparent (dry-air / ground clutter).
 * The baked-in WFAA legend rectangle is cleared so it is not drawn as echo.
 */
export function applyPalette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  lut: Rgba[] | null,
  clutterCutoff: number | null,
  legend: Rect | null,
): void {
  if (lut) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r !== g || g !== b) continue;
      if (clutterCutoff != null && r < clutterCutoff) {
        data[i + 3] = 0;
        continue;
      }
      const c = lut[r];
      if (!c) {
        data[i + 3] = 0;
        continue;
      }
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
      data[i + 3] = c.a;
    }
  }

  if (!legend || width <= 0 || height <= 0) return;
  const sx = width / BASE_FRAME.width;
  const sy = height / BASE_FRAME.height;
  const x0 = Math.max(0, Math.floor(Math.min(legend.x0, legend.x1) * sx));
  const y0 = Math.max(0, Math.floor(Math.min(legend.y0, legend.y1) * sy));
  const x1 = Math.min(width - 1, Math.ceil(Math.max(legend.x0, legend.x1) * sx));
  const y1 = Math.min(height - 1, Math.ceil(Math.max(legend.y0, legend.y1) * sy));
  for (let y = y0; y <= y1; y++) {
    let i = (y * width + x0) * 4 + 3;
    for (let x = x0; x <= x1; x++) {
      data[i] = 0;
      i += 4;
    }
  }
}
