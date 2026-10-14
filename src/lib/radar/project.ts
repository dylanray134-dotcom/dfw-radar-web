/**
 * Lambert conformal conic used by WFAA MyOwnRadar.
 * Parameter order matches MORAnimator `MORhanLambConConEllips`:
 * LCC, lat0, lat1, lon0, originLat, originLon, radius, eccentricity, spacing, x, y
 * `toXY` is in pixel units (radius / meters-per-pixel) with image Y downward.
 */

const RAD = Math.PI / 180;

export type LambertProjection = {
  kind: "lcc";
  lat0: number;
  lat1: number;
  lon0: number;
  originLat: number;
  originLon: number;
  radius: number;
  eccentricity: number;
  spacing: number;
  x: number;
  y: number;
};

function normalizeLon(lon: number): number {
  let value = lon;
  while (value < -180) value += 360;
  while (value > 180) value -= 360;
  return value;
}

export function parseCoordinates(value: string): LambertProjection | null {
  const parts = value.split(",").map((part) => part.trim());
  if (parts[0]?.toUpperCase() !== "LCC" || parts.length < 11) return null;
  const nums = parts.slice(1, 11).map((part) => Number.parseFloat(part));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [lat0, lat1, lon0, originLat, originLon, radius, eccentricity, spacing, x, y] = nums;
  if (spacing === 0 || radius === 0 || lat0 === lat1) return null;
  return {
    kind: "lcc",
    lat0,
    lat1,
    lon0,
    originLat,
    originLon,
    radius,
    eccentricity,
    spacing,
    x,
    y,
  };
}

function coneT(sinPhi: number, eccentricity: number): number {
  const ratio = (1 + eccentricity * sinPhi) / (1 - eccentricity * sinPhi);
  return Math.sqrt(((1 - sinPhi) / (1 + sinPhi)) * ratio ** eccentricity);
}

type ConeModel = {
  lon0: number;
  eccentricity: number;
  xOff: number;
  yOff: number;
  n: number;
  f: number;
  rg: number;
  rho0: number;
  originX: number;
  originY: number;
};

function coneModel(projection: LambertProjection): ConeModel | null {
  const { lat0, lat1, lon0, originLat, originLon, radius, eccentricity, spacing, x: xOff, y: yOff } =
    projection;
  if (spacing === 0 || radius === 0 || lat0 === lat1) return null;
  const e2 = eccentricity * eccentricity;
  const rg = radius / spacing;
  const phi0 = lat0 * RAD;
  const phi1 = lat1 * RAD;
  const sin0 = Math.sin(phi0);
  const sin1 = Math.sin(phi1);
  const m0 = Math.cos(phi0) / Math.sqrt(1 - e2 * sin0 * sin0);
  const m1 = Math.cos(phi1) / Math.sqrt(1 - e2 * sin1 * sin1);
  const t0 = coneT(sin0, eccentricity);
  const t1 = coneT(sin1, eccentricity);
  if (!(t0 > 0) || !(t1 > 0) || t0 === t1 || m0 <= 0 || m1 <= 0) return null;
  const n = (Math.log(m0) - Math.log(m1)) / (Math.log(t0) - Math.log(t1));
  if (!Number.isFinite(n) || n === 0) return null;
  const f = m0 / (n * t0 ** n);
  const rho0 = rg * f * t0 ** n;

  const project = (latitude: number, longitude: number) => {
    const phi = latitude * RAD;
    const lam = normalizeLon(longitude - lon0) * RAD;
    const t = coneT(Math.sin(phi), eccentricity);
    const rho = rg * f * t ** n;
    const theta = n * lam;
    return {
      x: rho * Math.sin(theta),
      y: rho0 + rho * Math.cos(theta),
    };
  };
  const origin = project(originLat, originLon);
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return null;
  return {
    lon0,
    eccentricity,
    xOff,
    yOff,
    n,
    f,
    rg,
    rho0,
    originX: origin.x,
    originY: origin.y,
  };
}

function latitudeFromT(t: number, eccentricity: number): number | null {
  if (!(t > 0)) return null;
  if (eccentricity === 0) {
    const tt = t * t;
    const sinPhi = (1 - tt) / (1 + tt);
    if (sinPhi < -1 || sinPhi > 1) return null;
    return Math.asin(sinPhi);
  }
  let phi = Math.PI / 2 - 2 * Math.atan(t);
  for (let i = 0; i < 12; i += 1) {
    const eSin = eccentricity * Math.sin(phi);
    if (Math.abs(eSin) >= 1) return null;
    const factor = ((1 - eSin) / (1 + eSin)) ** (eccentricity / 2);
    const next = Math.PI / 2 - 2 * Math.atan(t * factor);
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - phi) < 1e-14) return next;
    phi = next;
  }
  return phi;
}

/** Image pixel on the basemap. Null when the fix cannot be projected. */
export function projectToImage(
  projection: LambertProjection,
  lat: number,
  lon: number,
): { x: number; y: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) >= 90) return null;
  const model = coneModel(projection);
  if (!model) return null;
  const phi = lat * RAD;
  const lam = normalizeLon(lon - model.lon0) * RAD;
  const t = coneT(Math.sin(phi), model.eccentricity);
  const rho = model.rg * model.f * t ** model.n;
  const theta = model.n * lam;
  const pointX = rho * Math.sin(theta);
  const pointY = model.rho0 + rho * Math.cos(theta);
  const x = pointX - model.originX + model.xOff;
  const y = pointY - model.originY + model.yOff;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** Inverse of `projectToImage`. Image Y grows south. */
export function imageToLatLon(
  projection: LambertProjection,
  x: number,
  y: number,
): { lat: number; lon: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const model = coneModel(projection);
  if (!model) return null;
  const pointX = x - model.xOff + model.originX;
  const pointY = y - model.yOff + model.originY;
  const dx = pointX;
  const dy = pointY - model.rho0;
  const rho = Math.hypot(dx, dy);
  if (!(rho > 0)) return null;
  const theta = Math.atan2(dx, dy);
  const base = rho / (model.rg * model.f);
  if (!(base > 0)) return null;
  const t = base ** (1 / model.n);
  const phi = latitudeFromT(t, model.eccentricity);
  if (phi == null || !Number.isFinite(phi)) return null;
  const lat = phi / RAD;
  const lon = normalizeLon(model.lon0 + theta / model.n / RAD);
  if (!Number.isFinite(lat) || Math.abs(lat) >= 90 || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export type GeoBounds = { north: number; south: number; east: number; west: number };

/** Latitude/longitude extent of a radar frame. Edges are sampled because the frame is Lambert, not a lat/lng rectangle. */
export function frameBounds(
  projection: LambertProjection,
  width: number,
  height: number,
  steps = 32,
): GeoBounds | null {
  if (!(width > 0) || !(height > 0)) return null;
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  let found = false;
  const take = (x: number, y: number) => {
    const point = imageToLatLon(projection, x, y);
    if (!point) return;
    found = true;
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lon);
    west = Math.min(west, point.lon);
  };
  for (let i = 0; i <= steps; i += 1) {
    const sx = (width * i) / steps;
    const sy = (height * i) / steps;
    take(sx, 0);
    take(sx, height);
    take(0, sy);
    take(width, sy);
  }
  if (!found || !(north > south) || !(east > west)) return null;
  return { north, south, east, west };
}
