/**
 * Mô tả đổi qua `PATCH /api/tasks/{id}` (editor khi cờ tắt, tab cũ) thì tài liệu cộng tác phải theo bản mới (ADR-014): đang có
 * người mở thì thay nội dung ngay qua kết nối trực tiếp (họ thấy liền, lần lưu kế tiếp chiếu lại đúng mô tả này); không ai mở
 * thì quên trạng thái đã lưu để lần mở sau seed lại. Chạy cả khi cờ tắt: dòng trạng thái cũ không được sống lại khi bật cờ.
 */
import { collabDocumentName } from "./collab-auth";
import { replaceDocumentContent } from "./collab-content";
import { discardCollabDocument } from "./collab-persistence";
import { getCollabServer } from "./collab-server";

export async function syncCollabAfterDescriptionPatch(
  taskId: string,
  description: string | null,
  userId: string,
): Promise<void> {
  const server = await getCollabServer();
  const name = collabDocumentName(taskId);
  if (server?.hocuspocus.documents.has(name)) {
    const connection = await server.hocuspocus.openDirectConnection(name, { userId });
    try {
      await connection.transact((document) => replaceDocumentContent(document, description));
    } finally {
      await connection.disconnect();
    }
    return;
  }
  await discardCollabDocument(taskId);
}
