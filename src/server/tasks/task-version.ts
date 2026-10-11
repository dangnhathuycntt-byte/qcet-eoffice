import type { Prisma } from "@prisma/client";
import { PreconditionFailedError } from "@/server/api/errors";

/**
 * Khóa lạc quan trên nhiệm vụ: tăng `version` khi còn đúng phiên bản client gửi và chưa lưu trữ,
 * nếu không thì báo 412. Gọi trong transaction trước khi ghi các bảng con của nhiệm vụ.
 */
export async function bumpTaskVersion(
  tx: Prisma.TransactionClient,
  taskId: string,
  expectedVersion: number,
  options: { data?: Prisma.TaskUpdateManyMutationInput; where?: Prisma.TaskWhereInput } = {}
): Promise<void> {
  const bumped = await tx.task.updateMany({
    where: { id: taskId, version: expectedVersion, archivedAt: null, ...options.where },
    data: { ...options.data, version: { increment: 1 } },
  });
  if (bumped.count !== 1) {
    throw new PreconditionFailedError(`Task aggregate version conflict: expected version ${expectedVersion}`);
  }
}
