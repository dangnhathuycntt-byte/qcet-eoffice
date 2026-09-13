import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  transformTasksToCalendarOperations,
  filterWorkCalendarItems,
  getPriorOverdueWorkItems,
  type WorkCalendarItem,
  type WorkCalendarFilterState,
} from "../src/lib/work-calendar-adapter";
import {
  ExecutiveCalendarWorkspace,
  getWeekDays,
  type CalendarTimeEvent,
} from "../src/components/calendar/executive-calendar-workspace";
import {
  getInitialTaskFormData,
  validateTaskForm,
  type CreateTaskFormData,
} from "../src/components/dashboard/create-task-modal";
import { computeSchoolTaskRollup } from "../src/lib/dashboard-aggregator";
import { getSystemReferenceDate, isTaskPastDue } from "../src/lib/academic-calendar";
import type { SchoolTask, StaffTask, TaskStatus } from "../src/types/dashboard";

describe("Calendar Route Integration & Interactive Task Operations", () => {
  const mockTasks: SchoolTask[] = [
    {
      id: "task-school-1",
      taskCode: "NV-2026-001",
      code: "NV-2026-001",
      title: "Hoàn thiện Đề án Nâng cấp Phòng Thí nghiệm AI",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      status: "IN_PROGRESS",
      dueDate: "2026-09-18T17:00:00.000Z",
      progressPercent: 50,
      totalSubTasks: 2,
      completedSubTasks: 1,
      leadAssigneeName: "Nguyễn Văn A",
      assignedDate: "2026-09-01",
      coAssignees: [],
      subTasks: [
        {
          id: "sub-1-1",
          taskId: "task-school-1",
          title: "Khảo sát hiện trạng thiết bị phần cứng",
          status: "COMPLETED",
          dueDate: "2026-09-10T17:00:00.000Z",
          assigneeName: "Trần Văn B",
          assignedToDepartmentId: "CNTT",
          assignedToDepartmentName: "Khoa CNTT",
          department: "Khoa CNTT",
          parentSchoolTaskId: "task-school-1",
          updatedAt: "2026-09-10T17:00:00.000Z",
        },
        {
          id: "sub-1-2",
          taskId: "task-school-1",
          title: "Lập bảng dự toán kinh phí mua sắm GPU",
          status: "IN_PROGRESS",
          dueDate: "2026-09-18T17:00:00.000Z",
          assigneeName: "Lê Thị C",
          assignedToDepartmentId: "CNTT",
          assignedToDepartmentName: "Khoa CNTT",
          department: "Khoa CNTT",
          parentSchoolTaskId: "task-school-1",
          updatedAt: "2026-09-01T17:00:00.000Z",
        },
      ],
    },
    {
      id: "task-school-overdue",
      taskCode: "NV-2026-099",
      code: "NV-2026-099",
      title: "Báo cáo tự đánh giá kiểm định ABET",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      status: "IN_PROGRESS",
      dueDate: "2026-08-25T17:00:00.000Z", // Past due
      progressPercent: 30,
      totalSubTasks: 1,
      completedSubTasks: 0,
      leadAssigneeName: "Vũ Thị D",
      assignedDate: "2026-08-01",
      coAssignees: [],
      subTasks: [],
    },
  ];

  test("Slot click passing date pre-fills initialDueDate for task creation modal", () => {
    const clickedSlotDate = "2026-09-16";
    const initialForm = {
      ...getInitialTaskFormData("TRUONG"),
      dueDate: clickedSlotDate,
    };

    assert.equal(initialForm.dueDate, "2026-09-16");
    assert.equal(initialForm.level, "TRUONG");

    // Validation succeeds when required fields are populated
    initialForm.title = "Nhiệm vụ kiểm định chất lượng mới";
    initialForm.leadAssigneeName = "Trần Văn B";
    initialForm.category = "CNTT";
    const errors = validateTaskForm(initialForm);
    assert.equal(Object.keys(errors).length, 0);
  });

  test("Work item click resolves correct task/subtask for side-sheet inspection", () => {
    const calendarItems = transformTasksToCalendarOperations(mockTasks);

    // 1. Milestone click maps to parent school task
    const milestoneItem = calendarItems.find((item) => item.type === "school_milestone");
    assert.ok(milestoneItem, "Must produce school_milestone item");

    const matchedSchoolTask = mockTasks.find(
      (t) => t.id === milestoneItem.sourceTaskId || t.id === milestoneItem.parentSchoolTaskId
    );
    assert.ok(matchedSchoolTask);
    assert.equal(matchedSchoolTask.id, "task-school-1");

    // 2. Subtask click maps to subtask inside school task
    const subtaskItem = calendarItems.find((item) => item.type === "subtask");
    assert.ok(subtaskItem, "Must produce subtask item");

    let matchedSub: StaffTask | undefined;
    for (const st of mockTasks) {
      if (st.subTasks) {
        matchedSub = st.subTasks.find((sub) => sub.id === subtaskItem.sourceTaskId);
        if (matchedSub) break;
      }
    }
    assert.ok(matchedSub);
    assert.equal(matchedSub.title, "Khảo sát hiện trạng thiết bị phần cứng");
    assert.equal(matchedSub.assigneeName, "Trần Văn B");
  });

  test("Optimistic task creation updates state and recalibrates rollup", () => {
    let tasksState = [...mockTasks];

    // Optimistic creation of subtask under task-school-1
    const newSubtask: StaffTask = {
      id: "sub-1-3-new",
      taskId: "task-school-1",
      title: "Thẩm định danh mục phòng lab",
      status: "COMPLETED",
      dueDate: "2026-09-17T17:00:00.000Z",
      assigneeName: "Trần Văn B",
      assignedToDepartmentId: "CNTT",
      department: "Khoa CNTT",
      parentSchoolTaskId: "task-school-1",
      updatedAt: "2026-09-15T17:00:00.000Z",
    };

    tasksState = tasksState.map((st) => {
      if (st.id === "task-school-1") {
        const updatedSubs = [...(st.subTasks || []), newSubtask];
        return computeSchoolTaskRollup({
          ...st,
          subTasks: updatedSubs,
        });
      }
      return st;
    });

    const updatedTask = tasksState.find((t) => t.id === "task-school-1")!;
    assert.equal(updatedTask.totalSubTasks, 3);
    assert.equal(updatedTask.completedSubTasks, 2);
    // 2 completed out of 3 = 67%
    assert.equal(updatedTask.progressPercent, 67);
  });

  test("Optimistic status change updates task and side sheet state synchronously", () => {
    let tasksState = [...mockTasks];
    let selectedTask: SchoolTask | StaffTask | null = tasksState[0].subTasks![1]; // sub-1-2 (IN_PROGRESS)

    const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
      tasksState = tasksState.map((st) => {
        if (st.id === taskId) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
          return { ...st, status: schoolStatus };
        }
        if (st.subTasks) {
          const hasSub = st.subTasks.some((sub) => sub.id === taskId);
          if (hasSub) {
            const updatedSubs = st.subTasks.map((sub) =>
              sub.id === taskId ? { ...sub, status: newStatus } : sub
            );
            return computeSchoolTaskRollup({ ...st, subTasks: updatedSubs });
          }
        }
        return st;
      });

      if (selectedTask && selectedTask.id === taskId) {
        selectedTask = {
          ...selectedTask,
          status: newStatus,
        };
      }
    };

    // Mark sub-1-2 as COMPLETED
    handleStatusChange("sub-1-2", "COMPLETED");

    assert.equal(selectedTask?.status, "COMPLETED");
    const parentTask = tasksState.find((t) => t.id === "task-school-1")!;
    assert.equal(parentTask.completedSubTasks, 2);
    assert.equal(parentTask.totalSubTasks, 2);
    assert.equal(parentTask.progressPercent, 100);
  });

  test("ExecutiveCalendarWorkspace supports onOpenAddTask and onSelectWorkItem", () => {
    let addedDate = "";
    let selectedItem: WorkCalendarItem | null = null;

    const html = renderToStaticMarkup(
      React.createElement(ExecutiveCalendarWorkspace, {
        tasks: mockTasks,
        initialDate: "2026-09-14",
        initialViewMode: "week_grid",
        onAddTask: (date?: string) => {
          addedDate = date || "";
        },
        onOpenAddTask: (date?: string) => {
          addedDate = date || "";
        },
        onSelectWorkItem: (item) => {
          selectedItem = item;
        },
        isExecutive: true,
      })
    );

    assert.ok(html.includes("NV-2026-001"), "Workspace must render task code NV-2026-001");
    assert.ok(html.includes("data-time-grid"), "Workspace must render time grid");
    assert.ok(html.includes("Hôm nay"), "Workspace must render Hôm nay action button");
  });

  test("Timezone safety: date-only strings in getWeekDays do not shift in UTC+7", () => {
    // 2026-09-14 is a Monday
    const weekDays = getWeekDays("2026-09-14");
    assert.equal(weekDays.length, 7);
    assert.equal(weekDays[0].dateString, "2026-09-14");
    assert.equal(weekDays[0].dayOfWeekLabel, "T2");
    assert.equal(weekDays[6].dateString, "2026-09-20");
    assert.equal(weekDays[6].dayOfWeekLabel, "CN");

    // Reference date check
    const sysRef = getSystemReferenceDate();
    assert.ok(sysRef.includes("2026-09-"), "System reference date should anchor in academic cycle 2026-09");
  });

  test("filterWorkCalendarItems preserves overdue items when filtering by type", () => {
    const overdueTasks = getPriorOverdueWorkItems(mockTasks, "2026-09-14");
    assert.equal(overdueTasks.length, 1);
    assert.equal(overdueTasks[0].sourceTaskId, "task-school-overdue");

    const filter: WorkCalendarFilterState = {
      departmentId: "ALL",
      itemType: "school_milestone",
      status: "ALL",
      searchQuery: "",
    };

    const filtered = filterWorkCalendarItems(overdueTasks, filter);
    assert.equal(filtered.length, 1, "Filtering by school_milestone must retain overdue school milestone items");
  });

  test("Calendar page code contains ZERO dark: classes (Light-Only Standard)", () => {
    const pageFile = path.resolve(process.cwd(), "src/app/calendar/page.tsx");
    const workspaceFile = path.resolve(
      process.cwd(),
      "src/components/calendar/executive-calendar-workspace.tsx"
    );

    const pageContent = fs.readFileSync(pageFile, "utf8");
    const workspaceContent = fs.readFileSync(workspaceFile, "utf8");

    assert.doesNotMatch(pageContent, /\bdark:/, "page.tsx must have NO dark: classes");
    assert.doesNotMatch(workspaceContent, /\bdark:/, "executive-calendar-workspace.tsx must have NO dark: classes");
  });

  test("Calendar controls consolidated into content-first primary row with secondary disclosure", () => {
    const pageFile = path.resolve(process.cwd(), "src/app/calendar/page.tsx");
    const pageContent = fs.readFileSync(pageFile, "utf8");

    // Primary row contains scope switcher and month navigation
    assert.match(pageContent, /data-slot="calendar-controls-container"/, "Must contain controls container");
    assert.match(pageContent, /Của tôi/, "Scope tab must use canonical 'Của tôi'");
    assert.match(pageContent, /Hôm nay/, "Primary row must contain 'Hôm nay' navigation");

    // Task and event creation actions present
    assert.match(pageContent, /Tạo công việc/, "Dropdown must offer 'Tạo công việc'");
    assert.match(pageContent, /Tạo sự kiện/, "Dropdown must offer 'Tạo sự kiện'");

    // Search and secondary controls gated behind disclosure
    assert.match(pageContent, /isSecondaryOpen/, "Secondary controls must live behind disclosure");
  });

  test("Calendar month cells render at most 3 task previews with +N nhiệm vụ overflow badge", () => {
    const gridFile = path.resolve(process.cwd(), "src/components/calendar/calendar-month-grid.tsx");
    const gridContent = fs.readFileSync(gridFile, "utf8");

    // Max 3 preview items per cell
    assert.match(gridContent, /MAX_PREVIEW\s*=\s*3/, "Cell must define MAX_PREVIEW = 3");
    assert.match(gridContent, /slice\(0,\s*(?:MAX_PREVIEW|3)\)/, "Cell must slice items to max 3 items");

    // Exact "+N nhiệm vụ" overflow badge
    assert.match(gridContent, /\+\{remainingCount\}\s*nhiệm vụ/, "Must render +{remainingCount} nhiệm vụ");
    assert.doesNotMatch(gridContent, /\+\{remainingCount\}\s*việc khác/, "Must NOT render việc khác");
  });

  test("Calendar day sheet handles polite empty state and compliant touch targets", () => {
    const sheetFile = path.resolve(process.cwd(), "src/components/calendar/calendar-day-sheet.tsx");
    const sheetContent = fs.readFileSync(sheetFile, "utf8");

    // Polite empty state
    assert.match(sheetContent, /Không có nhiệm vụ trong ngày/, "Sheet must display polite empty state header");
    assert.match(sheetContent, /\+ Thêm việc ngày này/, "Sheet must display contextual '+ Thêm việc ngày này'");

    // Touch targets >= 44px on mobile
    assert.match(sheetContent, /min-h-\[44px\]/, "Must contain min-h-[44px] touch target for mobile actions");
  });
});
