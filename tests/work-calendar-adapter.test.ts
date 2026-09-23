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

    // Lọc theo itemType: "school_milestone" vẫn giữ lại mốc trường dù đã quá hạn (nhờ originType)
    const schoolMilestones = filterWorkCalendarItems(items, { itemType: "school_milestone" });
    assert.strictEqual(schoolMilestones.length, 2);
    assert.ok(schoolMilestones.some((m) => m.sourceTaskId === "school-task-overdue"));
    assert.ok(schoolMilestones.some((m) => m.sourceTaskId === "school-task-1"));
  });

  test("không bịa đặt dueTime cho nhiệm vụ date-only, chỉ giữ dueTime khi nguồn có giờ thực tế", () => {
    const tasks: SchoolTask[] = [
      {
        id: "task-date-only",
        code: "NV-DATE-ONLY",
        title: "Kế hoạch ngày chuẩn",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20", // YYYY-MM-DD
        subTasks: [
          {
            id: "sub-date-only",
            title: "Subtask date-only",
            status: "IN_PROGRESS",
            dueDate: "2026-09-20T00:00:00.000Z", // ISO midnight (date-only)
          } as any,
        ],
        deliverables: [
          {
            id: "deliv-date-only",
            title: "Báo cáo date-only",
            status: "PENDING",
            dueDate: "2026-09-20",
          },
        ],
      } as any,
      {
        id: "task-with-real-time",
        code: "NV-REAL-TIME",
        title: "Họp nghiệm thu có giờ",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20T14:30:00.000Z",
        subTasks: [
          {
            id: "sub-with-time",
            title: "Chuẩn bị tài liệu trước 08:30",
            status: "IN_PROGRESS",
            dueDate: "2026-09-20T08:30:00+07:00",
          } as any,
        ],
      } as any,
    ];

    const items = transformTasksToCalendarOperations(tasks, { referenceDate: "2026-09-10" });

    // Date-only items must have dueTime === undefined
    const dateOnlyMilestone = items.find((i) => i.id === "milestone-task-date-only");
    const dateOnlySub = items.find((i) => i.id === "subtask-sub-date-only");
    const dateOnlyDeliv = items.find((i) => i.id === "deliverable-deliv-date-only");

    assert.strictEqual(dateOnlyMilestone?.dueTime, undefined, "Date-only milestone must not have fake dueTime");
    assert.strictEqual(dateOnlySub?.dueTime, undefined, "Date-only subtask must not have fake dueTime");
    assert.strictEqual(dateOnlyDeliv?.dueTime, undefined, "Date-only deliverable must not have fake dueTime");

    // Items with real time preserve that time
    const realTimeMilestone = items.find((i) => i.id === "milestone-task-with-real-time");
    const realTimeSub = items.find((i) => i.id === "subtask-sub-with-time");

    assert.strictEqual(realTimeMilestone?.dueTime, "14:30");
    assert.strictEqual(realTimeSub?.dueTime, "08:30");
  });

  test("StaffTask không có tiến độ giữ nguyên undefined, có tiến độ giữ nguyên giá trị thực tế", () => {
    const tasks: SchoolTask[] = [
      {
        id: "task-progress-check",
        title: "Kiểm tra tiến độ subtask",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20",
        subTasks: [
          {
            id: "sub-no-progress",
            title: "Chưa ghi nhận tiến độ",
            status: "IN_PROGRESS",
            dueDate: "2026-09-20",
            // progressPercent is undefined
          } as any,
          {
            id: "sub-with-progress",
            title: "Đã hoàn thành một phần",
            status: "IN_PROGRESS",
            dueDate: "2026-09-20",
            progressPercent: 37,
          } as any,
          {
            id: "sub-completed-no-progress",
            title: "Hoàn thành nhưng không có trường progressPercent",
            status: "COMPLETED",
            dueDate: "2026-09-20",
            // must NOT fabricate 100%
          } as any,
        ],
      } as any,
    ];

    const items = transformTasksToCalendarOperations(tasks, { referenceDate: "2026-09-10" });
    const subNoProgress = items.find((i) => i.id === "subtask-sub-no-progress");
    const subWithProgress = items.find((i) => i.id === "subtask-sub-with-progress");
    const subCompletedNoProgress = items.find((i) => i.id === "subtask-sub-completed-no-progress");

    assert.strictEqual(subNoProgress?.progressPercent, undefined, "Subtask without progress must be undefined");
    assert.strictEqual(subWithProgress?.progressPercent, 37, "Subtask with progress must preserve exact value");
    assert.strictEqual(subCompletedNoProgress?.progressPercent, undefined, "Do not fabricate 100% when progressPercent is absent");
  });

  test("bảo tồn assigneeId và departmentId, không tự ý gán fallback BGH", () => {
    const tasks: SchoolTask[] = [
      {
        id: "task-without-dept",
        title: "Nhiệm vụ không phòng ban",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20",
        leadAssigneeId: "user-42",
        // no departmentId, no leadAssigneeName
        subTasks: [
          {
            id: "sub-explicit-dept",
            title: "Subtask với khoa CNTT",
            status: "IN_PROGRESS",
            dueDate: "2026-09-20",
            assignedToDepartmentId: "K_CNTT",
            assignedToDepartmentName: "Khoa CNTT",
            assigneeId: "user-99",
          } as any,
          {
            id: "sub-no-dept",
            title: "Subtask không đơn vị",
            status: "IN_PROGRESS",
            dueDate: "2026-09-20",
            // no departmentId, no assigneeId
          } as any,
        ],
      } as any,
    ];

    const items = transformTasksToCalendarOperations(tasks, { referenceDate: "2026-09-10" });
    const taskItem = items.find((i) => i.id === "milestone-task-without-dept");
    const subExplicit = items.find((i) => i.id === "subtask-sub-explicit-dept");
    const subNoDept = items.find((i) => i.id === "subtask-sub-no-dept");

    assert.strictEqual(taskItem?.assigneeId, "user-42");
    assert.strictEqual(taskItem?.departmentId, undefined, "Missing department must not fallback to BGH");
    assert.strictEqual(taskItem?.departmentName, undefined);

    assert.strictEqual(subExplicit?.departmentId, "K_CNTT");
    assert.strictEqual(subExplicit?.assigneeId, "user-99");

    assert.strictEqual(subNoDept?.departmentId, undefined, "Missing subtask department must not fallback to BGH");
    assert.strictEqual(subNoDept?.departmentName, undefined);
    assert.strictEqual(subNoDept?.assigneeId, undefined);
  });

  test("nhiệm vụ đã COMPLETED không bao giờ bị đánh dấu là overdue", () => {
    const tasks: SchoolTask[] = [
      {
        id: "task-completed-past-due",
        title: "Nhiệm vụ đã hoàn thành trong quá khứ",
        status: "COMPLETED",
        dueDate: "2026-08-01", // Due in the past relative to refDate
        subTasks: [
          {
            id: "sub-completed-past-due",
            title: "Subtask hoàn thành hạn cũ",
            status: "COMPLETED",
            dueDate: "2026-08-01",
          } as any,
        ],
        deliverables: [
          {
            id: "deliv-approved-past-due",
            title: "Sản phẩm đã nghiệm thu",
            status: "APPROVED",
            dueDate: "2026-08-01",
          },
        ],
      } as any,
    ];

    const items = transformTasksToCalendarOperations(tasks, { referenceDate: "2026-09-14" });
    for (const item of items) {
      assert.strictEqual(item.isOverdue, false, `Item ${item.id} with completed status must not be overdue`);
      assert.strictEqual(item.status, "COMPLETED");
      assert.strictEqual(item.daysOverdue || 0, 0);
    }

    const priorOverdue = getPriorOverdueWorkItems(tasks, "2026-09-14");
    assert.strictEqual(priorOverdue.length, 0, "Prior overdue list must not include completed tasks");
  });

  test("an toàn múi giờ date-only: không bị quá hạn sớm trong ngày làm việc", () => {
    const tasks: SchoolTask[] = [
      {
        id: "task-due-today",
        title: "Nhiệm vụ hạn chót hôm nay",
        status: "IN_PROGRESS",
        dueDate: "2026-09-14T00:00:00.000Z",
      } as any,
    ];

    // Reference date is the exact same day
    const items = transformTasksToCalendarOperations(tasks, { referenceDate: "2026-09-14T15:30:00+07:00" });
    const item = items.find((i) => i.id === "milestone-task-due-today");
    assert.strictEqual(item?.dueDate, "2026-09-14");
    assert.strictEqual(item?.isOverdue, false, "Task due today must not be overdue today");
    assert.strictEqual(item?.daysOverdue, 0);
  });

  test("regression: không bao giờ bịa đặt giờ 17:00/16:30/11:30, tiến độ, đơn vị BGH hay người phụ trách", () => {
    const tasks: SchoolTask[] = [
      {
        id: "task-regression",
        title: "Nhiệm vụ regression date-only",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20",
        subTasks: [
          {
            id: "sub-regression",
            title: "Subtask regression date-only",
            status: "IN_PROGRESS",
            dueDate: "2026-09-20",
          } as any,
        ],
        deliverables: [
          {
            id: "deliv-regression",
            title: "Deliverable regression date-only",
            status: "PENDING",
            dueDate: "2026-09-20",
          },
        ],
      } as any,
    ];

    const items = transformTasksToCalendarOperations(tasks, { referenceDate: "2026-09-10" });
    assert.strictEqual(items.length, 3);
    const bannedTimes = new Set(["17:00", "16:30", "11:30"]);
    for (const item of items) {
      assert.strictEqual(item.dueTime, undefined, `Item ${item.id} must not fabricate dueTime`);
      assert.ok(
        item.dueTime === undefined || !bannedTimes.has(item.dueTime),
        `Item ${item.id} must never carry a fake legacy time`
      );
      assert.strictEqual(item.progressPercent, undefined, `Item ${item.id} must not fabricate progress`);
      assert.strictEqual(item.departmentId, undefined, `Item ${item.id} must not fallback to BGH`);
      assert.strictEqual(item.departmentName, undefined, `Item ${item.id} must not fabricate department name`);
      assert.strictEqual(item.assigneeId, undefined, `Item ${item.id} must not fabricate assigneeId`);
      assert.strictEqual(item.assigneeName, undefined, `Item ${item.id} must not fabricate assigneeName`);
    }
  });

  test("milestone không tiến độ giữ undefined; date-only due hôm nay không quá hạn dù đã khuya giờ ICT", () => {
    const tasks: SchoolTask[] = [
      {
        id: "task-milestone-no-progress",
        title: "Milestone không tiến độ",
        status: "IN_PROGRESS",
        dueDate: "2026-09-14",
      } as any,
    ];

    const items = transformTasksToCalendarOperations(tasks, {
      referenceDate: "2026-09-14T23:30:00+07:00",
    });
    const milestone = items.find((i) => i.id === "milestone-task-milestone-no-progress");
    assert.ok(milestone, "Phải có milestone");
    assert.strictEqual(milestone?.progressPercent, undefined, "Unknown milestone progress is never 50 or 0");
    assert.strictEqual(milestone?.dueTime, undefined, "Date-only milestone must not have fake dueTime");
    assert.strictEqual(milestone?.isOverdue, false, "Date-only task due today is not overdue late at night ICT");
    assert.strictEqual(milestone?.daysOverdue, 0);
  });
});
