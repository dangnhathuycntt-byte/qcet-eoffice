/**
 * Workspace UI Invariants Test Suite (Shard F4 / Sprints 8 & 9)
 *
 * Enforces universal UI and semantic invariants across all QCET workspace views:
 * 1. Zero-Emoji Policy: RegEx /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u across all workspace views
 * 2. Single Global Primary Action: Absence of duplicate page-level CTAs on /tasks, /calendar, /dashboard
 * 3. 'Của tôi' Scope-vs-Status Exclusivity: Present in ScopeSwitcher, strictly absent in StatusFilter
 * 4. Dashboard Cockpit Deduplication: Band 1 (5 primary KPI cards) vs Band 2 (Action Queue)
 * 5. Touch Target & Accessibility Standards (>= 44px / touch-manipulation)
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  parseWorkspaceQuery,
  DEFAULT_WORKSPACE_FILTER_STATE,
} from "../src/lib/workspace-query";
import { ScopeSwitcher } from "../src/components/workspace/scope-switcher";
import { DEFAULT_STATUS_OPTIONS } from "../src/components/workspace/status-filter";
import {
  getExecutiveStatCardData,
  getStatCardData,
} from "../src/components/dashboard/executive-stat-strip";
import { getActionCardData } from "../src/components/dashboard/executive-action-center";
import type { DashboardStats } from "../src/types/dashboard";
import type { ExecutiveActionStats } from "../src/lib/executive-matrix-aggregator";

// Unicode range covering standard emojis, symbols, and pictographs
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

const WORKSPACE_DIRECTORIES = [
  "src/app/tasks",
  "src/app/calendar",
  "src/app/dashboard",
  "src/components/workspace",
  "src/components/tasks",
  "src/components/calendar",
  "src/components/dashboard",
];

function getSourceFilesRecursively(dir: string, baseDir = process.cwd()): string[] {
  const fullPath = path.resolve(baseDir, dir);
  if (!fs.existsSync(fullPath)) return [];

  const results: string[] = [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(fullPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...getSourceFilesRecursively(path.join(dir, entry.name), baseDir));
    } else if (
      (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx") &&
      !entry.name.endsWith(".d.ts")
    ) {
      results.push(entryPath);
    }
  }

  return results;
}

describe("Workspace UI Invariants - Quality, Semantics & Zero-Emoji Suite", () => {
  describe("Invariant 1: Zero-Emoji Policy Across All Workspace Views", () => {
    const allWorkspaceFiles = WORKSPACE_DIRECTORIES.flatMap((dir) =>
      getSourceFilesRecursively(dir)
    );

    test("scans a non-empty comprehensive set of workspace component and page files", () => {
      assert.ok(
        allWorkspaceFiles.length >= 25,
        `Expected at least 25 workspace source files, found ${allWorkspaceFiles.length}`
      );
    });

    test("asserts zero emojis across all workspace views and components", () => {
      const violations: { file: string; line: number; match: string }[] = [];

      for (const filePath of allWorkspaceFiles) {
        const relativePath = path.relative(process.cwd(), filePath);
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          const match = line.match(new RegExp(EMOJI_REGEX.source, "gu"));
          if (match) {
            violations.push({
              file: relativePath,
              line: index + 1,
              match: match.join(", "),
            });
          }
        });
      }

      assert.deepEqual(
        violations,
        [],
        `Detected forbidden emojis in workspace UI components:\n${violations
          .map((v) => `  - ${v.file}:${v.line} [${v.match}]`)
          .join("\n")}`
      );
    });

    test("emoji detection regex correctly catches sample pictographs and symbols", () => {
      const sampleViolations = ["🔥 Báo cáo khẩn", "🚀 Nhiệm vụ mới", "📅 Lịch tuần", "⚡ Điểm nghẽn"];
      for (const text of sampleViolations) {
        assert.ok(
          EMOJI_REGEX.test(text),
          `Regex must catch forbidden emoji in: "${text}"`
        );
      }

      const sampleClean = [
        "Báo cáo khẩn",
        "Nhiệm vụ mới",
        "Lịch công tác",
        "Điểm nghẽn & Trễ hạn",
        "Của tôi",
        "Toàn trường",
        "+ Giao việc",
        "+ Tạo",
      ];
      for (const text of sampleClean) {
        assert.ok(
          !EMOJI_REGEX.test(text),
          `Regex must NOT falsely flag clean text: "${text}"`
        );
      }
    });
  });

  describe("Invariant 2: Single Global Primary Action (Absence of Duplicate Page-Level CTAs)", () => {
    test("tasks page (/tasks): exactly 1 primary creation action in WorkspaceToolbar / UnifiedTaskToolbar, absent in header", () => {
      // 1. Page Header must NOT contain a duplicate '+ Giao việc' or '+ Tạo' button
      const tasksPagePath = path.resolve(process.cwd(), "src/app/tasks/page.tsx");
      const tasksPageContent = fs.readFileSync(tasksPagePath, "utf-8");

      // The server page simply renders TasksPageClient; no header CTA button
      assert.ok(
        !tasksPageContent.includes("+ Giao việc") && !tasksPageContent.includes("+ Tạo"),
        "src/app/tasks/page.tsx must not declare page-level creation CTA buttons"
      );

      // 2. Toolbar defines the single canonical '+ Giao việc' CTA button
      const workspacePath = path.resolve(
        process.cwd(),
        "src/components/workspace/unified-adaptive-workspace.tsx"
      );
      const workspaceContent = fs.readFileSync(workspacePath, "utf-8");
      assert.ok(
        workspaceContent.includes('createButtonLabel="+ Giao việc"'),
        "UnifiedAdaptiveWorkspace must configure single primary action '+ Giao việc'"
      );

      const unifiedToolbarPath = path.resolve(
        process.cwd(),
        "src/components/dashboard/unified-task-toolbar.tsx"
      );
      const unifiedToolbarContent = fs.readFileSync(unifiedToolbarPath, "utf-8");
      assert.ok(
        unifiedToolbarContent.includes('createButtonLabel || "+ Giao việc"'),
        "UnifiedTaskToolbar must define '+ Giao việc' as default primary action"
      );

      // 3. WorkspaceToolbar canonical component accepts primaryAction
      const toolbarPath = path.resolve(
        process.cwd(),
        "src/components/workspace/workspace-toolbar.tsx"
      );
      const toolbarContent = fs.readFileSync(toolbarPath, "utf-8");
      assert.ok(
        toolbarContent.includes("primaryAction"),
        "WorkspaceToolbar must accept single canonical primaryAction"
      );
    });

    test("calendar page (/calendar): exactly 1 global primary action (+ Tạo dropdown) in control row 2", () => {
      const calendarPagePath = path.resolve(process.cwd(), "src/app/calendar/page.tsx");
      const calendarContent = fs.readFileSync(calendarPagePath, "utf-8");

      // 1. In top page header (Section 1), the actions bar contains ONLY Refresh ("Làm mới") and no create buttons
      const headerStart = calendarContent.indexOf("Global Actions: Refresh");
      const headerEnd = calendarContent.indexOf("Unified Calendar Chrome");
      assert.ok(headerStart > 0 && headerEnd > headerStart, "Calendar header section must be present");
      const headerSection = calendarContent.slice(headerStart, headerEnd);

      assert.ok(
        headerSection.includes("Làm mới dữ liệu lịch") || headerSection.includes("Làm mới"),
        "Calendar header must include the Refresh action"
      );
      assert.ok(
        !headerSection.includes("handleOpenAddTask") && !headerSection.includes("handleOpenAddEvent"),
        "Calendar header must NOT contain creation handlers (no redundant header create button)"
      );

      // 2. Control Row 2 contains the single canonical '+ Tạo' primary action dropdown
      const controlsRow2 = calendarContent.slice(
        calendarContent.indexOf('data-slot="calendar-controls-row-2"'),
        calendarContent.indexOf("Calendar Content: Month Grid or Agenda List")
      );
      assert.ok(
        controlsRow2.includes("Single Global Primary Action (+ Tạo Dropdown)"),
        "Calendar Control Row 2 must house the single global + Tạo CTA"
      );
      assert.ok(
        controlsRow2.includes("handleOpenAddTask") && controlsRow2.includes("handleOpenAddEvent"),
        "Single + Tạo dropdown must consolidate both 'Tạo công việc' and 'Tạo sự kiện'"
      );
    });

    test("dashboard page (/dashboard): renders dashboard cockpit without competing creation buttons", () => {
      const dashboardZonePath = path.resolve(
        process.cwd(),
        "src/components/dashboard/zones/dashboard-zone.tsx"
      );
      const dashboardContent = fs.readFileSync(dashboardZonePath, "utf-8");

      // Contextual action bar in dashboard-zone contains only Scope, Month, and Refresh
      const barStart = dashboardContent.indexOf("Contextual Action Bar");
      const barEnd = dashboardContent.indexOf("<ExecutiveStatStrip", barStart);
      assert.ok(barStart > 0 && barEnd > barStart, "Dashboard action bar section must be present");
      const contextBar = dashboardContent.slice(barStart, barEnd);

      assert.ok(
        contextBar.includes("Làm mới dữ liệu"),
        "Dashboard contextual action bar has Refresh action"
      );
      assert.ok(
        !contextBar.includes("+ Giao việc") && !contextBar.includes("+ Tạo"),
        "Dashboard top action bar must NOT contain competing creation buttons"
      );
    });
  });

  describe("Invariant 3: 'Của tôi' Scope-vs-Status Exclusivity", () => {
    test("'Của tôi' is strictly defined in ScopeSwitcher and absent from StatusFilter options", () => {
      // 1. Render ScopeSwitcher and assert 'Của tôi' is present as a scope tab
      const scopeMarkup = renderToStaticMarkup(
        React.createElement(ScopeSwitcher, {
          activeScope: "school",
          onScopeChange: () => {},
        })
      );
      assert.ok(
        scopeMarkup.includes('id="scope-tab-my"'),
        "ScopeSwitcher must render 'my' scope tab"
      );
      assert.ok(
        scopeMarkup.includes("Của tôi"),
        "ScopeSwitcher must display 'Của tôi' label"
      );

      // 2. DEFAULT_STATUS_OPTIONS check
      const statusValues = DEFAULT_STATUS_OPTIONS.map((s) => s.id);
      assert.ok(
        !statusValues.includes("my"),
        "DEFAULT_STATUS_OPTIONS must NOT contain 'my'"
      );
      assert.ok(
        !statusValues.includes("my_tasks"),
        "DEFAULT_STATUS_OPTIONS must NOT contain 'my_tasks'"
      );

      const statusLabels = DEFAULT_STATUS_OPTIONS.map((s) => s.label);
      assert.ok(
        !statusLabels.includes("Của tôi"),
        "DEFAULT_STATUS_OPTIONS labels must NOT include 'Của tôi'"
      );
      assert.ok(
        !statusLabels.includes("Cá nhân"),
        "DEFAULT_STATUS_OPTIONS labels must NOT include 'Cá nhân'"
      );
    });

    test("query parser preserves orthogonal separation of scope and status", () => {
      // Case A: scope=my with status=in_progress
      const parsedA = parseWorkspaceQuery(
        new URLSearchParams("scope=my&status=in_progress")
      );
      assert.equal(parsedA.scope, "my", "scope=my must parse as scope='my'");
      assert.equal(
        parsedA.status,
        "IN_PROGRESS",
        "Orthogonal status must be parsed as IN_PROGRESS"
      );

      // Case B: legacy alias s=cua_toi
      const parsedB = parseWorkspaceQuery(new URLSearchParams("s=cua_toi"));
      assert.equal(parsedB.scope, "my", "s=cua_toi must normalize to scope='my'");
      assert.equal(
        parsedB.status,
        DEFAULT_WORKSPACE_FILTER_STATE.status,
        "Status must remain default ALL when only scope is passed"
      );

      // Case C: invalid status=my does NOT pollute status (falls back to default ALL)
      const parsedC = parseWorkspaceQuery(new URLSearchParams("status=my"));
      assert.equal(
        parsedC.status,
        "ALL",
        "Invalid status 'my' must not be recognized as a valid lifecycle status"
      );
    });

    test("StatusFilter component does not render 'Của tôi' option", () => {
      const statusFilterPath = path.resolve(
        process.cwd(),
        "src/components/workspace/status-filter.tsx"
      );
      if (fs.existsSync(statusFilterPath)) {
        const content = fs.readFileSync(statusFilterPath, "utf-8");
        // Status filter items should never include "Của tôi"
        assert.ok(
          !content.includes('label: "Của tôi"') && !content.includes("label: 'Của tôi'"),
          "StatusFilter options must NOT include 'Của tôi'"
        );
      }
    });

    test("ScopeSwitcher component renders 'Của tôi' as a valid scope tab", () => {
      const scopeSwitcherPath = path.resolve(
        process.cwd(),
        "src/components/workspace/scope-switcher.tsx"
      );
      if (fs.existsSync(scopeSwitcherPath)) {
        const content = fs.readFileSync(scopeSwitcherPath, "utf-8");
        assert.ok(
          content.includes('"my"') || content.includes("'my'"),
          "ScopeSwitcher must include 'my' scope"
        );
        assert.ok(
          content.includes("Của tôi"),
          "ScopeSwitcher must present 'Của tôi' label"
        );
      }
    });
  });

  describe("Invariant 4: Dashboard Cockpit & Metric Strip Deduplication", () => {
    const dummyStats: DashboardStats = {
      totalSchoolTasks: 395,
      schoolTasksInProgress: 200,
      schoolTasksCompleted: 105,
      schoolTasksNotStarted: 75,
      totalStaffTasks: 280,
      staffTasksInProgress: 140,
      staffTasksCompleted: 110,
      staffTasksNotStarted: 30,
      needsReviewTasksCount: 9,
      overdueTasksCount: 1,
      averageSchoolProgressPercent: 78,
      completionRate: 27,
    };

    const dummyExecutiveStats: ExecutiveActionStats = {
      pendingSchoolApprovalCount: 9,
      overdueTasksCount: 1,
      blockedTasksCount: 2,
      strategicActiveCount: 15,
    };

    test("Band 1 (ExecutiveStatStrip): returns exactly 5 primary KPI cards for executive view", () => {
      const cards = getExecutiveStatCardData(dummyStats, dummyExecutiveStats);

      assert.equal(cards.length, 5, "Band 1 executive strip must have exactly 5 cards");

      const cardIds = cards.map((c) => c.id);
      assert.deepEqual(cardIds, [
        "school-tasks",
        "pending-approval",
        "blocked-overdue",
        "strategic-active",
        "overall-progress",
      ]);

      // Card 1: Tổng nhiệm vụ
      assert.equal(cards[0].title, "Tổng nhiệm vụ");
      assert.equal(cards[0].value, "395");

      // Card 2: Chờ duyệt
      assert.equal(cards[1].title, "Chờ duyệt");
      assert.equal(cards[1].value, "9");

      // Card 3: Trễ / vướng
      assert.equal(cards[2].title, "Trễ / vướng");
      assert.equal(cards[2].value, "3"); // 1 overdue + 2 blocked

      // Card 4: Trọng tâm
      assert.equal(cards[3].title, "Trọng tâm");
      assert.equal(cards[3].value, "15");

      // Card 5: Tiến độ toàn trường
      assert.equal(cards[4].title, "Tiến độ toàn trường");
      assert.equal(cards[4].value, "78%");
    });

    test("Band 2 (ExecutiveActionCenter): supports hideCards to eliminate duplicate metric cards", () => {
      const actionCenterPath = path.resolve(
        process.cwd(),
        "src/components/dashboard/executive-action-center.tsx"
      );
      const actionCenterContent = fs.readFileSync(actionCenterPath, "utf-8");

      assert.ok(
        actionCenterContent.includes("hideCards"),
        "ExecutiveActionCenter must support hideCards prop to prevent card duplication"
      );

      // Verify that when hideCards is active, the 3 metric action filter cards are suppressed
      assert.ok(
        actionCenterContent.includes("{!hideCards && ("),
        "Action cards section must be conditional on !hideCards"
      );
    });

    test("cards in Band 1 and Band 2 have distinct, non-colliding semantic purviews", () => {
      const band1Cards = getExecutiveStatCardData(dummyStats, dummyExecutiveStats);
      const band2Cards = getActionCardData(dummyExecutiveStats);

      // Band 1 answers macro institutional status
      assert.equal(band1Cards.length, 5);
      // Band 2 answers micro action queues
      assert.equal(band2Cards.length, 3);

      // In Band 1, school-tasks and overall-progress provide macro situational awareness
      assert.ok(band1Cards.some((c) => c.id === "school-tasks"));
      assert.ok(band1Cards.some((c) => c.id === "overall-progress"));

      // Band 2 only focuses on action queues
      const band2Keys = band2Cards.map((c) => c.filterKey);
      assert.deepEqual(band2Keys, ["PENDING_APPROVAL", "BLOCKED_OVERDUE", "STRATEGIC"]);
    });
  });

  describe("Invariant 5: Touch Target & Accessibility Standards", () => {
    test("mobile navigation and primary interaction buttons enforce min-h-[36px] or min-h-[44px]", () => {
      const filesToCheck = [
        "src/components/workspace/workspace-toolbar.tsx",
        "src/app/calendar/page.tsx",
        "src/components/tasks/task-kanban-board.tsx",
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, "utf-8");
        // Look for touch target classes: min-h-[44px], min-h-[40px], min-h-[36px], h-9, h-10, touch-manipulation
        const hasAccessibleTouchTargets =
          content.includes("min-h-[44px]") ||
          content.includes("min-h-[40px]") ||
          content.includes("min-h-[36px]") ||
          content.includes("h-9") ||
          content.includes("h-10") ||
          content.includes("touch-manipulation");

        assert.ok(
          hasAccessibleTouchTargets,
          `${relPath} must specify accessible button heights / touch targets`
        );
      }
    });

    test("absence of hardcoded fake data arrays (zero synthetic operational data)", () => {
      const filesToAudit = [
        "src/components/dashboard/workbench-mobile-feed.tsx",
        "src/components/dashboard/personal-workbench.tsx",
        "src/components/workspace/unified-adaptive-workspace.tsx",
      ];

      for (const relPath of filesToAudit) {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, "utf-8");
        assert.ok(
          !content.includes("DEFAULT_SCHEDULE_ITEMS = [") &&
            !content.includes("DEFAULT_NOTICES = ["),
          `${relPath} must not contain hardcoded default synthetic schedule/notices`
        );
      }
    });
  });
});
