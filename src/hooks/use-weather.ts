"use client";

import { useEffect, useState } from "react";
import type { SkyKind } from "@/lib/weather/codes";
import { DFW_POINT, type CustomPoint, type LocationMode } from "@/lib/storage";

export type WeatherHour = {
  time: string;
  temperature: number;
  precipChance: number;
  precip: number;
  code: number;
  label: string;
  kind: SkyKind;
};

export type WeatherDay = {
  time: string;
  high: number;
  low: number;
  precip: number;
  precipChance: number;
  code: number;
  label: string;
  kind: SkyKind;
};

export type WeatherReport = {
  place: string;
  latitude: number;
  longitude: number;
  fetchedAt: string;
  current: {
    time: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
    precip: number;
    wind: number;
    windDirection: number;
    isDay: boolean;
    code: number;
    label: string;
    kind: SkyKind;
  };
  hourly: WeatherHour[];
  daily: WeatherDay[];
};

async function readPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not share location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 5 * 60 * 1000,
    });
  });
}

export function useWeather(mode: LocationMode, customPoint: CustomPoint | null, requestToken: number) {
  const [report, setReport] = useState<WeatherReport | null>(null);
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "ready" | "error">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [source, setSource] = useState<"device" | "dfw" | "custom" | null>(null);

  useEffect(() => {
    if (mode === "prompt") {
      setStatus("idle");
      setNotice(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      let lat = DFW_POINT.lat;
      let lon = DFW_POINT.lon;
      let name = DFW_POINT.name;
      let nextSource: "device" | "dfw" | "custom" = "dfw";
      let nextNotice: string | null = null;

      if (mode === "custom" && customPoint) {
        lat = customPoint.lat;
        lon = customPoint.lon;
        name = customPoint.name || "Pinned location";
        nextSource = "custom";
      } else if (mode === "device") {
        setStatus("locating");
        try {
          const position = await readPosition();
          lat = position.coords.latitude;
          lon = position.coords.longitude;
          name = "Your location";
          nextSource = "device";
        } catch (error) {
          const code = typeof error === "object" && error && "code" in error ? Number(error.code) : 0;
          nextNotice =
            code === 1
              ? "Location is blocked in this browser. Showing Dallas–Fort Worth until you allow it."
              : "Couldn't read a location fix. Showing Dallas–Fort Worth instead.";
          nextSource = "dfw";
        }
      }

      if (cancelled) return;
      setSource(nextSource);
      setNotice(nextNotice);
      setStatus("loading");

      try {
        const response = await fetch(
          `/api/weather?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&name=${encodeURIComponent(name)}`,
        );
        const body = (await response.json()) as WeatherReport & { error?: string };
        if (!response.ok) throw new Error(body.error || "Weather did not load.");
        if (!cancelled) {
          setReport(body);
          setStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setNotice(error instanceof Error ? error.message : "Weather did not load.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, customPoint, requestToken]);

  return { report, status, notice, source };
}
