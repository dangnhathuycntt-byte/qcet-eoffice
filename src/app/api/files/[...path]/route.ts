import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import {
  resolveSafeFilePath,
  openByteRangeStream,
  isAllowedFileExtension,
  buildContentDisposition,
} from "@/lib/storage";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError } from "@/server/api/response";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/api/errors";
import { prisma } from "@/lib/prisma";
import { canReadDocument } from "@/server/policies/document-policy";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskReadWhere } from "@/server/tasks/task-query-service";
import { canReadDossier, canReadDossierItem } from "@/server/policies/dossier-policy";
import { canViewMeeting } from "@/server/policies/meeting-policy";
import { logger } from "@/server/observability/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);
    await assertRateLimit(authUser.id, "FILE_DOWNLOAD");

    const resolvedParams = await Promise.resolve(params);
    const pathSegments = resolvedParams?.path;

    if (!pathSegments || pathSegments.length === 0) {
      throw new NotFoundError("Tệp không tồn tại");
    }

    const relativePath = path.join(...pathSegments);
    const fileName = path.basename(relativePath);

    if (!isAllowedFileExtension(fileName)) {
      logger.fileAccessDenied({
        requestId,
        userId: authUser.id,
        filePath: relativePath,
        fileName,
        reason: "Disallowed file extension",
      });
      throw new ForbiddenError("Loại tệp không được phép truy cập");
    }

    // Resolves against UPLOADS_DIR and guards against traversal
    const safeResolvedPath = resolveSafeFilePath(relativePath);

    // Normalize candidate path strings
    const normalizedRelative = relativePath.replace(/^\/+/, "");
    const normalizedUploads = `/uploads/${normalizedRelative}`;
    const candidateUrls = [
      relativePath,
      `/${normalizedRelative}`,
      normalizedUploads,
      `uploads/${normalizedRelative}`,
      `/api/files/${normalizedRelative}`,
      `api/files/${normalizedRelative}`,
    ];

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
      if (!dossierItem.dossier || !canReadDossierItem(authUser, dossierItem, dossierItem.dossier)) {
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
      return NextResponse.redirect(new URL(`/api/file-objects/${canonicalFile.id}`, req.url));
    }

    if (!fs.existsSync(safeResolvedPath)) {
      throw new NotFoundError("Không tìm thấy tệp yêu cầu");
    }

    const stat = await fs.promises.stat(safeResolvedPath);
    if (!stat.isFile()) {
      throw new ValidationError("Đường dẫn không phải là tệp hợp lệ");
    }

    const rangeHeader = req.headers.get("range");
    const streamResult = await openByteRangeStream(safeResolvedPath, rangeHeader);

    const headers = new Headers(streamResult.headers);
    headers.set("x-request-id", requestId);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");

    if (streamResult.status === 200) {
      headers.set("Content-Disposition", buildContentDisposition("inline", fileName));
    }

    return new NextResponse(
      (streamResult.stream as unknown as BodyInit) ?? null,
      {
        status: streamResult.status,
        headers,
      }
    );
  } catch (error) {
    return apiError(error, requestId);
  }
}
