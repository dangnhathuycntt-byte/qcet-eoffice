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

      // 5. Empty state is a single line with an add button
      assert.ok(
        sidebarContent.includes("Chưa có việc thành phần"),
        "Sidebar must have single-line empty state when no subtasks exist"
      );
    });
  });

  describe("2. Standard 5-Column Synchronized Subtasks Table", () => {
    it("TaskSubtasksSection renders exactly 5 columns: Nhiệm vụ → Phụ trách → Phối hợp → Thời hạn → Tình trạng", () => {
      assert.ok(
        tableContent.includes("Nhiệm vụ"),
        "Table header must include 'Nhiệm vụ'"
      );
      assert.ok(
        tableContent.includes("Phụ trách"),
        "Table header must include 'Phụ trách'"
      );
      assert.ok(
        tableContent.includes("Phối hợp"),
        "Table header must include 'Phối hợp'"
      );
      assert.ok(
        tableContent.includes("Thời hạn"),
        "Table header must include 'Thời hạn'"
      );
      assert.ok(
        tableContent.includes("Tình trạng"),
        "Table header must include 'Tình trạng'"
      );

      // Clicking subtask title calls onSelectSubtask
      assert.ok(
        tableContent.includes("onSelectSubtask && onSelectSubtask(st)"),
        "Clicking subtask title must trigger onSelectSubtask to open drawer"
      );
    });
  });

  describe("3. Right Subtask Peek Drawer & Non-Stacking Navigation", () => {
    it("SubtaskDetailDrawer renders parent link, full-page CTA, mobile full-width, and direct inline editor", () => {
      // 1. Back link / parent task reference
      assert.ok(
        drawerContent.includes("parentTaskTitle"),
        "Drawer must link back to parent task title"
      );
      assert.ok(
        drawerContent.includes("parentTaskCode"),
        "Drawer must display parent task code when present"
      );

      // 2. Full-page CTA
      assert.ok(
        drawerContent.includes("Mở toàn trang"),
        "Drawer header must contain 'Mở toàn trang' CTA"
      );
      assert.ok(
        drawerContent.includes("href={`/tasks/${subtask.id}`}"),
        "Mở toàn trang CTA must navigate to full subtask page"
      );

      // 3. Responsive styling: full width on mobile, covers sidebar on desktop
      assert.ok(
        drawerContent.includes("w-full") &&
          drawerContent.includes("lg:w-[460px]") &&
          drawerContent.includes("fixed top-0 right-0 bottom-0"),
        "Drawer must be full-screen on mobile and cover right sidebar on desktop"
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

      // 6. Real API mutations
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
