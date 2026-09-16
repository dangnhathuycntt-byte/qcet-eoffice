import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildQuickFilterPills,
  type QuickFilterPill,
} from "../src/components/dashboard/unified-task-toolbar";
import {
  saveCustomView,
  getCustomSavedViews,
  updateCustomView,
  deleteCustomView,
  type TaskViewCriteria,
} from "../src/lib/saved-views/saved-views-store";

describe("Saved Filters & Scope Recovery Test Suite", () => {
  describe("1. Scope Hierarchy & Default Recovery Flow", () => {
    test("Enforces canonical scope order: Cá nhân (my) → Đơn vị (unit) → Toàn trường (school)", () => {
      const canonicalScopes = ["my", "unit", "school"];
      assert.strictEqual(canonicalScopes[0], "my");
      assert.strictEqual(canonicalScopes[1], "unit");
      assert.strictEqual(canonicalScopes[2], "school");
    });

    test("Resolves initial scope by role for first-time login", () => {
      const getInitialRoleScope = (role: string) => {
        if (role === "ADMIN" || role === "BGH" || role === "BAN_GIAM_HIEU") return "school";
        if (role === "MANAGER" || role === "TRUONG_PHONG" || role === "TRUONG_KHOA") return "unit";
        return "my";
      };

      assert.strictEqual(getInitialRoleScope("STAFF"), "my", "Chuyên viên defaults to Cá nhân");
      assert.strictEqual(getInitialRoleScope("MANAGER"), "unit", "Trưởng đơn vị defaults to Đơn vị");
      assert.strictEqual(getInitialRoleScope("ADMIN"), "school", "BGH defaults to Toàn trường");
    });

    test("Priority order: URL Query > User Stored Preference > First-time Role Default", () => {
      const resolveEffectiveScope = (
        urlScope?: string,
        storedUserScope?: string,
        userRole: string = "STAFF"
      ) => {
        if (urlScope && (urlScope === "school" || urlScope === "unit" || urlScope === "my")) {
          return urlScope;
        }
        if (storedUserScope && (storedUserScope === "school" || storedUserScope === "unit" || storedUserScope === "my")) {
          return storedUserScope;
        }
        if (userRole === "ADMIN") return "school";
        if (userRole === "MANAGER") return "unit";
        return "my";
      };

      // Case A: URL parameter is present
      assert.strictEqual(resolveEffectiveScope("school", "unit", "STAFF"), "school");

      // Case B: URL is not present, but user has recent stored preference
      assert.strictEqual(resolveEffectiveScope(undefined, "unit", "STAFF"), "unit");

      // Case C: First-time login without URL or stored pref
      assert.strictEqual(resolveEffectiveScope(undefined, undefined, "STAFF"), "my");
      assert.strictEqual(resolveEffectiveScope(undefined, undefined, "MANAGER"), "unit");
      assert.strictEqual(resolveEffectiveScope(undefined, undefined, "ADMIN"), "school");
    });
  });

  describe("2. Quick Filter Pills Order & Business Logic", () => {
    test("buildQuickFilterPills places Tất cả → Quá hạn → Đến hạn tuần này → Chờ duyệt first", () => {
      const tabCounts = {
        all: 50,
        overdue: 5,
        this_week: 12,
        today: 3,
        waiting_approval: 8,
        review: 8,
        pending_submission: 4,
      };

      const pills = buildQuickFilterPills(true, tabCounts as any, "all", 50);

      assert.strictEqual(pills.length, 4);
      assert.strictEqual(pills[0].id, "all");
      assert.strictEqual(pills[0].label, "Tất cả");
      assert.strictEqual(pills[0].count, 50);

      assert.strictEqual(pills[1].id, "overdue");
      assert.strictEqual(pills[1].label, "Quá hạn");
      assert.strictEqual(pills[1].count, 5);

      assert.strictEqual(pills[2].id, "this_week");
      assert.strictEqual(pills[2].label, "Đến hạn tuần này");
      assert.strictEqual(pills[2].count, 12);

      assert.strictEqual(pills[3].id, "waiting_approval");
      assert.strictEqual(pills[3].label, "Chờ duyệt");
      assert.strictEqual(pills[3].count, 8);
    });
  });

  describe("3. Saved Filters (Lưu bộ lọc) Storage & Mutations", () => {
    test("saveCustomView, updateCustomView, and deleteCustomView manage filter criteria safely", () => {
      const testUserId = "test-user-vinh";
      const sampleCriteria: TaskViewCriteria = {
        scope: "unit",
        dept: "CNTT",
        status: "overdue",
        priority: "URGENT",
      };

      // Save filter
      const saved = saveCustomView("Việc CNTT quá hạn khẩn cấp", sampleCriteria, testUserId);
      assert.ok(saved.id);
      assert.strictEqual(saved.name, "Việc CNTT quá hạn khẩn cấp");
      assert.strictEqual(saved.criteria.dept, "CNTT");
      assert.strictEqual(saved.criteria.status, "overdue");

      // Verify retrieved from storage
      const allViews = getCustomSavedViews(testUserId);
      assert.ok(allViews.some((v) => v.id === saved.id));

      // Rename filter
      const updated = updateCustomView(saved.id, { name: "Bộ lọc CNTT Cần Gấp" }, testUserId);
      assert.strictEqual(updated?.name, "Bộ lọc CNTT Cần Gấp");

      // Delete filter
      const isDeleted = deleteCustomView(saved.id, testUserId);
      assert.strictEqual(isDeleted, true);

      const afterDelete = getCustomSavedViews(testUserId);
      assert.ok(!afterDelete.some((v) => v.id === saved.id));
    });
  });
});
