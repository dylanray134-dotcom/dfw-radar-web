import type { EnhanceTable, PaletteStop, Rgba } from "./types";

const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };

function emptyLut(): Rgba[] {
  return Array.from({ length: 256 }, () => ({ ...TRANSPARENT }));
}

function shortLabel(text: string, lo: number | null): string {
  if (lo == null) {
    if (/very large/i.test(text)) return "XL";
    if (/large hail/i.test(text)) return "Lg";
    if (/moderate hail/i.test(text)) return "Hail";
    if (/torrential/i.test(text)) return "Flood";
    if (/insignificant/i.test(text)) return "—";
    const word = text.replace(/=/g, "").trim().split(/\s+/)[0];
    return word ? word.slice(0, 8) : "•";
  }
  if (lo >= 10) return Math.round(lo).toString();
  if (lo >= 1) return lo.toFixed(1).replace(/\.0$/, "");
  const trimmed = lo.toFixed(2).replace(/0$/, "");
  return trimmed.startsWith("0") ? trimmed.slice(1) : trimmed;
}

/**
 * Parse WFAA enhance_radar.txt the same way MORAnimator builds its lookup tables.
 * Radar Colors bins below ~0.10 in/hr are marked with clutterCutoff (gray index).
 */
export function parseEnhance(text: string): EnhanceTable[] {
  const tables: EnhanceTable[] = [];
  let current: EnhanceTable | null = null;
  let pending:
    | { kind: "text"; text: string }
    | { kind: "range"; lo: number; hi: number; prefix: string; unit: string }
    | null = null;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    if (rawLine.trim().length < 2) continue;
    let sr = rawLine.replace(/\s+/g, " ").trim();
    const hash = sr.indexOf("#");
    if (hash === 0) continue;
    if (hash > 0) sr = sr.slice(0, hash).trim();
    if (!sr) continue;

    if (sr.startsWith("*")) {
      const rest = sr.slice(1).trim();
      const comma = rest.indexOf(",");
      const name = (comma === -1 ? rest : rest.slice(0, comma)).trim();
      const missing = (comma === -1 ? "None" : rest.slice(comma + 1)).trim() || "None";
      current = {
        name,
        missing,
        lut: emptyLut(),
        clutterCutoff: null,
        stops: [],
      };
      tables.push(current);
      pending = null;
      continue;
    }

    if (!current) continue;

    let body = sr;
    const valInx = sr.toLowerCase().indexOf("value");
    if (valInx > 0) {
      const valString = sr.slice(valInx + 1);
      body = sr.slice(0, valInx).trim();
      const eq = valString.indexOf("=");
      const after = eq === -1 ? valString : valString.slice(eq + 1);
      const items = after.split(",");
      if (items.length === 1) {
        pending = { kind: "text", text: items[0].trim() };
      } else {
        const lo = Number.parseFloat(items[0].trim());
        const hi = Number.parseFloat(items[1].trim());
        const unit = items.length > 3 ? items[3].trim() : "";
        const prefix = items.length > 4 ? items[4].trim() : "Value =";
        pending = {
          kind: "range",
          lo,
          hi,
          prefix,
          unit,
        };
      }
    }

    const sp = body.split(" ").filter(Boolean);
    if (sp.length < 8) continue;
    const inlo = Number.parseInt(sp[0], 10);
    const inhi = Number.parseInt(sp[1], 10);
    if (!Number.isFinite(inlo) || !Number.isFinite(inhi)) continue;
    const rlo = Number.parseFloat(sp[2]);
    const rhi = Number.parseFloat(sp[3]);
    const glo = Number.parseFloat(sp[4]);
    const ghi = Number.parseFloat(sp[5]);
    const blo = Number.parseFloat(sp[6]);
    const bhi = Number.parseFloat(sp[7]);
    let alo = 255;
    let ahi = 255;
    if (sp.length > 9) {
      alo = Number.parseFloat(sp[8]);
      ahi = Number.parseFloat(sp[9]);
    }
    const indif = inhi - inlo;

    const isRadar = current.name.toLowerCase().startsWith("radar colors");
    if (
      isRadar &&
      pending?.kind === "range" &&
      pending.lo >= 0.099 &&
      current.clutterCutoff == null
    ) {
      current.clutterCutoff = inlo;
    }

    let label = current.missing;
    let lo: number | null = null;
    let hi: number | null = null;
    if (pending?.kind === "text") {
      label = pending.text || label;
    } else if (pending?.kind === "range") {
      lo = pending.lo;
      hi = pending.hi;
      const unit = pending.unit ? ` ${pending.unit}` : "";
      const prefix = pending.prefix.replace(/=/g, "").trim();
      label = `${prefix} ${pending.lo}–${pending.hi}${unit}`.trim();
    }

    const mid = indif === 0 ? 0 : 0.5;
    const color: Rgba = {
      r: Math.round(rlo + (rhi - rlo) * mid),
      g: Math.round(glo + (ghi - glo) * mid),
      b: Math.round(blo + (bhi - blo) * mid),
      a: Math.round(alo + (ahi - alo) * mid),
    };
    const stop: PaletteStop = {
      from: inlo,
      to: inhi,
      lo,
      hi,
      label,
      short: shortLabel(label, lo),
      color,
    };
    if (inlo !== 0 || inhi !== 0) current.stops.push(stop);

    for (let k = inlo; k <= inhi && k < 256; k++) {
      if (k < 0) continue;
      if (indif === 0) {
        current.lut[k] = { r: rlo, g: glo, b: blo, a: alo };
      } else {
        const t = (k - inlo) / indif;
        current.lut[k] = {
          r: Math.round(rlo + (rhi - rlo) * t),
          g: Math.round(glo + (ghi - glo) * t),
          b: Math.round(blo + (bhi - blo) * t),
          a: Math.round(alo + (ahi - alo) * t),
        };
      }
    }
  }

  return tables;
}

export function rgbaCss(color: Rgba): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
}
