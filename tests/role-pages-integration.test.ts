import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterTasksByRole,
  filterUpcomingByRole,
  DEFAULT_DEMO_USERS,
} from "../src/lib/role-task-filter";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";
import { computeDashboardStats } from "../src/lib/dashboard-aggregator";
import {
  getViewpointText,
  getViewpointEmoji,
} from "../src/components/auth/role-viewpoint-banner";

describe("Role Pages Filtering Integration", () => {
  test("switching roles dynamically recomputes stats and task count", () => {
    const payload = getMockDashboardPayload();
    const adminTasks = filterTasksByRole(payload.tasks, DEFAULT_DEMO_USERS[0]);
    const staffTasks = filterTasksByRole(payload.tasks, DEFAULT_DEMO_USERS[2]);

    assert.ok(adminTasks.length > staffTasks.length);
  });

  test("ADMIN role viewpoint retains complete school-wide scope", () => {
    const payload = getMockDashboardPayload();
    const admin = DEFAULT_DEMO_USERS[0];
    const adminTasks = filterTasksByRole(payload.tasks, admin);
    const adminStats = computeDashboardStats(adminTasks);
    const adminUpcoming = filterUpcomingByRole(payload.upcoming, admin, adminTasks);

    assert.equal(adminTasks.length, payload.tasks.length);
    assert.equal(adminStats.totalSchoolTasks, 304);
    assert.equal(adminStats.totalStaffTasks, 920);
    assert.equal(adminUpcoming.length, payload.upcoming.length);

    assert.equal(getViewpointEmoji(admin.role), "🏛️");
    assert.equal(
      getViewpointText(admin),
      "Góc nhìn Ban Giám hiệu: Giám sát toàn trường (11 đơn vị trực thuộc)"
    );
  });

  test("MANAGER role viewpoint scopes to unit leadership and lead tasks", () => {
    const payload = getMockDashboardPayload();
    const manager = DEFAULT_DEMO_USERS[1]; // Trần Hùng
    const managerTasks = filterTasksByRole(payload.tasks, manager);
    const managerStats = computeDashboardStats(managerTasks);
    const managerUpcoming = filterUpcomingByRole(payload.upcoming, manager, managerTasks);

    assert.ok(managerTasks.length > 0);
    assert.ok(managerTasks.length < payload.tasks.length);
    assert.ok(managerStats.totalSchoolTasks < 304);
    assert.ok(managerStats.totalStaffTasks < 920);
    assert.ok(managerStats.totalSchoolTasks > 0);
    assert.ok(managerUpcoming.length > 0);

    assert.equal(getViewpointEmoji(manager.role), "🏢");
    assert.equal(
      getViewpointText(manager),
      `Góc nhìn Lãnh đạo Đơn vị: ${manager.department} — Phụ trách: ${manager.name}`
    );
  });

  test("STAFF role viewpoint scopes to individual assigned tasks with recalculated rollup", () => {
    const payload = getMockDashboardPayload();
    const staff = DEFAULT_DEMO_USERS[2]; // Nguyễn Ngọc Vinh
    const staffTasks = filterTasksByRole(payload.tasks, staff);
    const staffStats = computeDashboardStats(staffTasks);
    const staffUpcoming = filterUpcomingByRole(payload.upcoming, staff, staffTasks);

    assert.ok(staffTasks.length > 0);
    assert.ok(staffTasks.length <= payload.tasks.length);

    // Verify all subtasks in staffTasks belong to this staff member
    for (const t of staffTasks) {
      assert.ok(t.subTasks.length > 0);
      for (const sub of t.subTasks) {
        assert.ok(
          sub.assigneeName.toLowerCase().includes("vinh") ||
            sub.assigneeName.toLowerCase().includes("nguyễn ngọc vinh")
        );
      }
      assert.equal(t.totalSubTasks, t.subTasks.length);
    }

    // Verify staff upcoming items are filtered to the staff user
    assert.ok(staffUpcoming.length > 0);
    for (const item of staffUpcoming) {
      assert.ok(
        item.assigneeName.toLowerCase().includes("vinh") ||
          item.assigneeName.toLowerCase().includes("nguyễn ngọc vinh")
      );
    }

    assert.equal(getViewpointEmoji(staff.role), "👤");
    assert.equal(
      getViewpointText(staff),
      `Góc nhìn Cá nhân: Nhiệm vụ & Công việc được phân công cho ${staff.name}`
    );
  });
});
