/**
 * Kiểm quyền truy cập tệp theo tài nguyên sở hữu (tệp đính kèm văn bản, sản phẩm nhiệm vụ)
 * trước khi route stream tệp.
 */
import { FileScanStatus } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import type { AuthenticatedUser } from "@/server/api/request-context";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import { canReadDocument } from "@/server/policies/document-policy";
import { canReadDossierItem } from "@/server/policies/dossier-policy";
import { canViewMeeting } from "@/server/policies/meeting-policy";
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

/**
 * Tải tệp theo FileObject: tệp phải liên kết với ít nhất một tài nguyên người dùng được đọc (văn bản,
 * sản phẩm nhiệm vụ, hồ sơ, cuộc họp, nhiệm vụ trong metadata/mô tả) và đã quét sạch. Trả về bản ghi
 * (đã cập nhật trạng thái quét khi tự sửa ở môi trường dev) để route kiểm tệp trên đĩa rồi stream.
 */
export async function authorizeFileObjectDownload({
  authUser,
  fileObjectId,
  requestId,
}: {
  authUser: AuthenticatedUser;
  fileObjectId: string;
  requestId: string;
}) {
  const file = await prisma.fileObject.findUnique({
    where: { id: fileObjectId },
    include: {
      // Quyền đọc văn bản theo đơn vị cần đủ đơn vị xử lý (workflow, chỉ đạo, nhiệm vụ liên kết), nên nạp như route /api/files.
      attachments: {
        include: {
          document: {
            include: {
              directives: true,
              incomingWorkflow: { include: { unitAssignments: true } },
              linkedTask: { select: { leadUnitId: true } },
            },
          },
        },
      },
      deliverables: { include: { task: true } },
      dossierItems: { include: { dossier: true } },
      meetingMaterials: {
        include: {
          participants: { include: { user: true } },
          body: { include: { memberships: true } },
        },
      },
    },
  });
  if (!file || file.isArchived) throw new NotFoundError("Không tìm thấy tệp");

  // Ngữ cảnh phân quyền đầy đủ (chức danh, đơn vị, kiêm nhiệm) để trưởng đơn vị và lãnh đạo mở được tệp của văn bản
  // thuộc đơn vị mình; chỉ có `authUser` (id + vai trò) thì quy tắc theo đơn vị luôn từ chối. Giữ cổng cũ theo `authUser`
  // như route /api/files để không mất quyền của tài khoản chỉ có vai trò (vd. văn thư).
  const documentAuthContext = file.attachments.some((attachment) => attachment.document)
    ? await loadAuthorizationContext(authUser.id, new Date())
    : null;
  let hasAuthorizedResource = file.attachments.some(
    (attachment) =>
      attachment.document &&
      ((documentAuthContext && canReadDocument(documentAuthContext, attachment.document)) ||
        canReadDocument(authUser, attachment.document))
  );

  if (!hasAuthorizedResource && file.deliverables.length > 0) {
    const authorizationContext = await loadAuthorizationContext(authUser.id, new Date(), {
      useCache: true,
    });
    const taskReadWhere = buildTaskReadWhere(authorizationContext);
    const permitted = await prisma.taskDeliverable.findFirst({
      where: {
        fileObjectId: file.id,
        task: taskReadWhere,
      },
      select: { id: true },
    });
    hasAuthorizedResource = Boolean(permitted);
  }

  if (!hasAuthorizedResource) {
    // Hồ sơ đã hủy (xóa mềm) không cấp quyền đọc tệp qua mục của nó.
    hasAuthorizedResource = file.dossierItems.some(
      (item) => item.dossier && !item.dossier.disposedAt && canReadDossierItem(authUser, item, item.dossier)
    );
  }

  if (!hasAuthorizedResource) {
    hasAuthorizedResource = file.meetingMaterials.some((meeting) => canViewMeeting(authUser, meeting));
  }

  if (!hasAuthorizedResource) {
    const authorizationContext = await loadAuthorizationContext(authUser.id, new Date(), {
      useCache: true,
    });
    const taskReadWhere = buildTaskReadWhere(authorizationContext);

    const meta = (file.metadata as Record<string, unknown> | null) ?? null;
    const linkedTaskId = typeof meta?.taskId === "string" ? meta.taskId : null;

    if (linkedTaskId) {
      const permitted = await prisma.task.findFirst({
        where: {
          id: linkedTaskId,
          ...taskReadWhere,
        },
        select: { id: true },
      });
      hasAuthorizedResource = Boolean(permitted);
    }

    if (!hasAuthorizedResource) {
      // Ảnh nhúng lúc soạn nhiệm vụ mới (chưa có taskId để gắn metadata): chỉ tính nhiệm vụ do chính người tải tệp
      // lên tạo, để dán UUID tệp của người khác vào mô tả không tự cấp quyền tải tệp đó.
      const taskWithFile = await prisma.task.findFirst({
        where: {
          description: { contains: file.id },
          createdById: file.uploadedById,
          ...taskReadWhere,
        },
        select: { id: true },
      });
      hasAuthorizedResource = Boolean(taskWithFile);
    }
  }

  if (!hasAuthorizedResource) {
    logger.fileAccessDenied({
      requestId,
      userId: authUser.id,
      filePath: file.storageKey,
      fileName: file.originalName,
      reason: "FileObject is not linked to a resource readable by this user",
    });
    throw new ForbiddenError("Bạn không có quyền truy cập tệp này");
  }

  // Auto-heal pending scan status in development when no ClamAV scanner is configured
  if (
    file.scanStatus === FileScanStatus.PENDING &&
    !process.env.CLAMAV_HOST?.trim() &&
    (process.env.NODE_ENV === "development" || !process.env.NODE_ENV)
  ) {
    await prisma.fileObject.update({
      where: { id: file.id },
      data: { scanStatus: FileScanStatus.CLEAN },
    });
    file.scanStatus = FileScanStatus.CLEAN;
  }

  if (file.scanStatus !== FileScanStatus.CLEAN) {
    throw new ConflictError(
      "Tệp đang chờ kiểm tra an toàn và chưa thể tải xuống",
      file.scanStatus === FileScanStatus.INFECTED ? "FILE_QUARANTINED" : "FILE_SCAN_PENDING"
    );
  }

  return file;
}

/**
 * Tải theo đường dẫn cũ `/api/files/...`: mọi tài nguyên khớp đường dẫn (tệp đính kèm văn bản, sản phẩm
 * nhiệm vụ, mục hồ sơ, tài liệu cuộc họp) đều phải đọc được, kiểm lần lượt; không khớp tài nguyên nào thì
 * từ chối mặc định (404). Trả id FileObject chính thức khi tệp đã được kiểm kê và có liên kết, để route
 * chuyển hướng; null thì route stream tệp trực tiếp. Route đã kiểm định dạng và đường dẫn an toàn trước khi gọi.
 */
export async function authorizeLegacyFilePathDownload({
  authUser,
  requestId,
  relativePath,
  fileName,
  candidateUrls,
  normalizedRelative,
}: {
  authUser: AuthenticatedUser;
  requestId: string;
  relativePath: string;
  fileName: string;
  candidateUrls: string[];
  normalizedRelative: string;
}): Promise<{ canonicalFileObjectId: string | null }> {
  // Object-level authorization check: DocumentAttachment
  const attachment = await prisma.documentAttachment.findFirst({
    where: {
      fileUrl: { in: candidateUrls },
    },
    include: {
      document: {
        include: {
          directives: true,
          incomingWorkflow: {
            include: {
              unitAssignments: true,
            },
          },
          linkedTask: { select: { leadUnitId: true } },
        },
      },
    },
  });

  if (attachment) {
    // Ngữ cảnh phân quyền đầy đủ (mọi phân công đang hiệu lực, kể cả kiêm nhiệm), nạp mới (không cache)
    // để phân công vừa hết hạn không còn cấp quyền tải tệp. Giữ thêm cổng cũ theo `authUser` để không làm
    // mất quyền của tài khoản chỉ có vai trò (ví dụ văn thư chưa có phân công chức danh).
    const docAuthCtx = await loadAuthorizationContext(authUser.id, new Date());
    const canReadAttachment =
      Boolean(attachment.document) &&
      (canReadDocument(docAuthCtx, attachment.document) || canReadDocument(authUser, attachment.document));
    if (!canReadAttachment) {
      logger.fileAccessDenied({
        requestId,
        userId: authUser.id,
        filePath: relativePath,
        fileName,
        resourceType: "DocumentAttachment",
        resourceId: attachment.documentId,
        reason: "User lacks permission to read associated document",
      });
      throw new ForbiddenError(
        "Bạn không có quyền truy cập tệp đính kèm của văn bản này"
      );
    }
  }

  // Object-level authorization check: TaskDeliverable
  const deliverable = await prisma.taskDeliverable.findFirst({
    where: {
      fileUrl: { in: candidateUrls },
    },
  });

  if (deliverable) {
    // P1: Canonical authorization via buildTaskReadWhere (replaces legacy canReadTask)
    const authCtx = await loadAuthorizationContext(authUser.id, new Date(), { useCache: true });
    const taskAuthWhere = buildTaskReadWhere(authCtx);
    const authorizedDeliverable = await prisma.taskDeliverable.findFirst({
      where: {
        id: deliverable.id,
        task: taskAuthWhere,
      },
    });
    if (!authorizedDeliverable) {
      logger.fileAccessDenied({
        requestId,
        userId: authUser.id,
        filePath: relativePath,
        fileName,
        resourceType: "TaskDeliverable",
        resourceId: deliverable.taskId,
        reason: "User lacks permission to read associated task",
      });
      throw new ForbiddenError(
        "Bạn không có quyền truy cập tệp đính kèm của nhiệm vụ này"
      );
    }
  }

  // Object-level authorization check: WorkDossierItem
  const dossierItem = await prisma.dossierItem.findFirst({
    where: {
      OR: [
        { itemId: { in: candidateUrls } },
        { notes: { in: candidateUrls } },
      ],
    },
    include: {
      dossier: {
        include: {
          items: true,
        },
      },
    },
  });

  if (dossierItem) {
    // Hồ sơ đã hủy (xóa mềm) không cấp quyền đọc tệp qua mục của nó.
    if (
      !dossierItem.dossier ||
      dossierItem.dossier.disposedAt ||
      !canReadDossierItem(authUser, dossierItem, dossierItem.dossier)
    ) {
      logger.fileAccessDenied({
        requestId,
        userId: authUser.id,
        filePath: relativePath,
        fileName,
        resourceType: "DossierItem",
        resourceId: dossierItem.dossierId,
        reason: "User lacks permission to read associated work dossier item",
      });
      throw new ForbiddenError(
        "Bạn không có quyền truy cập tệp đính kèm của hồ sơ công việc này"
      );
    }
  }

  // Object-level authorization check: Meeting
  const meeting = await prisma.meeting.findFirst({
    where: {
      OR: [
        { materialsUrl: { in: candidateUrls } },
      ],
    },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
      body: {
        include: {
          memberships: true,
        },
      },
    },
  });

  if (meeting) {
    if (!canViewMeeting(authUser, meeting)) {
      logger.fileAccessDenied({
        requestId,
        userId: authUser.id,
        filePath: relativePath,
        fileName,
        resourceType: "Meeting",
        resourceId: meeting.id,
        reason: "User lacks permission to view associated meeting",
      });
      throw new ForbiddenError(
        "Bạn không có quyền truy cập tài liệu của cuộc họp này"
      );
    }
  }

  // Default Deny: Unregistered/orphan files cannot be downloaded (F07)
  if (!attachment && !deliverable && !dossierItem && !meeting) {
    logger.fileAccessDenied({
      requestId,
      userId: authUser.id,
      filePath: relativePath,
      fileName,
      reason: "Unregistered or orphan file not associated with any authorized resource",
    });
    throw new NotFoundError(
      "Không tìm thấy tệp hoặc tệp không thuộc tài nguyên được cấp quyền"
    );
  }

  const canonicalFile = await prisma.fileObject.findUnique({
    where: { storageKey: normalizedRelative },
    select: {
      id: true,
      scanStatus: true,
      attachments: { select: { id: true } },
      deliverables: { select: { id: true } },
      dossierItems: { select: { id: true } },
      meetingMaterials: { select: { id: true } },
    },
  });
  if (
    canonicalFile &&
    (canonicalFile.attachments.length > 0 || canonicalFile.deliverables.length > 0 ||
      canonicalFile.dossierItems.length > 0 || canonicalFile.meetingMaterials.length > 0)
  ) {
    if (canonicalFile.scanStatus !== "CLEAN") {
      throw new ForbiddenError("Tệp đang bị cách ly hoặc chờ kiểm tra an toàn");
    }
    return { canonicalFileObjectId: canonicalFile.id };
  }

  return { canonicalFileObjectId: null };
}
