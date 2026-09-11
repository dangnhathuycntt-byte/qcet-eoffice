import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CalendarWorkspace,
  CalendarEventDetailModal,
  type CalendarTimeEvent,
  type CalendarViewMode,
} from "../src/components/calendar/calendar-workspace";
import {
  transformTasksToCalendarOperations,
  type WorkCalendarItem,
} from "../src/lib/work-calendar-adapter";
import type { SchoolTask } from "../src/types/dashboard";

describe("Calendar Task Interaction & Unified Detail Surface", () => {
  const calendarWorkspacePath = path.resolve(
    process.cwd(),
    "src/components/calendar/calendar-workspace.tsx"
  );
  const calendarPagePath = path.resolve(
    process.cwd(),
    "src/app/calendar/page.tsx"
  );

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
    test("CalendarWorkspace distinguishes task events from non-task events", () => {
      assert.ok(fs.existsSync(calendarWorkspacePath));
      const code = fs.readFileSync(calendarWorkspacePath, "utf8");

      // Verifies branching on task vs non-task
      assert.ok(
        code.includes("item.sourceTaskId") || code.includes("ev.taskId") || code.includes("event.taskId"),
        "Must verify whether event corresponds to a task ID"
      );
      assert.ok(
        code.includes("onSelectNonTaskEvent") || code.includes("setSelectedNonTaskEvent"),
        "Must route non-task events to lightweight detail modal or non-task handler"
      );
    });

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
    test("CalendarWorkspace supports 4 distinct view modes (month_grid, week_grid, day_view, agenda_list)", () => {
      const code = fs.readFileSync(calendarWorkspacePath, "utf8");
      assert.ok(code.includes('"month_grid"'));
      assert.ok(code.includes('"week_grid"'));
      assert.ok(code.includes('"day_view"'));
      assert.ok(code.includes('"agenda_list"'));
    });

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

  describe("3. URL & Context Preservation in /calendar Route", () => {
    test("Calendar page parses ?taskId=... from URL search params", () => {
      const pageCode = fs.readFileSync(calendarPagePath, "utf8");
      assert.ok(
        pageCode.includes('searchParams?.get("taskId")') || pageCode.includes('searchParams.get("taskId")'),
        "Must read taskId query parameter from URL"
      );
      assert.ok(
        pageCode.includes("setSelectedTask"),
        "Must update selectedTask when taskIdParam matches"
      );
    });

    test("Calendar page updates browser URL without client reload or router.replace", () => {
      const pageCode = fs.readFileSync(calendarPagePath, "utf8");
      assert.equal(
        pageCode.includes("router.replace"),
        false,
        "Must not use router.replace to avoid unstyled state and full reload"
      );
      assert.ok(
        pageCode.includes("window.history.pushState") || pageCode.includes("window.history.replaceState"),
        "Must use window.history pushState / replaceState for seamless URL sync"
      );
    });

    test("Level-1 /calendar eliminates redundant 3-tier breadcrumbs while preserving task context", () => {
      const pageCode = fs.readFileSync(calendarPagePath, "utf8");
      assert.equal(
        pageCode.includes('<nav aria-label="Breadcrumb"'),
        false,
        "Level-1 primary calendar screen must not repeat location via redundant breadcrumb (P1 navigation invariant)"
      );
      assert.ok(
        pageCode.includes("taskIdParam") || pageCode.includes("selectedTask"),
        "Calendar page must preserve selectedTask and taskId URL context"
      );
    });
  });

  describe("4. Anti-Slop & Light-Only Standard Compliance", () => {
    test("calendar-workspace.tsx contains ZERO dark: classes", () => {
      const code = fs.readFileSync(calendarWorkspacePath, "utf8");
      assert.doesNotMatch(code, /\bdark:/, "calendar-workspace.tsx must contain no dark: classes");
    });

    test("calendar-workspace.tsx contains ZERO decorative emojis", () => {
      const code = fs.readFileSync(calendarWorkspacePath, "utf8");
      assert.doesNotMatch(code, /[\u{1F300}-\u{1FAFF}]/u, "calendar-workspace.tsx must contain no decorative emojis");
    });

    test("src/app/calendar/page.tsx contains ZERO dark: classes", () => {
      const code = fs.readFileSync(calendarPagePath, "utf8");
      assert.doesNotMatch(code, /\bdark:/, "page.tsx must contain no dark: classes");
    });

    test("src/app/calendar/page.tsx contains ZERO decorative emojis", () => {
      const code = fs.readFileSync(calendarPagePath, "utf8");
      assert.doesNotMatch(code, /[\u{1F300}-\u{1FAFF}]/u, "page.tsx must contain no decorative emojis");
    });

    test("calendar-workspace.tsx utilizes tabular-nums for numeric precision", () => {
      const code = fs.readFileSync(calendarWorkspacePath, "utf8");
      assert.ok(code.includes("tabular-nums"), "Must use tabular-nums for dates, hours, and counters");
    });
  });
});
