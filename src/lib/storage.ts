import type { ViewState } from "./radar/types";
import { DEFAULT_VIEW } from "./radar/types";

export type LocationMode = "prompt" | "device" | "dfw" | "custom";

export type CustomPoint = { lat: number; lon: number; name: string };

export const REFRESH_CHOICES = [
  { minutes: 0, label: "Off" },
  { minutes: 1, label: "1 minute" },
  { minutes: 2, label: "2 minutes" },
  { minutes: 5, label: "5 minutes" },
  { minutes: 10, label: "10 minutes" },
  { minutes: 15, label: "15 minutes" },
] as const;

export type RefreshMinutes = (typeof REFRESH_CHOICES)[number]["minutes"];

export type Settings = {
  regionId: string;
  dwellMs: number;
  rememberZoom: boolean;
  hideClutter: boolean;
  layers: Record<string, boolean>;
  views: Record<string, ViewState>;
  locationMode: LocationMode;
  customPoint: CustomPoint | null;
  refreshMinutes: RefreshMinutes;
  keepScreenOn: boolean;
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
  refreshMinutes: 5,
  keepScreenOn: false,
};

export function isRefreshMinutes(value: unknown): value is RefreshMinutes {
  return REFRESH_CHOICES.some((choice) => choice.minutes === value);
}

/** Milliseconds between auto-refreshes. Null means the loop is off. */
export function autoRefreshIntervalMs(minutes: RefreshMinutes): number | null {
  if (minutes <= 0) return null;
  return minutes * 60 * 1000;
}

/** A visible tab should catch up when the last sync is at least one interval old. */
export function shouldCatchUpRefresh(syncedAtMs: number | null, nowMs: number, intervalMs: number | null): boolean {
  if (intervalMs == null || syncedAtMs == null) return false;
  return nowMs - syncedAtMs >= intervalMs;
}

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
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function normalizeSettings(parsed: Partial<Settings> | null | undefined): Settings {
  const source = parsed ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    regionId: typeof source.regionId === "string" ? source.regionId : DEFAULT_SETTINGS.regionId,
    dwellMs: clampDwell(source.dwellMs ?? DEFAULT_SETTINGS.dwellMs),
    rememberZoom: source.rememberZoom !== false,
    hideClutter: source.hideClutter !== false,
    layers: source.layers && typeof source.layers === "object" ? source.layers : {},
    views: source.views && typeof source.views === "object" ? source.views : {},
    locationMode:
      source.locationMode === "device" || source.locationMode === "dfw" || source.locationMode === "custom"
        ? source.locationMode
        : "prompt",
    customPoint: source.customPoint ?? null,
    refreshMinutes: isRefreshMinutes(source.refreshMinutes) ? source.refreshMinutes : DEFAULT_SETTINGS.refreshMinutes,
    keepScreenOn: source.keepScreenOn === true,
  };
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
