import type { Prisma } from "@prisma/client";
import { ApiError, ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { buildTaskReadWhere } from "@/server/tasks/task-query-service";
import { AuditAction, AuditEntityType, logAuditEvent } from "@/lib/db/audit";

type Db = Pick<Prisma.TransactionClient, "task" | "document" | "auditEvent">;
type TxClient = Pick<Prisma.TransactionClient, "$queryRaw">;

export interface LinkedTaskChange {
  documentId: string;
  currentTaskId: string | null;
  nextTaskId: string | null;
}

/** Có đổi liên kết không (bỏ qua giá trị rỗng, coi "" như bỏ liên kết). */
export function normalizeLinkedTaskId(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

/**
 * Kiểm tra quyền khi gắn/đổi nhiệm vụ liên kết của văn bản (chặn liên kết tùy ý).
 * - Gắn nhiệm vụ mới: nhiệm vụ phải tồn tại và người thao tác phải đọc được nhiệm vụ đó
 *   theo chính sách đọc nhiệm vụ; nhiệm vụ chưa gắn với văn bản khác.
 * - Gỡ liên kết: chỉ cần quyền sửa văn bản (đã kiểm ở route).
 * Trả về thông tin nhiệm vụ để ghi nhật ký; `null` khi gỡ liên kết.
 */
export async function assertCanLinkTask(
  db: Db,
  authContext: AuthorizationContext,
  change: LinkedTaskChange,
): Promise<{ id: string; scope: string; leadUnitId: string | null } | null> {
  if (!change.nextTaskId) return null;

  const task = await db.task.findFirst({
    where: { id: change.nextTaskId },
    select: { id: true, scope: true, leadUnitId: true },
  });
  if (!task) {
    throw new NotFoundError("Nhiệm vụ liên kết không tồn tại", "LINKED_TASK_NOT_FOUND");
  }

  const readable = await db.task.findFirst({
    where: { AND: [{ id: task.id }, buildTaskReadWhere(authContext)] },
    select: { id: true },
  });
  if (!readable) {
    throw new ForbiddenError("Bạn không có quyền gắn nhiệm vụ này với văn bản", "LINKED_TASK_FORBIDDEN");
  }

  const other = await db.document.findFirst({
    where: { linkedTaskId: task.id, NOT: { id: change.documentId } },
    select: { id: true },
  });
  if (other) {
    throw new ConflictError("Nhiệm vụ này đã được liên kết với văn bản khác", "LINKED_TASK_ALREADY_LINKED");
  }

  return { id: task.id, scope: String(task.scope), leadUnitId: task.leadUnitId ?? null };
}

/** Ghi nhật ký bất biến mỗi khi liên kết nhiệm vụ của văn bản thay đổi. */
export async function recordLinkedTaskChange(
  db: Db,
  params: LinkedTaskChange & {
    actorId: string;
    requestId?: string | null;
    task: { id: string; scope: string; leadUnitId: string | null } | null;
  },
): Promise<void> {
  await logAuditEvent(db as never, {
    actorId: params.actorId,
    action: AuditAction.DOCUMENT_LINKED_TASK_CHANGED,
    entityType: AuditEntityType.DOCUMENT,
    entityId: params.documentId,
    requestId: params.requestId ?? null,
    beforeData: { linkedTaskId: params.currentTaskId },
    afterData: { linkedTaskId: params.nextTaskId },
    metadata: params.task ? { taskScope: params.task.scope, taskLeadUnitId: params.task.leadUnitId } : null,
  });
}

/**
 * Khóa dòng workflow đến (nếu có) rồi dòng văn bản trong transaction đang mở.
 * Thứ tự workflow -> văn bản trùng với `assignUnitWork` và `deleteTask` để không tạo vòng chờ khóa.
 * Phải đọc lại trạng thái văn bản SAU khi khóa, không dùng dữ liệu đọc trước transaction.
 */
export async function lockDocumentRows(tx: TxClient, documentId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM document_incoming_workflows WHERE document_id = ${documentId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM documents WHERE id = ${documentId} FOR UPDATE`;
}

/**
 * Chuyển lỗi ràng buộc DB khi ghi `Document.linkedTaskId` thành lỗi API rõ ràng:
 * - P2002 (UNIQUE): hai văn bản tranh cùng một nhiệm vụ -> 409.
 * - P2003 (FK): nhiệm vụ bị xóa giữa lúc kiểm tra và lúc ghi -> 404.
 */
export function toLinkedTaskConflict(error: unknown): unknown {
  if (error instanceof ApiError) return error;
  const e = error as { code?: string; meta?: { target?: unknown; field_name?: unknown } } | null;
  const detail = JSON.stringify(e?.meta ?? "");
  if (e?.code === "P2002" && detail.includes("linked_task_id")) {
    return new ConflictError("Nhiệm vụ này đã được liên kết với văn bản khác", "LINKED_TASK_ALREADY_LINKED");
  }
  if (e?.code === "P2003" && detail.includes("linked_task_id")) {
    return new NotFoundError("Nhiệm vụ liên kết không còn tồn tại", "LINKED_TASK_NOT_FOUND");
  }
  return error;
}
