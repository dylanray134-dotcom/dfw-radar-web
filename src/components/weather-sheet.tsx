"use client";

import { useState } from "react";
import { LocationPrompt } from "@/components/location-prompt";
import { SkyIcon } from "@/components/sky-icon";
import { Button } from "@/components/ui/button";
import { formatClock, compass } from "@/lib/radar/format";
import { DFW_POINT, type CustomPoint, type LocationMode } from "@/lib/storage";
import type { useWeather } from "@/hooks/use-weather";
import { RefreshCw } from "lucide-react";

type WeatherState = ReturnType<typeof useWeather>;

type Props = {
  mode: LocationMode;
  weather: WeatherState;
  onAllow: () => void;
  onUseDfw: () => void;
  onCustom: (point: CustomPoint) => void;
  onRefresh: () => void;
};

function hourLabel(stamp: string): string {
  const hour = Number(stamp.slice(11, 13));
  if (!Number.isFinite(hour)) return "";
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12} ${suffix}`;
}

function dayLabel(stamp: string, index: number): string {
  if (index === 0) return "Today";
  const [year, month, day] = stamp.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return stamp;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function round(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : "–";
}

export function WeatherSheet({ mode, weather, onAllow, onUseDfw, onCustom, onRefresh }: Props) {
  const [lat, setLat] = useState(String(DFW_POINT.lat));
  const [lon, setLon] = useState(String(DFW_POINT.lon));
  const [pointError, setPointError] = useState<string | null>(null);
  const { report, status, notice } = weather;

  if (mode === "prompt") {
    return (
      <div className="pb-6">
        <LocationPrompt onAllow={onAllow} onDismiss={onUseDfw} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {notice ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          {notice}
        </p>
      ) : null}

      {status === "error" && !report ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm">The forecast didn&apos;t load.</p>
          <Button type="button" className="mt-3" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      ) : null}

      {(status === "loading" || status === "locating") && !report ? (
        <div className="flex flex-col gap-3">
          <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
          <div className="h-16 w-28 animate-pulse rounded bg-white/10" />
          <p className="text-sm text-muted-foreground">
            {status === "locating" ? "Asking for your location…" : "Loading the forecast…"}
          </p>
        </div>
      ) : null}

      {report ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-medium">{report.place}</p>
              <p className="text-xs text-muted-foreground">
                Updated {formatClock(new Date(report.fetchedAt))}
                {weather.source === "dfw" ? " · Dallas–Fort Worth" : ""}
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={onRefresh} disabled={status === "loading"}>
              <RefreshCw className={status === "loading" ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-6xl leading-none tracking-tight">
                {round(report.current.temperature)}°
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm">
                <SkyIcon kind={report.current.kind} />
                {report.current.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Feels {round(report.current.feelsLike)}°
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Humidity</dt>
              <dd className="mt-1 font-medium">{round(report.current.humidity)}%</dd>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Wind</dt>
              <dd className="mt-1 font-medium">
                {round(report.current.wind)} mph {compass(report.current.windDirection)}
              </dd>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Precip</dt>
              <dd className="mt-1 font-medium">
                {Number.isFinite(report.current.precip) ? report.current.precip.toFixed(2) : "0.00"} in
              </dd>
            </div>
          </dl>

          {report.hourly.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-medium tracking-[0.14em] text-primary uppercase">Next hours</h3>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {report.hourly.map((hour) => (
                  <div
                    key={hour.time}
                    className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl bg-white/5 px-2 py-2 text-center"
                  >
                    <span className="text-[11px] text-muted-foreground">{hourLabel(hour.time)}</span>
                    <SkyIcon kind={hour.kind} className="size-4" />
                    <span className="font-medium">{round(hour.temperature)}°</span>
                    <span className="text-[10px] text-sky-200">{round(hour.precipChance)}%</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {report.daily.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-medium tracking-[0.14em] text-primary uppercase">Five days</h3>
              <ul className="flex flex-col divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">
                {report.daily.map((day, index) => (
                  <li key={day.time} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-12 text-muted-foreground">{dayLabel(day.time, index)}</span>
                    <SkyIcon kind={day.kind} className="size-4 text-white/80" />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{day.label}</span>
                    <span className="font-mono text-xs text-sky-200">{round(day.precipChance)}%</span>
                    <span className="font-mono">
                      {round(day.high)}° <span className="text-muted-foreground">{round(day.low)}°</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <section className="flex flex-col gap-2 border-t border-white/10 pt-4">
        <h3 className="text-xs font-medium tracking-[0.14em] text-primary uppercase">Location</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={mode === "device" ? "default" : "secondary"} onClick={onAllow}>
            Use my location
          </Button>
          <Button type="button" variant={mode === "dfw" ? "default" : "secondary"} onClick={onUseDfw}>
            Dallas–Fort Worth
          </Button>
        </div>
        <form
          className="mt-1 grid grid-cols-[1fr_1fr_auto] gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const nextLat = Number(lat);
            const nextLon = Number(lon);
            if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon) || Math.abs(nextLat) > 90 || Math.abs(nextLon) > 180) {
              setPointError("Enter a latitude and longitude.");
              return;
            }
            setPointError(null);
            onCustom({ lat: nextLat, lon: nextLon, name: "Pinned location" });
          }}
        >
          <input
            aria-label="Latitude"
            inputMode="decimal"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-sm"
            placeholder="Lat"
          />
          <input
            aria-label="Longitude"
            inputMode="decimal"
            value={lon}
            onChange={(event) => setLon(event.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-sm"
            placeholder="Lon"
          />
          <Button type="submit" variant="secondary">
            Use point
          </Button>
        </form>
        {pointError ? <p className="text-xs text-amber-200">{pointError}</p> : null}
        <p className="text-xs text-muted-foreground">
          Forecast from Open-Meteo. Place names from OpenStreetMap. No account required.
        </p>
      </section>
    </div>
  );
}
