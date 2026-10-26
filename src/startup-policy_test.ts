import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getStartMinimizedPreference } from "./startup-policy.ts";

test("background mode is required for preference visibility", () => {
  assert.deepEqual(getStartMinimizedPreference({backgroundEnabled: false, suspensionInhibited: true, tray: "ready"}), {
    visible: false, enabled: false, reason: "background-required",
  });
});

test("suspension inhibition is required for preference interaction", () => {
  assert.deepEqual(getStartMinimizedPreference({backgroundEnabled: true, suspensionInhibited: false, tray: "ready"}), {
    visible: true, enabled: false, reason: "suspension-required",
  });
});

test("preference distinguishes a connecting and unavailable tray", () => {
  assert.equal(getStartMinimizedPreference({backgroundEnabled: true, suspensionInhibited: true, tray: "pending"}).reason, "tray-connecting");
  assert.equal(getStartMinimizedPreference({backgroundEnabled: true, suspensionInhibited: true, tray: "unavailable"}).reason, "tray-unavailable");
});

test("ready tray and active inhibitor enables preference", () => {
  assert.deepEqual(getStartMinimizedPreference({backgroundEnabled: true, suspensionInhibited: true, tray: "ready"}), {
    visible: true, enabled: true, reason: "ready",
  });
});


test("tray availability does not block saving Start Minimized", () => {
  for (const tray of ["pending", "unavailable"] as const) {
    const preference = getStartMinimizedPreference({
      backgroundEnabled: true,
      suspensionInhibited: true,
      tray,
    });
    assert.equal(preference.visible, true);
    assert.equal(preference.enabled, true);
  }
});
