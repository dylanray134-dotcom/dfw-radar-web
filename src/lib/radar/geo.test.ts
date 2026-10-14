import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boundsAspect, coverageZoom, letterbox, mercatorPixel, minZoomForBounds } from "./geo";
import { frameBounds, parseCoordinates } from "./project";

const METRO = "LCC, 45.5, 28.8, -97.03, 32.99, -97.03, 6367470.0, 0.0, 351.923990499, 374.5, 210.5";

describe("map zoom clamp", () => {
  it("fits a letterboxed viewport to the region and no wider", () => {
    const projection = parseCoordinates(METRO);
    assert.ok(projection);
    const bounds = frameBounds(projection, 750, 422);
    assert.ok(bounds);
    const aspect = boundsAspect(bounds);
    const box = letterbox(390, 844, aspect);
    const fitted = coverageZoom(bounds, box.width, box.height);
    assert.ok(Math.abs(fitted.fit - fitted.strict) < 0.02);
    assert.equal(minZoomForBounds(bounds, box.width, box.height), fitted.strict);

    const tall = coverageZoom(bounds, 390, 844);
    assert.ok(tall.strict > fitted.strict + 0.5);
    assert.ok(box.width <= 390 + 0.01);
    assert.ok(box.height < 844);
    assert.ok(Math.abs(box.width / box.height - aspect) < 0.001);
  });

  it("places the north edge of a mercator image at y = 0", () => {
    const bounds = { north: 34, south: 32, east: -96, west: -98 };
    const north = mercatorPixel(bounds, 34, -97, 200, 100);
    const south = mercatorPixel(bounds, 32, -97, 200, 100);
    assert.ok(Math.abs(north.y) < 1e-9);
    assert.ok(Math.abs(south.y - 100) < 1e-6);
    assert.ok(north.x > 0 && north.x < 200);
  });
});