import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { promisify } from "node:util";

const statAsync = promisify(fs.stat);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const uploadsRoot = path.resolve(process.env.UPLOADS_DIR || "./uploads");
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Tệp không tồn tại", { status: 404 });
    }

    // Chống tấn công Path Traversal
    const relativePath = path.join(...pathSegments);
    const safeResolvedPath = path.resolve(uploadsRoot, relativePath);

    if (
      safeResolvedPath !== uploadsRoot &&
      !safeResolvedPath.startsWith(uploadsRoot + path.sep)
    ) {
      return new NextResponse("Yêu cầu không hợp lệ (Forbidden Access)", { status: 403 });
    }

    if (!fs.existsSync(safeResolvedPath)) {
      return new NextResponse("Không tìm thấy tệp yêu cầu", { status: 404 });
    }

    const stat = await statAsync(safeResolvedPath);
    if (!stat.isFile()) {
      return new NextResponse("Đường dẫn không phải là tệp hợp lệ", { status: 400 });
    }

    const ext = path.extname(safeResolvedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    const rangeHeader = req.headers.get("range");
    const fileSize = stat.size;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(safeResolvedPath, { start, end });
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
      });

      return new NextResponse(webStream as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600, must-revalidate",
        },
      });
    }

    const fileStream = fs.createReadStream(safeResolvedPath);
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600, must-revalidate",
        "Content-Disposition": `inline; filename="${path.basename(safeResolvedPath)}"`,
      },
    });
  } catch (error) {
    console.error("[File Service Error]", error);
    return new NextResponse("Lỗi máy chủ nội bộ khi nạp tệp", { status: 500 });
  }
}
