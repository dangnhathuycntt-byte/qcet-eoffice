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
import { canReadDocument, isAdmin } from "@/server/policies/document-policy";
import { canReadTask } from "@/server/policies/task-policy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);
    assertRateLimit(authUser.id, "FILE_DOWNLOAD");

    const resolvedParams = await Promise.resolve(params);
    const pathSegments = resolvedParams?.path;

    if (!pathSegments || pathSegments.length === 0) {
      throw new NotFoundError("Tệp không tồn tại");
    }

    const relativePath = path.join(...pathSegments);
    const fileName = path.basename(relativePath);

    if (!isAllowedFileExtension(fileName)) {
      throw new ForbiddenError("Loại tệp không được phép truy c���p");
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
    ];

    // Object-level authorization check: DocumentAttachment
    const attachment = await prisma.documentAttachment.findFirst({
      where: {
        fileUrl: { in: candidateUrls },
      },
      include: {
        document: true,
      },
    });

    if (attachment) {
      if (!attachment.document || !canReadDocument(authUser, attachment.document)) {
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
      include: {
        task: {
          include: {
            assignees: true,
          },
        },
      },
    });

    if (deliverable) {
      if (!deliverable.task || !canReadTask(authUser, deliverable.task)) {
        throw new ForbiddenError(
          "Bạn không có quyền truy cập tệp đính kèm của nhiệm vụ này"
        );
      }
    }

    // Default Deny: Unregistered/orphan files cannot be downloaded (F07)
    if (!attachment && !deliverable) {
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
