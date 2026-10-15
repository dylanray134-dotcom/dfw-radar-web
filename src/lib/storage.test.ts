import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoRefreshIntervalMs,
  DEFAULT_SETTINGS,
  normalizeSettings,
  REFRESH_CHOICES,
  shouldCatchUpRefresh,
  type RefreshMinutes,
} from "./storage";

describe("settings persistence", () => {
  it("defaults auto-refresh to 5 minutes and keep screen on to off", () => {
    const settings = normalizeSettings({});
    assert.equal(settings.refreshMinutes, 5);
    assert.equal(settings.keepScreenOn, false);
    assert.deepEqual(
      REFRESH_CHOICES.map((choice) => choice.label),
      ["Off", "1 minute", "2 minutes", "5 minutes", "10 minutes", "15 minutes"],
    );
  });

  it("keeps every supported refresh interval and a true wake-lock preference", () => {
    for (const choice of REFRESH_CHOICES) {
      const settings = normalizeSettings({ refreshMinutes: choice.minutes, keepScreenOn: true });
      assert.equal(settings.refreshMinutes, choice.minutes);
      assert.equal(settings.keepScreenOn, true);
    }
  });

  it("drops unknown refresh values and non-boolean wake-lock flags", () => {
    const settings = normalizeSettings({
      refreshMinutes: 3 as RefreshMinutes,
      keepScreenOn: "yes" as unknown as boolean,
      regionId: "northtx",
      rememberZoom: false,
    });
    assert.equal(settings.refreshMinutes, DEFAULT_SETTINGS.refreshMinutes);
    assert.equal(settings.keepScreenOn, false);
    assert.equal(settings.regionId, "northtx");
    assert.equal(settings.rememberZoom, false);
  });

  it("keeps older saved settings on the 5 minute default", () => {
    const settings = normalizeSettings({ dwellMs: 400, locationMode: "dfw" });
    assert.equal(settings.refreshMinutes, 5);
    assert.equal(settings.keepScreenOn, false);
    assert.equal(settings.dwellMs, 400);
    assert.equal(settings.locationMode, "dfw");
  });
});

describe("auto-refresh cadence", () => {
  it("turns off the timer only for a zero interval", () => {
    assert.equal(autoRefreshIntervalMs(0), null);
    assert.equal(autoRefreshIntervalMs(1), 60_000);
    assert.equal(autoRefreshIntervalMs(2), 120_000);
    assert.equal(autoRefreshIntervalMs(5), 300_000);
    assert.equal(autoRefreshIntervalMs(10), 600_000);
    assert.equal(autoRefreshIntervalMs(15), 900_000);
  });

  it("catches up only when a positive interval has elapsed since the last sync", () => {
    const five = autoRefreshIntervalMs(5);
    assert.equal(shouldCatchUpRefresh(null, 10_000, five), false);
    assert.equal(shouldCatchUpRefresh(0, 10_000, null), false);
    assert.equal(shouldCatchUpRefresh(0, 299_999, five), false);
    assert.equal(shouldCatchUpRefresh(0, 300_000, five), true);
    assert.equal(shouldCatchUpRefresh(1_000, 1_000 + 60_000, autoRefreshIntervalMs(1)), true);
  });
});
