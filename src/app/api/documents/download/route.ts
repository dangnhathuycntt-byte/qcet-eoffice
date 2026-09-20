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
import { logger } from "@/server/observability/logger";

export async function GET(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);
    assertRateLimit(authUser.id, "FILE_DOWNLOAD");

    const attachmentId =
      req.nextUrl.searchParams.get("attachmentId") ||
      req.nextUrl.searchParams.get("id");
    const filePathParam = req.nextUrl.searchParams.get("file");

    if (!attachmentId && !filePathParam) {
      throw new ValidationError("Thiếu tham số tải tệp (cần attachmentId hoặc file)");
    }

    let safeResolvedPath: string;
    let downloadName: string;

    if (attachmentId) {
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

      let fileRelPath = attachment.fileUrl;
      if (fileRelPath.startsWith("http://") || fileRelPath.startsWith("https://")) {
        return NextResponse.redirect(fileRelPath);
      }

      if (fileRelPath.startsWith("/api/files/")) {
        fileRelPath = fileRelPath.slice("/api/files/".length);
      } else if (fileRelPath.startsWith("/uploads/")) {
        fileRelPath = fileRelPath.slice("/uploads/".length);
      } else if (fileRelPath.startsWith("/")) {
        fileRelPath = fileRelPath.slice(1);
      }

      safeResolvedPath = resolveSafeFilePath(fileRelPath);
      downloadName =
        req.nextUrl.searchParams.get("name") ||
        attachment.fileName ||
        path.basename(safeResolvedPath);
    } else {
      // filePathParam mode
      if (!isAllowedFileExtension(filePathParam!)) {
        throw new ForbiddenError("Loại tệp không được phép tải xuống");
      }

      safeResolvedPath = resolveSafeFilePath(filePathParam!);
      const fileName = path.basename(safeResolvedPath);

      // Object-level permission check: DocumentAttachment
      const matchingAttachment = await prisma.documentAttachment.findFirst({
        where: {
          OR: [
            { fileUrl: { contains: filePathParam! } },
            { fileUrl: { contains: fileName } },
            { fileName: fileName },
          ],
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
          OR: [
            { fileUrl: { contains: filePathParam! } },
            { fileUrl: { contains: fileName } },
          ],
        },
        include: {
          task: {
            include: { assignees: true },
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

      downloadName = req.nextUrl.searchParams.get("name") || fileName;
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

    const safeDownloadName = sanitizeDownloadFilename(downloadName);
    const headers = new Headers(streamResult.headers);
    headers.set("x-request-id", requestId);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");

    if (streamResult.status === 200) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${safeDownloadName}"`
      );
    }

    return new NextResponse(
      (streamResult.stream as unknown as BodyInit) ?? null,
      {
        status: streamResult.status,
        headers,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
