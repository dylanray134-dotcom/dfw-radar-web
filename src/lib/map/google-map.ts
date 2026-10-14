import type { GeoBounds } from "@/lib/radar/project";
import type { RadarMap } from "./types";

const SCRIPT = "script[data-dfw-google-maps]";

function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window !== "undefined" && window.google?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(SCRIPT);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.dfwGoogleMaps = "1";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

function literal(bounds: GeoBounds): google.maps.LatLngBoundsLiteral {
  return { north: bounds.north, south: bounds.south, east: bounds.east, west: bounds.west };
}

class RadarGroundOverlay extends google.maps.OverlayView {
  private bounds: google.maps.LatLngBounds | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    super();
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
  }

  onAdd() {
    this.getPanes()?.overlayLayer.appendChild(this.canvas);
  }

  draw() {
    const projection = this.getProjection();
    if (!projection || !this.bounds || this.canvas.dataset.radar !== "1" || this.canvas.width < 2) {
      this.canvas.style.display = "none";
      return;
    }
    const sw = projection.fromLatLngToDivPixel(this.bounds.getSouthWest());
    const ne = projection.fromLatLngToDivPixel(this.bounds.getNorthEast());
    if (!sw || !ne) return;
    this.canvas.style.display = "block";
    this.canvas.style.left = `${sw.x}px`;
    this.canvas.style.top = `${ne.y}px`;
    this.canvas.style.width = `${Math.max(1, ne.x - sw.x)}px`;
    this.canvas.style.height = `${Math.max(1, sw.y - ne.y)}px`;
  }

  setBounds(bounds: GeoBounds) {
    this.bounds = new google.maps.LatLngBounds(
      { lat: bounds.south, lng: bounds.west },
      { lat: bounds.north, lng: bounds.east },
    );
    this.draw();
  }

  onRemove() {
    this.canvas.remove();
  }
}

export async function createGoogleMap(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  key: string,
): Promise<RadarMap> {
  await loadGoogleMaps(key);
  if (!window.google?.maps) throw new Error("Google Maps unavailable");

  let authFailed = false;
  const previousAuth = window.gm_authFailure;
  window.gm_authFailure = () => {
    authFailed = true;
    previousAuth?.();
  };

  const map = new google.maps.Map(container, {
    center: { lat: 32.99, lng: -97.03 },
    zoom: 8,
    minZoom: 8,
    maxZoom: 20,
    gestureHandling: "greedy",
    disableDefaultUI: true,
    clickableIcons: false,
    keyboardShortcuts: false,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    backgroundColor: "#071018",
    isFractionalZoomEnabled: true,
    tilt: 0,
  });
  const overlay = new RadarGroundOverlay(canvas);
  overlay.setMap(map);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (authFailed) reject(new Error("Google Maps key was rejected"));
        else resolve();
      }, 2500);
      google.maps.event.addListenerOnce(map, "idle", () => {
        window.clearTimeout(timer);
        if (authFailed) reject(new Error("Google Maps key was rejected"));
        else resolve();
      });
    });
  } catch (error) {
    overlay.setMap(null);
    window.google.maps.event.clearInstanceListeners(map);
    container.replaceChildren();
    throw error;
  }

  const listeners = new Set<() => void>();
  let clamping = false;
  const notify = () => {
    const zoom = map.getZoom();
    const minZoom = map.get("minZoom");
    if (!clamping && zoom != null && typeof minZoom === "number" && zoom < minZoom - 0.001) {
      clamping = true;
      map.setZoom(minZoom);
      clamping = false;
    }
    for (const listener of listeners) listener();
  };
  const idle = map.addListener("idle", notify);
  const boundsChanged = map.addListener("bounds_changed", notify);

  return {
    provider: "google",
    setRestriction(bounds, minZoom, maxZoom) {
      const center = map.getCenter();
      map.setOptions({
        minZoom,
        maxZoom,
        restriction: { latLngBounds: literal(bounds), strictBounds: true },
        center: center ?? { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 },
      });
    },
    setCamera(camera) {
      map.moveCamera({ center: { lat: camera.lat, lng: camera.lng }, zoom: camera.zoom, tilt: 0, heading: 0 });
    },
    getCamera() {
      const center = map.getCenter();
      const zoom = map.getZoom();
      if (!center || zoom == null) return null;
      return { lat: center.lat(), lng: center.lng(), zoom };
    },
    setOverlayBounds(bounds) {
      overlay.setBounds(bounds);
    },
    redraw() {
      overlay.draw();
    },
    containerPoint(lat, lng) {
      const projection = overlay.getProjection();
      if (!projection) return null;
      const point = projection.fromLatLngToContainerPixel(new google.maps.LatLng(lat, lng));
      if (!point) return null;
      return { x: point.x, y: point.y };
    },
    onCamera(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resize() {
      google.maps.event.trigger(map, "resize");
    },
    destroy() {
      idle.remove();
      boundsChanged.remove();
      listeners.clear();
      overlay.setMap(null);
      google.maps.event.clearInstanceListeners(map);
      container.replaceChildren();
    },
  };
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}
