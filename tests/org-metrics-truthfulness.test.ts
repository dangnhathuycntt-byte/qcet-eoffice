import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { QCET_ORG_UNITS } from "../src/lib/org/org-structure";

// T61 — directory must not carry fabricated operational metrics.
// headcount / activeTasksCount / activeTaskCount were hard-coded literals with
// no server source. The only honest counts are derived from the dataset itself
// (QCET_ORG_UNITS.length for units, members come from API at runtime).
describe("Org metrics truthfulness (T61)", () => {
  test("org units carry no hard-coded headcount", () => {
    for (const unit of QCET_ORG_UNITS) {
      assert.equal(
        "headcount" in unit,
        false,
        `${unit.code} must not carry a hard-coded headcount`
      );
    }
  });

  test("org units carry no hard-coded open-task counts", () => {
    for (const unit of QCET_ORG_UNITS) {
      assert.equal(
        "activeTasksCount" in unit,
        false,
        `${unit.code} must not carry a hard-coded task count`
      );
    }
  });

  test("org units carry no fabricated member arrays", () => {
    for (const unit of QCET_ORG_UNITS) {
      assert.equal(
        "members" in unit,
        false,
        `${unit.code} must not carry hard-coded members (personnel comes from API)`
      );
    }
  });

  test("honest counts still derive from the dataset", () => {
    const units = QCET_ORG_UNITS.length;
    assert.ok(units >= 4, "directory must list real units");
    // Personnel is now provided by the API, not hard-coded in config
    for (const unit of QCET_ORG_UNITS) {
      assert.ok(unit.name.length > 0, `${unit.code} must have a name`);
      assert.ok(unit.email.length > 0, `${unit.code} must have an email`);
    }
  });
});
