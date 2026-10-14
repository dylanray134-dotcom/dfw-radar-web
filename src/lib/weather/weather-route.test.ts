import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import { GET as proxyRadar } from "../../app/api/wfaa/[...path]/route";
import { GET, placeFromAddress, weatherCell } from "../../app/api/weather/route";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function forecastBody() {
  return {
    current: {
      time: "2026-10-03T09:00",
      temperature_2m: 72,
      apparent_temperature: 70,
      relative_humidity_2m: 40,
      precipitation: 0,
      weather_code: 0,
      wind_speed_10m: 5,
      wind_direction_10m: 180,
      is_day: 1,
    },
  };
}

describe("weather route", () => {
  it("rounds a cell to the same three decimals the fetch cache key uses", () => {
    assert.deepEqual(weatherCell(32.7767, -96.7974), { latitude: "32.777", longitude: "-96.797" });
    assert.deepEqual(weatherCell(32.7769, -96.7972), weatherCell(32.7767, -96.797));
  });

  it("ignores an empty Nominatim address instead of inventing a name", () => {
    assert.equal(placeFromAddress(undefined), null);
    assert.equal(placeFromAddress({ state: "Texas" }), null);
    assert.equal(placeFromAddress({ city: "Dallas", state: "Texas" }), "Dallas, Texas");
  });

  it("fetches the forecast and the reverse geocode together for the rounded cell", async () => {
    const urls: string[] = [];
    const inits: RequestInit[] = [];
    let started = 0;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = async (input, init) => {
      urls.push(String(input));
      inits.push(init ?? {});
      started += 1;
      if (started === 2) release();
      await gate;
      if (String(input).includes("nominatim")) {
        return Response.json({ address: { city: "Dallas", state: "Texas" } });
      }
      return Response.json(forecastBody());
    };

    const pending = GET(new Request("http://localhost/api/weather?lat=32.7767&lon=-96.7974&name=Alice"));
    try {
      const raced = await Promise.race([
        gate.then(() => "both" as const),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 500)),
      ]);
      assert.equal(raced, "both");
      assert.equal(started, 2);
    } finally {
      release();
    }

    const response = await pending;
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=120");
    const body = (await response.json()) as { place: string };
    assert.equal(body.place, "Dallas, Texas");
    assert.ok(urls.some((url) => url.includes("latitude=32.777") && url.includes("longitude=-96.797")));
    assert.ok(urls.some((url) => url.includes("lat=32.777") && url.includes("lon=-96.797")));
    for (const init of inits) {
      assert.equal(init.cache, "force-cache");
      assert.equal(init.next?.revalidate, 600);
      assert.ok(init.signal instanceof AbortSignal);
      assert.notEqual(init.cache, "no-store");
    }
  });

  it("keeps each caller's name when Nominatim fails for the same cell", async () => {
    globalThis.fetch = async (input) => {
      if (String(input).includes("nominatim")) return new Response("nope", { status: 502 });
      return Response.json(forecastBody());
    };
    const first = await GET(new Request("http://localhost/api/weather?lat=32.7767&lon=-96.797&name=Alice"));
    const second = await GET(new Request("http://localhost/api/weather?lat=32.7769&lon=-96.7972&name=Bob"));
    assert.equal(first.headers.get("Cache-Control"), "private, no-store");
    assert.equal(second.headers.get("Cache-Control"), "private, no-store");
    const alice = (await first.json()) as { place: string };
    const bob = (await second.json()) as { place: string };
    assert.equal(alice.place, "Alice");
    assert.equal(bob.place, "Bob");
  });

  it("rejects coordinates before calling upstream", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return Response.json(forecastBody());
    };
    const response = await GET(new Request("http://localhost/api/weather?lat=999&lon=0"));
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });
});

describe("wfaa proxy", () => {
  it("aborts an upstream fetch that runs too long", async () => {
    const seen: { signal: AbortSignal | null; cache?: RequestCache } = { signal: null };
    globalThis.fetch = async (_input, init) => {
      seen.signal = init?.signal ?? null;
      seen.cache = init?.cache;
      return new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    };
    const response = await proxyRadar(new Request("http://localhost/api/wfaa/metro40/a.png"), {
      params: Promise.resolve({ path: ["metro40", "a.png"] }),
    });
    assert.equal(response.status, 200);
    assert.ok(seen.signal instanceof AbortSignal);
    assert.equal(seen.cache, "no-store");
  });
});

describe("service worker", () => {
  it("does not answer a failed build asset with the cached document", () => {
    const source = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
    assert.match(source, /pathname\.startsWith\("\/_next\/"\)/);
    assert.match(source, /isNavigation\(event\.request\)/);
    assert.doesNotMatch(source, /cached \|\| caches\.match\("\/"\)/);
  });
});
