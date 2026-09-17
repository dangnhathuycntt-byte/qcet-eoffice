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

    it("serializes and deserializes structured blocks (headings, lists, quotes, callouts, divider, links, files) round-trip", () => {
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
        { id: "b11", type: "subtasks_view", content: "" },
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
      assert.equal(restored[10].type, "subtasks_view");
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
});
