import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getExecutiveStatCardData,
  getStatCardData,
} from "../src/components/dashboard/executive-stat-strip";
import {
  buildExecutiveAttentionQueue,
  type ExecutiveAttentionItem,
} from "../src/components/dashboard/executive-cockpit-workspace";
import {
  getDepartmentTasksUrl,
  sortDepartmentsByProgress,
  sortDepartmentsByOverdue,
  getDepartmentCardData,
} from "../src/components/dashboard/department-progress-matrix";
import { parseDateOnly } from "../src/components/dashboard/upcoming-deadlines-widget";
import { getActorInitials } from "../src/components/dashboard/activity-feed-widget";
import type { SchoolTask, DashboardStats } from "../src/types/dashboard";
import type { DepartmentHealthSummary } from "../src/lib/executive-matrix-aggregator";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Executive Dashboard Streamlining (Phase 6)", () => {
  const mockStats: DashboardStats = {
    totalSchoolTasks: 50,
    schoolTasksInProgress: 30,
    schoolTasksCompleted: 15,
    schoolTasksNotStarted: 5,
    totalStaffTasks: 120,
    staffTasksInProgress: 80,
    staffTasksCompleted: 35,
    staffTasksNotStarted: 5,
    needsReviewTasksCount: 4,
    overdueTasksCount: 3,
    averageSchoolProgressPercent: 68,
    completionRate: 30,
  };

  const mockTasks = [
    {
      id: "task-approval-1",
      code: "NV-001",
      title: "Phê duyệt kế hoạch kiểm định chất lượng đào tạo",
      departmentId: "QLCL",
      departmentName: "Phòng Quản lý chất lượng",
      dueDate: "2026-09-15",
      status: "PENDING_EXECUTIVE_APPROVAL",
      progressPercent: 100,
      priority: "HIGH",
      category: "BAO_CAO",
    },
    {
      id: "task-blocked-1",
      code: "NV-002",
      title: "Giải phóng mặt bằng phân hiệu 2",
      departmentId: "QTCSVC",
      departmentName: "Phòng QT-CSVC",
      dueDate: "2026-09-10",
      status: "BLOCKED" as any,
      progressPercent: 40,
      priority: "URGENT",
      category: "BAO_CAO",
    },
    {
      id: "task-overdue-1",
      code: "NV-003",
      title: "Báo cáo tuyển sinh đợt 1",
      departmentId: "TS-TT",
      departmentName: "Trung tâm TS-TT",
      dueDate: "2026-08-30",
      status: "IN_PROGRESS",
      progressPercent: 60,
      priority: "HIGH",
      category: "BAO_CAO",
    },
    {
      id: "task-normal-1",
      code: "NV-004",
      title: "Cập nhật đề cương chi tiết học kỳ 1",
      departmentId: "K-CNTT",
      departmentName: "Khoa CNTT",
      dueDate: "2026-09-25",
      status: "IN_PROGRESS",
      progressPercent: 50,
      priority: "NORMAL",
      category: "CNTT",
    },
    {
      id: "task-completed-1",
      code: "NV-005",
      title: "Tổ chức lễ khai giảng năm học 2026-2027",
      departmentId: "CT-CTHSSV",
      departmentName: "Phòng CT-CTHSSV",
      dueDate: "2026-09-05",
      status: "COMPLETED",
      progressPercent: 100,
      priority: "HIGH",
      category: "BAO_CAO",
    },
  ] as unknown as SchoolTask[];

  describe("1. Single 5-KPI Strip", () => {
    test("getExecutiveStatCardData returns exactly 5 core KPIs", () => {
      const cards = getExecutiveStatCardData(mockStats);
      assert.equal(cards.length, 5);

      const titles = cards.map((c) => c.title);
      assert.deepEqual(titles, [
        "Tổng nhiệm vụ",
        "Chờ duyệt",
        "Trễ / vướng",
        "Trọng tâm",
        "Tiến độ toàn trường",
      ]);
    });

    test("cards format values and percentages correctly", () => {
      const cards = getExecutiveStatCardData(mockStats);
      assert.equal(cards[0].value, "50");
      assert.equal(cards[1].value, "4");
      assert.equal(cards[4].value, "68%");
    });

    test("zero decorative emojis in all executive stat card labels and subtexts", () => {
      const cards = getExecutiveStatCardData(mockStats);
      const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      for (const card of cards) {
        assert.ok(!emojiRegex.test(card.title), `Title has emoji: ${card.title}`);
        if (card.subtext) {
          assert.ok(!emojiRegex.test(card.subtext), `Subtext has emoji: ${card.subtext}`);
        }
        if (card.badge?.label) {
          assert.ok(!emojiRegex.test(card.badge.label), `Badge has emoji: ${card.badge.label}`);
        }
      }
    });
  });

  describe("2. Attention Queue Builder", () => {
    test("builds attention queue prioritizing pending approvals, blocked and overdue items", () => {
      const items = buildExecutiveAttentionQueue(mockTasks, "2026-09-09", 7);

      assert.ok(items.length >= 3);
      // Item 1 should be pending approval
      assert.equal(items[0].type, "APPROVAL");
      assert.equal(items[0].id, "task-approval-1");

      // Item 2 should be blocked
      assert.equal(items[1].type, "BLOCKED");
      assert.equal(items[1].id, "task-blocked-1");

      // Item 3 should be overdue
      assert.equal(items[2].type, "OVERDUE");
      assert.equal(items[2].id, "task-overdue-1");
    });

    test("excludes completed tasks from the attention queue", () => {
      const items = buildExecutiveAttentionQueue(mockTasks, "2026-09-09", 7);
      const completedItem = items.find((i) => i.id === "task-completed-1");
      assert.equal(completedItem, undefined);
    });

    test("generates deep link tasksUrl directing to /tasks?taskId=...", () => {
      const items = buildExecutiveAttentionQueue(mockTasks, "2026-09-09", 7);
      for (const item of items) {
        assert.ok(
          item.tasksUrl.startsWith("/tasks?taskId="),
          `Task URL should link to /tasks: ${item.tasksUrl}`
        );
      }
    });

    test("limits attention items to maximum specified count", () => {
      const items = buildExecutiveAttentionQueue(mockTasks, "2026-09-09", 2);
      assert.equal(items.length, 2);
    });
  });

  describe("3. Department Progress Matrix & Navigation", () => {
    const mockDepts: DepartmentHealthSummary[] = [
      {
        departmentId: "K-CNTT",
        code: "K-CNTT",
        departmentName: "Khoa CNTT",
        leadName: "Trưởng khoa CNTT",
        totalTasksCount: 20,
        completedTasksCount: 18,
        inProgressTasksCount: 2,
        overdueTasksCount: 0,
        blockedTasksCount: 0,
        totalTasks: 20,
        completedTasks: 18,
        inProgressTasks: 2,
        overdueTasks: 0,
        averageProgressPercent: 90,
        healthScore: 92,
        healthStatus: "HEALTHY",
      },
      {
        departmentId: "QTCSVC",
        code: "QTCSVC",
        departmentName: "Phòng QT-CSVC",
        leadName: "Trưởng phòng QTCSVC",
        totalTasksCount: 15,
        completedTasksCount: 5,
        inProgressTasksCount: 7,
        overdueTasksCount: 3,
        blockedTasksCount: 0,
        totalTasks: 15,
        completedTasks: 5,
        inProgressTasks: 7,
        overdueTasks: 3,
        averageProgressPercent: 45,
        healthScore: 50,
        healthStatus: "AT_RISK",
      },
      {
        departmentId: "P-DT",
        code: "P-DT",
        departmentName: "Phòng Đào tạo",
        leadName: "Trưởng phòng ĐT",
        totalTasksCount: 25,
        completedTasksCount: 15,
        inProgressTasksCount: 9,
        overdueTasksCount: 1,
        blockedTasksCount: 0,
        totalTasks: 25,
        completedTasks: 15,
        inProgressTasks: 9,
        overdueTasks: 1,
        averageProgressPercent: 72,
        healthScore: 78,
        healthStatus: "HEALTHY",
      },
    ];

    test("generates direct link to /tasks?scope=school&dept=...", () => {
      const url = getDepartmentTasksUrl("K-CNTT");
      assert.equal(url, "/tasks?scope=school&dept=K-CNTT");
    });

    test("sorts departments by progress accurately", () => {
      const sorted = sortDepartmentsByProgress(mockDepts, true);
      assert.equal(sorted[0].code, "K-CNTT"); // 90%
      assert.equal(sorted[1].code, "P-DT");   // 72%
      assert.equal(sorted[2].code, "QTCSVC"); // 45%
    });

    test("sorts departments by overdue tasks accurately", () => {
      const sorted = sortDepartmentsByOverdue(mockDepts, true);
      assert.equal(sorted[0].code, "QTCSVC"); // 3 overdue
      assert.equal(sorted[1].code, "P-DT");   // 1 overdue
      assert.equal(sorted[2].code, "K-CNTT"); // 0 overdue
    });

    test("getDepartmentCardData assigns correct progress color", () => {
      const cards = getDepartmentCardData(mockDepts);
      assert.equal(cards[0].progressColor, "bg-emerald-500");
      assert.equal(cards[1].progressColor, "bg-rose-500");
      assert.equal(cards[2].progressColor, "bg-amber-500");
    });
  });

  describe("4. Compact Widgets (Deadlines & Activity)", () => {
    test("parseDateOnly extracts year, month, day correctly", () => {
      const result = parseDateOnly("2026-09-15T00:00:00.000Z");
      assert.equal(result.year, 2026);
      assert.equal(result.month, 8); // 0-indexed month for September
      assert.equal(result.day, 15);
    });

    test("getActorInitials handles Vietnamese and single names cleanly", () => {
      assert.equal(getActorInitials("Nguyễn Văn A"), "NA");
      assert.equal(getActorInitials("Quản trị"), "QT");
      assert.equal(getActorInitials("Huy"), "HU");
      assert.equal(getActorInitials(""), "QC");
    });
  });

  describe("5. Anti-Slop & Light-Only Standard Compliance", () => {
    test("executive dashboard files have zero dark: classes", () => {
      const filesToCheck = [
        "src/components/dashboard/executive-stat-strip.tsx",
        "src/components/dashboard/department-progress-matrix.tsx",
        "src/components/dashboard/upcoming-deadlines-widget.tsx",
        "src/components/dashboard/activity-feed-widget.tsx",
        "src/components/dashboard/executive-cockpit-workspace.tsx",
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.join(process.cwd(), relPath);
        assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
        const content = fs.readFileSync(fullPath, "utf-8");
        const darkMatches = content.match(/\bdark:[^\s"'`]+/g);
        assert.equal(
          darkMatches,
          null,
          `File ${relPath} contains prohibited dark: classes: ${darkMatches?.join(", ")}`
        );
      }
    });

    test("executive dashboard files do not contain decorative emojis", () => {
      const filesToCheck = [
        "src/components/dashboard/executive-stat-strip.tsx",
        "src/components/dashboard/department-progress-matrix.tsx",
        "src/components/dashboard/upcoming-deadlines-widget.tsx",
        "src/components/dashboard/activity-feed-widget.tsx",
        "src/components/dashboard/executive-cockpit-workspace.tsx",
      ];

      const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      for (const relPath of filesToCheck) {
        const fullPath = path.join(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        // Check line by line to locate any emoji
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          assert.ok(
            !emojiRegex.test(line),
            `File ${relPath} line ${idx + 1} contains decorative emoji: ${line.trim()}`
          );
        });
      }
    });
  });
});
