import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  type CalendarEntry,
  type CalendarUserContext,
  filterCalendarEntriesByScope as filterPresentationEntriesByScope,
  isCalendarEventEntry,
  isCalendarTaskEntry,
} from "../src/lib/calendar/calendar-presentation";
import {
  filterWorkCalendarEntriesByScope,
  matchesWorkCalendarScope,
  transformTasksToCalendarOperations,
  type WorkCalendarItem,
} from "../src/lib/work-calendar-adapter";

const sampleEntries: CalendarEntry[] = [
  {
    kind: "task",
    id: "task-school-1",
    sourceTaskId: "school-1",
    date: "2026-09-15",
    dueDate: "2026-09-15",
    title: "Báo cáo tổng kết năm học toàn trường",
    level: "Trường",
    status: "IN_PROGRESS",

    assigneeId: "user-principal",
    assigneeName: "Hiệu trưởng Nguyễn Văn A",
  },
  {
    kind: "task",
    id: "task-cntt-subtask",
    sourceTaskId: "sub-cntt-1",
    parentSchoolTaskId: "school-1",
    date: "2026-09-16",
    dueDate: "2026-09-16",
    title: "Triển khai hạ tầng phòng thực hành CNTT",
    level: "Đơn vị",
    status: "IN_PROGRESS",

    departmentName: "Khoa CNTT",
    assigneeId: "user-cntt-lead",
    assigneeName: "Trần Trọng B",
  },
  {
    kind: "task",
    id: "task-tchc-subtask",
    sourceTaskId: "sub-tchc-1",
    parentSchoolTaskId: "school-1",
    date: "2026-09-17",
    dueDate: "2026-09-17",
    title: "Tổng hợp danh sách nhân sự",
    level: "Đơn vị",
    status: "WAITING_APPROVAL",

    departmentName: "Phòng TCHC",
    assigneeId: "user-tchc-staff",
    assigneeName: "Lê Thị C",
  },
  {
    kind: "event",
    id: "event-meeting-cntt",
    meetingId: "meet-cntt-101",
    date: "2026-09-18",
    startTime: "08:30",
    endTime: "10:00",
    title: "Họp chuyên môn Khoa CNTT",
    level: "Đơn vị",
    unitId: "K_CNTT",
    unitName: "Khoa CNTT",
    organizerId: "user-cntt-lead",
    organizerName: "Trần Trọng B",
    location: "Phòng Lab 2",
  },
  {
    kind: "event",
    id: "event-school-council",
    meetingId: "meet-school-1",
    date: "2026-09-20",
    startTime: "14:00",
    endTime: "16:30",
    title: "Họp Hội đồng trường mở rộng",
    level: "Trường",
    organizerId: "user-principal",
    organizerName: "Hiệu trưởng Nguyễn Văn A",
    location: "Hội trường lớn",
  },
];

describe("Calendar presentation discriminated union & scope semantics", () => {
  test("phân biệt chính xác task entry và event entry bằng type guards", () => {
    const taskEntry = sampleEntries[0];
    const eventEntry = sampleEntries[3];

    assert.strictEqual(isCalendarTaskEntry(taskEntry), true);
    assert.strictEqual(isCalendarEventEntry(taskEntry), false);

    assert.strictEqual(isCalendarEventEntry(eventEntry), true);
    assert.strictEqual(isCalendarTaskEntry(eventEntry), false);
  });

  test("School scope: trả về các mục cấp trường và mốc nhiệm vụ chung", () => {
    const schoolItems = filterPresentationEntriesByScope(sampleEntries, "school");
    const ids = schoolItems.map((e) => e.id);

    assert.ok(ids.includes("task-school-1"));
    assert.ok(ids.includes("event-school-council"));
    assert.strictEqual(ids.includes("task-cntt-subtask"), false);
    assert.strictEqual(ids.includes("task-tchc-subtask"), false);
    assert.strictEqual(ids.includes("event-meeting-cntt"), false);
  });

  test("Department scope: khớp đúng departmentId cho task và unitId cho event của phòng ban", () => {
    const cnttUser: CalendarUserContext = {
      id: "user-cntt-staff-x",
      name: "Phạm Văn D",

      departmentName: "Khoa CNTT",
    };

    const cnttItems = filterPresentationEntriesByScope(sampleEntries, "department", cnttUser);
    const ids = cnttItems.map((e) => e.id);

    // Should include both the CNTT task and CNTT meeting event
    assert.ok(ids.includes("task-cntt-subtask"));
    assert.ok(ids.includes("event-meeting-cntt"));

    // Should NOT leak TCHC subtasks or school events
    assert.strictEqual(ids.includes("task-tchc-subtask"), false);
    assert.strictEqual(ids.includes("event-school-council"), false);
  });

  test("Department scope khi không có user context: trả về tất cả công việc/sự kiện cấp đơn vị", () => {
    const allUnitItems = filterPresentationEntriesByScope(sampleEntries, "unit");
    const ids = allUnitItems.map((e) => e.id);

    assert.ok(ids.includes("task-cntt-subtask"));
    assert.ok(ids.includes("task-tchc-subtask"));
    assert.ok(ids.includes("event-meeting-cntt"));
    assert.strictEqual(ids.includes("task-school-1"), false);
  });

  test("Personal/my scope: chỉ hiển thị việc gán cho người dùng hoặc sự kiện người dùng chủ trì", () => {
    const userLeadB: CalendarUserContext = {
      id: "user-cntt-lead",
      name: "Trần Trọng B",

    };

    const myItems = filterPresentationEntriesByScope(sampleEntries, "personal", userLeadB);
    const ids = myItems.map((e) => e.id);

    // Includes task assigned to user B and event organized by user B
    assert.deepEqual(ids, ["task-cntt-subtask", "event-meeting-cntt"]);

    // Does not include other people's tasks or school items
    assert.strictEqual(ids.includes("task-school-1"), false);
    assert.strictEqual(ids.includes("task-tchc-subtask"), false);
  });

  test("Personal scope không có user trả về mảng rỗng, không làm rò rỉ dữ liệu", () => {
    const emptyResult = filterPresentationEntriesByScope(sampleEntries, "personal");
    assert.deepEqual(emptyResult, []);
  });
});

// Lane A1 (Task 2.3 / 5.1-data): canonical ID-first scope resolver for calendar
// task projections in work-calendar-adapter. Persisted meetings reuse the same
// entry contract via { departmentId: unitId, organizerId }.
describe("work-calendar-adapter scope semantics (ID-first)", () => {
  const cnttMilestone: WorkCalendarItem = {
    id: "milestone-school-cntt",
    sourceTaskId: "school-cntt",
    title: "Nhiệm vụ Khoa CNTT",
    dueDate: "2026-09-16",
    type: "school_milestone",
    originType: "school_milestone",
    priority: "HIGH",
    status: "IN_PROGRESS",

    departmentName: "Khoa CNTT",
    assigneeId: "user-cntt-lead",
    assigneeName: "Trần Trọng B",
    isOverdue: false,
    daysOverdue: 0,
  };
  const tchcSubtask: WorkCalendarItem = {
    id: "subtask-sub-tchc-1",
    sourceTaskId: "sub-tchc-1",
    parentSchoolTaskId: "school-1",
    title: "Tổng hợp danh sách nhân sự",
    dueDate: "2026-09-17",
    type: "subtask",
    originType: "subtask",
    priority: "MEDIUM",
    status: "IN_PROGRESS",

    departmentName: "Phòng TCHC",
    assigneeId: "user-tchc-staff",
    assigneeName: "Lê Thị C",
    isOverdue: false,
    daysOverdue: 0,
  };
  const meetingAsEntry = {

    unitId: "K_CNTT",
    organizerId: "user-cntt-lead",
  };

  test("school scope: dataset permitted by server, adapter never narrows", () => {
    assert.strictEqual(
      matchesWorkCalendarScope(cnttMilestone, "school", { id: "anyone", departmentId: "P_OTHER" }),
      true
    );
    assert.strictEqual(matchesWorkCalendarScope(tchcSubtask, "school"), true);
  });

  test("unit scope: entry.departmentId === user.departmentId (ID-first)", () => {
    const user = { id: "user-cntt-staff-x", departmentId: "K_CNTT" };
    assert.strictEqual(matchesWorkCalendarScope(cnttMilestone, "unit", user), true);
    assert.strictEqual(matchesWorkCalendarScope(tchcSubtask, "unit", user), false);
  });

  test("unit scope: event unitId matches user departmentId", () => {
    assert.strictEqual(
      matchesWorkCalendarScope(meetingAsEntry, "unit", { id: "x", departmentId: "K_CNTT" }),
      true
    );
    assert.strictEqual(
      matchesWorkCalendarScope(meetingAsEntry, "unit", { id: "x", departmentId: "P_TCHC" }),
      false
    );
  });

  test("unit scope: no broadening when IDs are absent", () => {
    const idLess: WorkCalendarItem = {
      ...tchcSubtask,
      id: "subtask-id-less",

      departmentName: undefined,
    };
    assert.strictEqual(
      matchesWorkCalendarScope(idLess, "unit", { id: "u", departmentId: "P_TCHC" }),
      false,
      "Entry without departmentId must not match unit scope via display name"
    );
    assert.strictEqual(
      matchesWorkCalendarScope(cnttMilestone, "unit", { id: "u" }),
      false,
      "Unit scope without a user departmentId matches nothing"
    );
    assert.strictEqual(matchesWorkCalendarScope(cnttMilestone, "unit"), false);
  });

  test("unit scope: no display-name fallback when ID exists", () => {
    const sameNameOtherId: WorkCalendarItem = {
      ...cnttMilestone,
      id: "milestone-same-name",

      departmentName: "Khoa CNTT",
    };
    assert.strictEqual(
      matchesWorkCalendarScope(sameNameOtherId, "unit", { id: "u", departmentId: "K_CNTT" }),
      false,
      "Matching display names must not override canonical department IDs"
    );
  });

  test("my scope: assigneeId === user.id (ID-first), organizerId for events", () => {
    const lead = { id: "user-cntt-lead", departmentId: "K_CNTT" };
    assert.strictEqual(matchesWorkCalendarScope(cnttMilestone, "my", lead), true);
    assert.strictEqual(matchesWorkCalendarScope(tchcSubtask, "my", lead), false);
    assert.strictEqual(matchesWorkCalendarScope(meetingAsEntry, "my", lead), true);
    assert.strictEqual(
      matchesWorkCalendarScope(meetingAsEntry, "my", { id: "user-other" }),
      false
    );
  });

  test("my scope: rejects display-name-only matches and absent IDs", () => {
    const entryWithOnlyName: WorkCalendarItem = {
      ...cnttMilestone,
      id: "milestone-name-only",
      assigneeId: undefined,
      assigneeName: "Trần Trọng B",
    };
    assert.strictEqual(
      matchesWorkCalendarScope(entryWithOnlyName, "my", { id: "user-stranger" }),
      false,
      "Display-name similarity is never identity proof"
    );
    assert.strictEqual(matchesWorkCalendarScope(cnttMilestone, "my"), false);
    assert.strictEqual(
      matchesWorkCalendarScope(entryWithOnlyName, "my", { id: "user-cntt-lead" }),
      false,
      "Entry without assigneeId/organizerId never matches my scope"
    );
  });

  test("filter helper keeps entries whose IDs match, drops all others", () => {
    const items = [cnttMilestone, tchcSubtask];
    const unitItems = filterWorkCalendarEntriesByScope(items, "unit", {
      id: "u",

    });
    assert.deepEqual(
      unitItems.map((i) => i.id),
      ["milestone-school-cntt"]
    );
    const myItems = filterWorkCalendarEntriesByScope(items, "my", { id: "user-tchc-staff" });
    assert.deepEqual(
      myItems.map((i) => i.id),
      ["subtask-sub-tchc-1"]
    );
    assert.deepEqual(filterWorkCalendarEntriesByScope(items, "my"), []);
  });

  test("transformed items flow through the scope resolver without fabrication", () => {
    const transformed = transformTasksToCalendarOperations(
      [
        {
          id: "school-1",
          title: "Việc trường",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",

          leadAssigneeId: "user-cntt-lead",
          subTasks: [
            {
              id: "sub-1",
              title: "Việc đơn vị khác",
              status: "IN_PROGRESS",
              dueDate: "2026-09-20",
              assignedToDepartmentId: "P_TCHC",
              assigneeId: "user-tchc-staff",
            } as any,
          ],
        } as any,
      ],
      { referenceDate: "2026-09-10" }
    );
    const unitItems = filterWorkCalendarEntriesByScope(transformed, "unit", {
      id: "u",

    });
    assert.ok(unitItems.some((i) => i.id === "milestone-school-1"));
    assert.ok(!unitItems.some((i) => i.id === "subtask-sub-1"));
    const myItems = filterWorkCalendarEntriesByScope(transformed, "my", {
      id: "user-tchc-staff",
    });
    assert.deepEqual(
      myItems.map((i) => i.id),
      ["subtask-sub-1"]
    );
  });
});
