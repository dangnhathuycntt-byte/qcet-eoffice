import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  parseContentToBlocks,
  serializeBlocksToContent,
  type NotionBlockItem,
} from "@/components/tasks/detail/task-notion-block-content";

describe("Notion/Linear Minimalist Document Editor Suite", () => {
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

  describe("1. Redundant UI Elimination & Clean Document Canvas", () => {
    it("eliminates redundant heading 'Nội dung chi tiết', '+ Thêm nội dung' button, and fixed '+' prefix", () => {
      // 1. Must NOT contain heading "Nội dung chi tiết"
      assert.ok(
        !componentContent.includes("Nội dung chi tiết"),
        "Must NOT contain redundant heading 'Nội dung chi tiết'"
      );

      // 2. Must NOT contain '+ Thêm nội dung' button
      assert.ok(
        !componentContent.includes("Thêm nội dung"),
        "Must NOT contain redundant button '+ Thêm nội dung'"
      );

      // 3. Must NOT contain text hint 'hoặc gõ / để chọn'
      assert.ok(
        !componentContent.includes("hoặc gõ"),
        "Must NOT contain redundant text hint 'hoặc gõ / để chọn'"
      );

      // 4. In TaskDetailPage, TaskNotionBlockContent is rendered directly after TaskIdentityBlock (Resources)
      assert.ok(
        detailPageContent.includes("<TaskNotionBlockContent"),
        "TaskDetailPage must render TaskNotionBlockContent directly as continuous canvas"
      );
    });

    it("ensures drag handle (⋮⋮) is only revealed on hover/focus and blocks have clean canvas typography", () => {
      // Gutter with GripVertical has opacity-0 group-hover:opacity-100 focus-within:opacity-100
      assert.ok(
        componentContent.includes("opacity-0 group-hover/block:opacity-100 focus-within:opacity-100"),
        "Drag handle must only be visible on hover or focus"
      );
      assert.ok(
        componentContent.includes("GripVertical"),
        "Must use GripVertical icon for drag handle"
      );
    });
  });

  describe("2. Block Engine, Parsing & Persistence Serialization", () => {
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
  });

  describe("3. Slash Command Menu & Minimalist Interaction", () => {
    it("supports opening slash command menu with '/' key in blocks and search filtering", () => {
      assert.ok(
        componentContent.includes('e.key === "/"'),
        "Must detect '/' keydown to open slash command menu"
      );
      assert.ok(
        componentContent.includes("menuSearchQuery") && componentContent.includes("filteredMenuOptions"),
        "Must provide search input and filtered options for slash menu"
      );
    });

    it("implements all essential E-Office block options in slash menu", () => {
      assert.ok(componentContent.includes('"Văn bản"'), "Must support Text");
      assert.ok(componentContent.includes('"Tiêu đề 1"'), "Must support Heading 1");
      assert.ok(componentContent.includes('"Tiêu đề 2"'), "Must support Heading 2");
      assert.ok(componentContent.includes('"Danh sách chấm"'), "Must support Bullet list");
      assert.ok(componentContent.includes('"Danh sách số"'), "Must support Numbered list");
      assert.ok(componentContent.includes('"Checklist"'), "Must support Checklist");
      assert.ok(componentContent.includes('"Trích dẫn"'), "Must support Quote");
      assert.ok(componentContent.includes('"Ghi chú nổi bật"'), "Must support Callout");
      assert.ok(componentContent.includes('"Đường phân cách"'), "Must support Divider");
      assert.ok(componentContent.includes('"Tệp đính kèm"'), "Must support Attachment");
      assert.ok(componentContent.includes('"Liên kết"'), "Must support Link");
    });

    it("handles Enter to create next block and Backspace on empty block naturally", () => {
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
});
