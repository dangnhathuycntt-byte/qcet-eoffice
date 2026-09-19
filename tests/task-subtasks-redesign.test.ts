import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Subtasks UX Redesign Suite — Compact Sidebar, Subtask Drawer & Simplified Navigation", () => {
  const sidebarPath = path.join(
    process.cwd(),
    "src/components/tasks/detail/linear-properties-sidebar.tsx"
  );
  const drawerPath = path.join(
    process.cwd(),
    "src/components/tasks/detail/subtask-detail-drawer.tsx"
  );
  const detailPagePath = path.join(
    process.cwd(),
    "src/components/tasks/task-detail-page.tsx"
  );
  const sharedEditorPath = path.join(
    process.cwd(),
    "src/components/tasks/detail/task-notion-block-content.tsx"
  );
  const headerPath = path.join(
    process.cwd(),
    "src/components/tasks/detail/task-detail-header-nav.tsx"
  );

  const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
  const drawerContent = fs.readFileSync(drawerPath, "utf-8");
  const detailPageContent = fs.readFileSync(detailPagePath, "utf-8");
  const sharedEditorContent = fs.readFileSync(sharedEditorPath, "utf-8");
  const headerContent = fs.readFileSync(headerPath, "utf-8");

  describe("1. Parent Task Detail — Only Overview & Activity Tabs, No IDs", () => {
    it("parent detail has Overview and Activity tabs", () => {
      assert.ok(
        detailPageContent.includes('activeTab === "overview"'),
        "TaskDetailPage must have overview tab"
      );
      assert.ok(
        detailPageContent.includes('activeTab === "activity"'),
        "TaskDetailPage must have activity tab"
      );
    });

    it("TaskDetailHeaderNav uses taskId prop, no taskCode/taskTitle/onBack/breadcrumbs", () => {
      assert.ok(
        headerContent.includes("taskId: string"),
        "Header must accept taskId as required prop"
      );
      assert.ok(
        !headerContent.includes("taskCode"),
        "Header must not have taskCode prop"
      );
      assert.ok(
        !headerContent.includes("onBack"),
        "Header must not have onBack prop"
      );
      assert.ok(
        !headerContent.includes("showBreadcrumbs"),
        "Header must not have showBreadcrumbs prop"
      );
      assert.ok(
        headerContent.includes("getTaskDetailUrl"),
        "Header must use getTaskDetailUrl for canonical copy link"
      );
    });

    it("Header copy link awaits clipboard and cleans timer on unmount", () => {
      assert.ok(
        headerContent.includes("await navigator.clipboard.writeText"),
        "Copy link must await clipboard write"
      );
      assert.ok(
        headerContent.includes("copyTimerRef"),
        "Copy link must use a ref-tracked timer"
      );
      assert.ok(
        headerContent.includes("clearTimeout(copyTimerRef.current)"),
        "Copy link must clean timer on repeat / unmount"
      );
    });

    it("Header toggle hidden when child drawer open, restored otherwise", () => {
      assert.ok(
        headerContent.includes("onToggleInspector") &&
          headerContent.includes("isDrawerOpen"),
        "Header must expose panel toggle, hidden when drawer is open"
      );
      assert.ok(
        headerContent.includes("!isDrawerOpen"),
        "Panel toggle must be conditionally hidden when drawer is open"
      );
    });
  });

  describe("2. Sidebar Compact Subtasks List", () => {
    it("renders all subtask entries (not sliced to 3) with scrollable container", () => {
      assert.ok(
        sidebarContent.includes("subTasks.map("),
        "Sidebar must render all subtask entries, not slice"
      );
      assert.ok(
        !sidebarContent.includes("subTasks.slice(0, 3)"),
        "Sidebar must not silently truncate list to 3"
      );
      assert.ok(
        sidebarContent.includes("max-h-") && sidebarContent.includes("overflow-y-auto"),
        "Subtask list container must be scrollable"
      );
    });

    it("renders compact items with line-clamp-2, assignee, and due date", () => {
      assert.ok(
        sidebarContent.includes("line-clamp-2"),
        "Sidebar subtask titles must be limited to max 2 lines"
      );
      assert.ok(
        sidebarContent.includes("formatAssigneeNameWithTitle(st.assigneeName)"),
        "Sidebar must format assignee names with academic titles"
      );
      assert.ok(
        sidebarContent.includes("formatDisplayDate(st.dueDate)"),
        "Sidebar subtask items must display due date"
      );
    });

    it("empty state shows compact row, add button only renders with real onAddSubTask callback", () => {
      assert.ok(
        sidebarContent.includes("Việc thành phần") &&
          sidebarContent.includes('className="font-mono text-muted-foreground text-xs font-medium">0</span>'),
        "Sidebar must render canonical compact empty row"
      );
      assert.ok(
        sidebarContent.includes('aria-label="Thêm việc thành phần"'),
        "Add button must exist with proper aria-label"
      );
      assert.ok(
        sidebarContent.includes("canEdit && onAddSubTask &&"),
        "Add button must only render when both canEdit and onAddSubTask are truthy"
      );
    });
  });

  describe("3. Subtask Drawer — Child-First, No Parent Navigation", () => {
    it("drawer uses parentTaskId for canonical copy link, not window.location", () => {
      assert.ok(
        drawerContent.includes("parentTaskId: string"),
        "Drawer must accept parentTaskId as required prop"
      );
      assert.ok(
        drawerContent.includes("getTaskDetailUrl(parentTaskId, subtask.id)"),
        "Drawer must use getTaskDetailUrl with parentTaskId for canonical deep link"
      );
      assert.ok(
        !drawerContent.includes("window.location.pathname"),
        "Drawer must not derive copy link from window.location.pathname"
      );
    });

    it("drawer does not have parentTaskTitle, parentTaskCode, or onOpenAnotherSubtask props", () => {
      assert.ok(
        !drawerContent.includes("parentTaskTitle"),
        "Drawer must not have parentTaskTitle prop"
      );
      assert.ok(
        !drawerContent.includes("parentTaskCode"),
        "Drawer must not have parentTaskCode prop"
      );
      assert.ok(
        !drawerContent.includes("onOpenAnotherSubtask"),
        "Drawer must not have onOpenAnotherSubtask prop"
      );
    });

    it("drawer always shows close button plus subtle copy link with hover/focus/touch visibility", () => {
      assert.ok(
        drawerContent.includes('title="Đóng (Esc)"'),
        "Close button must always be visible"
      );
      assert.ok(
        drawerContent.includes("group-hover/peek-header:text-muted-foreground") &&
          drawerContent.includes("focus-visible:text-foreground"),
        "Copy link must be visible on hover/focus"
      );
      assert.ok(
        drawerContent.includes("active:!text-foreground"),
        "Copy link must be visible on touch (active state)"
      );
    });

    it("drawer copy link awaits clipboard, reports error, and cleans timer", () => {
      assert.ok(
        drawerContent.includes("await navigator.clipboard.writeText"),
        "Copy must await clipboard"
      );
      assert.ok(
        drawerContent.includes("notifyError") && drawerContent.includes("Lỗi clipboard"),
        "Copy must report clipboard errors"
      );
      assert.ok(
        drawerContent.includes("copyTimerRef") &&
          drawerContent.includes("clearTimeout(copyTimerRef.current)"),
        "Copy must clean timer ref"
      );
    });

    it("drawer child title is first, uses DirectInlineEditor and real API mutations", () => {
      assert.ok(
        drawerContent.includes("<DirectInlineEditor"),
        "Drawer must use DirectInlineEditor for title editing"
      );
      assert.ok(
        drawerContent.includes("fetch(`/api/tasks/${subtask.id}`"),
        "Drawer must execute real API PATCH mutations"
      );
      assert.ok(
        drawerContent.includes("<TaskNotionBlockContent"),
        "Drawer must include shared document editor"
      );
    });

    it("shared editor presentation stays flat in both main task and subtask surfaces", () => {
      const rootIndex = sharedEditorContent.indexOf('data-slot="task-notion-block-content"');
      assert.ok(rootIndex > 0, "Shared Plate editor root must exist");
      const rootBlock = sharedEditorContent.slice(rootIndex, rootIndex + 500);
      assert.ok(
        !rootBlock.includes("rounded-xl") &&
          !rootBlock.includes("border border-border") &&
          !rootBlock.includes("bg-card"),
        "Main task and subtask must share the same flat, canvas-integrated editor shell"
      );
    });
  });

  describe("4. Activity Tab — Timeline Promoted, No Progress Banner", () => {
    it("completely eliminates 'Báo cáo tiến độ mới nhất' banner from Activity tab", () => {
      assert.ok(
        !detailPageContent.includes("Báo cáo tiến độ mới nhất"),
        "TaskDetailPage must not contain 'Báo cáo tiến độ mới nhất' banner"
      );
    });

    it("promotes audit timeline to the top of Activity tab", () => {
      const activityIndex = detailPageContent.indexOf('activeTab === "activity"');
      assert.ok(activityIndex > 0, "Activity tab block must exist");

      const activityBlock = detailPageContent.slice(activityIndex);
      const timelineIndex = activityBlock.indexOf("Nhật ký xử lý & Lịch sử hoạt động");
      assert.ok(timelineIndex > 0, "Audit timeline must be present in Activity tab");

      const beforeTimeline = activityBlock.slice(0, timelineIndex);
      assert.ok(
        !beforeTimeline.includes("Cập nhật tiến độ"),
        "No progress banner or update button before audit timeline in Activity tab"
      );
    });
  });
});

// QCET subtasks tests verified
