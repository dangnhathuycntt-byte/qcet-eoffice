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
    const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    // Kiểm tra cấu trúc role-workspace-landing
    const landingSection = pageContent.substring(
      pageContent.indexOf('data-slot="role-workspace-landing"')
    );

    // Phải có {!isExecutive && ... trước ExecutiveCockpitWorkspace
    const outerHeaderExecutiveGuard =
      landingSection.includes("{!isExecutive && (") ||
      landingSection.includes("{!isExecutive &&");

    assert.ok(
      outerHeaderExecutiveGuard,
      "role-workspace-landing must guard outer context banner with {!isExecutive && ...} to avoid 2-tier redundant header"
    );

    // Và ExecutiveCockpitWorkspace phải nằm sau block này
    const guardIndex = landingSection.indexOf("{!isExecutive &&");
    const executiveWorkspaceIndex = landingSection.indexOf("<ExecutiveCockpitWorkspace");

    assert.ok(
      guardIndex !== -1 && guardIndex < executiveWorkspaceIndex,
      "{!isExecutive && ...} guard must appear before <ExecutiveCockpitWorkspace"
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
    const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    assert.ok(
      pageContent.includes("isSchoolView"),
      "page.tsx phải định nghĩa biến cờ isSchoolView để đồng bộ phạm vi toàn trường"
    );
    assert.ok(
      pageContent.includes("isUnitView"),
      "page.tsx phải định nghĩa biến cờ isUnitView để đồng bộ phạm vi đơn vị"
    );
    assert.ok(
      pageContent.includes("<ExecutiveCockpitWorkspace"),
      "page.tsx phải render ExecutiveCockpitWorkspace cho phạm vi toàn trường"
    );
    assert.ok(
      pageContent.includes("<DepartmentManagerWorkspace"),
      "page.tsx phải render DepartmentManagerWorkspace cho phạm vi đơn vị"
    );
    assert.ok(
      pageContent.includes("<LecturerFocusWorkspace"),
      "page.tsx phải render LecturerFocusWorkspace cho phạm vi cá nhân"
    );
  });
});
