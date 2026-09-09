import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SchoolTask } from "../src/types/dashboard";
import { filterDashboardReactiveTasks } from "../src/components/dashboard/zones/dashboard-zone";

describe("DashboardZone Reactivity and Reactive Filtering", () => {
  const zonePath = path.join(
    process.cwd(),
    "src/components/dashboard/zones/dashboard-zone.tsx"
  );

  test("DashboardZone connects stat strip filter and department matrix to active task list", () => {
    const content = fs.readFileSync(zonePath, "utf-8");
    // Verify that activeWorkbox or filter changes reflect on the displayed task container
    assert.ok(
      content.includes("CascadingTaskTable") ||
        content.includes("UnifiedAdaptiveWorkspace") ||
        content.includes("filteredTasks"),
      "DashboardZone must mount task table or workspace displaying reactive filtered tasks"
    );
    // Ensure dead-click items prop is passed to ExecutiveActionCenter if present
    assert.equal(
      content.includes("DEFAULT_ACTION_ITEMS"),
      false,
      "DashboardZone must not reference DEFAULT_ACTION_ITEMS"
    );
  });

  test("filterDashboardReactiveTasks correctly filters tasks by activeWorkbox and department", () => {
    const sampleTasks: SchoolTask[] = [
      {
        id: "task-1",
        title: "Hoàn thiện đề án tuyển sinh",
        category: "CHUYEN_DOI_SO",
        categoryLabel: "Chuyển đổi số",
        leadAssigneeName: "Nguyễn Văn A",
        leadAssigneeId: "user-1",
        departmentId: "DAO_TAO",
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 50,
        coAssignees: [],
      },
      {
        id: "task-2",
        title: "Nâng cấp bảo mật máy chủ",
        category: "ATTT",
        categoryLabel: "An toàn thông tin",
        leadAssigneeName: "Trần B",
        leadAssigneeId: "user-2",
        departmentId: "CNTT",
        assignedDate: "2026-09-01",
        dueDate: "2026-09-10",
        status: "OVERDUE" as any,
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 20,
        coAssignees: [],
      },
      {
        id: "task-3",
        title: "Báo cáo kiểm toán quý 3",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadAssigneeName: "Lê C",
        leadAssigneeId: "user-3",
        departmentId: "TAI_CHINH",
        assignedDate: "2026-08-01",
        dueDate: "2026-08-30",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 100,
        coAssignees: [],
      },
      {
        id: "task-4",
        title: "Xây dựng ngân hàng câu hỏi",
        category: "CHUYEN_DOI_SO",
        categoryLabel: "Chuyển đổi số",
        leadAssigneeName: "Phạm D",
        leadAssigneeId: "user-4",
        departmentId: "DAO_TAO",
        assignedDate: "2026-09-05",
        dueDate: "2026-09-15",
        status: "IN_PROGRESS",
        // @ts-expect-error simulated priority
        priority: "URGENT",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 10,
        coAssignees: [],
      },
      {
        id: "task-5",
        title: "Tổ chức hội thảo khoa học",
        category: "KHAC",
        categoryLabel: "Khác",
        leadAssigneeName: "Nguyễn E",
        leadAssigneeId: "user-5",
        // @ts-expect-error simulated assigneeIds
        assigneeIds: ["user-1"],
        departmentId: "KHCN",
        assignedDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 0,
        coAssignees: [],
      },
    ];

    const currentUser = { id: "user-1", name: "Nguyễn Văn A" };

    // 1. "ALL" returns all tasks
    const all = filterDashboardReactiveTasks(sampleTasks, "ALL", "ALL", currentUser);
    assert.equal(all.length, 5);

    // 2. "MY_ACTION" returns tasks where user is leadAssigneeId or in assigneeIds
    const myAction = filterDashboardReactiveTasks(sampleTasks, "MY_ACTION", "ALL", currentUser);
    assert.equal(myAction.length, 2);
    assert.deepEqual(
      myAction.map((t) => t.id).sort(),
      ["task-1", "task-5"]
    );

    // 3. "URGENT_OVERDUE" returns tasks with priority === 'URGENT' or status === 'OVERDUE'
    const urgent = filterDashboardReactiveTasks(sampleTasks, "URGENT_OVERDUE", "ALL", currentUser);
    assert.equal(urgent.length, 2);
    assert.deepEqual(
      urgent.map((t) => t.id).sort(),
      ["task-2", "task-4"]
    );

    // 4. "COMPLETED" returns tasks with status === 'COMPLETED'
    const completed = filterDashboardReactiveTasks(sampleTasks, "COMPLETED", "ALL", currentUser);
    assert.equal(completed.length, 1);
    assert.equal(completed[0].id, "task-3");

    // 5. Department filtering works as expected
    const daoTaoTasks = filterDashboardReactiveTasks(sampleTasks, "ALL", "DAO_TAO", currentUser);
    assert.equal(daoTaoTasks.length, 2);
    assert.deepEqual(
      daoTaoTasks.map((t) => t.id).sort(),
      ["task-1", "task-4"]
    );

    // 6. Resetting department to "ALL" returns all
    const resetDeptTasks = filterDashboardReactiveTasks(sampleTasks, "ALL", "ALL", currentUser);
    assert.equal(resetDeptTasks.length, 5);
  });
});
