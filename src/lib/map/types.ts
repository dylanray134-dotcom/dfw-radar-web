import type { GeoBounds } from "@/lib/radar/project";

export type MapCamera = { lat: number; lng: number; zoom: number };

export type RadarMap = {
  provider: "google" | "leaflet";
  setRestriction(bounds: GeoBounds, minZoom: number, maxZoom: number): void;
  setCamera(camera: MapCamera): void;
  getCamera(): MapCamera | null;
  setOverlayBounds(bounds: GeoBounds): void;
  redraw(): void;
  containerPoint(lat: number, lng: number): { x: number; y: number } | null;
  onCamera(listener: () => void): () => void;
  resize(): void;
  destroy(): void;
};
