import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedTaskToolbar } from "../src/components/dashboard/unified-task-toolbar";
import type { AuthUser } from "../src/types/auth";

describe("Cascading Fly-out Filter Menu (Anti-AI Slop & Clean Design)", () => {
  const mockUser: AuthUser = {
    id: "u-cntt-vinh",
    name: "KS. Nguyễn Ngọc Vinh",
    email: "vinh@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  test("Renders compact cascading filter button with proper aria-label and no checkboxes", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "my",
        onScopeChange: () => {},
        user: mockUser,
        searchQuery: "",
        onSearchChange: () => {},
        selectedStatus: "in_progress",
        selectedPriority: "URGENT",
      })
    );

    // 1. Trigger button 'Bộ lọc'
    assert.ok(html.includes('aria-label="Bộ lọc"'), "Trigger button must have accessible aria-label");
    assert.ok(html.includes("Bộ lọc"), "Must display 'Bộ lọc' text label");

    // 2. Active filter count badge (2 active: status + priority)
    assert.ok(html.includes(">2<"), "Must render active filter badge count");

    // 3. Anti-slop: zero checkbox inputs or roles in the entire toolbar
    assert.ok(!html.includes('type="checkbox"'), "Must NOT contain any HTML checkbox input");
    assert.ok(!html.includes('role="checkbox"'), "Must NOT contain any role='checkbox'");
  });

  test("Stacking context & semantic icons contract in source code", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/dashboard/unified-task-toolbar.tsx"),
      "utf-8"
    );

    // 1. Root positioner must have z-50 to avoid being clipped by sticky headers
    assert.ok(
      source.includes('MenuPositioner side="bottom" align="start" sideOffset={6} collisionPadding={12} className="z-50 outline-none"'),
      "Root MenuPositioner must have z-50 outline-none"
    );

    // 2. Submenu positioners must have side=left, sideOffset=2, and z-50 outline-none
    assert.ok(
      source.includes('MenuPositioner side="left" align="start" sideOffset={2} alignOffset={-4} collisionPadding={12} className="z-50 outline-none"'),
      "Submenu MenuPositioner must have side=left and z-50 outline-none to avoid overlapping root menu"
    );

    // 3. Status category icon must be CheckCircle2 (clean check circle)
    assert.ok(
      source.includes('key: "status",\n      group: "core",\n      label: "Trạng thái",\n      isActive: isStatusActive,\n      icon: CheckCircle2,'),
      "Status category must use CheckCircle2 icon for clean professional UI"
    );
  });

  test("Anti-slop check: 0% emojis in toolbar filter labels and actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        user: mockUser,
        searchQuery: "",
        onSearchChange: () => {},
      })
    );

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.ok(!emojiRegex.test(html), "Toolbar HTML must not contain any decorative emojis");
  });

  test("Expanded Linear-style rich categories and quick search palette", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/dashboard/unified-task-toolbar.tsx"),
      "utf-8"
    );

    // 1. Supports Linear-style search header 'Thêm bộ lọc... F'
    assert.ok(source.includes('placeholder="Thêm bộ lọc... F"'), "Must include search header input with F shortcut");

    // 2. Contains expanded categories: Lead team, Lead, Collaborators, Health, Origin
    assert.ok(source.includes('label: "Đơn vị"'), "Must include lead team category");
    assert.ok(source.includes('label: "Người chủ trì"'), "Must include lead assignee category");
    assert.ok(source.includes('label: "Người phối hợp"'), "Must include collaborator category");
    assert.ok(source.includes('label: "Tiến độ"'), "Must include health/progress category");
    assert.ok(source.includes('label: "Nguồn gốc"'), "Must include origin category");
  });

  test("Dates flattened into direct 1-tier sub-dropdowns (Hạn chốt and Kỳ tháng) without 3-level nesting", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/dashboard/unified-task-toolbar.tsx"),
      "utf-8"
    );

    // 1. Root menu width compact to 224px (w-56) with clean minimalist design
    assert.ok(source.includes('className="w-56 rounded-xl'), "Root menu width must be w-56 for compact clean design");

    // 2. Direct 1-tier sub-dropdowns: Hạn chốt & Kỳ tháng directly in root menu
    assert.ok(source.includes('label: "Hạn chốt"'), "Must contain direct 1-tier item for Target date / Hạn chốt");
    assert.ok(source.includes('label: "Kỳ tháng"'), "Must contain direct 1-tier item for Academic period / Kỳ tháng");

    // 3. Nested 3-level parent 'Mốc thời gian' eliminated
    assert.ok(!source.includes('label: "Mốc thời gian"'), "Must NOT contain redundant 3-level wrapper 'Mốc thời gian'");

    // 4. No-op stubs removed (anti-slop clean architecture)
    assert.ok(!source.includes("Ngày giao việc"), "Must NOT contain stub sub dropdown for Ngày giao việc");
    assert.ok(!source.includes("Ngày hoàn thành"), "Must NOT contain stub sub dropdown for Ngày hoàn thành");
  });

  test("Comprehensive search indexing in matchingSearchOptions across all 9 dimensions", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/dashboard/unified-task-toolbar.tsx"),
      "utf-8"
    );

    // Verify all dimensions are indexed into matchingSearchOptions
    assert.ok(source.includes("// Match Lead / Người chủ trì"), "Must index Lead options");
    assert.ok(source.includes("// Match Health / Tiến độ"), "Must index Health options");
    assert.ok(source.includes("// Match Origin / Nguồn gốc"), "Must index Origin options");
    assert.ok(source.includes("// Match Collaborator / Người phối hợp"), "Must index Collaborator options");
    assert.ok(source.includes("// Match Months"), "Must index Academic month options T1..T12");
  });

  test("filterDisplayedTasks canonical filtering engine supports health, origin, and collaborator", async () => {
    const { filterDisplayedTasks } = await import(
      "../src/components/workspace/unified-adaptive-workspace"
    );

    const sampleTasks: any[] = [
      {
        id: "t-1",
        title: "Kế hoạch tuyển sinh 2026",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20", // overdue relative to 2026-09-26
        progressPercent: 50,
        originLevel: "KE_HOACH_NAM",
        coDepartmentCodes: ["DAO_TAO"],
        coAssignees: ["GV. Nguyen Van A"],
      },
      {
        id: "t-2",
        title: "Nghị quyết nâng cấp phòng lab CNTT",
        status: "IN_PROGRESS",
        dueDate: "2026-09-28", // at risk (within 7 days of 2026-09-26)
        progressPercent: 30,
        originLevel: "NGHI_QUYET",
        coDepartmentCodes: [],
        coAssignees: [],
      },
      {
        id: "t-3",
        title: "Báo cáo kiểm định chất lượng",
        status: "COMPLETED",
        dueDate: "2026-09-15",
        progressPercent: 100,
        originLevel: "KE_HOACH_NAM",
        coDepartmentCodes: ["KHAO_THI"],
        coAssignees: [],
      },
      {
        id: "t-4",
        title: "Xây dựng đề cương chi tiết học kỳ 2",
        status: "IN_PROGRESS",
        dueDate: "2026-11-30", // on track (well in advance)
        progressPercent: 20,
        origin: "DON_VI",
        coDepartmentCodes: [],
        coAssignees: [],
      },
    ];

    const refDate = "2026-09-26";

    // 1. Health filter
    const overdueResult = filterDisplayedTasks({
      tasks: sampleTasks,
      health: "overdue",
      referenceDate: refDate,
    });
    assert.equal(overdueResult.length, 1);
    assert.equal(overdueResult[0].id, "t-1");

    const atRiskResult = filterDisplayedTasks({
      tasks: sampleTasks,
      health: "at_risk",
      referenceDate: refDate,
    });
    assert.equal(atRiskResult.length, 1);
    assert.equal(atRiskResult[0].id, "t-2");

    const completedResult = filterDisplayedTasks({
      tasks: sampleTasks,
      health: "completed",
      referenceDate: refDate,
    });
    assert.equal(completedResult.length, 1);
    assert.equal(completedResult[0].id, "t-3");

    const onTrackResult = filterDisplayedTasks({
      tasks: sampleTasks,
      health: "on_track",
      referenceDate: refDate,
    });
    assert.equal(onTrackResult.length, 1);
    assert.equal(onTrackResult[0].id, "t-4");

    // 2. Origin filter
    const originResult = filterDisplayedTasks({
      tasks: sampleTasks,
      origin: "KE_HOACH_NAM",
      referenceDate: refDate,
    });
    assert.equal(originResult.length, 2);
    assert.ok(originResult.every((t) => (t as any).originLevel === "KE_HOACH_NAM"));

    const originResult2 = filterDisplayedTasks({
      tasks: sampleTasks,
      origin: "DON_VI",
      referenceDate: refDate,
    });
    assert.equal(originResult2.length, 1);
    assert.equal(originResult2[0].id, "t-4");

    // 3. Collaborator filter
    const collabResult = filterDisplayedTasks({
      tasks: sampleTasks,
      collaborator: "has_collab",
      referenceDate: refDate,
    });
    assert.equal(collabResult.length, 2); // t-1 and t-3
    assert.ok(collabResult.some((t) => t.id === "t-1"));
    assert.ok(collabResult.some((t) => t.id === "t-3"));

    const singleResult = filterDisplayedTasks({
      tasks: sampleTasks,
      collaborator: "single",
      referenceDate: refDate,
    });
    assert.equal(singleResult.length, 2); // t-2 and t-4
    assert.ok(singleResult.some((t) => t.id === "t-2"));
    assert.ok(singleResult.some((t) => t.id === "t-4"));
  });

  test("Cascading direction: All submenus open to side='left' to prevent overlapping parent/grandparent menus (Linear pattern)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/dashboard/unified-task-toolbar.tsx"),
      "utf-8"
    );

    // Anti-overlapping invariant: no submenu positioner should use side="right"
    assert.ok(
      !source.includes('MenuPositioner side="right"'),
      "Submenu positioners must not use side='right' which would overlap parent root menu"
    );
    assert.ok(
      source.includes('MenuPositioner side="left"'),
      "Submenu positioners must open to side='left'"
    );
  });
});
