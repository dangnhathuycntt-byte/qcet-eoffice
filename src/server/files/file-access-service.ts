/**
 * Kiểm quyền truy cập tệp theo tài nguyên sở hữu (tệp đính kèm văn bản, sản phẩm nhiệm vụ)
 * trước khi route stream tệp.
 */
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/server/api/request-context";
import { ForbiddenError, NotFoundError } from "@/server/api/errors";
import { canReadDocument } from "@/server/policies/document-policy";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskReadWhere } from "@/server/tasks/task-query-service";
import { logger } from "@/server/observability/logger";

/** Tệp đính kèm văn bản (kèm văn bản) mà người dùng được đọc; 404 khi không có, 403 khi không có quyền. */
export async function getReadableAttachmentForDownload(authUser: AuthenticatedUser, attachmentId: string) {
  const attachment = await prisma.documentAttachment.findUnique({
    where: { id: attachmentId },
    include: { document: true },
  });

  if (!attachment) {
    throw new NotFoundError("Không tìm thấy tệp đính kèm");
  }

  if (!canReadDocument(authUser, attachment.document)) {
    throw new ForbiddenError(
      "Bạn không có quyền truy cập tệp đính kèm của văn bản này"
    );
  }

  return attachment;
}

/**
 * Tải theo đường dẫn tệp: tệp phải thuộc tệp đính kèm văn bản hoặc sản phẩm nhiệm vụ mà người dùng
 * được đọc; tệp không thuộc tài nguyên nào bị từ chối mặc định (404). Route đã kiểm định dạng và
 * đường dẫn an toàn trước khi gọi.
 */
export async function assertFilePathDownloadAllowed(
  authUser: AuthenticatedUser,
  filePathParam: string,
  fileName: string,
  requestId: string
): Promise<void> {
  // Object-level permission check: DocumentAttachment
  const matchingAttachment = await prisma.documentAttachment.findFirst({
    where: {
      fileUrl: { in: [
        filePathParam!,
        `/${filePathParam}`,
        `/uploads/${filePathParam}`,
        `uploads/${filePathParam}`,
        `/api/files/${filePathParam}`,
        `api/files/${filePathParam}`,
      ] },
    },
    include: { document: true },
  });

  if (matchingAttachment?.document) {
    if (!canReadDocument(authUser, matchingAttachment.document)) {
      throw new ForbiddenError(
        "Bạn không có quyền truy cập tệp đính kèm của văn bản này"
      );
    }
  }

  // Object-level permission check: TaskDeliverable
  const matchingDeliverable = await prisma.taskDeliverable.findFirst({
    where: {
      fileUrl: { in: [
        filePathParam!,
        `/${filePathParam}`,
        `/uploads/${filePathParam}`,
        `uploads/${filePathParam}`,
        `/api/files/${filePathParam}`,
        `api/files/${filePathParam}`,
      ] },
    },
    include: {
      task: {
        include: { actors: true },
      },
    },
  });

  if (matchingDeliverable?.task) {
    // P1: Canonical authorization via buildTaskReadWhere (replaces legacy canReadTask)
    const authCtx = await loadAuthorizationContext(authUser.id, new Date(), { useCache: true });
    const taskAuthWhere = buildTaskReadWhere(authCtx);
    const authorizedDeliverable = await prisma.taskDeliverable.findFirst({
      where: {
        id: matchingDeliverable.id,
        task: taskAuthWhere,
      },
    });
    if (!authorizedDeliverable) {
      throw new ForbiddenError("Bạn không có quyền truy cập tệp của nhiệm vụ này");
    }
  }

  // P0-1: Default deny (F07) — file không thuộc resource được cấp quyền
  if (!matchingAttachment && !matchingDeliverable) {
    logger.fileAccessDenied({
      requestId,
      userId: authUser.id,
      filePath: filePathParam!,
      fileName,
      reason: "Unregistered orphan file not associated with any authorized resource",
    });
    throw new NotFoundError(
      "Không tìm thấy tệp hoặc tệp không thuộc tài nguyên được cấp quyền"
    );
  }
}
