"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { REGIONS } from "@/lib/radar/regions";
import type { Settings } from "@/lib/storage";

type Props = {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onResetZoom: () => void;
  onRegion: (regionId: string) => void;
};

export function SettingsSheet({ settings, onChange, onResetZoom, onRegion }: Props) {
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
