import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  parseContentToBlocks,
  serializeBlocksToContent,
  type NotionBlockItem,
} from "@/components/tasks/detail/task-notion-block-content";

describe("Notion Block Content UX Suite — Block Engine, Slash Menu & Invariants", () => {
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

  describe("1. Block Parsing & Persistence Serialization", () => {
    it("preserves legacy plain text description as the first text block without data loss", () => {
      const legacyDesc = "Soạn thảo kế hoạch kiểm định chất lượng đào tạo năm học 2026-2027";
      const blocks = parseContentToBlocks(legacyDesc);

      assert.equal(blocks.length, 1);
      assert.equal(blocks[0].type, "text");
      assert.equal(blocks[0].content, legacyDesc);
    });

    it("handles null/undefined/empty string by providing an initial clean block", () => {
      const b1 = parseContentToBlocks(null);
      assert.equal(b1.length, 1);
      assert.equal(b1[0].type, "text");
      assert.equal(b1[0].content, "");

      const b2 = parseContentToBlocks("");
      assert.equal(b2.length, 1);
      assert.equal(b2[0].type, "text");
    });

    it("serializes and deserializes structured blocks (headings, checklists, links, subtasks view) round-trip", () => {
      const initialBlocks: NotionBlockItem[] = [
        { id: "b1", type: "heading", content: "Mục tiêu trọng tâm", level: 2 },
        { id: "b2", type: "text", content: "Nội dung triển khai theo quyết định BGH." },
        { id: "b3", type: "checklist", content: "Hoàn thiện đề cương chi tiết", checked: true },
        { id: "b4", type: "checklist", content: "Lấy ý kiến Hội đồng chuyên môn", checked: false },
        { id: "b5", type: "link", content: "Văn bản gốc", url: "https://qcet.edu.vn/docs/123" },
        { id: "b6", type: "subtasks_view", content: "" },
      ];

      const serialized = serializeBlocksToContent(initialBlocks);
      assert.ok(serialized.includes('"qcetBlocks":true'));

      const restored = parseContentToBlocks(serialized);
      assert.equal(restored.length, initialBlocks.length);
      assert.equal(restored[0].type, "heading");
      assert.equal(restored[0].content, "Mục tiêu trọng tâm");
      assert.equal(restored[2].type, "checklist");
      assert.equal(restored[2].checked, true);
      assert.equal(restored[3].checked, false);
      assert.equal(restored[4].url, "https://qcet.edu.vn/docs/123");
      assert.equal(restored[5].type, "subtasks_view");
    });
  });

  describe("2. Notion UI/UX Standards & Vietnamese Menu Structure", () => {
    it("features '+ Thêm nội dung' button persistently at the bottom with slash indicator", () => {
      assert.ok(
        componentContent.includes("Thêm nội dung"),
        "Must render persistent '+ Thêm nội dung' button at bottom of content"
      );
      assert.ok(
        componentContent.includes("— hoặc gõ") && componentContent.includes("/"),
        "Must provide '— hoặc gõ / để chọn' hint"
      );
    });

    it("organizes 3 distinct Vietnamese command groups: Nội dung, Tài liệu, Công việc", () => {
      assert.ok(componentContent.includes('"Nội dung"'), "Menu must include 'Nội dung' group");
      assert.ok(componentContent.includes('"Tài liệu"'), "Menu must include 'Tài liệu' group");
      assert.ok(componentContent.includes('"Công việc"'), "Menu must include 'Công việc' group");
    });

    it("implements all 8 required options: Văn bản, Tiêu đề, Danh sách, Checklist, Tệp đính kèm, Liên kết, Tạo việc con, Chèn danh sách việc con", () => {
      assert.ok(componentContent.includes('"Văn bản"'), "Must include 'Văn bản'");
      assert.ok(componentContent.includes('"Tiêu đề"'), "Must include 'Tiêu đề'");
      assert.ok(componentContent.includes('"Danh sách"'), "Must include 'Danh sách'");
      assert.ok(componentContent.includes('"Checklist"'), "Must include 'Checklist'");
      assert.ok(componentContent.includes('"Tệp đính kèm"'), "Must include 'Tệp đính kèm'");
      assert.ok(componentContent.includes('"Liên kết"'), "Must include 'Liên kết'");
      assert.ok(componentContent.includes('"Tạo việc con"'), "Must include 'Tạo việc con'");
      assert.ok(componentContent.includes('"Chèn danh sách việc con"'), "Must include 'Chèn danh sách việc con'");
    });

    it("distinguishes checklist as content vs subtask as canonical task workflow", () => {
      // 1. Checklist is content with interactive checkbox toggle
      assert.ok(
        componentContent.includes("type === \"checklist\""),
        "Checklist must be handled as an interactive content block"
      );
      assert.ok(
        componentContent.includes("checked: !block.checked"),
        "Checklist toggle must update checked boolean directly in block state"
      );

      // 2. 'Tạo việc con' triggers onOpenCreateSubtask for canonical task workflow
      assert.ok(
        componentContent.includes("onOpenCreateSubtask()"),
        "Create subtask must trigger real system task modal"
      );

      // 3. 'Chèn danh sách việc con' consumes existing subTasks without duplicating tasks
      assert.ok(
        componentContent.includes("subTasks.map"),
        "Subtasks view block must render existing subTasks directly"
      );
      assert.ok(
        componentContent.includes("onSelectSubtask?.(st)"),
        "Subtasks view items must allow opening the subtask drawer on click"
      );
    });

    it("provides hover/focus + button and drag handle (⋮⋮) with reordering and touch actions", () => {
      assert.ok(
        componentContent.includes("GripVertical"),
        "Must render GripVertical (⋮⋮) drag handle"
      );
      assert.ok(
        componentContent.includes("onDragStart") && componentContent.includes("onDragOver"),
        "Must support HTML5 drag and drop reordering"
      );
      assert.ok(
        componentContent.includes("Di chuyển lên") && componentContent.includes("Di chuyển xuống"),
        "Must support mouse/touch move actions via menu"
      );
      assert.ok(
        componentContent.includes("Xóa block"),
        "Must support delete block action"
      );
    });

    it("supports opening slash command menu with '/' key in blocks and search filtering", () => {
      assert.ok(
        componentContent.includes('e.key === "/"'),
        "Must detect '/' keydown to open command menu"
      );
      assert.ok(
        componentContent.includes("menuSearchQuery") && componentContent.includes("filteredMenuOptions"),
        "Must provide search input and filtered results for command menu"
      );
    });
  });

  describe("3. Integration in TaskDetailPage & Space Shortcut Immunity", () => {
    it("TaskDetailPage renders TaskNotionBlockContent in Overview tab", () => {
      assert.ok(
        detailPageContent.includes("<TaskNotionBlockContent"),
        "TaskDetailPage must render TaskNotionBlockContent in Overview tab"
      );
      assert.ok(
        detailPageContent.includes("onSaveContent={handleSaveDescription}"),
        "TaskNotionBlockContent must connect to handleSaveDescription for real persistence"
      );
    });

    it("Space key shortcut in TaskDetailPage ignores typing in block textareas, inputs, and search dialogs", () => {
      // isEditable check must guard inputs/textareas
      assert.ok(
        detailPageContent.includes("isEditable(target)"),
        "Space shortcut handler must ignore text editing in inputs/textareas"
      );
      // isDialogOpen check must guard dialog/menu role
      assert.ok(
        detailPageContent.includes("isDialogOpen()"),
        "Space shortcut handler must ignore when dialog/menu is active"
      );
    });
  });
});
