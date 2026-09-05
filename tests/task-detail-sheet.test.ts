import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isSchoolTask,
  getTaskLevelBadge,
  getDetailStatusConfig,
  formatDetailDate,
  getTaskAuditTimeline,
  TASK_STATUS_CONFIG,
  TASK_LEVEL_CONFIG,
} from "../src/components/dashboard/task-detail-side-sheet";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("TaskDetailSideSheet Type Guard and Helpers", () => {
  test("distinguishes SchoolTask from StaffTask", () => {
    const schoolTask: SchoolTask = {
      id: "s1",
      title: "Test School",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
    };

    const staffTask: StaffTask = {
      id: "st1",
      title: "Test Staff",
      assigneeName: "Tuấn",
      status: "NEW",
      dueDate: "2026-09-15",
      parentSchoolTaskId: "s1",
      updatedAt: "2026-09-02",
    };

    assert.equal(isSchoolTask(schoolTask), true);
    assert.equal(isSchoolTask(staffTask), false);
    assert.equal(isSchoolTask(null), false);
    assert.equal(isSchoolTask(undefined), false);
  });

  test("provides correct Task Level badge labels", () => {
    const schoolLevel = getTaskLevelBadge(true);
    assert.equal(schoolLevel.label, "Nhiệm vụ cấp Trường");

    const staffLevel = getTaskLevelBadge(false);
    assert.equal(staffLevel.label, "Công việc Đơn vị");
  });

  test("provides status configuration for quick selector and badge", () => {
    const newConfig = getDetailStatusConfig("NEW");
    assert.equal(newConfig.label, "Mới");

    const inProgressConfig = getDetailStatusConfig("IN_PROGRESS");
    assert.equal(inProgressConfig.label, "Đang thực hiện");

    const needsReviewConfig = getDetailStatusConfig("NEEDS_REVIEW");
    assert.equal(needsReviewConfig.label, "Cần chỉnh sửa");

    const completedConfig = getDetailStatusConfig("COMPLETED");
    assert.equal(completedConfig.label, "Hoàn thành");
  });

  test("formats detail dates safely", () => {
    assert.equal(formatDetailDate("2026-09-20"), "20/09/2026");
    assert.equal(formatDetailDate(""), "Chưa đặt");
    assert.equal(formatDetailDate(undefined), "Chưa đặt");
  });

  test("computes structured audit timeline for SchoolTask and StaffTask", () => {
    const schoolTask: SchoolTask = {
      id: "s1",
      title: "Nâng cấp bảo mật hạ tầng mạng",
      category: "ATTT",
      categoryLabel: "An toàn thông tin",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Nguyễn Ngọc Vinh"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "st1",
          title: "Kiểm tra switch mạng",
          assigneeName: "Trần Hùng",
          status: "COMPLETED",
          dueDate: "2026-09-10",
          parentSchoolTaskId: "s1",
          updatedAt: "2026-09-02",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 1,
      progressPercent: 100,
    };

    const timeline = getTaskAuditTimeline(schoolTask);
    assert.ok(Array.isArray(timeline));
    assert.ok(timeline.length >= 2, "Expected at least 2 timeline events");
    assert.equal(timeline[0].type, "assigned");
    assert.ok(timeline[0].timestamp.includes("01/09/2026"));

    const staffTask: StaffTask = {
      id: "st1",
      title: "Viết báo cáo đánh giá an toàn thông tin",
      assigneeName: "Trần Hùng",
      status: "NEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "s1",
      updatedAt: "2026-09-03",
    };

    const staffTimeline = getTaskAuditTimeline(staffTask);
    assert.ok(Array.isArray(staffTimeline));
    assert.ok(staffTimeline.length >= 2);
  });

  test("Anti-slop: zero emojis in task detail side sheet source and configs", () => {
    const hasEmoji = (str: string) =>
      /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D0}\u{1F6E0}-\u{1F6E5}\u{1F6F0}-\u{1F6F3}]/u.test(str);

    // Check status config labels
    for (const status of Object.values(TASK_STATUS_CONFIG)) {
      assert.equal(hasEmoji(status.label), false, `Emoji found in status: ${status.label}`);
    }

    // Check level config labels
    for (const level of Object.values(TASK_LEVEL_CONFIG)) {
      assert.equal(hasEmoji(level.label), false, `Emoji found in level: ${level.label}`);
    }

    // Check source file for zero decorative emojis
    const filePath = path.resolve(__dirname, "../src/components/dashboard/task-detail-side-sheet.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D0}\u{1F6E0}-\u{1F6E5}\u{1F6F0}-\u{1F6F3}]/gu;
    const matches = [...content.matchAll(emojiRegex)];
    assert.equal(matches.length, 0, `Found ${matches.length} emojis in task-detail-side-sheet.tsx: ${matches.map(m => m[0]).join(", ")}`);
  });

  test("Linear styling contract: muted semantic colors, tracking-tight, tabular-nums", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/task-detail-side-sheet.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Title styling
    assert.ok(
      content.includes("font-semibold tracking-tight"),
      "Task title should have font-semibold tracking-tight"
    );

    // Task ID and dates in font-mono tabular-nums
    assert.ok(
      content.includes("font-mono") && content.includes("tabular-nums"),
      "Metadata and IDs must use font-mono tabular-nums"
    );

    // Muted semantic status colors
    for (const status of Object.values(TASK_STATUS_CONFIG)) {
      assert.ok(
        status.className.includes("border-") && (status.className.includes("bg-") || status.className.includes("muted")),
        `Status ${status.label} should have muted semantic styling`
      );
    }

    // Clean audit timeline line and flat bullet nodes
    assert.ok(
      content.includes("before:w-px") || content.includes("before:bg-border"),
      "Audit timeline should feature a refined hairline timeline track"
    );
  });
});
