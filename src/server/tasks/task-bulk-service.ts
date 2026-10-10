/**
 * Đổi hàng loạt nhiệm vụ (T-08, spec task-document-gap-spec.md).
 *
 * Đợt đầu chỉ đổi ưu tiên (quyết định Q6). Hạn cần người giao đồng ý (T-01), đơn vị liên quan
 * đến chuyển giao trách nhiệm (T-12), còn trạng thái chỉ đổi bằng nút hành động (T3Menu).
 *
 * Mỗi dòng được kiểm quyền và kiểm phiên bản riêng, chạy trong transaction riêng: một dòng lỗi
 * không làm hỏng các dòng khác. Kết quả trả về từng dòng. Idempotency do route bảo đảm.
 */
import { z } from "zod";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import type { SessionPayload } from "@/lib/jwt-session";
import { ApiError } from "@/server/api/errors";
import { can, loadTaskWithActors } from "./authorize-on-task";

export const MAX_BULK_ITEMS = 200;

export const BulkUpdatePrioritySchema = z
  .object({
    items: z
      .array(z.object({ id: z.string().trim().min(1), expectedVersion: z.number().int().min(0) }).strict())
      .min(1, "Chọn ít nhất một nhiệm vụ")
      .max(MAX_BULK_ITEMS, `Tối đa ${MAX_BULK_ITEMS} nhiệm vụ mỗi lần`),
    priority: z.nativeEnum(TaskPriority),
  })
  .strict()
  .refine((input) => new Set(input.items.map((i) => i.id)).size === input.items.length, {
    message: "Danh sách nhiệm vụ có mã trùng nhau",
    path: ["items"],
  });

export type BulkUpdatePriorityInput = z.infer<typeof BulkUpdatePrioritySchema>;

export interface BulkRowResult {
  id: string;
  ok: boolean;
  /** Ưu tiên đã được đổi (false khi vốn đã là giá trị đó). */
  changed?: boolean;
  version?: number;
  code?: string;
  message?: string;
}

export interface BulkUpdateResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkRowResult[];
}

function failure(id: string, code: string, message: string): BulkRowResult {
  return { id, ok: false, code, message };
}

async function updateOne(
  session: SessionPayload,
  item: { id: string; expectedVersion: number },
  priority: TaskPriority
): Promise<BulkRowResult> {
  let task;
  try {
    task = await loadTaskWithActors(item.id);
  } catch {
    return failure(item.id, "NOT_FOUND", "Không tìm thấy nhiệm vụ");
  }

  const decision = await can(session, "task.update_metadata", task);
  if (!decision.allowed) {
    return failure(item.id, "FORBIDDEN", decision.reason || "Bạn không có quyền sửa nhiệm vụ này");
  }
  if (task.archivedAt || task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
    return failure(item.id, "TASK_CLOSED", "Nhiệm vụ đã kết thúc hoặc đã lưu trữ");
  }
  if (task.version !== item.expectedVersion) {
    return failure(item.id, "VERSION_CONFLICT", "Nhiệm vụ vừa được người khác thay đổi. Tải lại để xem bản mới");
  }
  if (task.priority === priority) {
    return { id: item.id, ok: true, changed: false, version: task.version };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.task.updateMany({
        where: { id: item.id, version: item.expectedVersion, archivedAt: null },
        data: { priority, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ApiError(412, "VERSION_CONFLICT", "Nhiệm vụ vừa được người khác thay đổi");
      await auditService.logEvent(tx, {
        actorId: session.id,
        action: AuditAction.TASK_UPDATED,
        entityType: AuditEntityType.TASK,
        entityId: item.id,
        beforeData: { priority: task.priority },
        afterData: { priority },
        metadata: { bulk: true },
      });
    });
  } catch (error) {
    if (error instanceof ApiError) return failure(item.id, error.code, error.message);
    throw error;
  }
  return { id: item.id, ok: true, changed: true, version: item.expectedVersion + 1 };
}

export async function bulkUpdateTaskPriority(
  session: SessionPayload,
  input: BulkUpdatePriorityInput
): Promise<BulkUpdateResult> {
  const validated = BulkUpdatePrioritySchema.parse(input);
  const results: BulkRowResult[] = [];
  for (const item of validated.items) {
    results.push(await updateOne(session, item, validated.priority));
  }
  const succeeded = results.filter((r) => r.ok).length;
  return { total: results.length, succeeded, failed: results.length - succeeded, results };
}
