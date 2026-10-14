# DFW Radar

Live WFAA metro radar for Dallas–Fort Worth, in the browser. It is the web companion to the DFW Radar iOS app: a full-bleed radar stage, frame playback, map layers, local weather, and settings that stay on the device.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test
npm run lint
npm run build
npm start
```

`npm start` also listens on port 43123.

## What you can do

- Play, pause, scrub, and jump the latest WFAA sweeps. Times are shown in `America/Chicago`.
- Pinch, scroll-wheel, or double-click to zoom. Drag to pan. Reset zoom from the stage or Settings.
- Switch regions: DFW Metro, North Texas, the four quadrants, Tarrant & Dallas, Denton & Collin.
- Toggle WFAA overlays. Reflectivity, rainfall, hail, and rotation tracks share one slot.
- Allow location for a city name (OpenStreetMap Nominatim) and a forecast (Open-Meteo). Skip it and the app uses Dallas–Fort Worth coordinates. Radar does not need location.
- Deep link a sheet with `?sheet=weather`, `?sheet=layers`, or `?sheet=settings`.

Choices are stored in `localStorage` under `dfw-radar-v1`.

## How the data flows

```
Browser
  → /api/wfaa/<region>/Latestdatafiles.txt
  → /api/wfaa/<region>/Latestconfig.txt
  → /api/wfaa/<region>/enhance_radar.txt
  → /api/wfaa/<region>/N0B_*.png and overlays
       → Next.js route
            → https://cdn.tegna-media.com/wfaa/weather/myownradar/750x422/
```

WFAA publishes MyOwnRadar as grayscale PNG frames plus `enhance_radar.txt` (the Radar Colors table the TV player uses). The CDN does not send `Access-Control-Allow-Origin`, so a canvas loaded from that host would be tainted and could not be recolored.

`/api/wfaa/[...path]` is a same-origin proxy. It only forwards paths under the WFAA `750x422` tree and rejects `..`. The browser then:

1. Draws each grayscale frame into a canvas.
2. Replaces gray pixels with the Radar Colors lookup (same interpolation as WFAA’s `MORAnimator`).
3. Makes Radar Colors bins under about **0.10 in/hr** transparent. That cutoff is the gray index where the `0.10` row starts in `enhance_radar.txt` (102 in the current table), so a dry KFWS disk does not read as light rain.
4. Skips the Navigation overlay (`navigation_north_texas.png`), which is the black region pad from the TV player.
5. Punches out the baked-in color-scale rectangle and draws a scale in the UI instead.
6. Composites the basemap, enabled overlays, and (when zoomed) the hi-res basemap and city mask.

The scene refetches about every 5 minutes, matching WFAA’s `auto_refresh`.

Weather is a second route, `/api/weather`:

- Open-Meteo forecast, no API key, US units, `America/Chicago`.
- Nominatim reverse geocode for the city name, with a User-Agent set on the server.

## Deploy

The app needs the Node server for the proxy. A static export would bring back the CORS block.

One-command deploy on Vercel (free tier is enough; no paid APIs):

```bash
npx vercel
```

Or build and run anywhere Node is available:

```bash
npm run build
npm start
```

A production build also registers `/sw.js` and ships a web manifest plus icons so it can be installed on iPhone Safari and desktop Chrome.

## Tests

`npm test` checks the palette cutoff, clutter transparency, frame timestamps, and that the Navigation pad is dropped from the layer list.
