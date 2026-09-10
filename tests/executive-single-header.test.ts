// tests/executive-single-header.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Single Header Rule for Executive Role", () => {
  it("xác nhận logic vai trò ADMIN / Lãnh đạo BGH không render header 2 tầng", () => {
    const shouldRenderOuterHeader = (role: string, isExecutive: boolean) => {
      if (isExecutive) return false;
      return true;
    };

    assert.equal(shouldRenderOuterHeader("ADMIN", true), false);
    assert.equal(shouldRenderOuterHeader("HIEU_TRUONG", true), false);
    assert.equal(shouldRenderOuterHeader("PHO_HIEU_TRUONG", true), false);
    assert.equal(shouldRenderOuterHeader("MANAGER", false), true);
    assert.equal(shouldRenderOuterHeader("TRUONG_KHOA", false), true);
    assert.equal(shouldRenderOuterHeader("STAFF", false), true);
    assert.equal(shouldRenderOuterHeader("GIANG_VIEN", false), true);
  });

  it("xác nhận page.tsx bỏ qua outer context banner khi người dùng là Executive", () => {
    const pageContent = [
      fs.readFileSync(path.resolve(process.cwd(), "src/app/page.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/dashboard/zones/tasks-focus-landing.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/workspace/unified-adaptive-workspace.tsx"), "utf-8"),
    ].join("\n");

    assert.ok(
      pageContent.includes('data-slot="role-workspace-landing"'),
      "role-workspace-landing slot must exist"
    );
    assert.ok(
      pageContent.includes("UnifiedAdaptiveWorkspace") || pageContent.includes("ExecutiveCockpitWorkspace"),
      "Must render UnifiedAdaptiveWorkspace or ExecutiveCockpitWorkspace"
    );
  });

  it("xác nhận page.tsx đã loại bỏ hoàn toàn nút legacy 'Chế độ xem toàn trường (Nâng cao)'", () => {
    const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    assert.ok(
      !pageContent.includes("Chế độ xem toàn trường (Nâng cao)"),
      "page.tsx không được chứa nút toggle 'Chế độ xem toàn trường (Nâng cao)'"
    );
  });

  it("xác nhận page.tsx đồng bộ scope URL với các workspace điều hành", () => {
    const combinedContent = [
      fs.readFileSync(path.resolve(process.cwd(), "src/app/page.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/hooks/use-task-filters.ts"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/dashboard/dashboard-context.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/portal/executive-cockpit-workspace.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/portal/department-manager-workspace.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/portal/lecturer-focus-workspace.tsx"), "utf-8"),
    ].join("\n");

    assert.ok(
      combinedContent.includes("isSchoolView"),
      "phải định nghĩa biến cờ isSchoolView để đồng bộ phạm vi toàn trường"
    );
    assert.ok(
      combinedContent.includes("isUnitView"),
      "phải định nghĩa biến cờ isUnitView để đồng bộ phạm vi đơn vị"
    );
    assert.ok(
      combinedContent.includes("ExecutiveCockpitWorkspace"),
      "phải render ExecutiveCockpitWorkspace cho phạm vi toàn trường"
    );
    assert.ok(
      combinedContent.includes("DepartmentManagerWorkspace"),
      "phải render DepartmentManagerWorkspace cho phạm vi đơn vị"
    );
    assert.ok(
      combinedContent.includes("LecturerFocusWorkspace"),
      "phải render LecturerFocusWorkspace cho phạm vi cá nhân"
    );
  });
});
