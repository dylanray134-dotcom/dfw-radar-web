import type { ViewState } from "./radar/types";
import { DEFAULT_VIEW } from "./radar/types";

export type LocationMode = "prompt" | "device" | "dfw" | "custom";

export type CustomPoint = { lat: number; lon: number; name: string };

export type Settings = {
  regionId: string;
  dwellMs: number;
  rememberZoom: boolean;
  hideClutter: boolean;
  layers: Record<string, boolean>;
  views: Record<string, ViewState>;
  locationMode: LocationMode;
  customPoint: CustomPoint | null;
};

export const SETTINGS_KEY = "dfw-radar-v1";

export const DEFAULT_SETTINGS: Settings = {
  regionId: "metro40",
  dwellMs: 250,
  rememberZoom: true,
  hideClutter: true,
  layers: {},
  views: {},
  locationMode: "prompt",
  customPoint: null,
};

export const DFW_POINT: CustomPoint = {
  lat: 32.7767,
  lon: -96.797,
  name: "Dallas–Fort Worth",
};

function clampDwell(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.dwellMs;
  return Math.min(800, Math.max(80, Math.round(value)));
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      regionId: typeof parsed.regionId === "string" ? parsed.regionId : DEFAULT_SETTINGS.regionId,
      dwellMs: clampDwell(parsed.dwellMs ?? DEFAULT_SETTINGS.dwellMs),
      rememberZoom: parsed.rememberZoom !== false,
      hideClutter: parsed.hideClutter !== false,
      layers: parsed.layers && typeof parsed.layers === "object" ? parsed.layers : {},
      views: parsed.views && typeof parsed.views === "object" ? parsed.views : {},
      locationMode:
        parsed.locationMode === "device" ||
        parsed.locationMode === "dfw" ||
        parsed.locationMode === "custom"
          ? parsed.locationMode
          : "prompt",
      customPoint: parsed.customPoint ?? null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function viewFor(settings: Settings, regionId: string): ViewState {
  if (!settings.rememberZoom) return DEFAULT_VIEW;
  const saved = settings.views[regionId];
  if (!saved || !Number.isFinite(saved.zoom)) return DEFAULT_VIEW;
  return {
    zoom: Math.min(8, Math.max(1, saved.zoom)),
    cx: Number.isFinite(saved.cx) ? saved.cx : 0.5,
    cy: Number.isFinite(saved.cy) ? saved.cy : 0.5,
  };
}
