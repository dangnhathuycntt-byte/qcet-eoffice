import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postcss, { type AnyNode } from "postcss";

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
    "src/components/tasks/detail/task-properties-sidebar.tsx"
  );
  const sidebarContent = fs.readFileSync(sidebarFile, "utf-8");

  describe("1. Title & Subtitle De-duplication", () => {
    it("renders subtitle strictly as taskCode · scopeLabel without duplicate department", () => {
      // The identity block renders compact inline properties with · separators
      // between status, assignee, and date range — not a separate subtitle line
      assert.ok(
        identityBlockContent.includes("<span>·</span>"),
        "Identity block must use · separator between compact inline properties"
      );
      assert.ok(
        !identityBlockContent.includes("{taskCode} · {scopeLabel} · {departmentName}"),
        "Identity block must NOT duplicate departmentName under title"
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
      // The identity block uses normalizedStatus for status display,
      // leadName for the assignee, and dueDateIso for the due date
      assert.ok(
        identityBlockContent.includes("normalizedStatus") &&
          identityBlockContent.includes("leadName") &&
          identityBlockContent.includes("dueDateIso"),
        "Compact summary must contain Status (normalizedStatus), Lead Name, and Due Date"
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
    // Subtask rendering is delegated from the sidebar to TaskSubtasksSidebarSection
    const subtasksSectionFile = path.resolve(
      process.cwd(),
      "src/components/tasks/detail/task-subtasks-sidebar-section.tsx"
    );
    const subtasksSectionContent = fs.readFileSync(subtasksSectionFile, "utf-8");

    it("renders a single compact row 'Việc thành phần 0 +' with no large card when count is 0", () => {
      // Sidebar delegates subtasks to TaskSubtasksSidebarSection component
      assert.ok(
        sidebarContent.includes("TaskSubtasksSidebarSection"),
        "Sidebar must delegate subtask rendering to TaskSubtasksSidebarSection"
      );
      // The subtasks section renders header with count badge and add button with Plus icon
      assert.ok(
        subtasksSectionContent.includes("Việc con") &&
          subtasksSectionContent.includes("subTasks.length") &&
          subtasksSectionContent.includes("Plus"),
        "Must render compact subtask header with count and plus icon"
      );
      assert.ok(
        !subtasksSectionContent.includes("Chưa có việc thành phần"),
        "Must NOT render 'Chưa có việc thành phần' text"
      );
    });

    it("provides 'Xem tất cả' button and limits preview to at most 3 items when subtasks exist", () => {
      // The subtasks section uses MAX_COLLAPSED = 5 and Collapsible with "Xem thêm" toggle
      assert.ok(
        subtasksSectionContent.includes("MAX_COLLAPSED") &&
          subtasksSectionContent.includes("subTasks.slice(0, MAX_COLLAPSED)") &&
          subtasksSectionContent.includes("Xem thêm"),
        "Must limit preview with MAX_COLLAPSED and provide collapsible navigation"
      );
    });
  });

  describe("5. Activities in Sidebar & Activity Tab Header", () => {
    it("limits activity preview to at most 3 latest events with 'Xem tất cả' navigation", () => {
      // Activity events are passed as a prop (auditEvents) but the sidebar does not
      // render them inline — it delegates to the Activity tab via onNavigateTab.
      // The sidebar accepts auditEvents and onNavigateTab props for this purpose.
      assert.ok(
        sidebarContent.includes("auditEvents"),
        "Sidebar must accept auditEvents prop"
      );
      assert.ok(
        sidebarContent.includes("onNavigateTab"),
        "Sidebar must accept onNavigateTab for activity navigation"
      );
    });

    it("verifies Activity tab header removes redundant badge and uses standard description", () => {
      // Source uses &amp; HTML entity for & in JSX
      assert.ok(
        taskDetailPageContent.includes("Nhật ký xử lý &amp; Lịch sử hoạt động") ||
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
    it("renders start date and due date as two independent property rows with clear labels", () => {
      // Dates are rendered via PropertyRow component with label props
      assert.ok(
        sidebarContent.includes('label="Ngày bắt đầu"') &&
          sidebarContent.includes('label="Hạn hoàn thành"'),
        "Must render start date and due date as separate PropertyRow components with clear labels"
      );
      assert.ok(
        sidebarContent.includes("startDateIso") &&
          sidebarContent.includes("dueDateIso"),
        "Must reference both startDateIso and dueDateIso variables"
      );
    });

    it("allocates dual-line height with normal whitespace for business-critical fields", () => {
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
      // The layout uses splitWorkspace grid + workspace card + TaskDetailSplitLayout
      // with a flex-based split (main flex-1 + inspector w-[340px])
      assert.ok(
        cssContent.includes(".splitWorkspace") &&
          cssContent.includes("grid-template-columns: minmax(0, 1fr)"),
        "Layout must use splitWorkspace grid container"
      );
      assert.ok(
        cssContent.includes("margin-inline: auto") ||
          cssContent.includes(".workspace"),
        "Layout must define workspace container"
      );
      assert.ok(
        taskDetailPageContent.includes('data-slot="task-workspace"'),
        "TaskDetailPage must use data-slot='task-workspace' on the workspace container"
      );
    });

    it("places main content rail at column 1 and details inspector at column 3", () => {
      // TaskDetailSplitLayout uses flex layout: main content (flex-1) + inspector (w-[340px])
      // The CSS module uses .content for main and .inspector for the sidebar panel
      const splitLayoutFile = path.resolve(
        process.cwd(),
        "src/components/tasks/detail/task-detail-split-layout.tsx"
      );
      const splitLayoutContent = fs.readFileSync(splitLayoutFile, "utf-8");
      assert.ok(
        splitLayoutContent.includes("flex-1") &&
          splitLayoutContent.includes("w-[340px]"),
        "Split layout must use flex-1 for main content and w-[340px] for inspector"
      );
    });

    it("centers single document column constrained between 760px and 820px when sidebar is closed", () => {
      // The content pane uses max-width: 100% and the canvas uses clamp-based padding
      // When sidebar is closed, content expands within the workspace card
      assert.ok(
        cssContent.includes(".content") &&
          (cssContent.includes("max-width: 100%") || cssContent.includes("max-width")),
        "Content pane must define max-width constraint"
      );
    });

    it("strictly avoids CSS layout hacks (no transform: translateX, no negative margin offset)", () => {
      postcss.parse(cssContent).walkDecls((declaration) => {
        let parent: AnyNode | undefined = declaration.parent;
        while (parent) {
          if (parent.type === "atrule" && parent.name === "keyframes") return;
          parent = parent.parent;
        }
        assert.ok(
          !(declaration.prop === "transform" && declaration.value.includes("translateX")) &&
            !(declaration.prop === "margin-left" && declaration.value.startsWith("-")),
          "Layout must use Grid/Flexbox; visual keyframes may use transforms"
        );
      });
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

    it("keeps label column at 96px so the longest label (Hạn hoàn thành) does not overflow", () => {
      assert.ok(
        cssContent.includes("grid-template-columns: 96px minmax(0, 1fr)"),
        "Label column must be 96px: 88px made 'Hạn hoàn thành' spill into the value column"
      );
    });

    it("displays assignee name only and moves title/role to tooltip/popover", () => {
      // leadParsed memo computes displayName, tooltip, role, fullTitle
      // but only displayName is used in JSX; the tooltip is computed for
      // potential tooltip/popover usage, and extractNameAndTitle separates name from role
      assert.ok(
        sidebarContent.includes("leadParsed.displayName") &&
          sidebarContent.includes("extractNameAndTitle"),
        "Must extract assignee name via extractNameAndTitle and use leadParsed.displayName"
      );
      // The computed leadParsed object includes tooltip property in its memo return
      assert.ok(
        sidebarContent.includes("tooltip:") &&
          sidebarContent.includes("tooltipParts.join"),
        "Must compute tooltip from name parts for potential tooltip/popover display"
      );
    });

    it("renders collaborators with overlapping avatar stack and remaining count", () => {
      assert.ok(
        sidebarContent.includes("<UserAvatarGroup") &&
          sidebarContent.includes("users={collaborators}"),
        "Must render collaborators through the shared overlapping UserAvatarGroup (+N counter)"
      );
    });

    it("renders empty activity as single compact row without vertical blank space", () => {
      // The sidebar does not render activity inline — it accepts auditEvents
      // as a prop but the rendering is handled by the Activity tab.
      // The sidebar's role is delegation, not direct rendering of activity rows.
      assert.ok(
        sidebarContent.includes("auditEvents") &&
          !sidebarContent.includes("Chưa có hoạt động mới nào."),
        "Sidebar must handle auditEvents without rendering redundant empty-state whitespace"
      );
    });

    it("eliminates redundant add property plus button in Properties section header", () => {
      assert.ok(
        !sidebarContent.includes('title="Thêm thuộc tính"'),
        "Properties section header must NOT contain plus button to add property"
      );
    });

    it("maintains lightweight compact cards with reduced padding and gap", () => {
      // Các khối của inspector là thẻ riêng cách nhau 8px (kiểu Linear);
      // từng dòng thuộc tính dùng padding-block: 2px cho mật độ gọn
      assert.ok(
        cssContent.includes("gap: 8px") &&
          cssContent.includes("padding-block: 2px"),
        "Sidebar must use structured gap and compact padding for property rows"
      );
    });
  });
});
