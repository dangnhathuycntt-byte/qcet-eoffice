import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  parseContentToBlocks,
  serializeBlocksToContent,
  type NotionBlockItem,
} from "@/components/tasks/detail/task-notion-block-content";

describe("Notion/Linear Minimalist Document Editor Suite — Auto-Height & No Internal Scroll", () => {
  const componentPath = path.join(
    process.cwd(),
    "src/components/tasks/detail/task-notion-block-content.tsx"
  );
  const detailPagePath = path.join(
    process.cwd(),
    "src/components/tasks/task-detail-page.tsx"
  );

  const componentContent = fs.readFileSync(componentPath, "utf-8");
  const detailPageContent = fs.readFileSync(detailPagePath, "utf-8");

  describe("1. Auto-Height Canvas & Elimination of Internal Scrollbar", () => {
    it("strictly eliminates internal scroll, large min-height, and fake blank area containers", () => {
      // 1. Must NOT contain min-h-[160px] or min-h-[220px] on editor canvas
      assert.ok(
        !componentContent.includes("min-h-[160px]") && !componentContent.includes("min-h-[220px]"),
        "Editor canvas must NOT have artificial large min-height (min-h-[160px] / min-h-[220px])"
      );

      // 2. Must NOT contain data-slot='canvas-blank-area' or min-h-[80px] filler
      assert.ok(
        !componentContent.includes('data-slot="canvas-blank-area"'),
        "Must NOT contain artificial canvas-blank-area container"
      );

      // 3. Must NOT have overflow-y: auto/scroll on the document editor container
      assert.ok(
        !componentContent.includes("overflow-y-auto") ||
          componentContent.indexOf("overflow-y-auto") === componentContent.lastIndexOf("overflow-y-auto"),
        "Must NOT have internal scroll on main editor (only dropdown menu if applicable)"
      );

      // 4. Textarea must have autoResizeTextarea and overflow-hidden to auto-grow with text
      assert.ok(
        componentContent.includes("autoResizeTextarea") &&
          componentContent.includes("overflow-hidden") &&
          componentContent.includes("resize-none"),
        "Textarea must auto-grow and hide internal overflow"
      );
    });

    it("displays 'Nhập nội dung hoặc gõ / để chọn' with keycap hint without standalone '/' line", () => {
      // 1. Must use 'Nhập nội dung hoặc gõ' and 'để chọn'
      assert.ok(
        componentContent.includes("Nhập nội dung hoặc gõ") &&
          componentContent.includes("để chọn"),
        "Must provide 'Nhập nội dung hoặc gõ ... để chọn' affordance"
      );

      // 2. Must render '/' as keycap/kbd hint
      assert.ok(
        componentContent.includes("<kbd") && componentContent.includes("font-mono"),
        "Must render '/' as a keycap/kbd keyboard hint"
      );

      // 3. Must NOT use standalone '/' placeholder as sole text line
      assert.ok(
        !componentContent.includes('placeholder="/"'),
        "Must NOT use standalone '/' as placeholder line"
      );
    });

    it("provides exactly one ~32px trailing empty row with keyboard hint affordance when content exists", () => {
      // 1. Must render trailing empty block row with height around 32px (h-8)
      assert.ok(
        componentContent.includes("group/trailing") && componentContent.includes("h-8"),
        "Must render a ~32px (h-8) trailing empty block"
      );

      // 2. Trailing visual keycap hint
      assert.ok(
        componentContent.includes("group-hover/trailing:text-muted-foreground/80"),
        "Trailing empty block must show refined hover transition on hint"
      );

      // 3. Handles direct typing and slash menu trigger in trailing block
      assert.ok(
        componentContent.includes("handleTrailingKeyDown") &&
          componentContent.includes("handleTrailingChange"),
        "Must handle direct typing and '/' slash trigger in trailing block"
      );
    });
  });

  describe("2. Elimination of Redundant UI & Minimalist Block Aesthetics", () => {
    it("ensures no fixed '+' buttons, no redundant headings, and no grey card backgrounds for normal blocks", () => {
      // 1. Must NOT contain heading 'Nội dung chi tiết'
      assert.ok(
        !componentContent.includes("Nội dung chi tiết"),
        "Must NOT contain redundant heading 'Nội dung chi tiết'"
      );

      // 2. Must NOT contain '+ Thêm nội dung' button
      assert.ok(
        !componentContent.includes("Thêm nội dung"),
        "Must NOT contain redundant button '+ Thêm nội dung'"
      );

      // 3. Drag handle (⋮⋮) is only revealed on hover/focus
      assert.ok(
        componentContent.includes("opacity-0 group-hover/block:opacity-100 focus-within:opacity-100"),
        "Drag handle must only be visible on hover or focus"
      );
    });
  });

  describe("3. Block Engine, Serialization & Slash Menu", () => {
    it("preserves legacy plain text description as the first text block without data loss", () => {
      const legacyDesc = "Soạn thảo kế hoạch kiểm định chất lượng đào tạo năm học 2026-2027";
      const blocks = parseContentToBlocks(legacyDesc);

      assert.equal(blocks.length, 1);
      assert.equal(blocks[0].type, "text");
      assert.equal(blocks[0].content, legacyDesc);
    });

    it("serializes and deserializes structured blocks round-trip and strips legacy subtasks widgets", () => {
      const initialBlocks: NotionBlockItem[] = [
        { id: "b1", type: "heading", content: "Kế hoạch năm học", level: 1 },
        { id: "b2", type: "text", content: "Nội dung thực hiện chi tiết." },
        { id: "b3", type: "bulleted_list", content: "Giai đoạn 1: Chuẩn bị" },
        { id: "b4", type: "numbered_list", content: "Phân công tổ chuyên môn" },
        { id: "b5", type: "checklist", content: "Hoàn thiện hồ sơ minh chứng", checked: true },
        { id: "b6", type: "quote", content: "Chỉ đạo trực tiếp từ Ban Giám hiệu" },
        { id: "b7", type: "callout", content: "Hạn cuối nộp báo cáo: 30/09/2026" },
        { id: "b8", type: "divider", content: "" },
        { id: "b9", type: "attachment", content: "Huong_dan_kiem_dinh.pdf", url: "https://qcet.edu.vn/files/1" },
        { id: "b10", type: "link", content: "Cổng thông tin kiểm định", url: "https://kiemdinh.edu.vn" },
      ];

      const serialized = serializeBlocksToContent(initialBlocks);
      assert.ok(serialized.includes('"qcetBlocks":true'));

      const restored = parseContentToBlocks(serialized);
      assert.equal(restored.length, initialBlocks.length);
      assert.equal(restored[0].type, "heading");
      assert.equal(restored[2].type, "bulleted_list");
      assert.equal(restored[3].type, "numbered_list");
      assert.equal(restored[4].type, "checklist");
      assert.equal(restored[4].checked, true);
      assert.equal(restored[5].type, "quote");
      assert.equal(restored[6].type, "callout");
      assert.equal(restored[7].type, "divider");
      assert.equal(restored[8].type, "attachment");
      assert.equal(restored[9].type, "link");

      // Verify legacy subtasks_view is stripped safely without polluting document model
      const legacyPayloadWithSubtasks = JSON.stringify({
        qcetBlocks: true,
        version: 1,
        blocks: [
          { id: "leg1", type: "subtasks_view", content: "" },
          { id: "leg2", type: "subtasks", content: "" },
          { id: "leg3", type: "text", content: "Nội dung hợp lệ" },
        ],
      });
      const cleaned = parseContentToBlocks(legacyPayloadWithSubtasks);
      assert.equal(cleaned.length, 1);
      assert.equal(cleaned[0].type, "text");
      assert.equal(cleaned[0].content, "Nội dung hợp lệ");
    });

    it("ensures subtasks is strictly excluded from slash menu and canvas", () => {
      // 1. Must NOT include 'Chèn việc thành phần' in slash menu
      assert.ok(
        !componentContent.includes("Chèn việc thành phần"),
        "Must NOT include 'Chèn việc thành phần' in slash menu"
      );

      // 2. Must NOT define subtasks_view as selectable menu option
      assert.ok(
        !componentContent.includes('id: "opt-subtasks-view"'),
        "Must NOT contain opt-subtasks-view in menu options"
      );

      // 3. Must NOT render subtasks_view canvas widget
      assert.ok(
        !componentContent.includes('block.type === "subtasks_view"'),
        "Must NOT render subtasks_view widget in canvas"
      );
    });

    it("implements all essential E-Office block options in slash menu", () => {
      assert.ok(componentContent.includes('"Văn bản"'), "Must support Text");
      assert.ok(componentContent.includes('"Tiêu đề 1"'), "Must support Heading 1");
      assert.ok(componentContent.includes('"Tiêu đề 2"'), "Must support Heading 2");
      assert.ok(componentContent.includes('"Danh sách dấu đầu dòng"'), "Must support Bullet list");
      assert.ok(componentContent.includes('"Danh sách đánh số"'), "Must support Numbered list");
      assert.ok(componentContent.includes('"Checklist"'), "Must support Checklist");
      assert.ok(componentContent.includes('"Trích dẫn"'), "Must support Quote");
      assert.ok(componentContent.includes('"Ghi chú nổi bật"'), "Must support Callout");
      assert.ok(componentContent.includes('"Đường phân cách"'), "Must support Divider");
      assert.ok(componentContent.includes('"Tệp đính kèm"'), "Must support Attachment");
      assert.ok(componentContent.includes('"Liên kết"'), "Must support Link");
    });

    it("handles Enter to create next block, Backspace to revert or delete, and Esc to close menu", () => {
      assert.ok(
        componentContent.includes('e.key === "Enter"'),
        "Enter must create next block"
      );
      assert.ok(
        componentContent.includes('e.key === "Backspace"'),
        "Backspace on empty block must convert to text or delete"
      );
      assert.ok(
        componentContent.includes('e.key === "Escape"'),
        "Escape must close slash menu"
      );
    });
  });

  describe("4. Integration & Space Shortcut Protection", () => {
    it("connects real persistence and protects Space key from triggering sidebar toggle", () => {
      assert.ok(
        detailPageContent.includes("onSaveContent={handleSaveDescription}"),
        "TaskNotionBlockContent must connect to handleSaveDescription for real persistence"
      );
      assert.ok(
        detailPageContent.includes("isEditable(target)"),
        "Space shortcut handler must ignore text editing in inputs/textareas"
      );
      assert.ok(
        detailPageContent.includes("isDialogOpen()"),
        "Space shortcut handler must ignore when dialog/menu is active"
      );
    });
  });

  describe("5. Slash Menu Collision Handling & Safe Viewport Auto-Scroll", () => {
    it("implements smooth auto-scroll on slash menu open with block: 'nearest'", () => {
      assert.ok(
        componentContent.includes('block: "nearest"') &&
          componentContent.includes('behavior: "smooth"'),
        "Must use scrollIntoView with block: 'nearest' and behavior: 'smooth'"
      );
    });

    it("handles collision by flipping top if bottom viewport space is insufficient", () => {
      assert.ok(
        componentContent.includes("shouldFlipTop") &&
          componentContent.includes("spaceBelow") &&
          componentContent.includes("spaceAbove"),
        "Must compute viewport space and flip to top when bottom space is inadequate"
      );
      assert.ok(
        componentContent.includes("BOTTOM_SAFETY_MARGIN") || componentContent.includes("COLLISION_PADDING"),
        "Must enforce safety padding margins from viewport edges"
      );
    });

    it("portals menu to document.body and applies dynamic max-height with internal scroll", () => {
      // 1. Must use createPortal to document.body
      assert.ok(
        componentContent.includes("createPortal") && componentContent.includes("document.body"),
        "Must portal slash menu to document.body to prevent clipping from parent overflow"
      );

      // 2. Must dynamically compute menuMaxHeight based on available viewport height
      assert.ok(
        componentContent.includes("menuMaxHeight") &&
          componentContent.includes("availableHeight"),
        "Must compute dynamic max-height based on available viewport space"
      );

      // 3. Menu list must scroll internally with flex-1 min-h-0 and overscroll-contain
      assert.ok(
        componentContent.includes("overflow-y-auto") &&
          componentContent.includes("overscroll-contain"),
        "Menu list must scroll internally when options exceed available height"
      );
    });

    it("shifts menu horizontally so it never exceeds left or right viewport edges", () => {
      assert.ok(
        componentContent.includes("maxLeft") &&
          componentContent.includes("window.innerWidth - menuWidth") &&
          componentContent.includes("left < COLLISION_PADDING"),
        "Must clamp horizontal position with shift so menu is always fully visible"
      );
    });

    it("ensures active menu item scrolls into view without scrolling page on ArrowDown/Up", () => {
      assert.ok(
        componentContent.includes("menuItemRefs") &&
          componentContent.includes("activeBtn.scrollIntoView"),
        "Must auto-scroll active option into menu viewport"
      );
    });

    it("auto-scrolls newly created block into view when user presses Enter", () => {
      assert.ok(
        componentContent.includes("pendingFocusBlockIdRef.current") &&
          componentContent.includes("el.scrollIntoView"),
        "Newly created blocks must auto-scroll smoothly into view"
      );
    });
  });

  describe("6. Fast Block Handle & Multi-Select Notion Interaction Suite", () => {
    it("strictly separates hover state from selected state without accidental selection or heavy borders", () => {
      // 1. Hover has neutral subtle background when not selected
      assert.ok(
        componentContent.includes('!isSelected && "hover:bg-muted/30"'),
        "Hover must apply subtle neutral background only when not selected"
      );

      // 2. Selected state uses light tint background without border or ring
      assert.ok(
        componentContent.includes('isSelected && "bg-primary/[0.08]"'),
        "Selected state must have light tint background without heavy border or ring"
      );
      assert.ok(
        !componentContent.includes("ring-1 ring-primary/30"),
        "Selected state must NOT contain heavy ring border"
      );

      // 3. Handle has no standalone blue background or button chip
      assert.ok(
        !componentContent.includes("text-primary hover:text-primary bg-primary/15"),
        "Handle must NOT have standalone blue background or button chip"
      );
    });

    it("renders contiguous selected blocks as a unified continuous group with adaptive radius", () => {
      assert.ok(
        componentContent.includes("selectionRadiusClass") &&
          componentContent.includes("rounded-t-md rounded-b-none") &&
          componentContent.includes("rounded-b-md rounded-t-none") &&
          componentContent.includes('"rounded-none"'),
        "Must adaptively adjust border-radius so contiguous blocks look like one continuous selection"
      );
      assert.ok(
        componentContent.includes("handleGutterMouseDown") &&
          componentContent.includes("handleBlockMouseEnter"),
        "Must support dragging from gutter to marquee-select multiple blocks"
      );
    });

    it("supports multi-selection via Shift+click range and Cmd/Ctrl+click toggle", () => {
      // 1. Shift+click range selection
      assert.ok(
        componentContent.includes("e.shiftKey && anchorBlockId") &&
          componentContent.includes("rangeIds.add"),
        "Must support Shift+click range selection"
      );

      // 2. Cmd/Ctrl+click toggle selection
      assert.ok(
        componentContent.includes("(e.metaKey || e.ctrlKey)") &&
          componentContent.includes("next.delete(block.id)") &&
          componentContent.includes("next.add(block.id)"),
        "Must support Cmd/Ctrl+click toggle selection"
      );

      // 3. Shift + ArrowUp / ArrowDown selection expansion
      assert.ok(
        componentContent.includes("e.shiftKey && (e.key === \"ArrowUp\" || e.key === \"ArrowDown\")"),
        "Must support Shift + ArrowUp/ArrowDown selection expansion"
      );
    });

    it("supports instant multi-delete, multi-duplicate (Cmd+D), and Esc transitions", () => {
      // 1. Delete / Backspace deletes all selected blocks
      assert.ok(
        componentContent.includes("handleDeleteSelectedBlocks()"),
        "Delete and Backspace must invoke handleDeleteSelectedBlocks"
      );

      // 2. Cmd/Ctrl+D duplicates all selected blocks
      assert.ok(
        componentContent.includes("handleDuplicateSelectedBlocks()"),
        "Cmd/Ctrl+D must invoke handleDuplicateSelectedBlocks"
      );

      // 3. Esc in text mode enters block selection, Esc in selection mode clears
      assert.ok(
        componentContent.includes("setSelectedBlockIds(new Set([block.id]))") &&
          componentContent.includes("setSelectedBlockIds(new Set())"),
        "Esc must smoothly toggle between text edit and selection mode"
      );
    });

    it("supports dragging multiple selected blocks as a group with proper insertion indicator", () => {
      // 1. Multi-drag group support
      assert.ok(
        componentContent.includes("draggedGroupBlockIds") &&
          componentContent.includes("setDraggedGroupBlockIds"),
        "Must track group of dragged block IDs"
      );

      // 2. Insertion indicator
      assert.ok(
        componentContent.includes('isDragOver && "bg-primary/10"'),
        "Must render clean insertion line indicator on drag over"
      );

      // 3. Right-click context menu
      assert.ok(
        componentContent.includes("onContextMenu"),
        "Must support right-click context menu"
      );
    });

    it("clears block selection when clicking or focusing inside text fields", () => {
      assert.ok(
        componentContent.includes("onFocus={() => {") &&
          componentContent.includes("setSelectedBlockIds(new Set())"),
        "Focusing text input must clear block selection"
      );
    });
  });

  describe("7. Empty Block Prevention, Auto-Sanitization & Non-Persistence", () => {
    it("identifies meaningful blocks and rejects placeholder-only empty blocks", () => {
      const { isMeaningfulBlock } = require("@/components/tasks/detail/task-notion-block-content");

      // Divider is always meaningful
      assert.equal(isMeaningfulBlock({ id: "1", type: "divider", content: "" }), true);

      // Text / Heading / Quote / List require non-whitespace content
      assert.equal(isMeaningfulBlock({ id: "2", type: "text", content: "   " }), false);
      assert.equal(isMeaningfulBlock({ id: "3", type: "text", content: "Nội dung" }), true);
      assert.equal(isMeaningfulBlock({ id: "4", type: "heading", content: "" }), false);
      assert.equal(isMeaningfulBlock({ id: "5", type: "bulleted_list", content: "" }), false);
      assert.equal(isMeaningfulBlock({ id: "6", type: "checklist", content: "" }), false);
      assert.equal(isMeaningfulBlock({ id: "7", type: "callout", content: "" }), false);
      assert.equal(isMeaningfulBlock({ id: "8", type: "callout", content: "Lưu ý quan trọng" }), true);

      // Link requires title or actual URL
      assert.equal(isMeaningfulBlock({ id: "9", type: "link", content: "", url: "https://" }), false);
      assert.equal(isMeaningfulBlock({ id: "10", type: "link", content: "QCET", url: "https://" }), true);
      assert.equal(isMeaningfulBlock({ id: "11", type: "link", content: "", url: "https://qcet.edu.vn" }), true);

      // Attachment requires actual file or url
      assert.equal(isMeaningfulBlock({ id: "12", type: "attachment", content: "", fileName: "Tài liệu đính kèm" }), false);
      assert.equal(isMeaningfulBlock({ id: "13", type: "attachment", content: "Báo cáo.pdf", fileName: "Báo cáo.pdf" }), true);
    });

    it("filters legacy empty blocks on parse and never persists empty blocks to storage", () => {
      const payloadWithEmptyBlocks = JSON.stringify({
        qcetBlocks: true,
        version: 1,
        blocks: [
          { id: "e1", type: "callout", content: "" },
          { id: "e2", type: "link", content: "", url: "https://" },
          { id: "e3", type: "bulleted_list", content: "   " },
          { id: "m1", type: "text", content: "Văn bản hợp lệ" },
          { id: "e4", type: "heading", content: "" },
        ],
      });

      const parsed = parseContentToBlocks(payloadWithEmptyBlocks);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].content, "Văn bản hợp lệ");

      const serialized = serializeBlocksToContent([
        { id: "e1", type: "callout", content: "" },
        { id: "m1", type: "text", content: "Văn bản hợp lệ" },
      ]);
      const reserialized = JSON.parse(serialized);
      assert.equal(reserialized.blocks.length, 1);
      assert.equal(reserialized.blocks[0].content, "Văn bản hợp lệ");
    });

    it("wires handleBlockBlur on input fields to clean up empty blocks when leaving", () => {
      assert.ok(
        componentContent.includes("handleBlockBlur") &&
          componentContent.includes("isMeaningfulBlock"),
        "Must implement handleBlockBlur to remove empty blocks when focus leaves"
      );
    });
  });

  describe("8. Modern Media, File and Link Redesign (Image, File, Bookmark & URL Paste)", () => {
    it("separates Image, File, Bookmark, and Link into dedicated slash menu options", () => {
      assert.ok(componentContent.includes('"opt-image"'), "Must provide dedicated Image slash option");
      assert.ok(componentContent.includes('"opt-attachment"'), "Must provide dedicated File/Attachment option");
      assert.ok(componentContent.includes('"opt-bookmark"'), "Must provide dedicated Web Bookmark option");
      assert.ok(componentContent.includes('"opt-link"'), "Must provide dedicated Link option");
    });

    it("renders image directly without generic attachment card and supports hover toolbar and caption", () => {
      assert.ok(
        componentContent.includes("<img") &&
          componentContent.includes("block.caption") &&
          componentContent.includes("Thay thế") &&
          componentContent.includes("imageWidth"),
        "Must render direct image tag with aspect ratio, width controls, and caption"
      );
    });

    it("renders files as compact document rows with icon and metadata instead of tall cards", () => {
      assert.ok(
        componentContent.includes("FileText") &&
          componentContent.includes("block.fileSize") &&
          componentContent.includes("group/file"),
        "Must render file as compact row with icon and secondary metadata"
      );
    });

    it("resolves internal QCET E-Office links for tasks, documents and meetings", () => {
      const { resolveUrlMetadata } = require("@/components/tasks/detail/task-notion-block-content");

      const taskMeta = resolveUrlMetadata("/tasks/task-123", "Soạn thảo kế hoạch");
      assert.equal(taskMeta.isInternalQcet, true);
      assert.equal(taskMeta.entityType, "task");
      assert.ok(taskMeta.title.includes("Soạn thảo kế hoạch"));

      const docMeta = resolveUrlMetadata("https://qcet.edu.vn/documents/incoming/doc-456");
      assert.equal(docMeta.isInternalQcet, true);
      assert.equal(docMeta.entityType, "document");

      const meetingMeta = resolveUrlMetadata("https://qcet.edu.vn/meetings/meet-789");
      assert.equal(meetingMeta.isInternalQcet, true);
      assert.equal(meetingMeta.entityType, "meeting");

      const extMeta = resolveUrlMetadata("https://github.com/dangnhathuycntt-byte/qcet-eoffice");
      assert.equal(extMeta.domain, "github.com");
      assert.equal(extMeta.title, "GitHub Repository");
    });

    it("handles clipboard image paste and drag & drop for images and files", () => {
      assert.ok(
        componentContent.includes("handleContainerPaste") &&
          componentContent.includes("handleContainerDrop"),
        "Must implement clipboard paste and drag & drop handlers on container"
      );
    });

    it("presents contextual popover to choose Link / Bookmark / Embed on URL paste", () => {
      assert.ok(
        componentContent.includes("urlPastePopover") &&
          componentContent.includes("Dán dưới dạng:"),
        "Must provide contextual URL paste popover"
      );
    });
  });

  describe("9. Global Window Drag & Drop UX for Media & Files (OS File Drop Anywhere)", () => {
    it("registers global window drag listeners with cleanup on unmount", () => {
      assert.ok(
        componentContent.includes('window.addEventListener("dragenter"') &&
          componentContent.includes('window.addEventListener("dragover"') &&
          componentContent.includes('window.addEventListener("dragleave"') &&
          componentContent.includes('window.addEventListener("drop"') &&
          componentContent.includes('window.removeEventListener("dragenter"') &&
          componentContent.includes('window.removeEventListener("drop"'),
        "Must register and unregister window dragenter, dragover, dragleave, drop listeners"
      );
    });

    it("activates global drop overlay only for OS files and ignores internal block drag", () => {
      assert.ok(
        componentContent.includes("isGlobalDragging") &&
          componentContent.includes("dragCounterRef") &&
          componentContent.includes("hasFiles") &&
          componentContent.includes("isDraggingRef.current"),
        "Must track dragCounter, isGlobalDragging and ignore internal handle 6-dot drag"
      );
    });

    it("renders global overlay via Portal with clear message and icon", () => {
      assert.ok(
        componentContent.includes('data-testid="global-file-drop-overlay"') &&
          componentContent.includes("Thả để thêm vào nội dung") &&
          componentContent.includes("Ảnh, PDF, tài liệu và các tệp khác") &&
          componentContent.includes("UploadCloud"),
        "Must render full-viewport overlay via portal with user-friendly drop message"
      );
    });

    it("handles multiple files and classifies images vs documents with optimistic rendering", () => {
      assert.ok(
        componentContent.includes("handleProcessDroppedFiles") &&
          componentContent.includes("Array.from(files)") &&
          componentContent.includes("isImageFile") &&
          componentContent.includes("URL.createObjectURL(file)") &&
          componentContent.includes('type: "image"') &&
          componentContent.includes('type: "attachment"'),
        "Must process multiple files, classify image vs document, and create blocks with optimistic preview"
      );
    });

    it("implements 3-tier insertion rules: focused block -> canvas cursor clientY -> end of document", () => {
      assert.ok(
        componentContent.includes("lastActiveBlockIdRef.current") &&
          componentContent.includes("insertIndex") &&
          componentContent.includes("clientY") &&
          componentContent.includes("Math.abs(clientY - midY)") &&
          componentContent.includes("handleBlockFocus"),
        "Must implement adaptive insertion targeting focused block, nearest canvas block or document end"
      );
    });

    it("prevents default browser file open behavior on dragover and drop", () => {
      assert.ok(
        componentContent.includes("handleWindowDragOver") &&
          componentContent.includes("handleWindowDrop") &&
          componentContent.includes('dropEffect = "copy"'),
        "Must call preventDefault on dragover and drop to stop browser native file navigation"
      );
    });
  });
});
