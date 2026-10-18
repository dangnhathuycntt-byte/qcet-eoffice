import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import {
  resolveSafeFilePath,
  isAllowedFileExtension,
} from "@/server/files/storage";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError } from "@/server/api/response";
import { streamLocalFile } from "@/server/api/file-response";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  ForbiddenError,
  NotFoundError,
} from "@/server/api/errors";
import { authorizeLegacyFilePathDownload } from "@/server/files/file-access-service";
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

    const { canonicalFileObjectId } = await authorizeLegacyFilePathDownload({
      authUser,
      requestId,
      relativePath,
      fileName,
      candidateUrls,
      normalizedRelative,
    });
    if (canonicalFileObjectId !== null) {
      return NextResponse.redirect(new URL(`/api/file-objects/${canonicalFileObjectId}`, req.url));
    }

    return streamLocalFile(req, safeResolvedPath, requestId, { type: "inline", filename: fileName });
  } catch (error) {
    return apiError(error, requestId);
  }
}
