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
  ValidationError,
} from "@/server/api/errors";
import {
  assertFilePathDownloadAllowed,
  getReadableAttachmentForDownload,
} from "@/server/files/file-access-service";

export async function GET(req: NextRequest) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    const authUser = requireAuthenticated(context);
    await assertRateLimit(authUser.id, "FILE_DOWNLOAD");

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
      // 404 khi không có tệp đính kèm, 403 khi không đọc được văn bản
      const attachment = await getReadableAttachmentForDownload(authUser, attachmentId);

      if (attachment.fileObjectId) {
        // Đường dẫn tương đối: qua rewrite của web req.url là địa chỉ nội bộ của api, proxy không sửa Location tuyệt đối
        return new NextResponse(null, { status: 307, headers: { Location: `/api/file-objects/${attachment.fileObjectId}` } });
      }

      let fileRelPath = attachment.fileUrl;
      if (/^[a-z][a-z0-9+.-]*:/i.test(fileRelPath) || fileRelPath.startsWith("//")) {
        // Liên kết ngoài không được chuyển hướng qua hệ thống (tránh open redirect).
        throw new NotFoundError("Tệp đính kèm là liên kết ngoài, không tải qua hệ thống");
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

      // Tệp phải thuộc tệp đính kèm văn bản / sản phẩm nhiệm vụ được đọc; mặc định từ chối (404)
      await assertFilePathDownloadAllowed(authUser, filePathParam!, fileName, requestId);

      downloadName = req.nextUrl.searchParams.get("name") || fileName;
    }

    return streamLocalFile(req, safeResolvedPath, requestId, { type: "attachment", filename: downloadName });
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
