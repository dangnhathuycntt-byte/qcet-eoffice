import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import {
  resolveSafeFilePath,
  openByteRangeStream,
  isAllowedFileExtension,
  sanitizeDownloadFilename,
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
import { canReadDossier } from "@/server/policies/dossier-policy";
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
          },
        },
      },
    });

    if (attachment) {
      if (!attachment.document || !canReadDocument(authUser, attachment.document)) {
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
          { itemId: { contains: normalizedRelative } },
          { notes: { contains: normalizedRelative } },
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
      if (!dossierItem.dossier || !canReadDossier(authUser, dossierItem.dossier)) {
        logger.fileAccessDenied({
          requestId,
          userId: authUser.id,
          filePath: relativePath,
          fileName,
          resourceType: "DossierItem",
          resourceId: dossierItem.dossierId,
          reason: "User lacks permission to read associated work dossier",
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
          { materialsUrl: { contains: normalizedRelative } },
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
      const safeDownloadName = sanitizeDownloadFilename(fileName);
      headers.set("Content-Disposition", `inline; filename="${safeDownloadName}"`);
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
