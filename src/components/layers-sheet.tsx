"use client";

import { Switch } from "@/components/ui/switch";
import type { Overlay } from "@/lib/radar/types";

const SECTION_ORDER = ["Radar", "Map", "Observations", "Lightning", "Storms", "Warnings", "Layers"];

type Props = {
  overlays: Overlay[];
  isOn: (overlay: Overlay) => boolean;
  onToggle: (overlay: Overlay) => void;
};

export function LayersSheet({ overlays, isOn, onToggle }: Props) {
  const sections = SECTION_ORDER.map((title) => ({
    title,
    items: overlays.filter((overlay) => overlay.section === title),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <p className="text-sm text-muted-foreground">
        WFAA overlays for this loop. Reflectivity, rainfall, hail, and rotation tracks share one slot so the
        colors stay readable.
      </p>
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-[0.14em] text-primary uppercase">{section.title}</h3>
          <ul className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {section.items.map((overlay) => {
              const on = isOn(overlay);
              return (
                <li
                  key={overlay.id}
                  className="flex items-center gap-3 border-b border-white/8 px-3 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{overlay.label}</p>
                    <p className="text-xs text-muted-foreground">{overlay.description}</p>
                  </div>
                  <Switch
                    checked={on}
                    onCheckedChange={() => onToggle(overlay)}
                    aria-label={overlay.label}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
