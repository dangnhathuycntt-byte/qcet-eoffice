import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import {
  openByteRangeStream,
  buildContentDisposition,
  resolveSafeFilePath,
  SECURE_FILE_HEADERS,
} from "@/server/files/storage";
import { authorizeFileObjectDownload } from "@/server/files/file-access-service";
import { apiError } from "@/server/api/response";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "@/server/api/errors";

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

    const file = await authorizeFileObjectDownload({ authUser, fileObjectId: id, requestId });

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
    headers.set("Content-Disposition", buildContentDisposition("inline", file.originalName));

    return new NextResponse((streamResult.stream as unknown as BodyInit) ?? null, {
      status: streamResult.status,
      headers,
    });
  } catch (error) {
    return apiError(error, requestId, { headers: { "Cache-Control": "private, no-store" } });
  }
}
