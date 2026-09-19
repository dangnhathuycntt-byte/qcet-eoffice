import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  qcetToPlate,
  plateToQcet,
  parseContentToBlocks,
  serializeBlocksToContent,
  parseToPlateValue,
  serializePlateValue,
  isMeaningfulBlock,
  PLATE_NODE_TYPES as PT,
} from "../src/components/tasks/detail/plate-qcet-codec";
import type { NotionBlockItem } from "../src/components/tasks/detail/task-notion-block-content";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundTrip(blocks: NotionBlockItem[]): NotionBlockItem[] {
  return plateToQcet(qcetToPlate(blocks));
}

function makeBlock(partial: Partial<NotionBlockItem> & { type: NotionBlockItem["type"] }): NotionBlockItem {
  return { id: `test-${Date.now()}`, content: "", ...partial };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("plate-qcet-codec", () => {
  describe("qcetToPlate → plateToQcet round-trip", () => {
    it("text block round-trips", () => {
      const blocks = [makeBlock({ type: "text", content: "Hello" })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "text");
      assert.equal(result[0].content, "Hello");
    });

    it("heading levels round-trip", () => {
      for (const level of [1, 2, 3] as const) {
        const blocks = [makeBlock({ type: "heading", content: `H${level}`, level })];
        const result = roundTrip(blocks);
        assert.equal(result[0].type, "heading");
        assert.equal(result[0].level, level);
        assert.equal(result[0].content, `H${level}`);
      }
    });

    it("bulleted_list round-trips", () => {
      const blocks = [makeBlock({ type: "bulleted_list", content: "Bullet" })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "bulleted_list");
      assert.equal(result[0].content, "Bullet");
    });

    it("numbered_list round-trips", () => {
      const blocks = [makeBlock({ type: "numbered_list", content: "Numbered" })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "numbered_list");
      assert.equal(result[0].content, "Numbered");
    });

    it("checklist round-trips with checked state", () => {
      const blocks = [makeBlock({ type: "checklist", content: "Task", checked: true })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "checklist");
      assert.equal(result[0].checked, true);
      assert.equal(result[0].content, "Task");
    });

    it("checklist unchecked round-trips", () => {
      const blocks = [makeBlock({ type: "checklist", content: "Todo", checked: false })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "checklist");
      assert.equal(result[0].checked, false);
    });

    it("quote round-trips", () => {
      const blocks = [makeBlock({ type: "quote", content: "A quote" })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "quote");
      assert.equal(result[0].content, "A quote");
    });

    it("callout round-trips", () => {
      const blocks = [makeBlock({ type: "callout", content: "Important" })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "callout");
    });

    it("divider round-trips", () => {
      const blocks = [makeBlock({ type: "divider" })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "divider");
    });

    it("image round-trips with metadata", () => {
      const blocks = [makeBlock({
        type: "image",
        content: "",
        url: "data:image/png;base64,abc",
        caption: "Photo",
        imageWidth: 50,
      })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "image");
      assert.equal(result[0].url, "data:image/png;base64,abc");
      assert.equal(result[0].caption, "Photo");
      assert.equal(result[0].imageWidth, 50);
    });

    it("attachment round-trips with metadata", () => {
      const blocks = [makeBlock({
        type: "attachment",
        content: "",
        url: "data:application/pdf;base64,xyz",
        fileName: "doc.pdf",
        fileSize: "1.2 MB",
        fileType: "application/pdf",
      })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "attachment");
      assert.equal(result[0].fileName, "doc.pdf");
      assert.equal(result[0].fileSize, "1.2 MB");
    });

    it("link round-trips", () => {
      const blocks = [makeBlock({
        type: "link",
        content: "GitHub",
        url: "https://github.com",
        description: "/org/repo",
      })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "link");
      assert.equal(result[0].url, "https://github.com");
    });

    it("bookmark round-trips with metadata", () => {
      const blocks = [makeBlock({
        type: "bookmark",
        content: "Example",
        url: "https://example.com",
        description: "Desc",
        favicon: "https://example.com/fav.ico",
        thumbnailUrl: "https://example.com/thumb.jpg",
      })];
      const result = roundTrip(blocks);
      assert.equal(result[0].type, "bookmark");
      assert.equal(result[0].favicon, "https://example.com/fav.ico");
      assert.equal(result[0].thumbnailUrl, "https://example.com/thumb.jpg");
    });

    it("all 12 types together round-trip", () => {
      const blocks: NotionBlockItem[] = [
        makeBlock({ type: "text", content: "p" }),
        makeBlock({ type: "heading", content: "h", level: 1 }),
        makeBlock({ type: "bulleted_list", content: "b" }),
        makeBlock({ type: "numbered_list", content: "n" }),
        makeBlock({ type: "checklist", content: "c", checked: true }),
        makeBlock({ type: "quote", content: "q" }),
        makeBlock({ type: "callout", content: "ca" }),
        makeBlock({ type: "divider" }),
        makeBlock({ type: "image", url: "http://img.png", content: "" }),
        makeBlock({ type: "attachment", url: "http://f.pdf", fileName: "f.pdf", content: "" }),
        makeBlock({ type: "link", url: "http://link.com", content: "lnk" }),
        makeBlock({ type: "bookmark", url: "http://bm.com", content: "bm" }),
      ];
      const result = roundTrip(blocks);
      assert.equal(result.length, 12);
      const types = result.map((b) => b.type);
      assert.deepEqual(types, [
        "text", "heading", "bulleted_list", "numbered_list", "checklist",
        "quote", "callout", "divider", "image", "attachment", "link", "bookmark",
      ]);
    });
  });

  describe("parseContentToBlocks", () => {
    it("empty string → single empty text block", () => {
      const result = parseContentToBlocks("");
      assert.equal(result.length, 1);
      assert.equal(result[0].type, "text");
      assert.equal(result[0].content, "");
    });

    it("null → single empty text block", () => {
      const result = parseContentToBlocks(null);
      assert.equal(result.length, 1);
    });

    it("plain text → single text block preserving content", () => {
      const result = parseContentToBlocks("Legacy description text");
      assert.equal(result.length, 1);
      assert.equal(result[0].type, "text");
      assert.equal(result[0].content, "Legacy description text");
    });

    it("QCET JSON v1 parses correctly", () => {
      const raw = JSON.stringify({
        qcetBlocks: true,
        version: 1,
        blocks: [
          { id: "b1", type: "text", content: "Hello" },
          { id: "b2", type: "heading", content: "Title", level: 1 },
        ],
      });
      const result = parseContentToBlocks(raw);
      assert.equal(result.length, 2);
      assert.equal(result[0].content, "Hello");
    });

    it("strips legacy widget types", () => {
      const raw = JSON.stringify({
        qcetBlocks: true,
        version: 1,
        blocks: [
          { id: "b1", type: "text", content: "Keep" },
          { id: "b2", type: "subtasks_view", content: "" },
          { id: "b3", type: "activity_view", content: "" },
        ],
      });
      const result = parseContentToBlocks(raw);
      assert.equal(result.length, 1);
      assert.equal(result[0].content, "Keep");
    });

    it("strips empty blocks", () => {
      const raw = JSON.stringify({
        qcetBlocks: true,
        version: 1,
        blocks: [
          { id: "b1", type: "text", content: "Keep" },
          { id: "b2", type: "text", content: "" },
          { id: "b3", type: "text", content: "  " },
        ],
      });
      const result = parseContentToBlocks(raw);
      assert.equal(result.length, 1);
      assert.equal(result[0].content, "Keep");
    });
  });

  describe("serializeBlocksToContent", () => {
    it("empty meaningful → empty string", () => {
      const result = serializeBlocksToContent([
        { id: "b1", type: "text", content: "" },
      ]);
      assert.equal(result, "");
    });

    it("meaningful blocks → valid QCET JSON v1", () => {
      const result = serializeBlocksToContent([
        { id: "b1", type: "text", content: "Hello" },
      ]);
      const parsed = JSON.parse(result);
      assert.equal(parsed.qcetBlocks, true);
      assert.equal(parsed.version, 1);
      assert.equal(parsed.blocks.length, 1);
    });

    it("strips legacy types during serialize", () => {
      const result = serializeBlocksToContent([
        { id: "b1", type: "text", content: "Keep" },
        { id: "b2", type: "subtasks_view" as any, content: "" },
      ]);
      const parsed = JSON.parse(result);
      assert.equal(parsed.blocks.length, 1);
    });
  });

  describe("parseToPlateValue / serializePlateValue", () => {
    it("full round-trip through Plate Value", () => {
      const raw = JSON.stringify({
        qcetBlocks: true,
        version: 1,
        blocks: [
          { id: "b1", type: "text", content: "Hello" },
          { id: "b2", type: "checklist", content: "Done", checked: true },
          { id: "b3", type: "divider", content: "" },
        ],
      });
      const plateValue = parseToPlateValue(raw);
      assert.equal(plateValue.length, 3);
      assert.equal(plateValue[0].type, "p");
      assert.equal(plateValue[1].checked, true);
      assert.equal(plateValue[2].type, "hr");

      const serialized = serializePlateValue(plateValue);
      const parsed = JSON.parse(serialized);
      assert.equal(parsed.blocks.length, 3);
      assert.equal(parsed.blocks[0].type, "text");
      assert.equal(parsed.blocks[1].type, "checklist");
      assert.equal(parsed.blocks[1].checked, true);
      assert.equal(parsed.blocks[2].type, "divider");
    });

    it("legacy plain text → Plate Value → QCET", () => {
      const plateValue = parseToPlateValue("Some old text");
      assert.equal(plateValue.length, 1);
      assert.equal(plateValue[0].type, "p");

      const serialized = serializePlateValue(plateValue);
      const parsed = JSON.parse(serialized);
      assert.equal(parsed.blocks[0].content, "Some old text");
    });

    it("empty → Plate Value → empty string", () => {
      const plateValue = parseToPlateValue("");
      const serialized = serializePlateValue(plateValue);
      assert.equal(serialized, "");
    });
  });

  describe("isMeaningfulBlock", () => {
    it("divider is always meaningful", () => {
      assert.equal(isMeaningfulBlock({ id: "x", type: "divider", content: "" }), true);
    });
    it("empty text is not meaningful", () => {
      assert.equal(isMeaningfulBlock({ id: "x", type: "text", content: "" }), false);
    });
    it("image without URL is not meaningful", () => {
      assert.equal(isMeaningfulBlock({ id: "x", type: "image", content: "" }), false);
    });
    it("image with URL is meaningful", () => {
      assert.equal(isMeaningfulBlock({ id: "x", type: "image", content: "", url: "http://x.png" }), true);
    });
  });

  describe("Plate node type mapping", () => {
    it("text → p", () => {
      const [el] = qcetToPlate([makeBlock({ type: "text", content: "x" })]);
      assert.equal(el.type, "p");
    });
    it("heading 1 → h1", () => {
      const [el] = qcetToPlate([makeBlock({ type: "heading", content: "x", level: 1 })]);
      assert.equal(el.type, "h1");
    });
    it("bulleted_list → p with listStyleType disc", () => {
      const [el] = qcetToPlate([makeBlock({ type: "bulleted_list", content: "x" })]);
      assert.equal(el.type, "p");
      assert.equal(el.listStyleType, "disc");
      assert.equal(el.indent, 1);
    });
    it("checklist → p with listStyleType disc + checked", () => {
      const [el] = qcetToPlate([makeBlock({ type: "checklist", content: "x", checked: true })]);
      assert.equal(el.type, "p");
      assert.equal(el.checked, true);
    });
  });
});
