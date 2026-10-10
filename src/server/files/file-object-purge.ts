/**
 * Xóa tệp vật lý của FileObject qua outbox (V-07, spec task-document-gap-spec.md).
 *
 * Giao dịch nghiệp vụ (vd. xóa hẳn hồ sơ) chỉ ghi sự kiện `FILE_OBJECT_PURGE_REQUESTED`; I/O đĩa chạy ở
 * handler, ngoài giao dịch. Handler idempotent, chia ba bước để chạy lại ở bước nào cũng an toàn:
 *  1. Khóa dòng, đếm tham chiếu thật. Còn tham chiếu thì bỏ qua. Không còn thì gắn `isArchived`: tệp biến
 *     khỏi mọi đường đọc, không được dedup tái dùng, và dòng vẫn giữ `storageKey` nên không bản tải lên nào
 *     ghi đè được cùng đường dẫn trong lúc xóa.
 *  2. Xóa tệp trên đĩa (`force`: đã mất thì coi như xong). Lỗi khác ném ra để outbox thử lại.
 *  3. Khóa lại, đếm lại, xóa dòng FileObject và ghi nhật ký.
 *
 * `referenceCount` chỉ tăng khi dedup và không giảm ở đâu nên không dùng được; tham chiếu được đếm theo
 * đúng các nguồn mà `GET /api/file-objects/{id}` dùng để cấp quyền tải tệp.
 */
import { Prisma, StorageProvider, type FileObject } from "@prisma/client";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import {
  publishOutboxEvent,
  OutboxAggregateType,
  OutboxEventType,
  type DbClient,
  type OutboxHandlerMap,
} from "@/lib/db/outbox";
import { resolveSafeFilePath } from "@/lib/storage";

export type FileObjectPurgeOutcome = "deleted" | "missing" | "referenced" | "unsupported_provider";

export interface FileObjectPurgeRequest {
  fileObjectId: string;
  requestedById: string | null;
  reason: string;
  dossierId?: string;
}

/** Ghi yêu cầu xóa tệp vào outbox, gọi bên trong giao dịch nghiệp vụ. Mỗi tệp một sự kiện. */
export async function requestFileObjectPurges(
  tx: DbClient,
  fileObjectIds: Iterable<string>,
  meta: Omit<FileObjectPurgeRequest, "fileObjectId">
) {
  const ids = [...new Set(fileObjectIds)].filter(Boolean);
  for (const fileObjectId of ids) {
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.FILE_OBJECT_PURGE_REQUESTED,
      aggregateType: OutboxAggregateType.FILE_OBJECT,
      aggregateId: fileObjectId,
      payload: { fileObjectId, ...meta },
    });
  }
  return ids;
}

/** Số bản ghi còn dùng tệp này. Lớn hơn 0 thì không được xóa. */
export async function countFileObjectReferences(db: DbClient, file: Pick<FileObject, "id" | "metadata">): Promise<number> {
  const id = file.id;
  const byFkOrUrl = { OR: [{ fileObjectId: id }, { fileUrl: { contains: id } }] };
  const counts = [
    await db.documentAttachment.count({ where: byFkOrUrl }),
    await db.taskDeliverable.count({ where: byFkOrUrl }),
    await db.dossierItem.count({ where: { fileObjectId: id } }),
    await db.meeting.count({ where: { materialsFileObjectId: id } }),
    await db.task.count({ where: { description: { contains: id } } }),
    await db.taskComment.count({ where: { body: { contains: id } } }),
  ];
  const meta = file.metadata && typeof file.metadata === "object" && !Array.isArray(file.metadata)
    ? (file.metadata as Record<string, unknown>)
    : null;
  if (typeof meta?.taskId === "string" && meta.taskId) {
    counts.push(await db.task.count({ where: { id: meta.taskId } }));
  }
  return counts.reduce((sum, n) => sum + n, 0);
}

async function lockFileObject(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM file_objects WHERE id = ${id} FOR UPDATE`;
  return tx.fileObject.findUnique({ where: { id } });
}

function withMetadata(metadata: Prisma.JsonValue | null, patch: Record<string, unknown>): Prisma.InputJsonValue {
  const base = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

/** Xóa một tệp nếu không còn ai dùng. Gọi lại bao nhiêu lần cũng cho cùng kết quả. */
export async function purgeFileObject(request: FileObjectPurgeRequest, now = new Date()): Promise<FileObjectPurgeOutcome> {
  const { fileObjectId, requestedById, reason, dossierId } = request;
  const auditBase = { actorId: requestedById, entityType: AuditEntityType.FILE_OBJECT, entityId: fileObjectId };

  // Bước 1: kiểm tham chiếu và gắn cờ chờ xóa.
  const staged = await prisma.$transaction(async (tx) => {
    const file = await lockFileObject(tx, fileObjectId);
    if (!file) return { outcome: "missing" as const };
    const refs = await countFileObjectReferences(tx, file);
    const skip = async (outcome: "referenced" | "unsupported_provider") => {
      if (file.isArchived) {
        // Lần chạy trước đã gắn cờ nhưng nay có tham chiếu mới: trả tệp về trạng thái dùng được.
        await tx.fileObject.update({ where: { id: file.id }, data: { isArchived: false, metadata: withMetadata(file.metadata, { purgePending: null }) } });
      }
      await auditService.logEvent(tx, {
        ...auditBase,
        action: AuditAction.FILE_OBJECT_PURGE_SKIPPED,
        beforeData: null,
        afterData: { outcome, references: refs, storageProvider: file.storageProvider },
        metadata: { reason, dossierId: dossierId ?? null },
      });
      return { outcome } as const;
    };
    if (refs > 0) return skip("referenced");
    if (file.storageProvider !== StorageProvider.LOCAL_DISK) return skip("unsupported_provider");
    if (!file.isArchived) {
      await tx.fileObject.update({
        where: { id: file.id },
        data: { isArchived: true, metadata: withMetadata(file.metadata, { purgePending: { reason, dossierId: dossierId ?? null, at: now.toISOString() } }) },
      });
    }
    return { outcome: "staged" as const, storageKey: file.storageKey };
  });
  if (staged.outcome !== "staged") return staged.outcome;

  // Bước 2: xóa trên đĩa, ngoài giao dịch.
  await fs.rm(resolveSafeFilePath(staged.storageKey), { force: true });

  // Bước 3: xóa dòng và ghi nhật ký.
  return prisma.$transaction(async (tx) => {
    const file = await lockFileObject(tx, fileObjectId);
    if (!file) return "missing";
    const refs = await countFileObjectReferences(tx, file);
    if (refs > 0) {
      // Có bản ghi trỏ tới tệp trong lúc xóa (đường gắn tệp theo mã không kiểm `isArchived`). Tệp đã mất,
      // giữ dòng ở trạng thái ẩn để đường tải trả 404 thay vì lỗi đọc đĩa, và ghi lại để xử lý tay.
      await auditService.logEvent(tx, {
        ...auditBase,
        action: AuditAction.FILE_OBJECT_PURGE_SKIPPED,
        beforeData: null,
        afterData: { outcome: "referenced_after_delete", references: refs, storageKey: file.storageKey },
        metadata: { reason, dossierId: dossierId ?? null },
      });
      return "referenced";
    }
    await tx.fileObject.delete({ where: { id: file.id } });
    await auditService.logEvent(tx, {
      ...auditBase,
      action: AuditAction.FILE_OBJECT_PURGED,
      beforeData: {
        storageKey: file.storageKey,
        originalName: file.originalName,
        contentHash: file.contentHash,
        byteSize: file.byteSize.toString(),
      },
      afterData: null,
      metadata: { reason, dossierId: dossierId ?? null },
    });
    return "deleted";
  });
}

function payloadOf(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export const FILE_PURGE_HANDLERS: OutboxHandlerMap = {
  [OutboxEventType.FILE_OBJECT_PURGE_REQUESTED]: async (event, context) => {
    const p = payloadOf(event.payload);
    const fileObjectId = typeof p.fileObjectId === "string" && p.fileObjectId ? p.fileObjectId : event.aggregateId;
    return purgeFileObject(
      {
        fileObjectId,
        requestedById: typeof p.requestedById === "string" ? p.requestedById : null,
        reason: typeof p.reason === "string" ? p.reason : "unspecified",
        dossierId: typeof p.dossierId === "string" ? p.dossierId : undefined,
      },
      context?.now
    );
  },
};
