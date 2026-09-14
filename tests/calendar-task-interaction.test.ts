import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CalendarWorkspace,
  CalendarEventDetailModal,
  type CalendarTimeEvent,
} from "../src/components/calendar/calendar-workspace";
import type { SchoolTask } from "../src/types/dashboard";

// Behavioural coverage rendered from the real components. Source-text-only
// assertions (route URL parsing, anti-slop class checks) were dropped per the
// testing invariants; the route-level ones live in tests/calendar-route.test.ts
// and class/emoji checks are enforced by tests/anti-slop-audit.test.ts.
describe("Calendar Task Interaction & Unified Detail Surface", () => {
  const mockTasks: SchoolTask[] = [
    {
      id: "task-school-ai",
      code: "NV-2026-AI",
      taskCode: "NV-2026-AI",
      title: "Xây dựng Trung tâm Nghiên cứu AI và Robotics",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      status: "IN_PROGRESS",
      dueDate: "2026-09-18T17:00:00.000Z",
      progressPercent: 60,
      totalSubTasks: 2,
      completedSubTasks: 1,
      leadAssigneeName: "TS. Nguyễn Văn A",
      assignedDate: "2026-09-01",
      coAssignees: [],
      subTasks: [
        {
          id: "subtask-gpu-cluster",
          taskId: "task-school-ai",
          title: "Nghiệm thu cụm máy chủ GPU H100",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15T17:00:00.000Z",
          assigneeName: "ThS. Trần Văn B",
          assignedToDepartmentId: "CNTT",
          assignedToDepartmentName: "Khoa CNTT",
          department: "Khoa CNTT",
          parentSchoolTaskId: "task-school-ai",
          updatedAt: "2026-09-10T17:00:00.000Z",
        },
      ],
    },
  ];

  const mockNonTaskEvent: CalendarTimeEvent = {
    id: "event-meeting-bgh",
    title: "Họp Giao Ban Đầu Tuần Ban Giám Hiệu",
    date: "2026-09-14",
    startTime: "08:00",
    endTime: "09:30",
    location: "Phòng Họp A - Nhà Hiệu Bộ",
    department: "Ban Giám hiệu",
    departmentName: "Ban Giám hiệu",
    assigneeName: "TS. Lê Doãn Cường (Chủ trì)",
    attendees: ["TS. Lê Doãn Cường", "Phó Hiệu trưởng phụ trách Đào tạo", "Trưởng các Phòng Ban"],
    description: "Rà soát chỉ đạo công tác đào tạo học kỳ I và tiến độ kiểm định ABET",
  };

  describe("1. Unified Detail Surface & Event Routing", () => {
    test("CalendarEventDetailModal renders non-task event details faithfully", () => {
      const html = renderToStaticMarkup(
        React.createElement(CalendarEventDetailModal, {
          event: mockNonTaskEvent,
          isOpen: true,
          onClose: () => {},
        })
      );

      assert.ok(html.includes("Họp Giao Ban Đầu Tuần Ban Giám Hiệu"), "Must render event title");
      assert.ok(html.includes("Phòng Họp A - Nhà Hiệu Bộ"), "Must render location");
      assert.ok(html.includes("08:00 - 09:30"), "Must render formatted time range");
      assert.ok(html.includes("2026-09-14"), "Must render event date");
      assert.ok(html.includes("Rà soát chỉ đạo công tác đào tạo"), "Must render event description");
    });

    test("CalendarEventDetailModal renders nothing when isOpen is false", () => {
      const html = renderToStaticMarkup(
        React.createElement(CalendarEventDetailModal, {
          event: mockNonTaskEvent,
          isOpen: false,
          onClose: () => {},
        })
      );
      assert.equal(html, "");
    });
  });

  describe("2. Responsive Layout: 7-Column Desktop & Mobile Agenda View", () => {
    test("Renders full-width 7-column week grid on desktop", () => {
      const html = renderToStaticMarkup(
        React.createElement(CalendarWorkspace, {
          tasks: mockTasks,
          initialDate: "2026-09-14",
          initialViewMode: "week_grid",
        })
      );

      assert.ok(html.includes('grid-cols-7'), "Must have 7 columns for 7 days of the week");
      assert.ok(html.includes('data-time-grid="true"'), "Must contain time grid layout");
      assert.ok(html.includes("Xây dựng Trung tâm Nghiên cứu AI"), "Must contain task title");
    });

    test("Renders agenda list view with touch-friendly cards for mobile", () => {
      const html = renderToStaticMarkup(
        React.createElement(CalendarWorkspace, {
          tasks: mockTasks,
          events: [mockNonTaskEvent],
          initialDate: "2026-09-14",
          initialViewMode: "agenda_list",
        })
      );

      assert.ok(html.includes("Nghị sự điều hành") || html.includes("mục"), "Must render agenda view");
      assert.ok(html.includes("min-h-[44px]"), "Must ensure touch target height is at least 44px");
      assert.ok(html.includes("Họp Giao Ban Đầu Tuần Ban Giám Hiệu"), "Must render event in agenda list");
    });

    test("Renders day view with 07:00 to 18:00 hourly timeline", () => {
      const html = renderToStaticMarkup(
        React.createElement(CalendarWorkspace, {
          tasks: mockTasks,
          initialDate: "2026-09-18",
          initialViewMode: "day_view",
        })
      );

      assert.ok(html.includes("07:00") && html.includes("18:00"), "Must render 07:00-18:00 hours");
      assert.ok(html.includes("nhiệm vụ / sự kiện"), "Must render day summary header");
    });
  });
});
