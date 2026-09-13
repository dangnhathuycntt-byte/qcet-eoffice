import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";

// T61 — directory must not carry fabricated operational metrics.
// headcount / activeTasksCount / activeTaskCount were hard-coded literals with
// no server source. The only honest counts are derived from the dataset itself
// (departments.length, members.length).
describe("Org metrics truthfulness (T61)", () => {
  test("departments carry no hard-coded headcount", () => {
    for (const dept of QCET_DEPARTMENTS) {
      assert.equal(
        "headcount" in dept,
        false,
        `${dept.code} must not carry a hard-coded headcount`
      );
    }
  });

  test("departments carry no hard-coded open-task counts", () => {
    for (const dept of QCET_DEPARTMENTS) {
      assert.equal(
        "activeTasksCount" in dept,
        false,
        `${dept.code} must not carry a hard-coded task count`
      );
    }
  });

  test("staff carry no hard-coded per-person task counts", () => {
    for (const dept of QCET_DEPARTMENTS) {
      for (const member of dept.members) {
        assert.equal(
          "activeTaskCount" in member,
          false,
          `${member.name} must not carry a hard-coded task count`
        );
      }
    }
  });

  test("honest counts still derive from the dataset", () => {
    const units = QCET_DEPARTMENTS.length;
    const staff = QCET_DEPARTMENTS.reduce((acc, d) => acc + d.members.length, 0);
    assert.ok(units >= 4, "directory must list real units");
    assert.ok(staff > units, "directory must list real personnel");
    for (const dept of QCET_DEPARTMENTS) {
      assert.ok(dept.members.length > 0, `${dept.code} must list real members`);
    }
  });
});
