import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { aggregateTasksByDepartment } from "../src/lib/department-task-aggregator";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";

describe("Department Grouped Task View Integration", () => {
  const payload = getMockDashboardPayload();

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
});
