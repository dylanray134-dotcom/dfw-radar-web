const CHICAGO: Intl.DateTimeFormatOptions = {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("en-US", CHICAGO).format(date);
}

export function formatFrameStamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/** Filename clocks on WFAA frames are UTC. America/Chicago applies CDT/CST. */
export function frameTimeFromName(name: string): Date | null {
  const re = /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/g;
  let match: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((match = re.exec(name))) last = match;
  if (!last) return null;
  const year = Number(last[1]);
  const month = Number(last[2]);
  const day = Number(last[3]);
  const hour = Number(last[4]);
  const minute = Number(last[5]);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

export function compass(degrees: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
  return dirs[index];
}
