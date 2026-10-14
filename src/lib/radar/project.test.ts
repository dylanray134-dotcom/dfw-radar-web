import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseScene } from "./parse";
import { parseCoordinates, projectToImage } from "./project";

const METRO =
  "LCC, 45.5, 28.8, -97.03, 32.99, -97.03, 6367470.0, 0.0, 351.923990499, 374.5, 210.5";

describe("radar projection", () => {
  it("parses the MyOwnRadar LCC coordinates line", () => {
    const projection = parseCoordinates(METRO);
    assert.ok(projection);
    assert.equal(projection.kind, "lcc");
    assert.equal(projection.x, 374.5);
    assert.equal(projection.y, 210.5);
    assert.equal(parseCoordinates("CE, 1, 2, 3"), null);
    assert.equal(parseCoordinates("LCC, no"), null);
  });

  it("places the projection origin on the reference pixel", () => {
    const projection = parseCoordinates(METRO);
    assert.ok(projection);
    const origin = projectToImage(projection, 32.99, -97.03);
    assert.ok(origin);
    assert.ok(Math.abs(origin.x - 374.5) < 1e-6);
    assert.ok(Math.abs(origin.y - 210.5) < 1e-6);
  });

  it("puts Dallas east and south of the metro origin", () => {
    const projection = parseCoordinates(METRO);
    assert.ok(projection);
    const dallas = projectToImage(projection, 32.7767, -96.797);
    assert.ok(dallas);
    assert.ok(Math.abs(dallas.x - 435.89514554932026) < 1e-6);
    assert.ok(Math.abs(dallas.y - 277.262158604397) < 1e-6);
    assert.ok(dallas.x > 374.5);
    assert.ok(dallas.y > 210.5);
    const north = projectToImage(projection, 33.4, -97.03);
    assert.ok(north);
    assert.ok(north.y < 210.5);
    assert.equal(projectToImage(projection, 95, -97), null);
  });

  it("keeps the wider North Texas view on the same basemap pixel space", () => {
    const projection = parseCoordinates(
      "LCC, 45.5, 28.8, -97.027, 32.981, -97.027, 6367470.0, 0.0, 703.847980998, 374.5, 210.5",
    );
    assert.ok(projection);
    const dallas = projectToImage(projection, 32.7767, -96.797);
    assert.ok(dallas);
    assert.ok(dallas.x > 374.5 && dallas.x < 750);
    assert.ok(dallas.y > 210.5 && dallas.y < 422);
  });
});

describe("scene projection", () => {
  it("reads coordinates from the data file", () => {
    const scene = parseScene(
      "metro40",
      "overlay_labels = Radar/on",
      `image_base = ../metro40/\ncoordinates = ${METRO}\nbg.jpg overlay = N0B_20260923_0639-20260923_0640.png`,
      "* Radar Colors\n0 0 0 0 0 0 0 0 0 0\n",
    );
    assert.equal(scene.projection?.kind, "lcc");
    assert.equal(scene.projection?.spacing, 351.923990499);
  });
});
