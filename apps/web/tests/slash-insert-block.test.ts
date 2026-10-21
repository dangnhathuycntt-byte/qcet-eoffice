/**
 * Chèn khối từ menu "/" và dọn khối rỗng khi rời editor (lỗi tìm thấy 21/10/2026 khi kiểm menu "/"):
 * - chọn khối trên dòng chỉ có "/…" để lại dòng trống phía trên khối mới;
 * - chọn "Trích dẫn" thì chữ gõ tiếp rơi vào khối phía trên (trích dẫn là khối chứa, chuẩn hóa bọc thêm đoạn bên trong);
 * - chèn đường phân cách thì con trỏ kẹt trên khối void, rời editor thì đường phân cách bị xóa như khối rỗng.
 * Chạy với editor Plate không DOM, cùng plugin trích dẫn/đường phân cách như editor thật.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSlateEditor } from "platejs";
import { BaseBlockquotePlugin, BaseHorizontalRulePlugin } from "@platejs/basic-nodes";
import { insertSlashBlock } from "../src/components/tasks/detail/slash-insert-block";
import { pruneEmptyBlocks } from "../src/components/tasks/detail/prune-empty-blocks";

function makeEditor(value: any[], cursor: { path: number[]; offset: number }) {
  const editor = createSlateEditor({ plugins: [BaseBlockquotePlugin, BaseHorizontalRulePlugin], value });
  editor.tf.select(cursor);
  return editor;
}

const types = (editor: any) => (editor.children as any[]).map((node) => node.type);

describe("insertSlashBlock", () => {
  it("dòng trống: khối mới thay chính dòng đó, con trỏ trong khối mới", () => {
    const editor = makeEditor(
      [{ type: "p", children: [{ text: "Trên" }] }, { type: "p", children: [{ text: "" }] }],
      { path: [1, 0], offset: 0 },
    );
    assert.equal(insertSlashBlock(editor, { type: "h2", children: [{ text: "" }] }), null);
    assert.deepEqual(types(editor), ["p", "h2"]);
    assert.deepEqual(editor.selection?.anchor.path, [1, 0]);
  });

  it("dòng còn chữ: chèn khối mới ngay sau dòng, giữ nguyên chữ", () => {
    const editor = makeEditor([{ type: "p", children: [{ text: "Có chữ " }] }], { path: [0, 0], offset: 7 });
    insertSlashBlock(editor, { type: "h2", children: [{ text: "" }] });
    assert.deepEqual(types(editor), ["p", "h2"]);
    assert.equal((editor.children[0] as any).children[0].text, "Có chữ ");
    assert.deepEqual(editor.selection?.anchor.path, [1, 0]);
  });

  it("trích dẫn (khối chứa): con trỏ nằm trong trích dẫn sau khi chuẩn hóa, không rơi về khối trên", () => {
    const editor = makeEditor(
      [{ type: "p", children: [{ text: "Trên" }] }, { type: "p", children: [{ text: "" }] }],
      { path: [1, 0], offset: 0 },
    );
    insertSlashBlock(editor, { type: "blockquote", children: [{ text: "" }] });
    assert.deepEqual(types(editor), ["p", "blockquote"]);
    assert.equal(editor.selection?.anchor.path[0], 1);
    editor.tf.insertText("Câu");
    assert.equal(editor.api.string([1]), "Câu");
    assert.equal(editor.api.string([0]), "Trên");
  });

  it("đường phân cách (void): con trỏ xuống dòng trống ngay dưới, trả khối void", () => {
    const editor = makeEditor(
      [{ type: "p", children: [{ text: "Trên" }] }, { type: "p", children: [{ text: "" }] }],
      { path: [1, 0], offset: 0 },
    );
    const inserted = insertSlashBlock(editor, { type: "hr", children: [{ text: "" }] });
    assert.equal(inserted?.type, "hr");
    assert.deepEqual(types(editor), ["p", "hr", "p"]);
    assert.deepEqual(editor.selection?.anchor.path, [2, 0]);
  });

  it("đường phân cách: dùng lại dòng trống sẵn có bên dưới, không thêm dòng", () => {
    const editor = makeEditor(
      [{ type: "p", children: [{ text: "" }] }, { type: "p", children: [{ text: "" }] }],
      { path: [0, 0], offset: 0 },
    );
    insertSlashBlock(editor, { type: "hr", children: [{ text: "" }] });
    assert.deepEqual(types(editor), ["hr", "p"]);
    assert.deepEqual(editor.selection?.anchor.path, [1, 0]);
  });
});

describe("pruneEmptyBlocks", () => {
  it("xóa tiêu đề rỗng, giữ đoạn rỗng và đường phân cách", () => {
    const editor = makeEditor(
      [
        { type: "p", children: [{ text: "Trên" }] },
        { type: "hr", children: [{ text: "" }] },
        { type: "h2", children: [{ text: "" }] },
        { type: "p", children: [{ text: "" }] },
      ],
      { path: [0, 0], offset: 0 },
    );
    pruneEmptyBlocks(editor);
    assert.deepEqual(types(editor), ["p", "hr", "p"]);
  });

  it("luôn còn ít nhất một khối", () => {
    const editor = makeEditor([{ type: "h2", children: [{ text: "" }] }], { path: [0, 0], offset: 0 });
    pruneEmptyBlocks(editor);
    assert.deepEqual(types(editor), ["h2"]);
  });
});
