import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Task Detail Unified Workspace — Layout, Tabs, Drawer & Sidebar", () => {
  const sidebarPath = path.join(process.cwd(), "src/components/tasks/detail/linear-properties-sidebar.tsx");
  const drawerPath = path.join(process.cwd(), "src/components/tasks/detail/subtask-detail-drawer.tsx");
  const detailPagePath = path.join(process.cwd(), "src/components/tasks/task-detail-page.tsx");
  const sharedEditorPath = path.join(process.cwd(), "src/components/tasks/detail/task-notion-block-content.tsx");
  const headerPath = path.join(process.cwd(), "src/components/tasks/detail/task-detail-header-nav.tsx");
  const cssPath = path.join(process.cwd(), "src/components/tasks/task-detail-page.module.css");

  const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
  const drawerContent = fs.readFileSync(drawerPath, "utf-8");
  const detailPageContent = fs.readFileSync(detailPagePath, "utf-8");
  const sharedEditorContent = fs.readFileSync(sharedEditorPath, "utf-8");
  const headerContent = fs.readFileSync(headerPath, "utf-8");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  describe("1. Unified Workspace Layout", () => {
    it("splitWorkspace uses flexbox row, not CSS grid", () => {
      // Check the .splitWorkspace rule specifically
      const splitIdx = cssContent.indexOf(".splitWorkspace {");
      assert.ok(splitIdx >= 0, ".splitWorkspace must exist");
      const splitBlock = cssContent.slice(splitIdx, cssContent.indexOf("}", splitIdx) + 1);
      assert.ok(
        splitBlock.includes("display: flex") && splitBlock.includes("flex-direction: row"),
        "splitWorkspace must use flexbox row layout"
      );
      assert.ok(
        !splitBlock.includes("grid-template-columns"),
        "splitWorkspace must not use CSS grid"
      );
      assert.ok(
        !cssContent.includes("data-peek-open"),
        "No data-peek-open grid switching rule"
      );
    });

    it("single card shell — border/radius on splitWorkspace, not on workspace/peekSurface", () => {
      // splitWorkspace has card styling
      const splitIdx = cssContent.indexOf(".splitWorkspace");
      const splitBlock = cssContent.slice(splitIdx, cssContent.indexOf("}", splitIdx) + 1);
      assert.ok(
        splitBlock.includes("border-radius") && splitBlock.includes("border:"),
        "splitWorkspace must have card border and radius"
      );
    });

    it("peekSurface is inset card on desktop, fixed overlay on mobile", () => {
      assert.ok(cssContent.includes("width: 440px"), "Peek pane must be 440px on desktop");
      assert.ok(cssContent.includes("flex-shrink: 0"), "Peek pane must not shrink");
      assert.ok(
        cssContent.includes("border-radius: 14px"),
        "Peek pane must have rounded corners"
      );
      assert.ok(
        cssContent.includes("margin: 8px"),
        "Peek pane must have inset margin"
      );
      assert.ok(
        !cssContent.includes("border-left: 1px solid var(--border)"),
        "Peek pane must not use hard left border divider"
      );
      assert.ok(
        cssContent.includes("position: fixed"),
        "Peek pane must be fixed overlay on mobile"
      );
    });

    it("content pane has no max-width cap", () => {
      // Find the .content rule
      const contentIdx = cssContent.indexOf(".content {");
      if (contentIdx >= 0) {
        const contentBlock = cssContent.slice(contentIdx, cssContent.indexOf("}", contentIdx) + 1);
        assert.ok(
          !contentBlock.includes("max-width: 750px"),
          "Content must not have 750px max-width"
        );
      }
      assert.ok(!cssContent.includes(".expanded"), "No .expanded class should exist");
      assert.ok(!cssContent.includes(".shell {"), "No .shell class should exist");
    });

    it("no react-resizable-panels in TaskDetailPage", () => {
      assert.ok(
        !detailPageContent.includes("react-resizable-panels"),
        "TaskDetailPage must not import react-resizable-panels"
      );
      assert.ok(
        !detailPageContent.includes("TaskSubtaskSplit"),
        "TaskSubtaskSplit component must be removed"
      );
    });
  });

  describe("2. Tabs — Only Tổng quan + Hoạt động", () => {
    it("has overview and activity tabs", () => {
      assert.ok(detailPageContent.includes('activeTab === "overview"'));
      assert.ok(detailPageContent.includes('activeTab === "activity"'));
    });

    it("does NOT have subtasks tab", () => {
      assert.ok(
        !detailPageContent.includes('tab-subtasks'),
        "No subtasks tab button"
      );
      assert.ok(
        !detailPageContent.includes('activeTab === "subtasks"'),
        "No subtasks tab panel"
      );
      assert.ok(
        !detailPageContent.includes("TaskSubtasksSection"),
        "TaskSubtasksSection must not be imported or rendered"
      );
    });
  });

  describe("3. Sidebar — Compact Subtask Section", () => {
    it("sidebar has compact subtask section via TaskSubtasksSidebarSection", () => {
      assert.ok(
        sidebarContent.includes("TaskSubtasksSidebarSection"),
        "Sidebar must import and render TaskSubtasksSidebarSection"
      );
      assert.ok(
        sidebarContent.includes("subTasks"),
        "Sidebar must accept subTasks prop"
      );
      assert.ok(
        sidebarContent.includes("activeSubtaskId"),
        "Sidebar must accept activeSubtaskId prop"
      );
      assert.ok(
        sidebarContent.includes("onSelectSubtask"),
        "Sidebar must accept onSelectSubtask prop"
      );
    });

    it("sidebar does NOT use old large TaskSubtasksSection", () => {
      assert.ok(
        !sidebarContent.includes("TaskSubtasksSection"),
        "Sidebar must not use the old large TaskSubtasksSection"
      );
    });

    it("sidebar onNavigateTab only accepts overview or activity", () => {
      assert.ok(
        sidebarContent.includes('"overview" | "activity"'),
        "onNavigateTab type must be overview | activity only"
      );
      assert.ok(
        !sidebarContent.includes('"subtasks"'),
        "Sidebar must not reference subtasks tab"
      );
    });
  });

  describe("4. Subtask Drawer — Child-First, Minimal Chrome", () => {
    it("drawer uses parentTaskId for canonical copy link", () => {
      assert.ok(drawerContent.includes("parentTaskId: string"));
      assert.ok(drawerContent.includes("getTaskDetailUrl"));
    });

    it("drawer has no parent navigation chrome", () => {
      assert.ok(!drawerContent.includes("parentTaskTitle"));
      assert.ok(!drawerContent.includes("parentTaskCode"));
      assert.ok(!drawerContent.includes("onOpenAnotherSubtask"));
    });

    it("drawer shows close + hover copy link", () => {
      assert.ok(drawerContent.includes('title="Đóng (Esc)"'));
      assert.ok(
        drawerContent.includes("group-hover/peek-header") || drawerContent.includes("group/peek-header"),
        "Copy link must use group hover pattern"
      );
    });

    it("drawer uses DirectInlineEditor and real API mutations", () => {
      assert.ok(drawerContent.includes("<DirectInlineEditor"));
      assert.ok(drawerContent.includes("fetch(`/api/tasks/${subtask.id}`"));
      assert.ok(drawerContent.includes("<TaskNotionBlockContent"));
    });
  });

  describe("5. Header — Simplified", () => {
    it("header uses taskId, no taskCode or breadcrumbs", () => {
      assert.ok(headerContent.includes("taskId: string"));
      assert.ok(!headerContent.includes("taskCode"));
      assert.ok(!headerContent.includes("onBack"));
    });

    it("header has inspector toggle hidden when drawer open", () => {
      assert.ok(headerContent.includes("onToggleInspector"));
      assert.ok(headerContent.includes("!isDrawerOpen"));
    });
  });

  describe("6. Activity Tab Content", () => {
    it("activity tab has audit timeline", () => {
      const activityIndex = detailPageContent.indexOf('activeTab === "activity"');
      assert.ok(activityIndex > 0, "Activity tab block must exist");
      const activityBlock = detailPageContent.slice(activityIndex, activityIndex + 2000);
      assert.ok(
        activityBlock.includes("feedActivityEvents"),
        "Activity tab must render feed events"
      );
    });

    it("no progress banner before timeline", () => {
      assert.ok(
        !detailPageContent.includes("Báo cáo tiến độ mới nhất"),
        "No progress banner in activity tab"
      );
    });
  });
});
