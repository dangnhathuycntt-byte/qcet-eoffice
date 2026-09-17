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

  describe("5. Activities in Sidebar & Activity Tab Header", () => {
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

    it("verifies Activity tab header removes redundant badge and uses standard description", () => {
      assert.ok(
        taskDetailPageContent.includes("Nhật ký xử lý & Lịch sử hoạt động"),
        "Activity tab must have title 'Nhật ký xử lý & Lịch sử hoạt động'"
      );
      assert.ok(
        taskDetailPageContent.includes("Ghi nhận đầy đủ các thay đổi, cập nhật và thao tác trên nhiệm vụ."),
        "Activity tab description must follow standard administrative phrasing"
      );
      assert.ok(
        !taskDetailPageContent.includes("mốc</span>") &&
          !taskDetailPageContent.includes("mốc\n") &&
          !taskDetailPageContent.includes("{feedActivityEvents.length} mốc"),
        "Activity tab header must NOT contain redundant 'mốc' count badge"
      );
    });
  });

  describe("6. Unified Date Range Visual & Interaction Polish in Sidebar", () => {
    it("renders both start date and due date with unified inline typography without pills/borders", () => {
      assert.ok(
        sidebarContent.includes('variant="inline"') &&
          !sidebarContent.includes('variant="chip"'),
        "Both dates must use unified inline variant without border/pill"
      );
    });

    it("eliminates inline label texts to prevent multi-line wrapping and provides tooltips", () => {
      assert.ok(
        sidebarContent.includes('title="Ngày bắt đầu"') &&
          sidebarContent.includes('title="Hạn hoàn thành"'),
        "Must provide title/tooltip for both dates without multi-line label text"
      );
      assert.ok(
        !sidebarContent.includes('label="Ngày bắt đầu"') &&
          !sidebarContent.includes('label="Hạn hoàn thành"'),
        "Must NOT render inline label text 'Ngày bắt đầu' or 'Hạn hoàn thành' causing line wrapping"
      );
    });

    it("ensures hover and open states are independent without permanent pill background on open", () => {
      const datePickerFile = path.resolve(
        process.cwd(),
        "src/components/ui/vietnamese-date-picker.tsx"
      );
      const datePickerContent = fs.readFileSync(datePickerFile, "utf-8");

      assert.ok(
        datePickerContent.includes('data-state={isOpen ? "open" : "closed"}'),
        "DatePicker must manage open state independently via data-state attribute"
      );
      assert.ok(
        !datePickerContent.includes('isOpen ? "bg-muted/60 text-foreground" : "hover:bg-muted/50"'),
        "DatePicker must NOT lock a permanent pill background when open"
      );
    });

    it("makes both start date and due date directly clickable to open date picker", () => {
      assert.ok(
        sidebarContent.includes("handleStartDateChangeInternal") &&
          sidebarContent.includes("handleDueDateChangeInternal"),
        "Both start date and due date must be interactive and update dates directly"
      );
    });

    it("enforces start date <= due date validation without silent invalid persistence", () => {
      assert.ok(
        sidebarContent.includes("newDateIso > dueDateIso") &&
          sidebarContent.includes("newDateIso < startDateIso") &&
          sidebarContent.includes("notifyWarning"),
        "Must validate that start date cannot be after due date"
      );
    });

    it("renders muted arrow separator between start date and due date", () => {
      assert.ok(
        sidebarContent.includes("ArrowRight") &&
          sidebarContent.includes("text-muted-foreground"),
        "Arrow separator between dates must use muted styling"
      );
    });
  });
});
