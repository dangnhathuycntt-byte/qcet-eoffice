import { FileScanStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import {
  openByteRangeStream,
  resolveSafeFilePath,
  sanitizeDownloadFilename,
  SECURE_FILE_HEADERS,
} from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/server/api/response";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "@/server/api/errors";
import { canReadDocument } from "@/server/policies/document-policy";
import { canReadDossierItem } from "@/server/policies/dossier-policy";
import { canViewMeeting } from "@/server/policies/meeting-policy";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { buildTaskReadWhere } from "@/server/tasks/task-query-service";
import { logger } from "@/server/observability/logger";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;
    const authUser = requireAuthenticated(context);
    await assertRateLimit(authUser.id, "FILE_DOWNLOAD");

    const { id } = await params;
    if (!UUID_PATTERN.test(id)) throw new ValidationError("Mã tệp không hợp lệ");

    const file = await prisma.fileObject.findUnique({
      where: { id },
      include: {
        attachments: { include: { document: true } },
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

    let hasAuthorizedResource = file.attachments.some(
      (attachment) => attachment.document && canReadDocument(authUser, attachment.document)
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
      hasAuthorizedResource = file.dossierItems.some(
        (item) => item.dossier && canReadDossierItem(authUser, item, item.dossier)
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
        const taskWithFile = await prisma.task.findFirst({
          where: {
            description: { contains: file.id },
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

    const safePath = resolveSafeFilePath(file.storageKey);
    if (!fs.existsSync(safePath)) throw new NotFoundError("Không tìm thấy tệp yêu cầu");
    const [realPath, uploadsRoot] = await Promise.all([
      fs.promises.realpath(safePath),
      fs.promises.realpath(path.resolve(process.env.UPLOADS_DIR || "./uploads")),
    ]);
    if (!realPath.startsWith(`${uploadsRoot}${path.sep}`)) {
      throw new ForbiddenError("Đường dẫn lưu tệp không hợp lệ");
    }
    const stat = await fs.promises.stat(realPath);
    if (!stat.isFile()) throw new ValidationError("Đường dẫn không phải là tệp hợp lệ");
    if (BigInt(stat.size) !== file.byteSize) {
      throw new ConflictError("Kích thước tệp không khớp dữ liệu kiểm kê", "FILE_SIZE_MISMATCH");
    }

    const streamResult = await openByteRangeStream(realPath, req.headers.get("range"));
    const headers = new Headers(streamResult.headers);
    for (const [name, value] of Object.entries(SECURE_FILE_HEADERS)) headers.set(name, value);
    headers.set("x-request-id", requestId);
    headers.set("Content-Type", file.mimeType);
    headers.set("Content-Disposition", `inline; filename="${sanitizeDownloadFilename(file.originalName)}"`);

    return new NextResponse((streamResult.stream as unknown as BodyInit) ?? null, {
      status: streamResult.status,
      headers,
    });
  } catch (error) {
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}
