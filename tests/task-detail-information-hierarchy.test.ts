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
    it("renders compact properties under title conditionally only when right sidebar is collapsed", () => {
      assert.ok(
        taskDetailPageContent.includes("showInlineProperties={!showInspector}"),
        "TaskDetailPage must only show inline compact properties when right sidebar is collapsed"
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

  describe("6. Decoupled Independent Date Rows & Text Wrap Polish in Sidebar", () => {
    it("renders both start date and due date with unified inline typography without pills/borders", () => {
      assert.ok(
        sidebarContent.includes('variant="inline"') &&
          !sidebarContent.includes('variant="chip"'),
        "Both dates must use unified inline variant without border/pill"
      );
    });

    it("renders start date and due date as two independent property rows with clear labels", () => {
      assert.ok(
        sidebarContent.includes("Ngày bắt đầu</span>") &&
          sidebarContent.includes("Hạn hoàn thành</span>"),
        "Must render separate property labels 'Ngày bắt đầu' and 'Hạn hoàn thành'"
      );
      assert.ok(
        sidebarContent.includes('title="Ngày bắt đầu"') &&
          sidebarContent.includes('title="Hạn hoàn thành"'),
        "Must provide title/tooltip for both dates without multi-line label text"
      );
    });

    it("eliminates arrow connector between dates in sidebar", () => {
      assert.ok(
        !sidebarContent.includes("ArrowRight"),
        "Sidebar must strictly eliminate arrow connector between dates"
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

    it("eliminates text-overflow ellipsis on Department, Lead, and Tags, allowing up to 2-line wrap", () => {
      assert.ok(
        sidebarContent.includes("line-clamp-2") &&
          sidebarContent.includes("whiteSpace: \"normal\""),
        "Must allow up to 2-line wrap with normal white-space for business critical fields"
      );
      assert.ok(
        sidebarContent.includes("textOverflow: \"clip\"") &&
          sidebarContent.includes("wordBreak: \"break-word\""),
        "Value columns must use clip and break-word to prevent premature truncation"
      );
    });
  });

  describe("7. Linear-Style 2-Rail Horizontal Layout System & Flexible Gutter", () => {
    const cssFile = path.resolve(
      process.cwd(),
      "src/components/tasks/task-detail-page.module.css"
    );
    const cssContent = fs.readFileSync(cssFile, "utf-8");

    it("creates a 2-rail layout with flexible whitespace between main rail and details rail", () => {
      assert.ok(
        cssContent.includes(".shellOpen") &&
          cssContent.includes("grid-template-columns: minmax(700px, 750px) minmax(48px, 1fr) 300px"),
        "Open shell must use 3-track grid: main rail (700-750px), flexible gutter (minmax(48px, 1fr)), details rail (300px)"
      );
      assert.ok(
        cssContent.includes("max-width: 1220px") && cssContent.includes("margin-inline: auto"),
        "Open shell must use max-width and margin-inline:auto to balance composition and shift rightwards"
      );
      assert.ok(
        taskDetailPageContent.includes('data-slot="task-shell"'),
        "TaskDetailPage must wrap document and sidebar within data-slot='task-shell'"
      );
    });

    it("places main content rail at column 1 and details inspector at column 3", () => {
      assert.ok(
        cssContent.includes(".shellOpen .content") &&
          cssContent.includes("grid-column: 1") &&
          cssContent.includes(".shellOpen .inspector") &&
          cssContent.includes("grid-column: 3"),
        "Main content must anchor to left rail and inspector to right rail"
      );
    });

    it("centers single document column constrained between 760px and 820px when sidebar is closed", () => {
      assert.ok(
        cssContent.includes(".shellClosed") && cssContent.includes("max-width: 780px"),
        "Closed shell must constrain document to 780px centered in workspace"
      );
    });

    it("strictly avoids CSS layout hacks (no transform: translateX, no negative margin offset)", () => {
      assert.ok(
        !cssContent.includes("transform: translateX") &&
          !cssContent.includes("margin-left: -"),
        "Layout must rely on standard CSS Grid/Flexbox without transform or negative margin hacks"
      );
    });

    it("ensures unified internal alignment axis without section padding skew", () => {
      assert.ok(
        cssContent.includes(".content > section { padding-inline: 0; }"),
        "Section must have 0 inline padding to share exact same left edge as blocks and title"
      );
    });
  });

  describe("8. Linear-Grade Compact Sidebar Inspector Polish", () => {
    const cssFile = path.resolve(
      process.cwd(),
      "src/components/tasks/task-detail-page.module.css"
    );
    const cssContent = fs.readFileSync(cssFile, "utf-8");

    it("narrows label column to 88px to allocate maximum space for value column", () => {
      assert.ok(
        cssContent.includes("grid-template-columns: 88px minmax(0, 1fr)"),
        "Label column must be narrowed to 88px, expanding value column width"
      );
    });

    it("displays assignee name only and moves title/role to tooltip/popover", () => {
      assert.ok(
        sidebarContent.includes("leadParsed.displayName") &&
          sidebarContent.includes("leadParsed.tooltip") &&
          sidebarContent.includes("extractNameAndTitle"),
        "Must extract assignee name and delegate full title/role to tooltip and popover"
      );
    });

    it("renders collaborators with overlapping avatar stack and remaining count", () => {
      assert.ok(
        sidebarContent.includes("-space-x-1.5") &&
          sidebarContent.includes("+${collaborators.length - 3}") &&
          sidebarContent.includes("size-5 rounded-full"),
        "Must render overlapping avatar stack with size-5 circles and +N counter"
      );
    });

    it("renders empty activity as single compact row without vertical blank space", () => {
      assert.ok(
        /Hoạt động\s*<\/span>/.test(sidebarContent) &&
          sidebarContent.includes(">0</span>") &&
          !sidebarContent.includes("Chưa có hoạt động mới nào."),
        "Empty activity section must render as a single compact row eliminating blank whitespace"
      );
    });

    it("maintains lightweight compact cards with reduced padding and gap", () => {
      assert.ok(
        cssContent.includes("gap: 6px;") &&
          cssContent.includes("padding: 12px 14px;"),
        "Sidebar cards must use compact 6px gap and 12px vertical padding"
      );
    });
  });
});
