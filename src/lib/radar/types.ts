export type Rgba = { r: number; g: number; b: number; a: number };

export type PaletteStop = {
  from: number;
  to: number;
  lo: number | null;
  hi: number | null;
  label: string;
  short: string;
  color: Rgba;
};

export type EnhanceTable = {
  name: string;
  missing: string;
  lut: Rgba[];
  /** Gray index where Radar Colors reaches ~0.10 in/hr. Null for other products. */
  clutterCutoff: number | null;
  stops: PaletteStop[];
};

export type Rect = { x0: number; y0: number; x1: number; y1: number };

export type Overlay = {
  index: number;
  id: string;
  label: string;
  description: string;
  section: string;
  defaultOn: boolean;
  group: string | null;
  enhanceIndex: number | null;
  opacity: number;
  legend: Rect | null;
  drawOrder: number;
};

export type RadarFrame = {
  index: number;
  files: string[];
  time: Date | null;
};

export type HiresLevel = {
  zoom: number;
  bg: string | null;
  fg: string | null;
  fgOverlayIndex: number;
};

export type Scene = {
  regionId: string;
  bg: string;
  frames: RadarFrame[];
  overlays: Overlay[];
  tables: EnhanceTable[];
  hires: HiresLevel[];
};

export type ViewState = {
  zoom: number;
  cx: number;
  cy: number;
};

export const BASE_FRAME = { width: 750, height: 422 };

export const DEFAULT_VIEW: ViewState = { zoom: 1, cx: 0.5, cy: 0.5 };
