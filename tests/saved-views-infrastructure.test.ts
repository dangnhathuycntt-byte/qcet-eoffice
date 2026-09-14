import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  EXECUTIVE_PRESETS,
  MANAGER_PRESETS,
  STAFF_PRESETS,
  ALL_ROLE_PRESETS,
  getRolePresetViews,
  findPresetById,
  findPresetByName,
  areCriteriaEqual,
  criteriaToUrlParams,
  urlParamsToCriteria,
  getCustomSavedViews,
  saveCustomView,
  updateCustomView,
  deleteCustomView,
  clearCustomViews,
  type TaskViewCriteria,
  type SavedTaskView,
} from "../src/lib/saved-views/saved-views-store";
import type { AuthUser } from "../src/types/auth";

describe("Saved Views Infrastructure", () => {
  // Mock localStorage for node environment
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  });

  afterEach(() => {
    clearCustomViews();
    delete (globalThis as any).localStorage;
  });

  describe("1. Role Presets Specification", () => {
    it("should provide exact Executive presets: Chờ BGH duyệt, Trễ hạn toàn trường, Nhiệm vụ trọng tâm", () => {
      const names = EXECUTIVE_PRESETS.map((p) => p.name);
      assert.ok(names.includes("Chờ BGH duyệt"));
      assert.ok(names.includes("Trễ hạn toàn trường"));
      assert.ok(names.includes("Nhiệm vụ trọng tâm"));

      const pendingView = EXECUTIVE_PRESETS.find((p) => p.name === "Chờ BGH duyệt");
      assert.equal(pendingView?.criteria.scope, "school");
      assert.equal(pendingView?.criteria.status, "pending_review");

      const overdueView = EXECUTIVE_PRESETS.find((p) => p.name === "Trễ hạn toàn trường");
      assert.equal(overdueView?.criteria.scope, "school");
      assert.equal(overdueView?.criteria.status, "overdue");

      const highPriorityView = EXECUTIVE_PRESETS.find((p) => p.name === "Nhiệm vụ trọng tâm");
      assert.equal(highPriorityView?.criteria.scope, "school");
      assert.equal(highPriorityView?.criteria.priority, "HIGH");
    });

    it("should provide exact Manager presets: Chờ tôi duyệt, Việc đơn vị, Quá hạn đơn vị", () => {
      const names = MANAGER_PRESETS.map((p) => p.name);
      assert.ok(names.includes("Chờ tôi duyệt"));
      assert.ok(names.includes("Việc đơn vị"));
      assert.ok(names.includes("Quá hạn đơn vị"));

      const pendingView = MANAGER_PRESETS.find((p) => p.name === "Chờ tôi duyệt");
      assert.equal(pendingView?.criteria.scope, "unit");
      assert.equal(pendingView?.criteria.status, "pending_review");

      const unitTasks = MANAGER_PRESETS.find((p) => p.name === "Việc đơn vị");
      assert.equal(unitTasks?.criteria.scope, "unit");

      const overdueUnit = MANAGER_PRESETS.find((p) => p.name === "Quá hạn đơn vị");
      assert.equal(overdueUnit?.criteria.scope, "unit");
      assert.equal(overdueUnit?.criteria.status, "overdue");
    });

    it("should provide exact Staff presets: Việc của tôi, Hạn tuần này", () => {
      const names = STAFF_PRESETS.map((p) => p.name);
      assert.ok(names.includes("Việc của tôi"));
      assert.ok(names.includes("Hạn tuần này"));

      const myTasks = STAFF_PRESETS.find((p) => p.name === "Việc của tôi");
      assert.equal(myTasks?.criteria.scope, "my");

      const thisWeek = STAFF_PRESETS.find((p) => p.name === "Hạn tuần này");
      assert.equal(thisWeek?.criteria.scope, "my");
      assert.equal(thisWeek?.criteria.status, "in_progress");
    });

    it("should resolve role-preset views based on user role and attributes", () => {
      const execUser: AuthUser = {
        id: "u1",
        email: "hieutruong@example.com",
        name: "Hiệu trưởng",
        role: "ADMIN",
        roleLabel: "Ban Giám hiệu",
        department: "BGH",
        departmentCode: "BGH",
      };
      const execViews = getRolePresetViews("EXECUTIVE", execUser);
      assert.equal(execViews.length, 3);
      assert.equal(execViews[0].name, "Chờ BGH duyệt");

      const managerUser: AuthUser = {
        id: "u2",
        email: "truongkhoa@example.com",
        name: "Trưởng khoa",
        role: "MANAGER",
        roleLabel: "Trưởng khoa CNTT",
        department: "KHOA_CNTT",
        departmentCode: "KHOA_CNTT",
      };
      const mgrViews = getRolePresetViews("MANAGER", managerUser);
      assert.equal(mgrViews.length, 3);
      assert.equal(mgrViews[0].name, "Chờ tôi duyệt");

      const staffUser: AuthUser = {
        id: "u3",
        email: "giangvien@example.com",
        name: "Giảng viên",
        role: "STAFF",
        roleLabel: "Giảng viên",
        department: "KHOA_CNTT",
        departmentCode: "KHOA_CNTT",
      };
      const staffViews = getRolePresetViews("STAFF", staffUser);
      assert.equal(staffViews.length, 2);
      assert.equal(staffViews[0].name, "Việc của tôi");
    });

    it("should lookup presets by id and by name (including legacy star prefix compatibility)", () => {
      const byId = findPresetById("exec-pending-approval");
      assert.ok(byId);
      assert.equal(byId?.name, "Chờ BGH duyệt");

      // Test backwards compatibility with legacy star prefix
      const byLegacyName = findPresetByName("★ Quá hạn đơn vị");
      assert.ok(byLegacyName);
      assert.equal(byLegacyName?.id, "mgr-unit-overdue");

      // Test clean name lookup
      const byCleanName = findPresetByName("Quá hạn đơn vị");
      assert.ok(byCleanName);
      assert.equal(byCleanName?.id, "mgr-unit-overdue");
    });
  });

  describe("2. Custom Saved Views Storage Operations", () => {
    it("should save, retrieve, update, and delete custom views", () => {
      assert.deepEqual(getCustomSavedViews(), []);

      const criteria1: TaskViewCriteria = {
        scope: "school",
        dept: "PHONG_DT",
        status: "in_progress",
        priority: "HIGH",
        academicMonth: 10,
        viewMode: "kanban",
        density: "compact",
      };

      const view1 = saveCustomView("Nhiệm vụ P.ĐT Tháng 10", criteria1);
      assert.ok(view1.id.startsWith("custom-"));
      assert.equal(view1.name, "Nhiệm vụ P.ĐT Tháng 10");
      assert.equal(view1.isPreset, false);
      assert.deepEqual(view1.criteria, criteria1);

      // Verify retrieval
      const list = getCustomSavedViews();
      assert.equal(list.length, 1);
      assert.equal(list[0].id, view1.id);

      // Update name
      const updated = updateCustomView(view1.id, { name: "Nhiệm vụ P.ĐT Kỳ 1" });
      assert.ok(updated);
      assert.equal(updated?.name, "Nhiệm vụ P.ĐT Kỳ 1");

      const listAfterUpdate = getCustomSavedViews();
      assert.equal(listAfterUpdate[0].name, "Nhiệm vụ P.ĐT Kỳ 1");

      // Delete
      const deleted = deleteCustomView(view1.id);
      assert.equal(deleted, true);
      assert.deepEqual(getCustomSavedViews(), []);
    });

    it("should handle storage serialization gracefully", () => {
      saveCustomView("View 1", { scope: "my" });
      saveCustomView("View 2", { scope: "unit", dept: "KHOA_CK" });

      const views = getCustomSavedViews();
      assert.equal(views.length, 2);

      clearCustomViews();
      assert.deepEqual(getCustomSavedViews(), []);
    });
  });

  describe("3. Criteria Comparison and URL Synchronization", () => {
    it("should correctly compare criteria treating undefined and ALL / all as equivalent", () => {
      const c1: TaskViewCriteria = {
        scope: "my",
        dept: "ALL",
        status: "all",
        category: "ALL",
        priority: "ALL",
        academicMonth: "ALL",
        viewMode: "table",
      };
      const c2: TaskViewCriteria = {
        scope: "my",
      };
      assert.equal(areCriteriaEqual(c1, c2), true);

      const c3: TaskViewCriteria = {
        scope: "my",
        status: "overdue",
      };
      assert.equal(areCriteriaEqual(c1, c3), false);
    });

    it("should serialize criteria to URL params cleanly without redundant defaults", () => {
      const criteria: TaskViewCriteria = {
        scope: "school",
        dept: "PHONG_KHCN",
        status: "pending_review",
        workbox: "pending",
        category: "ALL",
        priority: "HIGH",
        academicMonth: 11,
        q: "nghiên cứu",
        viewMode: "kanban",
        density: "compact",
        sortField: "dueDate",
        sortDirection: "asc",
      };

      const params = criteriaToUrlParams(criteria, "exec-pending-approval");
      assert.equal(params.scope, "school");
      assert.equal(params.dept, "PHONG_KHCN");
      assert.equal(params.status, "pending_review");
      assert.equal(params.workbox, "pending");
      assert.equal(params.month, "11");
      assert.equal(params.priority, "HIGH");
      assert.equal(params.q, "nghiên cứu");
      assert.equal(params.view, "kanban");
      assert.equal(params.density, "compact");
      assert.equal(params.viewId, "exec-pending-approval");
      // Category "ALL" should not be serialized
      assert.equal(params.category, undefined);
    });

    it("should parse URL search params back to criteria", () => {
      const search = "?scope=unit&dept=KHOA_CNTT&status=overdue&month=9&q=b%C3%A1o%20c%C3%A1o&view=kanban&density=compact&viewId=mgr-unit-overdue";
      const { criteria, viewId } = urlParamsToCriteria(search);

      assert.equal(viewId, "mgr-unit-overdue");
      assert.equal(criteria.scope, "unit");
      assert.equal(criteria.dept, "KHOA_CNTT");
      assert.equal(criteria.status, "overdue");
      assert.equal(criteria.academicMonth, 9);
      assert.equal(criteria.q, "báo cáo");
      assert.equal(criteria.viewMode, "kanban");
      assert.equal(criteria.density, "compact");
    });
  });

  describe("4. Anti-slop & Light-Only Standard Compliance", () => {
    it("should not contain dark: classes in saved views code", () => {
      const storePath = path.resolve(__dirname, "../src/lib/saved-views/saved-views-store.ts");
      const selectorPath = path.resolve(__dirname, "../src/components/tasks/saved-views-selector.tsx");

      const storeContent = fs.readFileSync(storePath, "utf-8");
      const selectorContent = fs.readFileSync(selectorPath, "utf-8");

      assert.ok(!storeContent.includes("dark:"), "saved-views-store must have zero dark: classes");
      assert.ok(!selectorContent.includes("dark:"), "saved-views-selector must have zero dark: classes");
    });

    it("should have zero decorative emojis and use Lucide icons or typographic glyphs", () => {
      const selectorPath = path.resolve(__dirname, "../src/components/tasks/saved-views-selector.tsx");
      const selectorContent = fs.readFileSync(selectorPath, "utf-8");

      // Regex checking for common emojis (excluding plain characters)
      const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      // We allow the star character ★ used in preset titles
      const sanitized = selectorContent.replace(/★/g, "");
      assert.ok(!emojiRegex.test(sanitized), "saved-views-selector must not contain decorative emojis");
    });

    it("should have minimum font size >= 12px (text-xs or larger)", () => {
      const selectorPath = path.resolve(__dirname, "../src/components/tasks/saved-views-selector.tsx");
      const selectorContent = fs.readFileSync(selectorPath, "utf-8");

      // No text-[10px], text-[9px], text-[8px], text-[11px]
      const smallFontRegex = /text-\[(?:[0-9]|10|11)px\]/;
      assert.ok(!smallFontRegex.test(selectorContent), "Font sizes must be at least 12px (text-xs or larger)");
    });
  });
});
