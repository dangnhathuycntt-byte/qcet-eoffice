import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { resolveSafeFilePath, openByteRangeStream } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Tệp không tồn tại", { status: 404 });
    }

    const relativePath = path.join(...pathSegments);
    let safeResolvedPath: string;
    try {
      safeResolvedPath = resolveSafeFilePath(relativePath);
    } catch {
      return new NextResponse("Yêu cầu không hợp lệ (Forbidden Access)", { status: 403 });
    }

    if (!fs.existsSync(safeResolvedPath)) {
      return new NextResponse("Không tìm thấy tệp yêu cầu", { status: 404 });
    }

    const stat = await fs.promises.stat(safeResolvedPath);
    if (!stat.isFile()) {
      return new NextResponse("Đường dẫn không phải là tệp hợp lệ", { status: 400 });
    }

    const rangeHeader = req.headers.get("range");
    const streamResult = await openByteRangeStream(safeResolvedPath, rangeHeader);

    const headers = new Headers(streamResult.headers);
    headers.set("Cache-Control", "private, max-age=3600, must-revalidate");
    if (streamResult.status === 200) {
      headers.set("Content-Disposition", `inline; filename="${path.basename(safeResolvedPath)}"`);
    }

    return new NextResponse(streamResult.stream as unknown as BodyInit, {
      status: streamResult.status,
      headers,
    });
  } catch (error) {
    console.error("[File Service Error]", error);
    return new NextResponse("Lỗi máy chủ nội bộ khi nạp tệp", { status: 500 });
  }
}

