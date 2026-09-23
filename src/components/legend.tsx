import { rgbaCss } from "@/lib/radar/palette";
import type { EnhanceTable } from "@/lib/radar/types";

export function ColorLegend({
  table,
  hideClutter,
}: {
  table: EnhanceTable | null;
  hideClutter: boolean;
}) {
  if (!table) return null;
  const stops = table.stops.filter((stop) => {
    if (stop.from === 0 && stop.to === 0) return false;
    if (hideClutter && table.clutterCutoff != null && stop.to < table.clutterCutoff) return false;
    if (stop.color.a < 40 && (stop.lo == null || stop.lo < 0.05)) return false;
    return true;
  });
  if (stops.length === 0) return null;

  return (
    <div className="pointer-events-none max-w-[min(100%,28rem)]">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[10px] tracking-wide text-white/70 uppercase">
        <span>{table.name.replace(/,.*/, "")}</span>
        <span>in/hr</span>
      </div>
      <div className="flex overflow-hidden rounded-full ring-1 ring-white/15">
        {stops.map((stop) => (
          <div
            key={`${stop.from}-${stop.short}`}
            className="h-2 min-w-2 flex-1"
            style={{ background: rgbaCss({ ...stop.color, a: 255 }) }}
            title={stop.label}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/75">
        <span>{stops[0]?.short}</span>
        <span>{stops[Math.floor(stops.length / 2)]?.short}</span>
        <span>{stops[stops.length - 1]?.short}</span>
      </div>
    </div>
  );
}
