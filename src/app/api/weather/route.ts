import { describeWeather } from "@/lib/weather/codes";

export const dynamic = "force-dynamic";

type CacheEntry = { at: number; body: unknown };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

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

function placeName(address: Nominatim["address"], fallback: string): string {
  if (!address) return fallback;
  const city =
    address.city || address.town || address.village || address.hamlet || address.suburb || address.county;
  if (!city) return fallback;
  return address.state ? `${city}, ${address.state}` : city;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const fallbackName = url.searchParams.get("name")?.slice(0, 80) || "Your location";
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "Need a latitude and longitude." }, { status: 400 });
  }

  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return Response.json(hit.body, {
      headers: { "Cache-Control": "public, max-age=120" },
    });
  }

  const meteoUrl = new URL("https://api.open-meteo.com/v1/forecast");
  meteoUrl.searchParams.set("latitude", String(lat));
  meteoUrl.searchParams.set("longitude", String(lon));
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

  let forecast: {
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
  try {
    const response = await fetch(meteoUrl, { cache: "no-store" });
    if (!response.ok) {
      return Response.json({ error: "Weather service did not respond." }, { status: 502 });
    }
    forecast = await response.json();
  } catch {
    return Response.json({ error: "Weather service is unreachable." }, { status: 502 });
  }

  let place = fallbackName;
  try {
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12`;
    const geo = await fetch(geoUrl, {
      headers: {
        "User-Agent": "DFWRadar/1.0 (local weather companion)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (geo.ok) {
      const data = (await geo.json()) as Nominatim;
      place = placeName(data.address, fallbackName);
    }
  } catch {
    place = fallbackName;
  }

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
    place,
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
  cache.set(key, { at: Date.now(), body });
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=120" },
  });
}
