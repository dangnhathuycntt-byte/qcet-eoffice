/**
 * Chuyển qua lại giữa mô tả nhiệm vụ đã lưu (QCET JSON v1) và tài liệu Yjs của editor cộng tác (ADR-014). Dùng đúng codec của
 * editor (`parseToPlateValue`, `plateToBlocks` + `serializeBlocksToContent`): tự viết bộ mã hóa riêng mà lệch định dạng là hỏng
 * mô tả của mọi nhiệm vụ đã mở. Gốc tài liệu là `Y.XmlText` tên `content`, đúng chỗ `@platejs/yjs` đọc.
 */
import * as Y from "yjs";
import { slateNodesToInsertDelta, yTextToSlateElement } from "@slate-yjs/core";
import {
  parseToPlateValue,
  plateToBlocks,
  serializeBlocksToContent,
  type PlateValue,
} from "@qcet/shared/lib/tasks/plate-block-codec";

export const COLLAB_ROOT_NAME = "content";

function rootOf(doc: Y.Doc): Y.XmlText {
  return doc.get(COLLAB_ROOT_NAME, Y.XmlText);
}

function insertDescription(root: Y.XmlText, description: string | null | undefined): void {
  root.applyDelta(slateNodesToInsertDelta(parseToPlateValue(description) as never));
}

/** Tài liệu còn trống (chưa nạp trạng thái đã lưu) thì đổ mô tả hiện có vào. Có nội dung rồi thì không đụng. */
export function seedDocumentFromDescription(doc: Y.Doc, description: string | null | undefined): boolean {
  const root = rootOf(doc);
  if (root.length > 0) return false;
  doc.transact(() => insertDescription(root, description));
  return true;
}

/** Thay toàn bộ nội dung tài liệu bằng mô tả mới (mô tả đổi qua PATCH khi đang có người mở). */
export function replaceDocumentContent(doc: Y.Doc, description: string | null | undefined): void {
  const root = rootOf(doc);
  doc.transact(() => {
    if (root.length > 0) root.delete(0, root.length);
    insertDescription(root, description);
  });
}

/** Giá trị Plate hiện tại của tài liệu. */
export function documentToPlateValue(doc: Y.Doc): PlateValue {
  return yTextToSlateElement(rootOf(doc)).children as unknown as PlateValue;
}

/**
 * Tài liệu → mô tả để lưu vào `Task.description`, cùng cách editor tự lưu: bỏ khối còn URL `blob:` (ảnh, tệp đang tải lên).
 * Tài liệu rỗng → `null` như PATCH mô tả rỗng.
 */
export function documentToDescription(doc: Y.Doc): string | null {
  const blocks = plateToBlocks(documentToPlateValue(doc)).filter((block) => !block.url?.startsWith("blob:"));
  return serializeBlocksToContent(blocks) || null;
}

/**
 * Mô tả đã lưu đi qua đúng đường của tài liệu (giải mã → giá trị Plate → mã hóa lại), để so với bản chiếu mà không ghi lại mô tả
 * chỉ vì khác cách viết JSON: mở nhiệm vụ không được làm đổi `updatedAt`.
 */
export function normalizeDescription(description: string | null | undefined): string | null {
  const blocks = plateToBlocks(parseToPlateValue(description)).filter((block) => !block.url?.startsWith("blob:"));
  return serializeBlocksToContent(blocks) || null;
}
