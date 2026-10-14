import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseScene } from "./parse";
import { frameBounds, imageToLatLon, parseCoordinates, projectToImage } from "./project";

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

  it("inverts the metro projection back to latitude and longitude", () => {
    const projection = parseCoordinates(METRO);
    assert.ok(projection);
    const dallas = projectToImage(projection, 32.7767, -96.797);
    assert.ok(dallas);
    const back = imageToLatLon(projection, dallas.x, dallas.y);
    assert.ok(back);
    assert.ok(Math.abs(back.lat - 32.7767) < 1e-6);
    assert.ok(Math.abs(back.lon - -96.797) < 1e-6);
    const origin = imageToLatLon(projection, 374.5, 210.5);
    assert.ok(origin);
    assert.ok(Math.abs(origin.lat - 32.99) < 1e-6);
    assert.ok(Math.abs(origin.lon - -97.03) < 1e-6);
  });

  it("bounds the DFW metro frame on the cities at the edge of the widest view", () => {
    const projection = parseCoordinates(METRO);
    assert.ok(projection);
    const bounds = frameBounds(projection, 750, 422);
    assert.ok(bounds);
    assert.ok(Math.abs(bounds.north - 33.662) < 0.02);
    assert.ok(Math.abs(bounds.south - 32.31) < 0.02);
    assert.ok(Math.abs(bounds.west - -98.467) < 0.02);
    assert.ok(Math.abs(bounds.east - -95.593) < 0.02);
    const cities: [string, number, number][] = [
      ["Jacksboro", 33.218, -98.159],
      ["Bowie", 33.559, -97.848],
      ["Decatur", 33.234, -97.586],
      ["Bonham", 33.577, -96.178],
      ["Honey Grove", 33.585, -95.907],
      ["Lipan", 32.519, -98.046],
      ["Granbury", 32.442, -97.794],
      ["Kaufman", 32.589, -96.309],
      ["Canton", 32.556, -95.863],
      ["Mabank", 32.367, -96.104],
    ];
    for (const [, lat, lon] of cities) {
      assert.ok(lat < bounds.north && lat > bounds.south, String(lat));
      assert.ok(lon > bounds.west && lon < bounds.east, String(lon));
    }
    assert.ok(30.27 < bounds.south);
  });

  it("gives North Texas a wider frame than DFW metro", () => {
    const metro = parseCoordinates(METRO);
    const north = parseCoordinates(
      "LCC, 45.5, 28.8, -97.027, 32.981, -97.027, 6367470.0, 0.0, 703.847980998, 374.5, 210.5",
    );
    assert.ok(metro && north);
    const metroBounds = frameBounds(metro, 750, 422);
    const northBounds = frameBounds(north, 750, 422);
    assert.ok(metroBounds && northBounds);
    assert.ok(northBounds.north > metroBounds.north);
    assert.ok(northBounds.south < metroBounds.south);
    assert.ok(northBounds.west < metroBounds.west);
    assert.ok(northBounds.east > metroBounds.east);
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
