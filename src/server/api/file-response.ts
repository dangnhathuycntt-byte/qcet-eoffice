import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { buildContentDisposition, openByteRangeStream } from "@/lib/storage";
import { NotFoundError, ValidationError } from "@/server/api/errors";

/**
 * Trả tệp cục bộ đã được phân quyền và chuẩn hoá đường dẫn, hỗ trợ `Range` (200/206/416).
 * `Content-Disposition` chỉ gắn khi trả toàn bộ nội dung.
 */
export async function streamLocalFile(
  req: NextRequest,
  safePath: string,
  requestId: string,
  disposition: { type: "inline" | "attachment"; filename: string }
): Promise<NextResponse> {
  if (!fs.existsSync(safePath)) {
    throw new NotFoundError("Không tìm thấy tệp yêu cầu");
  }

  const stat = await fs.promises.stat(safePath);
  if (!stat.isFile()) {
    throw new ValidationError("Đường dẫn không phải là tệp hợp lệ");
  }

  const streamResult = await openByteRangeStream(safePath, req.headers.get("range"));

  const headers = new Headers(streamResult.headers);
  headers.set("x-request-id", requestId);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");

  if (streamResult.status === 200) {
    headers.set("Content-Disposition", buildContentDisposition(disposition.type, disposition.filename));
  }

  return new NextResponse((streamResult.stream as unknown as BodyInit) ?? null, {
    status: streamResult.status,
    headers,
  });
}
