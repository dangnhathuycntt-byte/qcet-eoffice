import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  calculateEventLayout,
  getSemanticEventStyle,
  getWeekDays,
  type CalendarTimeEvent,
  ExecutiveCalendarWorkspace,
  WorkCalendarCard,
  PriorOverdueBacklogBanner,
} from "@/components/calendar/executive-calendar-workspace";
import type { SchoolTask } from "@/types/dashboard";
import type { WorkCalendarItem } from "@/lib/work-calendar-adapter";

describe("ExecutiveCalendarWorkspace Layout and Collision Detection Engine", () => {
  test("calculateEventLayout computes correct top and height percentages", () => {
    // Start of day: 07:00 (420 mins), End: 18:00 (1080 mins) -> 660 mins total
    const event: CalendarTimeEvent = {
      id: "evt-1",
      title: "Họp Giao ban Ban Giám hiệu",
      startTime: "08:00",
      endTime: "09:30",
      date: "2026-09-14",
      type: "meeting",
    };

    const layout = calculateEventLayout(event, 7, 18);
    // 08:00 is 60 mins from 07:00. 60 / 660 = ~9.09%
    assert.ok(Math.abs(layout.topPercent - 9.09) < 0.2);
    // Duration: 90 mins. 90 / 660 = ~13.64%
    assert.ok(Math.abs(layout.heightPercent - 13.64) < 0.2);
    assert.equal(layout.hasCollision, false);
    assert.equal(layout.widthPercent, 100);
    assert.equal(layout.leftPercent, 0);
  });

  test("calculateEventLayout handles simultaneous event collisions", () => {
    const eventA: CalendarTimeEvent = {
      id: "evt-a",
      title: "Tiếp đoàn chuyên gia ĐBCL",
      startTime: "09:00",
      endTime: "10:30",
      date: "2026-09-14",
      type: "meeting",
    };
    const eventB: CalendarTimeEvent = {
      id: "evt-b",
      title: "Họp Thẩm định DACUM Khoa CNTT",
      startTime: "09:30",
      endTime: "11:00",
      date: "2026-09-14",
      type: "meeting",
    };

    const [layoutA, layoutB] = [
      calculateEventLayout(eventA, 7, 18, [eventB]),
      calculateEventLayout(eventB, 7, 18, [eventA]),
    ];

    assert.equal(layoutA.hasCollision, true);
    assert.equal(layoutB.hasCollision, true);
    assert.equal(layoutA.widthPercent, 50);
    assert.equal(layoutB.widthPercent, 50);
    assert.equal(layoutA.leftPercent, 0);
    assert.equal(layoutB.leftPercent, 50);
  });

  test("calculateEventLayout handles 3-way collision with 33.33% column distribution", () => {
    const event1: CalendarTimeEvent = {
      id: "evt-1",
      title: "Họp BGH",
      startTime: "09:00",
      endTime: "10:30",
      date: "2026-09-14",
    };
    const event2: CalendarTimeEvent = {
      id: "evt-2",
      title: "Thẩm định chương trình",
      startTime: "09:15",
      endTime: "10:00",
      date: "2026-09-14",
    };
    const event3: CalendarTimeEvent = {
      id: "evt-3",
      title: "Làm việc với đối tác",
      startTime: "09:30",
      endTime: "11:00",
      date: "2026-09-14",
    };

    const layout1 = calculateEventLayout(event1, 7, 18, [event2, event3]);
    const layout2 = calculateEventLayout(event2, 7, 18, [event1, event3]);
    const layout3 = calculateEventLayout(event3, 7, 18, [event1, event2]);

    assert.equal(layout1.hasCollision, true);
    assert.equal(layout2.hasCollision, true);
    assert.equal(layout3.hasCollision, true);

    assert.ok(Math.abs(layout1.widthPercent - 33.33) < 0.1);
    assert.ok(Math.abs(layout2.widthPercent - 33.33) < 0.1);
    assert.ok(Math.abs(layout3.widthPercent - 33.33) < 0.1);

    assert.equal(layout1.leftPercent, 0);
    assert.ok(Math.abs(layout2.leftPercent - 33.33) < 0.1);
    assert.ok(Math.abs(layout3.leftPercent - 66.66) < 0.1);
  });

  test("getSemanticEventStyle returns design spec color tokens without dark variant", () => {
    const meetingStyle = getSemanticEventStyle("meeting");
    assert.ok(meetingStyle.includes("bg-blue-500/10"));
    assert.ok(meetingStyle.includes("text-blue-700"));
    assert.ok(!meetingStyle.includes("dark:"));

    const deliverableStyle = getSemanticEventStyle("deliverable");
    assert.ok(deliverableStyle.includes("bg-violet-500/10"));
    assert.ok(deliverableStyle.includes("text-violet-700"));

    const academicStyle = getSemanticEventStyle("academic");
    assert.ok(academicStyle.includes("bg-emerald-500/10"));
    assert.ok(academicStyle.includes("text-emerald-700"));

    const urgentStyle = getSemanticEventStyle("urgent");
    assert.ok(urgentStyle.includes("bg-rose-500/10"));
    assert.ok(urgentStyle.includes("text-rose-700"));

    const internalStyle = getSemanticEventStyle("internal");
    assert.ok(internalStyle.includes("bg-zinc-500/10"));
    assert.ok(internalStyle.includes("text-zinc-700"));

    const milestoneStyle = getSemanticEventStyle("school_milestone");
    assert.ok(milestoneStyle.includes("text-blue-700"));

    const subtaskStyle = getSemanticEventStyle("subtask");
    assert.ok(subtaskStyle.includes("text-emerald-700"));
  });

  test("getWeekDays returns 7 days starting from Monday", () => {
    // 2026-09-14 is a Monday
    const days = getWeekDays(new Date("2026-09-16")); // Wednesday
    assert.equal(days.length, 7);
    assert.equal(days[0].dateString, "2026-09-14");
    assert.equal(days[0].dayOfWeekLabel, "T2");
    assert.equal(days[6].dateString, "2026-09-20");
    assert.equal(days[6].dayOfWeekLabel, "CN");
  });
});

describe("ExecutiveCalendarWorkspace Work Operations Integration", () => {
  const sampleSchoolTasks: SchoolTask[] = [
    {
      id: "task-01",
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
          id: "sub-01",
          taskId: "task-01",
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
          id: "deliv-01",
          taskId: "task-01",
          title: "Báo cáo tổng hợp doanh nghiệp",
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
      id: "task-overdue",
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

  test("does not render DEFAULT_SAMPLE_EVENTS mock data when no tasks or events provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveCalendarWorkspace, {
        initialDate: "2026-09-14",
      })
    );

    // Verify mock sample events are removed
    assert.ok(!html.includes("Họp Giao ban Ban Giám hiệu (Định kỳ Thứ Hai)"));
    assert.ok(!html.includes("sample-evt-1"));
    assert.ok(!html.includes("Tiếp đoàn chuyên gia ĐBCL"));
    assert.ok(!html.includes("Hạn chót phê duyệt Kế hoạch Ngân sách quý IV"));
  });

  test("renders live transformed work items when tasks are provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveCalendarWorkspace, {
        tasks: sampleSchoolTasks,
        initialDate: "2026-09-14",
        initialViewMode: "agenda_list",
      })
    );

    // Verify School Milestone is rendered
    assert.ok(html.includes("Nghiệm thu chuẩn đầu ra DACUM"), "Should render milestone task title");
    assert.ok(html.includes("NV-01"), "Should render task code");
    assert.ok(html.includes("Phòng Đào tạo &amp; QLKH") || html.includes("Phòng Đào tạo & QLKH"), "Should render department name");
    assert.ok(html.includes("Thầy Nam"), "Should render lead assignee DRI");

    // Verify Subtask is rendered
    assert.ok(html.includes("Hoàn thiện ma trận kỹ năng nghề CNTT"), "Should render subtask title");
    assert.ok(html.includes("Khoa CNTT"), "Should render subtask department");
    assert.ok(html.includes("Cô Lan"), "Should render subtask assignee");

    // Verify Deliverable is rendered
    assert.ok(html.includes("Báo cáo tổng hợp doanh nghiệp"), "Should render deliverable title");
  });

  test("renders Prior Overdue Backlog banner when overdue items exist", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveCalendarWorkspace, {
        tasks: sampleSchoolTasks,
        initialDate: "2026-09-14",
      })
    );

    // Verify Overdue banner presence and styling
    assert.ok(html.includes("prior-overdue-backlog-banner") || html.includes("bg-rose-50"), "Must have overdue banner");
    assert.ok(html.includes("Kế hoạch tu sửa xưởng thực hành E3"), "Must list overdue task title");
    assert.ok(html.includes("Trễ") || html.includes("quá hạn"), "Must display overdue duration marker");
  });

  test("renders work-oriented filter controls (Department, Type, Status, Search)", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveCalendarWorkspace, {
        tasks: sampleSchoolTasks,
        initialDate: "2026-09-14",
      })
    );

    // Department filter
    assert.ok(html.includes("P_DTQLKH") || html.includes("Phòng Đào tạo"), "Should include department filter option");
    // Type filter options
    assert.ok(html.includes("Mốc trường"), "Should include school milestone filter");
    assert.ok(html.includes("Sản phẩm DACUM"), "Should include deliverable filter");
    assert.ok(html.includes("Việc đơn vị"), "Should include subtask filter");
    // Status filter options
    assert.ok(html.includes("Đang làm") || html.includes("Đang thực hiện"), "Should include active status filter");
    assert.ok(html.includes("Quá hạn"), "Should include overdue status filter");
    assert.ok(html.includes("Hoàn thành"), "Should include completed status filter");
    // Search input
    assert.ok(html.includes("Tìm kiếm") || html.includes("input"), "Should include search query input");
  });

  test("WorkCalendarCard displays code, title, DRI, department, progress bar and badge", () => {
    const mockItem: WorkCalendarItem = {
      id: "item-test-1",
      sourceTaskId: "src-1",
      title: "Hoàn thiện ma trận kỹ năng nghề CNTT",
      code: "NV-01",
      dueDate: "2026-09-15",
      type: "subtask",
      priority: "HIGH",
      status: "IN_PROGRESS",
      progressPercent: 75,
      departmentId: "K_CNTT",
      departmentName: "Khoa CNTT",
      assigneeName: "Cô Lan",
      isOverdue: false,
    };

    const html = renderToStaticMarkup(
      React.createElement(WorkCalendarCard, { item: mockItem })
    );

    assert.ok(html.includes("NV-01"), "Should render code");
    assert.ok(html.includes("Hoàn thiện ma trận kỹ năng nghề CNTT"), "Should render title");
    assert.ok(html.includes("Khoa CNTT"), "Should render department");
    assert.ok(html.includes("Cô Lan"), "Should render assignee");
    assert.ok(html.includes("75%"), "Should render progress percent");
    assert.ok(html.includes("Việc đơn vị"), "Should render type badge");
    assert.ok(!html.includes("dark:"), "Must adhere to Light-Only standard (no dark:)");
  });

  test("PriorOverdueBacklogBanner renders overdue items with days overdue and count", () => {
    const mockOverdueItem: WorkCalendarItem = {
      id: "overdue-1",
      sourceTaskId: "src-overdue",
      title: "Kế hoạch tu sửa xưởng E3",
      code: "NV-02",
      dueDate: "2026-09-02",
      type: "urgent_overdue",
      priority: "URGENT",
      status: "OVERDUE",
      progressPercent: 30,
      departmentId: "P_QTTB",
      departmentName: "Phòng Quản trị - Thiết bị",
      assigneeName: "Thầy Dũng",
      isOverdue: true,
      daysOverdue: 12,
    };

    const html = renderToStaticMarkup(
      React.createElement(PriorOverdueBacklogBanner, {
        overdueItems: [mockOverdueItem],
      })
    );

    assert.ok(html.includes("12 ngày"), "Should display 12 days overdue");
    assert.ok(html.includes("Kế hoạch tu sửa xưởng E3"), "Should display title");
    assert.ok(html.includes("NV-02"), "Should display code");
    assert.ok(html.includes("bg-rose-50"), "Should use rose background styling");
    assert.ok(!html.includes("dark:"), "Must adhere to Light-Only standard (no dark:)");
  });
});
