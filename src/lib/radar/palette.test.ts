import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPalette } from "./colorize";
import { frameTimeFromName } from "./format";
import { parseEnhance } from "./palette";
import { parseScene } from "./parse";

const ENHANCE = `
# Radar Enhance GrayScale RR GG BB Alpha Alpha

* Radar Colors, Precipitation Not Detected
0 0 0 0 0 0 0 0 0 0
1 50 0 0 153 153 255 255 0 50 value= Insignificant
51 67 0 0 153 204 255 204 50 255 value=.010,.019,3, in per hour, Rainfall Rate =
68 84 0 0 204 255 204 0 255 255 value=.02,.04,2
85 101 0 0 255 153 0 0 255 255 value=.05,.09,2
102 118 0 255 153 255 0 0 255 255 value=.10,.21,2
119 135 255 255 255 153 0 0 255 255 value=.22,.44,2
238 255 50 1 50 1 50 1 255 255 value=Very Large Hail Likely

* One-Hour Rainfall, Precipitation Not Detected
0 0 0 0 0 0 0 0 0 0
1 5 51 51 204 204 255 255 20 255 value=0.01,0.30,2,in, Estimated Rainfall =
`;

describe("radar palette", () => {
  it("marks gray indexes below 0.10 in/hr as clutter", () => {
    const tables = parseEnhance(ENHANCE);
    assert.equal(tables[0].name, "Radar Colors");
    assert.equal(tables[0].clutterCutoff, 102);
    assert.equal(tables[1].clutterCutoff, null);
    assert.equal(tables[0].lut[102].g > 100, true);
    assert.equal(tables[0].lut[0].a, 0);
  });

  it("drops dry-air bins and keeps rain-rate greens", () => {
    const table = parseEnhance(ENHANCE)[0];
    const data = new Uint8ClampedArray(8);
    data.set([50, 50, 50, 255, 110, 110, 110, 255]);
    applyPalette(data, 2, 1, table.lut, table.clutterCutoff, null);
    assert.equal(data[3], 0);
    assert.equal(data[7], 255);
    assert.equal(data[5] > 100, true);
  });

  it("leaves non-gray pixels alone", () => {
    const table = parseEnhance(ENHANCE)[0];
    const data = new Uint8ClampedArray([20, 180, 200, 255]);
    applyPalette(data, 1, 1, table.lut, table.clutterCutoff, null);
    assert.deepEqual(Array.from(data), [20, 180, 200, 255]);
  });
});

describe("scene parse", () => {
  it("reads frames, skips navigation, and timestamps as UTC", () => {
    const config = `
overlay_labels = Radar/on, Cities-Roads/always, Navigation/always
overlay_tooltip = Standard Radar, Cities, Map Navigation
overlay_order = 1, 2, 3
auto_enhance = 1, 0, 0
overlay_radio = false/1, false, false
overlay_transparent_amount = 100, 100, 100
overlay_preserve_list = t, f, f
overlay_preserve = 582,392,745,412
`;
    const data = `
image_base = ../metro40/
high_res_basemap = hires/bg.jpg
high_res_overlay = 5,hires/fg.png
high_res_zoom = 2
bg.jpg overlay = N0B_20260923_0639-20260923_0640.png,fg.png,../graphics/navigation_north_texas.png
`;
    const scene = parseScene("metro40", config, data, ENHANCE);
    assert.equal(scene.bg, "metro40/bg.jpg");
    assert.equal(scene.frames.length, 1);
    assert.equal(scene.frames[0].time?.toISOString(), "2026-09-23T06:40:00.000Z");
    assert.deepEqual(
      scene.overlays.map((overlay) => overlay.id),
      ["radar", "cities-roads"],
    );
    assert.equal(scene.overlays[0].defaultOn, true);
    assert.equal(scene.overlays[0].enhanceIndex, 0);
    assert.equal(scene.overlays[0].legend?.x0, 582);
    assert.equal(scene.hires[0].bg, "metro40/hires/bg.jpg");
    assert.equal(frameTimeFromName("STP_20260923_0638.png")?.toISOString(), "2026-09-23T06:38:00.000Z");
  });
});
