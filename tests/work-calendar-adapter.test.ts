import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  transformTasksToCalendarOperations,
  getPriorOverdueWorkItems,
  filterWorkCalendarItems,
  type WorkCalendarItem,
} from "../src/lib/work-calendar-adapter";
import type { SchoolTask } from "../src/types/dashboard";

describe("Work Calendar Adapter & Operations Engine", () => {
  const sampleTasks: SchoolTask[] = [
    {
      id: "school-task-1",
      code: "NV-01",
      title: "Nghiệm thu chuẩn đầu ra DACUM",
      category: "CHUYEN_MON" as any,
      categoryLabel: "Chuyên môn",
      priority: "URGENT",
      status: "IN_PROGRESS",
      progressPercent: 75,
      dueDate: "2026-09-16T00:00:00.000Z",
      startDate: "2026-09-01T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo & QLKH",
      leadAssigneeName: "Thầy Nam",
      totalSubTasks: 1,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-01T00:00:00.000Z",
      subTasks: [
        {
          id: "subtask-1-1",
          taskId: "school-task-1",
          title: "Hoàn thiện ma trận kỹ năng nghề CNTT",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15T00:00:00.000Z",
          assignedToDepartmentId: "K_CNTT",
          assignedToDepartmentName: "Khoa CNTT",
          assigneeName: "Cô Lan",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-10T00:00:00.000Z",
        },
      ],
      deliverables: [
        {
          id: "deliv-1",
          taskId: "school-task-1",
          title: "Báo cáo tổng hợp góp ý doanh nghiệp",
          status: "PENDING",
          dueDate: "2026-09-14T00:00:00.000Z",
          submittedAt: null,
          verifiedAt: null,
        },
      ],
      assignees: [],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    },
    {
      id: "school-task-overdue",
      code: "NV-02",
      title: "Kế hoạch tu sửa xưởng thực hành E3",
      category: "CO_SO_VAT_CHAT" as any,
      categoryLabel: "Cơ sở vật chất",
      priority: "HIGH",
      status: "IN_PROGRESS",
      progressPercent: 30,
      dueDate: "2026-09-02T00:00:00.000Z",
      startDate: "2026-08-20T00:00:00.000Z",
      departmentId: "P_QTTB",
      departmentName: "Phòng Quản trị - Thiết bị",
      leadAssigneeName: "Thầy Dũng",
      totalSubTasks: 0,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-08-20T00:00:00.000Z",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
  ];

  test("chuyển đổi đầy đủ mốc trường, tiểu nhiệm vụ và sản phẩm bàn giao", () => {
    const items = transformTasksToCalendarOperations(sampleTasks, {
      referenceDate: "2026-09-14T00:00:00.000Z",
    });

    assert.ok(items.length >= 3, `Expected at least 3 items, got ${items.length}`);

    // Kiểm tra mốc nhiệm vụ trường
    const schoolMilestone = items.find((i: WorkCalendarItem) => i.id === "milestone-school-task-1");
    assert.ok(schoolMilestone, "Phải có item mốc nhiệm vụ trường");
    assert.strictEqual(schoolMilestone?.type, "school_milestone");
    assert.strictEqual(schoolMilestone?.dueDate, "2026-09-16");
    assert.strictEqual(schoolMilestone?.assigneeName, "Thầy Nam");

    // Kiểm tra subtask
    const subtaskItem = items.find((i: WorkCalendarItem) => i.id === "subtask-subtask-1-1");
    assert.ok(subtaskItem, "Phải có item tiểu nhiệm vụ");
    assert.strictEqual(subtaskItem?.type, "subtask");
    assert.strictEqual(subtaskItem?.dueDate, "2026-09-15");
    assert.strictEqual(subtaskItem?.departmentId, "K_CNTT");
    assert.strictEqual(subtaskItem?.assigneeName, "Cô Lan");

    // Kiểm tra deliverable
    const delivItem = items.find((i: WorkCalendarItem) => i.id === "deliverable-deliv-1");
    assert.ok(delivItem, "Phải có item sản phẩm bàn giao");
    assert.strictEqual(delivItem?.type, "deliverable");
    assert.strictEqual(delivItem?.dueDate, "2026-09-14");
  });

  test("trích xuất chính xác danh sách nhiệm vụ quá hạn (Prior Overdue)", () => {
    const overdueItems = getPriorOverdueWorkItems(sampleTasks, "2026-09-14T00:00:00.000Z");
    assert.strictEqual(overdueItems.length, 1);
    assert.strictEqual(overdueItems[0].sourceTaskId, "school-task-overdue");
    assert.strictEqual(overdueItems[0].isOverdue, true);
    assert.ok((overdueItems[0].daysOverdue || 0) > 0);
  });

  test("bộ lọc công việc theo phòng ban và trạng thái", () => {
    const items = transformTasksToCalendarOperations(sampleTasks, {
      referenceDate: "2026-09-14T00:00:00.000Z",
    });

    const cnttItems = filterWorkCalendarItems(items, { departmentId: "K_CNTT" });
    assert.strictEqual(cnttItems.length, 1);
    assert.strictEqual(cnttItems[0].departmentId, "K_CNTT");

    const overdueOnly = filterWorkCalendarItems(items, { statusFilter: "OVERDUE" });
    assert.strictEqual(overdueOnly.length, 1);
    assert.strictEqual(overdueOnly[0].sourceTaskId, "school-task-overdue");
  });
});
