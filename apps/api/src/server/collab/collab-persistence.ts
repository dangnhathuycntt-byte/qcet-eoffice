/**
 * Nạp và lưu tài liệu cộng tác (ADR-014). Trạng thái Yjs nằm ở `task_collab_documents`; chưa có thì seed từ `Task.description`.
 * Mỗi lần lưu ghi lại trạng thái rồi chiếu ra `Task.description` (danh sách, tìm kiếm, Trợ lý vẫn đọc mô tả), không tăng
 * `Task.version` để người đang sửa tên hay hạn không nhận 409 chỉ vì có người gõ mô tả.
 */
import * as Y from "yjs";
import { prisma } from "@qcet/db/prisma";
import { documentToDescription, normalizeDescription, seedDocumentFromDescription } from "./collab-content";

export async function loadCollabDocument(document: Y.Doc, taskId: string): Promise<void> {
  const row = await prisma.taskCollabDocument.findUnique({ where: { taskId }, select: { state: true } });
  if (row) {
    Y.applyUpdate(document, new Uint8Array(row.state));
    return;
  }
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { description: true } });
  if (!task) throw new Error("collab-task-not-found");
  seedDocumentFromDescription(document, task.description);
}

export async function storeCollabDocument(document: Y.Doc, taskId: string, userId: string | null): Promise<void> {
  const state = Buffer.from(Y.encodeStateAsUpdate(document));
  const description = documentToDescription(document);
  await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId }, select: { description: true } });
    // Nhiệm vụ vừa bị xóa: không tạo lại gì (dòng trạng thái đã bị xóa theo khóa ngoại)
    if (!task) return;
    await tx.taskCollabDocument.upsert({
      where: { taskId },
      create: { taskId, state, updatedById: userId },
      update: { state, updatedById: userId },
    });
    if (normalizeDescription(task.description) !== description) {
      await tx.task.update({ where: { id: taskId }, data: { description } });
    }
  });
}

/** Quên trạng thái đã lưu: lần mở sau seed lại từ `Task.description` (mô tả đổi qua PATCH khi không ai đang mở). */
export async function discardCollabDocument(taskId: string): Promise<void> {
  await prisma.taskCollabDocument.deleteMany({ where: { taskId } });
}
