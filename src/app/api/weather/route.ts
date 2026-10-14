import { upstreamTimeout } from "@/lib/upstream";
import { describeWeather } from "@/lib/weather/codes";

// Dynamic so a caller's fallback name is not cached as the route response.
// Upstream fetches opt into the data cache; their URL is the rounded cell.
export const dynamic = "force-dynamic";

const REVALIDATE_SECONDS = 10 * 60;

type Nominatim = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    county?: string;
    state?: string;
  };
};

type Forecast = {
  current?: Record<string, number | string>;
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    precipitation: number[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
  };
};

export function weatherCell(lat: number, lon: number): { latitude: string; longitude: string } {
  return { latitude: lat.toFixed(3), longitude: lon.toFixed(3) };
}

function chicagoStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** City label from a Nominatim address. Null when the lookup did not name a place. */
export function placeFromAddress(address: Nominatim["address"]): string | null {
  if (!address) return null;
  const city =
    address.city || address.town || address.village || address.hamlet || address.suburb || address.county;
  if (!city) return null;
  return address.state ? `${city}, ${address.state}` : city;
}

function cachedGet(url: string, headers?: HeadersInit): Promise<Response> {
  return fetch(url, {
    cache: "force-cache",
    next: { revalidate: REVALIDATE_SECONDS },
    signal: upstreamTimeout(),
    headers,
  });
}

function forecastUrl(cell: { latitude: string; longitude: string }): string {
  const meteoUrl = new URL("https://api.open-meteo.com/v1/forecast");
  meteoUrl.searchParams.set("latitude", cell.latitude);
  meteoUrl.searchParams.set("longitude", cell.longitude);
  meteoUrl.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day",
  );
  meteoUrl.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code,precipitation");
  meteoUrl.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
  );
  meteoUrl.searchParams.set("temperature_unit", "fahrenheit");
  meteoUrl.searchParams.set("wind_speed_unit", "mph");
  meteoUrl.searchParams.set("precipitation_unit", "inch");
  meteoUrl.searchParams.set("timezone", "America/Chicago");
  meteoUrl.searchParams.set("forecast_days", "5");
  return meteoUrl.toString();
}

function nominatimUrl(cell: { latitude: string; longitude: string }): string {
  const geoUrl = new URL("https://nominatim.openstreetmap.org/reverse");
  geoUrl.searchParams.set("format", "jsonv2");
  geoUrl.searchParams.set("lat", cell.latitude);
  geoUrl.searchParams.set("lon", cell.longitude);
  geoUrl.searchParams.set("zoom", "12");
  return geoUrl.toString();
}

async function loadForecast(cell: { latitude: string; longitude: string }): Promise<Forecast | Response> {
  try {
    const response = await cachedGet(forecastUrl(cell));
    if (!response.ok) {
      return Response.json({ error: "Weather service did not respond." }, { status: 502 });
    }
    return (await response.json()) as Forecast;
  } catch {
    return Response.json({ error: "Weather service is unreachable." }, { status: 502 });
  }
}

async function loadPlace(
  cell: { latitude: string; longitude: string },
  fallbackName: string,
): Promise<{ place: string; shared: boolean }> {
  try {
    const geo = await cachedGet(nominatimUrl(cell), {
      "User-Agent": "DFWRadar/1.0 (local weather companion)",
      Accept: "application/json",
    });
    if (!geo.ok) return { place: fallbackName, shared: false };
    const data = (await geo.json()) as Nominatim;
    const place = placeFromAddress(data.address);
    if (!place) return { place: fallbackName, shared: false };
    return { place, shared: true };
  } catch {
    return { place: fallbackName, shared: false };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const fallbackName = url.searchParams.get("name")?.slice(0, 80) || "Your location";
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "Need a latitude and longitude." }, { status: 400 });
  }

  const cell = weatherCell(lat, lon);
  const [forecast, located] = await Promise.all([loadForecast(cell), loadPlace(cell, fallbackName)]);
  if (forecast instanceof Response) return forecast;

  const hourly = forecast.hourly;
  const chicagoNow = chicagoStamp(new Date());
  let start = 0;
  if (hourly) {
    start = hourly.time.findIndex((stamp) => stamp.slice(0, 16) >= chicagoNow.slice(0, 16));
    if (start < 0) start = Math.max(0, hourly.time.length - 1);
  }
  const hours = hourly
    ? hourly.time.slice(start, start + 18).map((time, index) => {
        const i = start + index;
        const code = hourly.weather_code[i] ?? 0;
        return {
          time,
          temperature: hourly.temperature_2m[i],
          precipChance: hourly.precipitation_probability[i],
          precip: hourly.precipitation[i],
          code,
          ...describeWeather(code),
        };
      })
    : [];

  const daily = forecast.daily;
  const days = daily
    ? daily.time.map((time, index) => {
        const code = daily.weather_code[index] ?? 0;
        return {
          time,
          high: daily.temperature_2m_max[index],
          low: daily.temperature_2m_min[index],
          precip: daily.precipitation_sum[index],
          precipChance: daily.precipitation_probability_max[index],
          code,
          ...describeWeather(code),
        };
      })
    : [];

  const current = forecast.current ?? {};
  const code = Number(current.weather_code ?? 0);
  const body = {
    place: located.place,
    latitude: lat,
    longitude: lon,
    fetchedAt: new Date().toISOString(),
    current: {
      time: String(current.time ?? ""),
      temperature: Number(current.temperature_2m),
      feelsLike: Number(current.apparent_temperature),
      humidity: Number(current.relative_humidity_2m),
      precip: Number(current.precipitation),
      wind: Number(current.wind_speed_10m),
      windDirection: Number(current.wind_direction_10m),
      isDay: Number(current.is_day) === 1,
      code,
      ...describeWeather(code),
    },
    hourly: hours,
    daily: days,
  };
  return Response.json(body, {
    headers: {
      // A resolved place is safe to share. A caller fallback is not: the data-cache
      // key is the rounded cell and does not include that name.
      "Cache-Control": located.shared ? "public, max-age=120" : "private, no-store",
    },
  });
}
