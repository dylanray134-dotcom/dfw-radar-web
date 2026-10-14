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

/** Image pixel on the basemap. Null when the fix cannot be projected. */
export function projectToImage(
  projection: LambertProjection,
  lat: number,
  lon: number,
): { x: number; y: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) >= 90) return null;

  const { lat0, lat1, lon0, originLat, originLon, radius, eccentricity, spacing, x: xOff, y: yOff } =
    projection;
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
    const sinPhi = Math.sin(phi);
    const t = coneT(sinPhi, eccentricity);
    const rho = rg * f * t ** n;
    const theta = n * lam;
    return {
      x: rho * Math.sin(theta),
      y: rho0 + rho * Math.cos(theta),
    };
  };

  const origin = project(originLat, originLon);
  const point = project(lat, lon);
  const x = point.x - origin.x + xOff;
  const y = point.y - origin.y + yOff;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}
