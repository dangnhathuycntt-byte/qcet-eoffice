import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  type CalendarEntry,
  type CalendarUserContext,
  filterCalendarEntriesByScope as filterPresentationEntriesByScope,
  isCalendarEventEntry,
  isCalendarTaskEntry,
} from "../src/lib/calendar/calendar-presentation";

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
    departmentId: undefined,
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
    departmentId: "K_CNTT",
    departmentName: "Khoa CNTT",
    assigneeId: "user-cntt-lead",
    assigneeName: "Tr��n Trọng B",
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
    departmentId: "P_TCHC",
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
      departmentId: "K_CNTT",
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
      departmentId: "K_CNTT",
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
