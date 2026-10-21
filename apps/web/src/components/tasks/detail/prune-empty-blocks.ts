import type { SlateEditor } from "platejs";
import { PLATE_NODE_TYPES as PT } from "@qcet/shared/lib/tasks/plate-block-codec";

/**
 * Xóa khối rỗng (tiêu đề, danh sách…) khi editor mất tiêu điểm. Giữ đoạn văn rỗng vì đó là khối mặc định; giữ khối void (ảnh,
 * tệp, nhúng, đường phân cách, dấu trang, liên kết: chữ con luôn rỗng) và khối cấu trúc (bảng, khối thu gọn). Luôn còn ít nhất
 * một khối.
 */
export function pruneEmptyBlocks(editor: SlateEditor): void {
  const children = editor.children as any[];
  const toRemove: number[] = [];
  for (let i = children.length - 1; i >= 0; i--) {
    const node = children[i];
    if (!node || node.type === PT.paragraph) continue;
    if (editor.api.isVoid(node) || node.type === PT.table || node.type === PT.toggle) continue;
    const texts = (node.children || []) as any[];
    const isEmpty = texts.length === 0 || texts.every((t: any) => typeof t.text === "string" && t.text.trim() === "" && !t.type);
    if (isEmpty) toRemove.push(i);
  }
  if (toRemove.length > 0 && toRemove.length < children.length) {
    editor.tf.withoutNormalizing(() => {
      for (const idx of toRemove) editor.tf.removeNodes({ at: [idx] });
    });
  }
}
