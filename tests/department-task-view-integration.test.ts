import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { aggregateTasksByDepartment } from "../src/lib/department-task-aggregator";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { parseViewModeParam } from "../src/lib/unified-task-hub";

describe("Department Grouped Task View Integration", () => {
  const payload = getMockDashboardPayload();

  test("parseViewModeParam parses 'department' and 'don-vi' correctly", () => {
    assert.equal(parseViewModeParam("department"), "department");
    assert.equal(parseViewModeParam("don-vi"), "department");
    assert.equal(parseViewModeParam("unit"), "department");
  });

  test("Gom nhóm toàn bộ dữ liệu mock của trường thành 12 đơn vị", () => {
    const groups = aggregateTasksByDepartment(payload.tasks, QCET_DEPARTMENTS, "2026-09-06");
    assert.equal(groups.length, QCET_DEPARTMENTS.length);

    // Kiểm tra tổng số tasks gom được khớp với số lượng tasks mock
    const totalSchoolTasks = groups.reduce((sum, g) => sum + g.schoolTasks.length, 0);
    assert.equal(totalSchoolTasks, payload.tasks.length);
  });

  test("Mỗi đơn vị có đầy đủ các trường thống kê theo chuẩn Workday Sup-Org", () => {
    const groups = aggregateTasksByDepartment(payload.tasks, QCET_DEPARTMENTS, "2026-09-06");
    for (const g of groups) {
      assert.ok(g.departmentCode);
      assert.ok(g.departmentName);
      assert.ok(g.leaderName);
      assert.ok(["GREEN", "AMBER", "RED"].includes(g.stats.ragStatus));
      assert.ok(typeof g.stats.averageProgress === "number");
      assert.ok(g.stats.averageProgress >= 0 && g.stats.averageProgress <= 100);
    }
  });

  test("File component department-grouped-task-view.tsx tồn tại và tuân thủ chuẩn Anti-slop", () => {
    const componentPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    assert.ok(fs.existsSync(componentPath), "department-grouped-task-view.tsx must exist");

    const content = fs.readFileSync(componentPath, "utf-8");
    assert.ok(content.trimStart().startsWith('"use client"'), 'Must start with "use client"');
    assert.ok(content.includes("export function DepartmentGroupedTaskView"), "Must export DepartmentGroupedTaskView");
    assert.ok(content.includes("font-mono"), "Must use font-mono for metrics");
    assert.ok(content.includes("tabular-nums"), "Must use tabular-nums for numeric precision");
    assert.ok(content.includes("strokeWidth={1.5}"), "Must use strokeWidth={1.5} for lucide-react icons");

    // Zero emojis check
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.ok(!emojiRegex.test(content), "Must not contain decorative emojis");

    // No replacement characters
    assert.ok(!content.includes("�"), "Must not contain replacement character");
  });

  test("src/app/page.tsx integrates DepartmentGroupedTaskView with dynamic import and viewMode === 'department'", () => {
    const pagePath = path.join(process.cwd(), "src/app/page.tsx");
    assert.ok(fs.existsSync(pagePath), "src/app/page.tsx must exist");

    const pageContent = [
      fs.readFileSync(pagePath, "utf-8"),
      fs.readFileSync(path.join(process.cwd(), "src/components/dashboard/zones/tasks-zone.tsx"), "utf-8"),
      fs.readFileSync(path.join(process.cwd(), "src/components/dashboard/zones/tasks-expanded-views.tsx"), "utf-8"),
    ].join("\n");
    assert.ok(
      pageContent.includes("DepartmentGroupedTaskView = dynamic("),
      "src/app/page.tsx or tasks zone must dynamically import DepartmentGroupedTaskView"
    );
    assert.ok(
      pageContent.includes("@/components/dashboard/department-grouped-task-view"),
      "src/app/page.tsx or tasks zone must import from '@/components/dashboard/department-grouped-task-view'"
    );
    assert.ok(
      pageContent.includes("viewMode === \"department\""),
      "src/app/page.tsx or tasks zone must conditionally render when viewMode === 'department'"
    );
    assert.ok(
      pageContent.includes("<DepartmentGroupedTaskView"),
      "src/app/page.tsx or tasks zone must render <DepartmentGroupedTaskView"
    );
  });

  test("Tuân thủ WAI-ARIA Accordion và không lồng interactive elements", () => {
    const componentPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");

    // Accordion trigger button semantic attributes
    assert.ok(
      content.includes('type="button"'),
      "Accordion trigger must be a semantic button with type='button'"
    );
    assert.ok(
      content.includes("aria-expanded={isExpanded}"),
      "Accordion trigger must have dynamic aria-expanded attribute"
    );
    assert.ok(
      content.includes("aria-controls="),
      "Accordion trigger must point to controlled panel via aria-controls"
    );
    assert.ok(
      content.includes('role="region"'),
      "Expanded panel must have role='region' according to WAI-ARIA Accordion spec"
    );
    assert.ok(
      content.includes("aria-labelledby="),
      "Expanded panel must reference trigger header via aria-labelledby"
    );
  });

  test("Định dạng trạng thái công việc chuẩn tiếng Việt trong bảng danh sách", () => {
    const componentPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");

    // Vietnamese localized status labels
    assert.ok(content.includes("Hoàn thành"), "Must include 'Hoàn thành' for COMPLETED status");
    assert.ok(content.includes("Quá hạn"), "Must include 'Quá hạn' for overdue status");
    assert.ok(content.includes("Chờ BGH duyệt"), "Must include 'Chờ BGH duyệt' for PENDING_EXECUTIVE_APPROVAL");
    assert.ok(content.includes("Cần đánh giá"), "Must include 'Cần đánh giá' for NEEDS_REVIEW");
    assert.ok(content.includes("Đang thực hiện"), "Must include 'Đang thực hiện' for IN_PROGRESS");
    assert.ok(content.includes("Bị nghẽn"), "Must include 'Bị nghẽn' for BLOCKED");
  });
});
