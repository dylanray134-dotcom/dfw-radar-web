export type CompositeLayer = {
  source: CanvasImageSource;
  opacity: number;
};

/** Stack radar and data layers on a transparent canvas. The photo basemap is not included. */
export function compositeOverlays(width: number, height: number, layers: CompositeLayer[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  for (const layer of layers) {
    context.globalAlpha = layer.opacity;
    context.drawImage(layer.source, 0, 0, canvas.width, canvas.height);
  }
  context.globalAlpha = 1;
  return canvas;
}
