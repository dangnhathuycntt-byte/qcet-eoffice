import test from "node:test";
import assert from "node:assert/strict";
import { parseZoneParam } from "../src/types/workspace";
import { resolveBreadcrumb } from "../src/lib/navigation/active-matcher";

test("parseZoneParam defaults to 'dashboard' when param is null or undefined (Bàn làm việc Cockpit)", () => {
  assert.equal(parseZoneParam(null), "dashboard");
  assert.equal(parseZoneParam(undefined), "dashboard");
  assert.equal(parseZoneParam(""), "dashboard");
  assert.equal(parseZoneParam("tasks"), "tasks");
  assert.equal(parseZoneParam("calendar"), "calendar");
});

test("resolveBreadcrumb for root path '/' resolves to 'Bàn làm việc'", () => {
  const crumbs = resolveBreadcrumb("/");
  assert.deepEqual(crumbs, ["QCET E-Office", "Bàn làm việc"]);
});
