import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task Detail Information Hierarchy & Duplication Audit Suite", () => {
  const identityBlockFile = path.resolve(
    process.cwd(),
    "src/components/tasks/detail/task-identity-block.tsx"
  );
  const identityBlockContent = fs.readFileSync(identityBlockFile, "utf-8");

  const taskDetailPageFile = path.resolve(
    process.cwd(),
    "src/components/tasks/task-detail-page.tsx"
  );
  const taskDetailPageContent = fs.readFileSync(taskDetailPageFile, "utf-8");

  const sidebarFile = path.resolve(
    process.cwd(),
    "src/components/tasks/detail/linear-properties-sidebar.tsx"
  );
  const sidebarContent = fs.readFileSync(sidebarFile, "utf-8");

  describe("1. Title & Subtitle De-duplication", () => {
    it("renders subtitle strictly as taskCode · scopeLabel without duplicate department", () => {
      assert.ok(
        identityBlockContent.includes("{taskCode} · {scopeLabel}"),
        "Subtitle must contain taskCode and scopeLabel"
      );
      assert.ok(
        !identityBlockContent.includes("{taskCode} · {scopeLabel} · {departmentName}"),
        "Subtitle must NOT duplicate departmentName under title"
      );
    });
  });

  describe("2. Properties under Title (Conditional & Compact Summary)", () => {
    it("strictly hides pinned properties under title when sidebar inspector is open", () => {
      assert.ok(
        taskDetailPageContent.includes("showInlineProperties={!showInspector}"),
        "TaskDetailPage must hide inline properties when showInspector is true"
      );
    });

    it("eliminates the redundant 'Properties' label", () => {
      assert.ok(
        !identityBlockContent.includes('Properties</span>') &&
          !identityBlockContent.includes('>Properties<'),
        "Must NOT render 'Properties' text label under title"
      );
    });

    it("renders only compact summary (Status · Assignee · Due Date) when sidebar is collapsed", () => {
      assert.ok(
        identityBlockContent.includes("currentStatusObj.label") &&
          identityBlockContent.includes("leadName") &&
          identityBlockContent.includes("dueDateIso"),
        "Compact summary must contain Status, Lead Name, and Due Date"
      );
      assert.ok(
        !identityBlockContent.includes("LinearInlineStartDateIcon") &&
          !identityBlockContent.includes("Chọn ngày bắt đầu"),
        "Compact summary must NOT repeat start date under title"
      );
    });
  });

  describe("3. Elimination of Redundant Resources Bar", () => {
    it("completely removes the separate Resources row and popover from task identity block", () => {
      assert.ok(
        !identityBlockContent.includes("Linear-style Inline Resources Row") &&
          !identityBlockContent.includes("isResourcePopoverOpen") &&
          !identityBlockContent.includes("Thêm tài liệu hoặc liên kết..."),
        "Must remove separate Resources row since editor supports rich media natively"
      );
    });
  });

  describe("4. Subtasks Summary in Sidebar", () => {
    it("renders a single compact row 'Việc thành phần 0 +' with no large card when count is 0", () => {
      assert.ok(
        sidebarContent.includes('Việc thành phần') &&
          sidebarContent.includes('>0</span>') &&
          sidebarContent.includes('Plus className="size-3.5"'),
        "Must render compact row for 0 subtasks"
      );
      assert.ok(
        !sidebarContent.includes("Chưa có việc thành phần"),
        "Must NOT render 'Chưa có việc thành phần' text"
      );
    });

    it("provides 'Xem tất cả' button and limits preview to at most 3 items when subtasks exist", () => {
      assert.ok(
        sidebarContent.includes("subTasks.slice(0, 3)") &&
          sidebarContent.includes("onNavigateTab") &&
          sidebarContent.includes("Xem tất cả"),
        "Must limit preview to 3 items and provide navigation to full subtasks tab"
      );
    });
  });

  describe("5. Activities in Sidebar", () => {
    it("limits activity preview to at most 3 latest events with 'Xem tất cả' navigation", () => {
      assert.ok(
        sidebarContent.includes("auditEvents.slice(0, 3)"),
        "Must limit sidebar activity preview to at most 3 items"
      );
      assert.ok(
        sidebarContent.includes('onNavigateTab("activity")') &&
          sidebarContent.includes("Xem tất cả"),
        "Must provide 'Xem tất cả' linking to full Activity tab"
      );
    });
  });
});
