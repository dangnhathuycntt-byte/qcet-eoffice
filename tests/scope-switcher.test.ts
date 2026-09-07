import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { parseScopeParam, scopeToParam, type TaskScope } from "@/lib/unified-task-hub";
import {
  resolveScopeDetails,
  buildScopeUrl,
  resolveDepartment,
  formatDepartmentLabel,
} from "@/components/layout/scope-switcher";

describe("Scope Switcher Logic & Parameter Suite", () => {
  describe("TaskHub Scope Helpers", () => {
    test("parseScopeParam correctly identifies school, unit, and my", () => {
      assert.strictEqual(parseScopeParam("school"), "SCHOOL_TASKS");
      assert.strictEqual(parseScopeParam("school_tasks"), "SCHOOL_TASKS");
      assert.strictEqual(parseScopeParam("unit"), "UNIT_TASKS");
      assert.strictEqual(parseScopeParam("unit_tasks"), "UNIT_TASKS");
      assert.strictEqual(parseScopeParam("my"), "MY_TASKS");
      assert.strictEqual(parseScopeParam("my_tasks"), "MY_TASKS");
    });

    test("scopeToParam maps TaskScope to shorthand query values", () => {
      assert.strictEqual(scopeToParam("SCHOOL_TASKS"), "school");
      assert.strictEqual(scopeToParam("UNIT_TASKS"), "unit");
      assert.strictEqual(scopeToParam("MY_TASKS"), "my");
    });

    test("Falls back to defaultScope when parameter is null or undefined", () => {
      assert.strictEqual(parseScopeParam(null, "SCHOOL_TASKS"), "SCHOOL_TASKS");
      assert.strictEqual(parseScopeParam(undefined, "MY_TASKS"), "MY_TASKS");
    });
  });

  describe("Scope Details Resolution", () => {
    test("Resolves current scope label and icon: Toàn trường (BGH QCET)", () => {
      const details = resolveScopeDetails("school");
      assert.strictEqual(details.scope, "school");
      assert.strictEqual(details.label, "Toàn trường (BGH QCET)");
      assert.strictEqual(details.iconType, "School");
      assert.strictEqual(details.triggerLabel, "Phạm vi: Toàn trường (BGH QCET)");
    });

    test("Resolves current scope label and icon: Phòng Đào tạo & QLKH", () => {
      const details = resolveScopeDetails("unit", "DAO_TAO");
      assert.strictEqual(details.scope, "unit");
      assert.strictEqual(details.label, "Phòng Đào tạo & QLKH");
      assert.strictEqual(details.iconType, "Building2");
      assert.ok(details.department);
      assert.strictEqual(details.department?.code, "P_DTQLKH");
      assert.strictEqual(details.triggerLabel, "Phạm vi: Phòng Đào tạo & QLKH");
    });

    test("Resolves current scope label and icon: Cá nhân (Của tôi)", () => {
      const details = resolveScopeDetails("my");
      assert.strictEqual(details.scope, "my");
      assert.strictEqual(details.label, "Cá nhân (Của tôi)");
      assert.strictEqual(details.iconType, "User");
      assert.strictEqual(details.triggerLabel, "Phạm vi: Cá nhân (Của tôi)");
    });

    test("Defaults to Cá nhân (Của tôi) when scope is undefined or empty", () => {
      const detailsNull = resolveScopeDetails(null);
      assert.strictEqual(detailsNull.scope, "my");
      assert.strictEqual(detailsNull.label, "Cá nhân (Của tôi)");
      assert.strictEqual(detailsNull.iconType, "User");

      const detailsEmpty = resolveScopeDetails("");
      assert.strictEqual(detailsEmpty.scope, "my");
      assert.strictEqual(detailsEmpty.label, "Cá nhân (Của tôi)");
    });

    test("Falls back to generic 'Đơn vị' when unit scope has no department specified", () => {
      const details = resolveScopeDetails("unit", null);
      assert.strictEqual(details.scope, "unit");
      assert.strictEqual(details.label, "Đơn vị");
      assert.strictEqual(details.iconType, "Building2");
      assert.strictEqual(details.triggerLabel, "Phạm vi: Đơn vị");
    });

    test("Resolves other authentic QCET units like Khoa CNTT", () => {
      const details = resolveScopeDetails("unit", "K_CNTT");
      assert.strictEqual(details.scope, "unit");
      assert.strictEqual(details.label, "Khoa CNTT");
      assert.strictEqual(details.iconType, "Building2");
    });
  });

  describe("Clean URL Construction", () => {
    test("Constructs clean URL for school scope (?scope=school)", () => {
      const url = buildScopeUrl("school");
      assert.strictEqual(url, "?scope=school");
    });

    test("Constructs clean URL for unit scope with department (?scope=unit&dept=DAO_TAO)", () => {
      const url = buildScopeUrl("unit", "DAO_TAO");
      assert.strictEqual(url, "?scope=unit&dept=DAO_TAO");
    });

    test("Constructs clean URL for my scope (?scope=my)", () => {
      const url = buildScopeUrl("my");
      assert.strictEqual(url, "?scope=my");
    });

    test("Removes old dept parameter when switching from unit to school or my", () => {
      const urlToSchool = buildScopeUrl("school", undefined, "", "scope=unit&dept=DAO_TAO&other=123");
      assert.ok(!urlToSchool.includes("dept="), "Must not include dept when switching to school");
      assert.ok(urlToSchool.includes("scope=school"));
      assert.ok(urlToSchool.includes("other=123"));

      const urlToMy = buildScopeUrl("my", undefined, "", "scope=unit&dept=DAO_TAO");
      assert.ok(!urlToMy.includes("dept="), "Must not include dept when switching to my");
      assert.ok(urlToMy.includes("scope=my"));
    });

    test("Appends clean query to target pathname when pathname is provided", () => {
      const url = buildScopeUrl("school", undefined, "/tasks");
      assert.strictEqual(url, "/tasks?scope=school");
    });
  });
});
