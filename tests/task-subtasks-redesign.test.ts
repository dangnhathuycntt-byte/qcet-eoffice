import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Subtasks UX Redesign Suite — Compact Sidebar, 5-Column Table & Subtask Drawer", () => {
  const sidebarPath = path.join(
    process.cwd(),
    "src/components/tasks/detail/linear-properties-sidebar.tsx"
  );
  const tableSectionPath = path.join(
    process.cwd(),
    "src/components/tasks/detail/task-subtasks-section.tsx"
  );
  const drawerPath = path.join(
    process.cwd(),
    "src/components/tasks/detail/subtask-detail-drawer.tsx"
  );
  const detailPagePath = path.join(
    process.cwd(),
    "src/components/tasks/task-detail-page.tsx"
  );

  const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
  const tableContent = fs.readFileSync(tableSectionPath, "utf-8");
  const drawerContent = fs.readFileSync(drawerPath, "utf-8");
  const detailPageContent = fs.readFileSync(detailPagePath, "utf-8");

  describe("1. Overview Tab Cleanup & Sidebar Compact Subtasks List", () => {
    it("Overview tab does NOT render the large TaskSubtasksSection under description", () => {
      // Find the activeTab === "overview" block in TaskDetailPage
      const overviewIndex = detailPageContent.indexOf('activeTab === "overview"');
      assert.ok(overviewIndex > 0, "TaskDetailPage must have activeTab === 'overview' block");

      // Find the end of activeTab === "overview" block (marked by activeTab === "subtasks")
      const subtasksIndex = detailPageContent.indexOf('activeTab === "subtasks"');
      assert.ok(subtasksIndex > overviewIndex, "activeTab === 'subtasks' must follow overview");

      const overviewBlock = detailPageContent.slice(overviewIndex, subtasksIndex);
      assert.ok(
        !overviewBlock.includes("<TaskSubtasksSection"),
        "Overview tab must NOT include the large TaskSubtasksSection"
      );
    });

    it("Sidebar renders compact Notion-style subtasks list with line-clamp-2, title, due date, and status", () => {
      // 1. Must contain header with subtask count, add button, and 'Xem tất cả'
      assert.ok(
        sidebarContent.includes("completedSubTasks") && sidebarContent.includes("subTasks.length"),
        "Sidebar header must show total and completed subtask count"
      );
      assert.ok(
        sidebarContent.includes("Xem tất cả"),
        "Sidebar header must include 'Xem tất cả' button"
      );

      // 2. Subtask items have line-clamp-2
      assert.ok(
        sidebarContent.includes("line-clamp-2"),
        "Sidebar subtask titles must be limited to max 2 lines with line-clamp-2"
      );

      // 3. Subtask items use formatAssigneeNameWithTitle
      assert.ok(
        sidebarContent.includes("formatAssigneeNameWithTitle(st.assigneeName)"),
        "Sidebar must format assignee names with academic titles"
      );

      // 4. Subtask items show due date
      assert.ok(
        sidebarContent.includes("formatDisplayDate(st.dueDate)"),
        "Sidebar subtask items must display due date"
      );

      // 5. Empty state is a compact single line with label, zero count, and add button
      assert.ok(
        sidebarContent.includes("Việc thành phần") &&
          sidebarContent.includes('className="font-mono text-muted-foreground text-xs font-medium">0</span>') &&
          sidebarContent.includes('aria-label="Thêm việc thành phần"'),
        "Sidebar must render the canonical compact empty row"
      );
    });
  });

  describe("2. Linear Compact Sub-Issues List Redesign", () => {
    it("eliminates heavy table/card and horizontal scrollbar in favor of compact div rows", () => {
      // Must NOT contain <table>, <thead>, <tbody>, or overflow-x-auto
      assert.ok(
        !tableContent.includes("<table") && !tableContent.includes("overflow-x-auto"),
        "Subtasks section must not use heavy table container or horizontal scrollbar"
      );

      // Header contains title, progress '0/0', and add subtask button
      assert.ok(
        tableContent.includes("Việc thành phần") &&
          tableContent.includes("{completedCount}/{totalCount}") &&
          tableContent.includes("Thêm việc con"),
        "Header must only contain 'Việc thành phần', progress '0/0', and '+ Thêm việc con' button"
      );

      // Minimal empty state without duplicate add button or card box
      assert.ok(
        tableContent.includes("Chưa có việc thành phần") &&
          tableContent.includes("Tạo việc con để phân rã nhiệm vụ này."),
        "Empty state must display minimal text without heavy box"
      );

      // Row height and structure: status icon | title | assignee | due date | status badge + action '...'
      assert.ok(
        tableContent.includes("h-10 sm:h-11") || tableContent.includes("min-h-[40px]"),
        "Subtask row height must be compact (40-44px)"
      );
      assert.ok(
        tableContent.includes("st.title") &&
          tableContent.includes("assigneeTitle") &&
          tableContent.includes("formatDisplayDate(st.dueDate)") &&
          tableContent.includes("statusObj.label") &&
          tableContent.includes("MoreHorizontal"),
        "Subtask row must contain status icon, title, assignee, due date, status badge, and hover action '...'"
      );

      // Clicking subtask row calls onSelectSubtask
      assert.ok(
        tableContent.includes("onSelectSubtask && onSelectSubtask(st)"),
        "Clicking subtask row must trigger onSelectSubtask to open drawer"
      );
    });

    it("supports inline fast-add with autofocus into task title and strict schema payload", () => {
      // 1. Autofocus via titleInputRef when inline add is active
      assert.ok(
        tableContent.includes("titleInputRef") &&
          tableContent.includes("titleInputRef.current?.focus()"),
        "Inline creation must autofocus title input upon opening"
      );

      // 2. Linear detail view payload compliance (no unrecognized keys for CreateTaskSchema)
      const detailViewPath = path.join(
        process.cwd(),
        "src/components/tasks/detail/linear-task-detail-view.tsx"
      );
      const detailViewContent = fs.readFileSync(detailViewPath, "utf-8");

      assert.ok(
        !detailViewContent.includes('level: "DON_VI"') &&
          !detailViewContent.includes("leadAssigneeName:"),
        "Inline subtask creation in linear-task-detail-view must not send legacy level or leadAssigneeName keys"
      );
      assert.ok(
        detailViewContent.includes("parentTaskId: task.id") &&
          detailViewContent.includes("scope: isSchool ? \"DEPARTMENT\" : \"INDIVIDUAL\""),
        "Inline subtask creation must pass parentTaskId and valid scope"
      );
    });
  });

  describe("3. Right Subtask Peek Drawer & Non-Stacking Navigation", () => {
    it("SubtaskDetailDrawer renders a flat quick-preview surface with compact editing", () => {
      // 1. Back link / parent task reference
      assert.ok(
        drawerContent.includes("parentTaskTitle"),
        "Drawer must link back to parent task title"
      );
      assert.ok(
        drawerContent.includes("parentTaskCode"),
        "Drawer must display parent task code when present"
      );

      // 2. Utility toolbar keeps more actions without the open-page link
      assert.ok(
        !drawerContent.includes("Mở trang") && drawerContent.includes("MoreHorizontal"),
        "Drawer toolbar must omit open-page navigation and retain more actions"
      );
      assert.ok(
        drawerContent.includes("onClose") && drawerContent.includes("Đóng chi tiết việc con"),
        "Drawer header must contain close CTA"
      );

      // 3. Desktop uses sibling surfaces; only compact screens use an overlay.
      const layout = fs.readFileSync(path.join(process.cwd(), "src/components/tasks/task-detail-page.module.css"), "utf-8");
      assert.ok(
        drawerContent.includes("styles.peekSurface") &&
          layout.includes("grid-template-columns: minmax(0, 1fr) clamp(420px, 30vw, 500px)") &&
          layout.includes("gap: calc(var(--spacing) * 2)") &&
          layout.includes("padding: calc(var(--spacing) * 2)") &&
          layout.includes("border-radius: var(--radius-xl)") &&
          layout.includes("position: relative") &&
          drawerContent.includes("lg:hidden") &&
          !drawerContent.includes('aria-modal="true"'),
        "Peek must reflow the main surface with inset, matching corners, and a compact-only backdrop"
      );

      // 4. Non-stacking navigation: uses in-drawer history stack rather than nested drawers
      assert.ok(
        drawerContent.includes("hasHistoryPrev") &&
          drawerContent.includes("onNavigateBackHistory"),
        "Drawer must support in-drawer history navigation without stacking"
      );

      // 5. Uses DirectInlineEditor for title and description
      assert.ok(
        drawerContent.includes("<DirectInlineEditor"),
        "Drawer must share DirectInlineEditor for title and description editing"
      );

      // 6. Flat hierarchy: no persistent metadata or empty description card
      assert.ok(
        !drawerContent.includes('aria-label="Thuộc tính việc thành phần" className="divide-y') &&
          drawerContent.includes("<TaskNotionBlockContent") &&
          drawerContent.includes("isDeadlineEditorOpen"),
        "Peek must render flat metadata, the shared document editor, and a collapsed deadline row"
      );

      // 7. Real API mutations
      assert.ok(
        drawerContent.includes("fetch(`/api/tasks/${subtask.id}`"),
        "Drawer must execute real API PATCH mutations"
      );
    });

    it("TaskDetailPage manages drawer state, URL search param synchronization, and history stack", () => {
      // 1. URL search param synchronization (?subtaskId=...)
      assert.ok(
        detailPageContent.includes("subtaskId"),
        "TaskDetailPage must synchronize subtaskId URL param"
      );
      assert.ok(
        detailPageContent.includes("window.history.pushState"),
        "TaskDetailPage must use pushState to preserve scroll position and filter state"
      );

      // 2. Popstate listener for browser Back/Forward
      assert.ok(
        detailPageContent.includes("popstate"),
        "TaskDetailPage must handle popstate to support browser navigation"
      );

      // 3. Non-stacking history management
      assert.ok(
        detailPageContent.includes("subtaskHistory"),
        "TaskDetailPage must maintain subtaskHistory stack"
      );
      assert.ok(
        detailPageContent.includes("handleNavigateBackSubtaskHistory"),
        "TaskDetailPage must provide history back handler"
      );

      // 4. Rollup & subtask update synchronization
      assert.ok(
        detailPageContent.includes("handleSubtaskUpdated"),
        "TaskDetailPage must synchronize subtask edits back to parent state"
      );

      assert.ok(
        detailPageContent.includes("lastPeekSubtaskIdRef") &&
          detailPageContent.includes("handleNavigateSubtaskSibling"),
        "TaskDetailPage must support Space toggling and arrow sibling navigation for Peek"
      );
    });
  });

  describe("4. Activity Tab Progress Banner Elimination & Timeline Promotion", () => {
    it("completely eliminates 'Báo cáo tiến độ mới nhất' banner from Activity tab", () => {
      assert.ok(
        !detailPageContent.includes("Báo cáo tiến độ mới nhất"),
        "TaskDetailPage must not contain 'Báo cáo tiến độ mới nhất' banner"
      );
    });

    it("promotes 'Nhật ký xử lý & Lịch sử hoạt động' to the top of Activity tab without extra whitespace", () => {
      const activityIndex = detailPageContent.indexOf('activeTab === "activity"');
      assert.ok(activityIndex > 0, "Activity tab block must exist");

      const activityBlock = detailPageContent.slice(activityIndex);
      const timelineIndex = activityBlock.indexOf("Nhật ký xử lý & Lịch sử hoạt động");
      assert.ok(timelineIndex > 0, "Audit timeline must be present in Activity tab");

      // Verify that no other content precedes the timeline in the activity block
      const beforeTimeline = activityBlock.slice(0, timelineIndex);
      assert.ok(
        !beforeTimeline.includes("Cập nhật tiến độ"),
        "No progress banner or update button before audit timeline in Activity tab"
      );
    });
  });
});

// QCET subtasks tests verified
