import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import {
  resolveSafeFilePath,
  openByteRangeStream,
} from "../../../../lib/storage";
import { getSessionFromRequest } from "@/lib/jwt-session";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Unauthorized",
          status: 401,
          detail: "Vui lòng đăng nhập để tải tệp",
          success: false,
          error: "Vui lòng đăng nhập để tải tệp",
        },
        { status: 401 }
      );
    }

    const filePathParam = req.nextUrl.searchParams.get("file");
    if (!filePathParam) {
      return new NextResponse("Thiếu tham số tệp (Missing file parameter)", {
        status: 400,
      });
    }

    let safeResolvedPath: string;
    try {
      safeResolvedPath = resolveSafeFilePath(filePathParam);
    } catch {
      return new NextResponse("Yêu cầu không hợp lệ (Forbidden Access)", {
        status: 403,
      });
    }

    if (!fs.existsSync(safeResolvedPath)) {
      return new NextResponse("Không tìm thấy tệp yêu cầu", { status: 404 });
    }

    const stat = await fs.promises.stat(safeResolvedPath);
    if (!stat.isFile()) {
      return new NextResponse("Đường dẫn không phải là tệp hợp lệ", {
        status: 400,
      });
    }

    const rangeHeader = req.headers.get("range");
    const streamResult = await openByteRangeStream(safeResolvedPath, rangeHeader);

    const downloadName =
      req.nextUrl.searchParams.get("name") || path.basename(safeResolvedPath);

    const headers = new Headers(streamResult.headers);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${downloadName}"`
    );

    return new NextResponse(streamResult.stream as unknown as BodyInit, {
      status: streamResult.status,
      headers,
    });
  } catch (error) {
    console.error("[Document Download Error]", error);
    return new NextResponse("Lỗi máy chủ nội bộ khi tải tệp", { status: 500 });
  }
}
