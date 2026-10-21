/**
 * Cùng sửa (ADR-014): tách khối (Enter) phải cho khối mới một `id` riêng cả trong tài liệu Yjs, không chỉ trong editor của người
 * gõ. Lỗi tìm thấy 21/10/2026 khi thử hai tab: YjsPlugin bọc ngoài NodeIdPlugin nên Yjs nhận thao tác trước khi NodeId đổi `id`
 * (tài liệu có `id` trùng, mỗi máy tự gán một `id` khác). Chạy editor Plate không DOM với plugin Yjs thật, provider giả.
 */
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { createSlateEditor } from "platejs";
import { BaseYjsPlugin } from "@platejs/yjs";
import { slateNodesToInsertDelta, yTextToSlateElement, YHistoryEditor } from "@slate-yjs/core";
import { collabNodeIdPlugin } from "../src/components/tasks/detail/collab-node-id";

// Awareness giữ một setInterval: hủy sau test để tiến trình test thoát
const cleanups: Array<() => void> = [];
after(() => cleanups.forEach((cleanup) => cleanup()));

async function connectedEditor() {
  const ydoc = new Y.Doc();
  const root = ydoc.get("content", Y.XmlText);
  root.applyDelta(
    slateNodesToInsertDelta([
      { type: "p", id: "khoi-1", children: [{ text: "Ý thứ nhất" }] },
      { type: "p", id: "khoi-2", children: [{ text: "Ý thứ hai" }] },
    ] as never),
  );
  const awareness = new Awareness(ydoc);
  cleanups.push(() => {
    awareness.destroy();
    ydoc.destroy();
  });
  const provider = {
    type: "gia",
    awareness,
    document: ydoc,
    isConnected: true,
    isSynced: true,
    connect() {},
    disconnect() {},
    destroy() {},
  };
  const editor = createSlateEditor({
    skipInitialization: true,
    plugins: [collabNodeIdPlugin, BaseYjsPlugin.configure({ options: { ydoc, awareness, providers: [provider as never] } })],
  });
  await editor.getApi(BaseYjsPlugin).yjs.init({ value: null, autoConnect: false });
  return { editor, root };
}

const ids = (nodes: Array<{ id?: unknown }>) => nodes.map((node) => node.id);

describe("cùng sửa: NodeIdPlugin bọc ngoài withYjs", () => {
  it("tách khối: khối mới có id riêng, tài liệu Yjs và editor cùng id", async () => {
    const { editor, root } = await connectedEditor();
    editor.tf.select({ path: [0, 0], offset: 4 });
    editor.tf.splitNodes({ always: true });
    // withYjs đẩy thao tác cục bộ vào tài liệu ở onChange (Slate gọi sau một microtask)
    await new Promise((resolve) => setTimeout(resolve, 0));

    const docIds = ids(yTextToSlateElement(root).children as never);
    assert.equal(docIds.length, 3);
    assert.equal(new Set(docIds).size, 3, `id trùng trong tài liệu Yjs: ${docIds.join(", ")}`);
    assert.deepEqual(ids(editor.children as never), docIds, "editor và tài liệu Yjs phải cùng id");
  });

  it("hoàn tác vẫn là của Yjs (chỉ gỡ thay đổi của chính mình), không bị HistoryPlugin đè", async () => {
    const { editor } = await connectedEditor();
    assert.ok(YHistoryEditor.isYHistoryEditor(editor));
  });
});
