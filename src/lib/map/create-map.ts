import type { RadarMap } from "./types";

/** Present when the site was built with a Maps JavaScript API key. Empty uses the Leaflet fallback. */
export function googleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

export async function createRadarMap(container: HTMLElement, canvas: HTMLCanvasElement): Promise<RadarMap> {
  const key = googleMapsApiKey();
  if (key) {
    try {
      const { createGoogleMap } = await import("./google-map");
      return await createGoogleMap(container, canvas, key);
    } catch {
      container.replaceChildren();
    }
  }
  const { createLeafletMap } = await import("./leaflet-map");
  return createLeafletMap(container, canvas);
}
