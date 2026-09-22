import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Task Detail Dual-Card Workspace — Layout, Tabs, Drawer & Sidebar", () => {
  const sidebarPath = path.join(process.cwd(), "src/components/tasks/detail/task-properties-sidebar.tsx");
  const drawerPath = path.join(process.cwd(), "src/components/tasks/detail/subtask-detail-drawer.tsx");
  const detailPagePath = path.join(process.cwd(), "src/components/tasks/task-detail-page.tsx");
  const sharedEditorPath = path.join(process.cwd(), "src/components/tasks/detail/task-block-editor.tsx");
  const headerPath = path.join(process.cwd(), "src/components/tasks/detail/task-detail-header-nav.tsx");
  const cssPath = path.join(process.cwd(), "src/components/tasks/task-detail-page.module.css");

  const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
  const drawerContent = fs.readFileSync(drawerPath, "utf-8");
  const detailPageContent = fs.readFileSync(detailPagePath, "utf-8");
  const sharedEditorContent = fs.readFileSync(sharedEditorPath, "utf-8");
  const headerContent = fs.readFileSync(headerPath, "utf-8");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  describe("1. Dual Independent Cards Layout", () => {
    it("splitWorkspace uses CSS grid, not flexbox row", () => {
      // Check the .splitWorkspace rule specifically
      const splitIdx = cssContent.indexOf(".splitWorkspace {");
      assert.ok(splitIdx >= 0, ".splitWorkspace must exist");
      const splitBlock = cssContent.slice(splitIdx, cssContent.indexOf("}", splitIdx) + 1);
      assert.ok(
        splitBlock.includes("display: grid"),
        "splitWorkspace must use CSS grid layout"
      );
      assert.ok(
        splitBlock.includes("grid-template-columns"),
        "splitWorkspace must define grid columns"
      );
      assert.ok(
        splitBlock.includes("gap:"),
        "splitWorkspace must use gap (not margin hack) for card spacing"
      );
    });

    it("splitWorkspace is layout-only — no border, no radius, no background", () => {
      const splitIdx = cssContent.indexOf(".splitWorkspace {");
      const splitBlock = cssContent.slice(splitIdx, cssContent.indexOf("}", splitIdx) + 1);
      assert.ok(
        !splitBlock.includes("border:") && !splitBlock.includes("border-radius") && !splitBlock.includes("background:"),
        "splitWorkspace must NOT have card styling (border/radius/background)"
      );
    });

    it("workspace and peekSurface are independent cards with border/radius/background", () => {
      // workspace card
      const workspaceIdx = cssContent.indexOf(".workspace {");
      assert.ok(workspaceIdx >= 0, ".workspace must exist");
      const workspaceBlock = cssContent.slice(workspaceIdx, cssContent.indexOf("}", workspaceIdx) + 1);
      assert.ok(
        workspaceBlock.includes("border:") && workspaceBlock.includes("border-radius") && workspaceBlock.includes("background:"),
        "workspace must have independent card styling"
      );
      // peekSurface card (mobile base rule)
      const peekIdx = cssContent.indexOf(".peekSurface {");
      assert.ok(peekIdx >= 0, ".peekSurface must exist");
      const peekBlock = cssContent.slice(peekIdx, cssContent.indexOf("}", peekIdx) + 1);
      assert.ok(
        peekBlock.includes("border:") && peekBlock.includes("border-radius") && peekBlock.includes("background:"),
        "peekSurface must have independent card styling"
      );
    });

    it("peekSurface is fixed overlay on mobile, grid column on desktop", () => {
      // Mobile: fixed overlay
      const peekIdx = cssContent.indexOf(".peekSurface {");
      const peekBlock = cssContent.slice(peekIdx, cssContent.indexOf("}", peekIdx) + 1);
      assert.ok(
        peekBlock.includes("position: fixed"),
        "Peek pane must be fixed overlay on mobile"
      );
      // Desktop: data-peek-open triggers second grid column
      assert.ok(
        cssContent.includes("data-peek-open"),
        "Must use data-peek-open to toggle grid columns on desktop"
      );
      assert.ok(
        cssContent.includes("min(75vw, var(--qcet-subtask-peek-width, 480px))"),
        "Cột việc con dùng độ rộng đã lưu và giới hạn theo viewport"
      );
      // No border-left divider
      assert.ok(
        !cssContent.includes("border-left: 1px solid var(--border)"),
        "Peek pane must not use hard left border divider"
      );
      // No margin hack
      assert.ok(
        !cssContent.includes("margin: 8px 8px 8px 0"),
        "Peek pane must not use margin hack for gap"
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
    it("header việc con không còn nút sao chép liên kết", () => {
      assert.ok(!drawerContent.includes("handleCopyLink"));
      assert.ok(!drawerContent.includes("getTaskDetailUrl"));
    });

    it("drawer has no parent navigation chrome", () => {
      assert.ok(!drawerContent.includes("parentTaskTitle"));
      assert.ok(!drawerContent.includes("parentTaskCode"));
      assert.ok(!drawerContent.includes("onOpenAnotherSubtask"));
    });

    it("header giữ nút đóng, resize handle không vẽ đường dọc", () => {
      assert.ok(drawerContent.includes('title="Đóng (Esc)"'));
      assert.ok(drawerContent.includes('onDoubleClick={handleResetWidth}'));
      assert.ok(!drawerContent.includes("group-hover/resize:bg-primary"));
      assert.ok(!drawerContent.includes('"h-full w-0.5'));
      assert.ok(drawerContent.includes('window.removeEventListener("blur", handleMouseUp)'));
    });

    it("resize gom theo frame và chỉ lưu sau khi kết thúc kéo", () => {
      assert.ok(drawerContent.includes("window.requestAnimationFrame"));
      assert.ok(drawerContent.includes("window.cancelAnimationFrame(pendingFrame)"));
      assert.ok(drawerContent.includes("onPeekWidthChange(latestWidth, false)"));
      assert.ok(drawerContent.includes("onPeekWidthChange(latestWidth);"));
      assert.ok(detailPageContent.includes("if (!persist) return;"));
    });

    it("không giữ prop nhiệm vụ cha hoặc placeholder trùng mặc định", () => {
      assert.ok(!drawerContent.includes("parentTaskId"));
      assert.ok(!drawerContent.includes('placeholder="Nhập nội dung hoặc gõ / để chèn..."'));
    });

    it("drawer uses DirectInlineEditor and real API mutations", () => {
      assert.ok(drawerContent.includes("<DirectInlineEditor"));
      assert.ok(drawerContent.includes("fetch(`/api/tasks/${subtask.id}`"));
      assert.ok(drawerContent.includes("<TaskBlockEditor"));
    });

    it("drawer accepts siblings, onSelectSibling, onAddSubtask props", () => {
      assert.ok(drawerContent.includes("siblings"), "Must accept siblings prop");
      assert.ok(drawerContent.includes("onSelectSibling"), "Must accept onSelectSibling prop");
      assert.ok(drawerContent.includes("onAddSubtask"), "Must accept onAddSubtask prop");
    });

    it("drawer renders master-detail sibling list with x/y label, status dots, titles, assignees and dates", () => {
      assert.ok(
        drawerContent.includes("siblingPosition") && drawerContent.includes("siblingTotal"),
        "Must compute sibling position and total"
      );
      assert.ok(drawerContent.includes("Việc con"), "Header must show 'Việc con' label");
      assert.ok(drawerContent.includes("statusObj.dotClass"), "Each sibling row must show status dot");
      assert.ok(drawerContent.includes("sib.title"), "Each sibling row must show title");
      assert.ok(drawerContent.includes("formattedDueDate"), "Each sibling row must show due date");
      assert.ok(drawerContent.includes("assigneeName"), "Each sibling row must show assignee name");
      // No technical IDs
      assert.ok(
        !drawerContent.includes(">{sib.id}<") && !drawerContent.includes("{sib.taskId}"),
        "Sibling rows must not display raw IDs"
      );
    });

    it("drawer master-detail list has '+ Thêm việc con' action", () => {
      assert.ok(drawerContent.includes('aria-label="Thêm việc con"'), "Must have add child action");
    });

    it("drawer does NOT have Back/Previous/Next buttons", () => {
      assert.ok(!drawerContent.includes("Previous"), "No Previous button");
      assert.ok(!drawerContent.includes("handleNavigateBack"), "No back navigation handler");
      assert.ok(
        !drawerContent.includes('aria-label="Quay lại"') && !drawerContent.includes(">Quay lại<"),
        "No back button"
      );
    });
  });

  describe("4b. Keyboard Navigation", () => {
    it("ArrowUp/ArrowDown calls onSelectSibling with wrapping", () => {
      assert.ok(
        drawerContent.includes('e.key === "ArrowDown"') && drawerContent.includes('e.key === "ArrowUp"'),
        "Must handle ArrowDown and ArrowUp"
      );
      assert.ok(
        drawerContent.includes("siblings.length") && drawerContent.includes("% siblings.length"),
        "Must wrap around using modulo"
      );
    });

    it("keyboard nav is blocked inside editable contexts", () => {
      assert.ok(drawerContent.includes("isContentEditable"), "Must check contentEditable");
      assert.ok(
        drawerContent.includes("data-slate-editor"),
        "Must check Slate editor to avoid intercepting editor keys"
      );
      assert.ok(
        drawerContent.includes("role='combobox'") || drawerContent.includes('role=\'combobox\''),
        "Must check combobox role"
      );
    });

    it("Esc closes the drawer", () => {
      assert.ok(
        drawerContent.includes('"Escape"') && drawerContent.includes("onClose"),
        "Esc must trigger onClose"
      );
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

  describe("5b. TaskDetailPage passes sibling props to drawer", () => {
    it("passes siblings={subTasks} to SubtaskDetailDrawer", () => {
      assert.ok(
        detailPageContent.includes("siblings={subTasks}"),
        "TaskDetailPage must pass subTasks as siblings to the drawer"
      );
    });

    it("passes onSelectSibling={handleOpenSubtaskDrawer}", () => {
      assert.ok(
        detailPageContent.includes("onSelectSibling={handleOpenSubtaskDrawer}"),
        "TaskDetailPage must pass handleOpenSubtaskDrawer as onSelectSibling"
      );
    });

    it("passes onAddSubtask={handleAddSubtask}", () => {
      assert.ok(
        detailPageContent.includes("onAddSubtask={handleAddSubtask}"),
        "TaskDetailPage must pass handleAddSubtask as onAddSubtask"
      );
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
