import type { SlateEditor } from "platejs";
import { PLATE_NODE_TYPES as PT, type PlateElement } from "@qcet/shared/lib/tasks/plate-block-codec";

/**
 * Chèn khối chọn từ menu "/" tại con trỏ (dấu "/…" đã gỡ). Dòng trống thì khối mới thay chính dòng đó như Notion; dòng còn
 * chữ thì chèn ngay sau dòng. Con trỏ đặt sau khi chuẩn hóa: khối chứa như trích dẫn được bọc thêm đoạn bên trong lúc chuẩn
 * hóa nên vùng chọn đặt trước đó rơi về khối phía trên. Khối không gõ chữ được (đường phân cách, ảnh, tệp, dấu trang…) thì
 * con trỏ xuống dòng trống ngay dưới. Trả khối void vừa chèn (để đưa tiêu điểm vào ô nhập của nó), không thì `null`.
 */
export function insertSlashBlock(editor: SlateEditor, node: PlateElement): PlateElement | null {
  const entry = editor.api.block();
  // Trong ô bảng, khối thu gọn…: chèn tại con trỏ như cũ
  if (!entry || entry[1].length !== 1) {
    editor.tf.insertNodes([node] as any);
    return null;
  }
  const replace = editor.api.isEmpty(entry[0]);
  const at = replace ? entry[1] : [entry[1][0] + 1];
  editor.tf.withoutNormalizing(() => {
    if (replace) editor.tf.removeNodes({ at });
    editor.tf.insertNodes([node] as any, { at });
  });
  const inserted = editor.api.node(at)?.[0] as PlateElement | undefined;
  if (!inserted || !editor.api.isVoid(inserted as any)) {
    editor.tf.select(editor.api.end(at));
    return null;
  }
  const next = [at[0] + 1];
  const nextNode = editor.api.node(next)?.[0] as PlateElement | undefined;
  if (!nextNode || nextNode.type !== PT.paragraph || nextNode.listStyleType || !editor.api.isEmpty(nextNode as any)) {
    editor.tf.insertNodes({ type: PT.paragraph, children: [{ text: "" }] } as any, { at: next });
  }
  editor.tf.select(editor.api.start(next));
  return inserted;
}
