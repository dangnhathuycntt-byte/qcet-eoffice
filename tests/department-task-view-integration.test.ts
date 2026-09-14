import { test, describe } from "node:test";
import assert from "node:assert/strict";
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

});
