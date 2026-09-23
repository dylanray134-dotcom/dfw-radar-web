"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudSun, Layers, RotateCcw, Settings as SettingsIcon } from "lucide-react";
import { ColorLegend } from "@/components/legend";
import { LocationPrompt } from "@/components/location-prompt";
import { LayersSheet } from "@/components/layers-sheet";
import { RadarMark } from "@/components/radar-mark";
import { RadarStage } from "@/components/radar-stage";
import { SettingsSheet } from "@/components/settings-sheet";
import { TransportBar } from "@/components/transport-bar";
import { WeatherSheet } from "@/components/weather-sheet";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRadar } from "@/hooks/use-radar";
import { useWeather } from "@/hooks/use-weather";
import { formatClock, formatFrameStamp } from "@/lib/radar/format";
import { isOverlayOn } from "@/lib/radar/parse";
import { regionById, REGIONS } from "@/lib/radar/regions";
import type { Overlay, ViewState } from "@/lib/radar/types";
import { DEFAULT_VIEW } from "@/lib/radar/types";
import {
  DFW_POINT,
  loadSettings,
  saveSettings,
  viewFor,
  type CustomPoint,
  type LocationMode,
  type Settings,
} from "@/lib/storage";
import { DEFAULT_SETTINGS } from "@/lib/storage";

type SheetId = "weather" | "layers" | "settings";

function isSheet(value: string | null): value is SheetId {
  return value === "weather" || value === "layers" || value === "settings";
}

export function RadarApp() {
  const params = useSearchParams();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [playing, setPlaying] = useState(false);
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [panel, setPanel] = useState<SheetId>("settings");
  const [regionOpen, setRegionOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [weatherToken, setWeatherToken] = useState(0);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    const stored = loadSettings();
    setSettings(stored);
    setView(viewFor(stored, stored.regionId));
    const requested = params.get("sheet");
    if (isSheet(requested)) setSheet(requested);
    setHydrated(true);
  }, [params]);

  useEffect(() => {
    if (hydrated) saveSettings(settings);
  }, [settings, hydrated]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const radar = useRadar(hydrated ? settings.regionId : null, settings.layers, settings.hideClutter, view.zoom);
  const weather = useWeather(hydrated ? settings.locationMode : "prompt", settings.customPoint, weatherToken);

  const refresh = radar.refresh;
  const setFrameIndex = radar.setFrameIndex;
  const frameIndex = radar.frameIndex;
  const frameCount = radar.scene?.frames.length ?? 0;
  const syncedRef = useRef(radar.syncedAt);
  syncedRef.current = radar.syncedAt;

  useEffect(() => {
    if (radar.status !== "ready" || booted.current) return;
    booted.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(!reduce);
  }, [radar.status]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => refresh(), 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const synced = syncedRef.current?.getTime() ?? 0;
      if (Date.now() - synced > 5 * 60 * 1000) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hydrated, refresh]);

  useEffect(() => {
    if (!playing || frameCount === 0) return;
    const atEnd = frameIndex >= frameCount - 1;
    const delay = atEnd ? settings.dwellMs + 500 : settings.dwellMs;
    const timer = window.setTimeout(() => {
      setFrameIndex((index) => (index + 1) % frameCount);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, frameIndex, frameCount, settings.dwellMs, setFrameIndex]);

  useEffect(() => {
    if (!hydrated || !settings.rememberZoom) return;
    const timer = window.setTimeout(() => {
      setSettings((current) => {
        const existing = current.views[current.regionId];
        if (existing && existing.zoom === view.zoom && existing.cx === view.cx && existing.cy === view.cy) {
          return current;
        }
        return { ...current, views: { ...current.views, [current.regionId]: view } };
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [view, hydrated, settings.rememberZoom, settings.regionId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (frameCount === 0) return;
      if (event.key === " " || event.key === "k") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === "ArrowRight") {
        setPlaying(false);
        setFrameIndex((index) => Math.min(frameCount - 1, index + 1));
      } else if (event.key === "ArrowLeft") {
        setPlaying(false);
        setFrameIndex((index) => Math.max(0, index - 1));
      } else if (event.key === "Home") {
        setPlaying(false);
        setFrameIndex(0);
      } else if (event.key === "End") {
        setPlaying(false);
        setFrameIndex(Math.max(0, frameCount - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frameCount, setFrameIndex]);

  const openSheet = useCallback((next: SheetId | null) => {
    if (next) setPanel(next);
    setSheet(next);
    setRegionOpen(false);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("sheet", next);
    else url.searchParams.delete("sheet");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

  const onViewChange = useCallback((next: ViewState) => setView(next), []);

  const activeOverlays = useMemo(() => {
    if (!radar.scene) return [];
    return radar.scene.overlays.filter((overlay) => isOverlayOn(overlay, settings.layers));
  }, [radar.scene, settings.layers]);

  const legendTable = useMemo(() => {
    if (!radar.scene) return null;
    const enhanced = activeOverlays
      .filter((overlay) => overlay.enhanceIndex != null)
      .sort((a, b) => b.drawOrder - a.drawOrder);
    const overlay = enhanced[0];
    if (!overlay || overlay.enhanceIndex == null) return null;
    return radar.scene.tables[overlay.enhanceIndex] ?? null;
  }, [radar.scene, activeOverlays]);

  const frame = radar.scene?.frames[radar.frameIndex];
  const stamp = frame?.time ? formatFrameStamp(frame.time) : radar.syncedAt ? formatClock(radar.syncedAt) : "Loading sweep";
  const region = regionById(settings.regionId);

  function chooseRegion(regionId: string) {
    setRegionOpen(false);
    setSettings((current) => {
      const next = { ...current, regionId };
      setView(viewFor(next, regionId));
      return next;
    });
  }

  function toggleLayer(overlay: Overlay) {
    setSettings((current) => {
      if (!radar.scene) return current;
      const on = isOverlayOn(overlay, current.layers);
      const layers = { ...current.layers, [overlay.id]: !on };
      if (!on && overlay.group) {
        for (const other of radar.scene.overlays) {
          if (other.group === overlay.group && other.id !== overlay.id) layers[other.id] = false;
        }
      }
      return { ...current, layers };
    });
  }

  function setLocationMode(mode: LocationMode, customPoint?: CustomPoint | null) {
    setSettings((current) => ({
      ...current,
      locationMode: mode,
      customPoint: customPoint === undefined ? current.customPoint : customPoint,
    }));
    setWeatherToken((token) => token + 1);
  }

  const sheetSide = wide ? "right" : "bottom";

  return (
    <div className="relative h-dvh overflow-hidden bg-[#071018] text-white">
      <RadarStage
        scene={radar.scene}
        frameIndex={radar.frameIndex}
        revision={radar.revision}
        view={view}
        onViewChange={onViewChange}
        getRaw={radar.getRaw}
        getOverlayBitmap={radar.getOverlayBitmap}
        activeOverlays={activeOverlays}
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <header className="glass-bar pointer-events-auto pt-safe pl-safe pr-safe">
          <div className="mx-auto flex max-w-5xl items-center gap-1.5 px-1 py-2 sm:gap-2 sm:px-3">
            <RadarMark className="size-9 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm leading-none font-semibold tracking-wide">DFW Radar</p>
              <p className="mt-1 truncate text-[11px] text-white/60">WFAA · KFWS</p>
            </div>
            <div className="relative shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-expanded={regionOpen}
                onClick={() => setRegionOpen((open) => !open)}
              >
                {region.short}
              </Button>
              {regionOpen ? (
                <div className="absolute top-10 left-0 z-30 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0d1b24] shadow-2xl">
                  {REGIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/8 ${
                        item.id === region.id ? "text-primary" : "text-white"
                      }`}
                      onClick={() => chooseRegion(item.id)}
                    >
                      <span className="block">{item.name}</span>
                      <span className="block text-[11px] text-white/50">{item.blurb}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label="Weather"
                onClick={() => openSheet("weather")}
              >
                <CloudSun className="size-6" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label="Layers"
                onClick={() => openSheet("layers")}
              >
                <Layers className="size-6" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label="Settings"
                onClick={() => openSheet("settings")}
              >
                <SettingsIcon className="size-6" />
              </Button>
            </div>
          </div>
          {radar.progress < 1 && radar.status === "ready" ? (
            <div className="h-0.5 bg-white/10">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(radar.progress * 100)}%` }} />
            </div>
          ) : null}
        </header>

        <div className="flex flex-1 flex-col justify-end">
          {hydrated && settings.locationMode === "prompt" && sheet == null ? (
            <div className="pointer-events-auto mx-auto mb-3 w-full max-w-md px-3">
              <div className="rounded-2xl border border-white/10 bg-[#0c1822]/95 p-4 shadow-2xl backdrop-blur-md">
                <LocationPrompt
                  onAllow={() => {
                    setLocationMode("device");
                    openSheet("weather");
                  }}
                  onDismiss={() => setLocationMode("dfw", DFW_POINT)}
                />
              </div>
            </div>
          ) : null}
          <div className="pointer-events-none px-3 pb-2 pl-safe pr-safe">
            <div className="mx-auto flex max-w-5xl items-end justify-between gap-3">
              <ColorLegend table={legendTable} hideClutter={settings.hideClutter} />
              {view.zoom > 1.02 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="pointer-events-auto shrink-0"
                  onClick={() => setView(DEFAULT_VIEW)}
                >
                  <RotateCcw />
                  Reset zoom
                </Button>
              ) : (
                <span />
              )}
            </div>
          </div>
        </div>

        {radar.refreshError ? (
          <p className="pointer-events-none px-4 pb-1 text-center text-xs text-amber-200">{radar.refreshError}</p>
        ) : null}

        <div className="pointer-events-auto">
          <TransportBar
            frameIndex={radar.frameIndex}
            frameCount={radar.scene?.frames.length ?? 0}
            playing={playing}
            dwellMs={settings.dwellMs}
            stamp={stamp}
            refreshing={radar.refreshing}
            onFrame={(index) => {
              setPlaying(false);
              radar.setFrameIndex(index);
            }}
            onTogglePlay={() => setPlaying((value) => !value)}
            onDwell={(dwellMs) => setSettings((current) => ({ ...current, dwellMs }))}
            onRefresh={radar.refresh}
          />
        </div>
      </div>

      {radar.status === "loading" && !radar.scene ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#071018]/80">
          <RadarMark className="size-16 animate-pulse" />
          <p className="text-sm text-white/80">Pulling the latest KFWS sweep…</p>
        </div>
      ) : null}

      {radar.status === "error" ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#071018]/90 px-6 text-center">
          <RadarMark className="size-16" />
          <p className="max-w-sm text-sm text-white/80">
            Couldn&apos;t reach WFAA radar. Check the connection and try the loop again.
          </p>
          <Button type="button" onClick={radar.refresh}>
            Retry
          </Button>
        </div>
      ) : null}

      <Sheet open={sheet != null} onOpenChange={(open) => openSheet(open ? sheet : null)}>
        <SheetContent
          side={sheetSide}
          className="gap-0 overflow-y-auto border-white/10 bg-[#0c1822] data-[side=bottom]:max-h-[86dvh] data-[side=bottom]:rounded-t-3xl data-[side=right]:w-full sm:max-w-md"
        >
          <SheetHeader className="pr-10">
            <SheetTitle>
              {panel === "layers" ? "Layers" : panel === "weather" ? "Weather" : "Settings"}
            </SheetTitle>
            <SheetDescription>
              {panel === "layers"
                ? region.name
                : panel === "weather"
                  ? "Conditions for your location, or the metro if you skip it."
                  : "Saved on this device."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {panel === "layers" && radar.scene ? (
              <LayersSheet
                overlays={radar.scene.overlays}
                isOn={(overlay) => isOverlayOn(overlay, settings.layers)}
                onToggle={toggleLayer}
              />
            ) : null}
            {panel === "weather" ? (
              <WeatherSheet
                mode={settings.locationMode}
                weather={weather}
                onAllow={() => setLocationMode("device")}
                onUseDfw={() => setLocationMode("dfw", DFW_POINT)}
                onCustom={(point) => setLocationMode("custom", point)}
                onRefresh={() => setWeatherToken((token) => token + 1)}
              />
            ) : null}
            {panel === "settings" ? (
              <SettingsSheet
                settings={settings}
                onRegion={chooseRegion}
                onResetZoom={() => setView(DEFAULT_VIEW)}
                onChange={(partial) => {
                  if (partial.rememberZoom === false) setView(DEFAULT_VIEW);
                  setSettings((current) => ({ ...current, ...partial }));
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
