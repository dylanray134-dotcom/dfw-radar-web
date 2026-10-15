"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { REGIONS } from "@/lib/radar/regions";
import { REFRESH_CHOICES, type Settings } from "@/lib/storage";

type Props = {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onResetZoom: () => void;
  onRegion: (regionId: string) => void;
};

export function SettingsSheet({ settings, onChange, onResetZoom, onRegion }: Props) {
  const [wakeLockSupported, setWakeLockSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setWakeLockSupported(typeof navigator.wakeLock?.request === "function");
  }, []);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Animation speed</h3>
          <span className="font-mono text-xs text-muted-foreground">{settings.dwellMs} ms</span>
        </div>
        <Slider
          min={80}
          max={800}
          step={10}
          value={[settings.dwellMs]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            onChange({ dwellMs: next });
          }}
          aria-label="Frame dwell"
        />
        <p className="text-xs text-muted-foreground">
          How long each sweep stays on screen. The newest frame holds a little longer before the loop repeats.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Auto-refresh</h3>
        <div role="radiogroup" aria-label="Auto-refresh interval" className="grid grid-cols-2 gap-2">
          {REFRESH_CHOICES.map((choice) => {
            const selected = settings.refreshMinutes === choice.minutes;
            return (
              <Button
                key={choice.minutes}
                type="button"
                role="radio"
                aria-checked={selected}
                variant={selected ? "default" : "secondary"}
                className="h-9"
                onClick={() => onChange({ refreshMinutes: choice.minutes })}
              >
                {choice.label}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          While this tab is visible, pull new radar frames on this cadence, and weather when a place is set. Off
          refreshes only when the page loads or you refresh by hand. Changing the interval starts the timer over.
        </p>
      </section>

      <section className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Remember zoom</p>
          <p className="text-xs text-muted-foreground">Keep pan and zoom for each region on this device.</p>
        </div>
        <Switch
          checked={settings.rememberZoom}
          onCheckedChange={(checked) => onChange({ rememberZoom: checked })}
          aria-label="Remember zoom"
        />
      </section>

      <section className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Hide dry-air clutter</p>
          <p className="text-xs text-muted-foreground">
            Radar Colors below 0.10 in/hr are drawn clear, so the dry KFWS disk does not look like rain.
          </p>
        </div>
        <Switch
          checked={settings.hideClutter}
          onCheckedChange={(checked) => onChange({ hideClutter: checked })}
          aria-label="Hide dry-air clutter"
        />
      </section>

      <section className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Keep screen on</p>
          <p className="text-xs text-muted-foreground">
            Hold a screen wake lock while this tab is visible so the display stays awake.
          </p>
          {settings.keepScreenOn && wakeLockSupported === false ? (
            <p className="mt-1 text-xs text-muted-foreground">
              This browser has no Screen Wake Lock. The preference is saved and does nothing here.
            </p>
          ) : null}
        </div>
        <Switch
          checked={settings.keepScreenOn}
          onCheckedChange={(checked) => onChange({ keepScreenOn: checked })}
          aria-label="Keep screen on"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Region</h3>
        <div className="grid grid-cols-2 gap-2">
          {REGIONS.map((region) => {
            const selected = region.id === settings.regionId;
            return (
              <Button
                key={region.id}
                type="button"
                variant={selected ? "default" : "secondary"}
                className="h-auto justify-start px-3 py-2 text-left"
                onClick={() => onRegion(region.id)}
              >
                <span className="flex flex-col items-start">
                  <span>{region.short}</span>
                  <span className={`text-[11px] font-normal ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {region.blurb}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </section>

      <Button type="button" variant="secondary" onClick={onResetZoom}>
        Reset zoom
      </Button>

      <section className="text-xs leading-relaxed text-muted-foreground">
        <p>
          Frames come from WFAA&apos;s MyOwnRadar CDN. Reflectivity is colorized in the browser with their Radar
          Colors table. The black navigation pad from the TV player is left off. Times are Central.
        </p>
        <p className="mt-2">
          Add DFW Radar to your Home Screen for a full-screen loop. Radar imagery is served by WFAA / TEGNA.
          Forecasts are from Open-Meteo.
        </p>
      </section>
    </div>
  );
}
