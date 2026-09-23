import { frameTimeFromName } from "./format";
import { parseEnhance } from "./palette";
import type { HiresLevel, Overlay, RadarFrame, Rect, Scene } from "./types";

const SECTION_BY_INDEX: Record<number, string> = {
  0: "Radar",
  1: "Radar",
  2: "Radar",
  3: "Radar",
  4: "Map",
  5: "Observations",
  6: "Observations",
  7: "Observations",
  8: "Observations",
  9: "Lightning",
  10: "Lightning",
  11: "Storms",
  12: "Storms",
  13: "Storms",
  14: "Storms",
  15: "Storms",
  16: "Storms",
  17: "Warnings",
  18: "Warnings",
  19: "Warnings",
  20: "Map",
};

export function parseConfig(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    if (key) values[key] = value;
  }
  return values;
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((part) => part.trim());
}

function slug(label: string): string {
  const id = label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return id || "layer";
}

function resolvePath(imageBase: string, file: string): string {
  const base = imageBase.replace(/^\.\.\//, "").replace(/\/$/, "");
  const combined = file.startsWith("../")
    ? file.replace(/^\.\.\//, "")
    : `${base}/${file.replace(/^\.\//, "")}`;
  const parts: string[] = [];
  for (const part of combined.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function parsePreserve(listRaw: string | undefined, rectRaw: string | undefined): (Rect | null)[] {
  const flags = splitList(listRaw);
  const nums = splitList(rectRaw)
    .map((n) => Number.parseFloat(n))
    .filter((n) => Number.isFinite(n));
  const rects: Rect[] = [];
  for (let i = 0; i + 3 < nums.length; i += 4) {
    rects.push({ x0: nums[i], y0: nums[i + 1], x1: nums[i + 2], y1: nums[i + 3] });
  }
  const out: (Rect | null)[] = [];
  let cursor = 0;
  for (const flag of flags) {
    const on = flag.toLowerCase().startsWith("t") || flag.toLowerCase().startsWith("y");
    out.push(on ? (rects[cursor++] ?? null) : null);
  }
  return out;
}

function parseLabel(raw: string): { label: string; defaultOn: boolean; skip: boolean } {
  let label = raw.trim();
  if (label.startsWith("/")) label = label.slice(1).trim();
  let defaultOn = false;
  if (/\/always$/i.test(label)) {
    defaultOn = true;
    label = label.replace(/\/always$/i, "").trim();
  } else if (/\/on$/i.test(label)) {
    defaultOn = true;
    label = label.replace(/\/on$/i, "").trim();
  }
  label = label.replace(/\/.*$/, "").trim();
  const skip = label.toLowerCase() === "navigation";
  return { label, defaultOn, skip };
}

export function parseScene(
  regionId: string,
  configText: string,
  dataText: string,
  enhanceText: string,
): Scene {
  const config = parseConfig(configText);
  const tables = parseEnhance(enhanceText);
  const labels = splitList(config.overlay_labels);
  const tips = splitList(config.overlay_tooltip);
  const radios = splitList(config.overlay_radio);
  const enhance = splitList(config.auto_enhance);
  const amounts = splitList(config.overlay_transparent_amount);
  const order = splitList(config.overlay_order).map((n) => Number.parseInt(n, 10) - 1);
  const legends = parsePreserve(config.overlay_preserve_list, config.overlay_preserve);
  const drawOrder = new Map<number, number>();
  order.forEach((index, position) => {
    if (Number.isFinite(index)) drawOrder.set(index, position);
  });

  const overlays: Overlay[] = [];
  labels.forEach((raw, index) => {
    const parsed = parseLabel(raw);
    if (!parsed.label || parsed.skip) return;
    const radio = radios[index] ?? "";
    const slash = radio.indexOf("/");
    const group = slash === -1 ? null : radio.slice(slash + 1).trim() || null;
    const enhRaw = Number.parseInt(enhance[index] ?? "0", 10);
    const enhanceIndex = Number.isFinite(enhRaw) && enhRaw > 0 ? enhRaw - 1 : null;
    const opacityRaw = Number.parseFloat(amounts[index] ?? "100");
    const opacity = Number.isFinite(opacityRaw) ? Math.min(1, Math.max(0, opacityRaw / 100)) : 1;
    overlays.push({
      index,
      id: slug(parsed.label),
      label: parsed.label,
      description: (tips[index] ?? parsed.label).trim(),
      section: SECTION_BY_INDEX[index] ?? "Layers",
      defaultOn: parsed.defaultOn,
      group,
      enhanceIndex: enhanceIndex != null && enhanceIndex < tables.length ? enhanceIndex : null,
      opacity,
      legend: legends[index] ?? null,
      drawOrder: drawOrder.get(index) ?? index + 100,
    });
  });

  let imageBase = `${regionId}/`;
  const frameLines: string[] = [];
  let hiresBg: string[] = [];
  let hiresFg: string[] = [];
  let hiresZooms: number[] = [];
  let fgOverlayIndex = 4;

  for (const raw of dataText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    if (key === "image_base") {
      imageBase = value;
    } else if (key === "bg.jpg overlay") {
      frameLines.push(value);
    } else if (key === "high_res_basemap") {
      hiresBg = splitList(value);
    } else if (key === "high_res_overlay") {
      const parts = splitList(value);
      const maybeIndex = Number.parseInt(parts[0] ?? "", 10);
      if (Number.isFinite(maybeIndex) && !parts[0].includes(".")) {
        fgOverlayIndex = maybeIndex - 1;
        hiresFg = parts.slice(1);
      } else {
        hiresFg = parts;
      }
    } else if (key === "high_res_zoom") {
      hiresZooms = splitList(value)
        .map((n) => Number.parseFloat(n))
        .filter((n) => Number.isFinite(n) && n > 1);
    }
  }

  const frames: RadarFrame[] = frameLines.map((line, index) => {
    const files = splitList(line).map((file) => resolvePath(imageBase, file));
    const timed = files.map(frameTimeFromName).find((time) => time != null) ?? null;
    return { index, files, time: timed };
  });

  const hires: HiresLevel[] = hiresZooms.map((zoom, index) => ({
    zoom,
    bg: hiresBg[index] ? resolvePath(imageBase, hiresBg[index]) : null,
    fg: hiresFg[index] ? resolvePath(imageBase, hiresFg[index]) : null,
    fgOverlayIndex,
  }));

  return {
    regionId,
    bg: resolvePath(imageBase, "bg.jpg"),
    frames,
    overlays,
    tables,
    hires,
  };
}

export function isOverlayOn(overlay: Overlay, overrides: Record<string, boolean>): boolean {
  if (Object.prototype.hasOwnProperty.call(overrides, overlay.id)) return overrides[overlay.id];
  return overlay.defaultOn;
}

export function apiUrl(path: string): string {
  return `/api/wfaa/${path.split("/").map(encodeURIComponent).join("/")}`;
}
