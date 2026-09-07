import fs from "node:fs";
import path from "node:path";

export interface StreamResult {
  status: 200 | 206 | 416;
  headers: Record<string, string>;
  stream?: ReadableStream<Uint8Array>;
}

/**
 * Resolves relative path against UPLOADS_DIR safely and prevents path traversal.
 * Throws Error on any traversal attempts.
 */
export function resolveSafeFilePath(relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error("Path traversal detected: Access Denied");
  }

  const uploadsRoot = path.resolve(process.env.UPLOADS_DIR || "./uploads");
  const safeResolvedPath = path.resolve(uploadsRoot, relativePath);

  if (
    safeResolvedPath !== uploadsRoot &&
    !safeResolvedPath.startsWith(uploadsRoot + path.sep)
  ) {
    throw new Error("Path traversal detected: Access Denied");
  }

  return safeResolvedPath;
}

/**
 * Maps common file extensions to MIME types.
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain; charset=utf-8",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Opens a byte-range or full stream for the given file path.
 * Supports HTTP 200 (Full content), HTTP 206 (Partial byte-range), and HTTP 416 (Range Not Satisfiable).
 */
export async function openByteRangeStream(
  fullPath: string,
  rangeHeader?: string | null
): Promise<StreamResult> {
  const stat = await fs.promises.stat(fullPath);
  const fileSize = stat.size;
  const contentType = getMimeType(fullPath);

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (
      isNaN(start) ||
      start >= fileSize ||
      (end !== undefined && end >= fileSize) ||
      start > end
    ) {
      return {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileSize}`,
        },
      };
    }

    const chunkSize = end - start + 1;
    const nodeStream = fs.createReadStream(fullPath, { start, end });
    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on("data", (chunk) =>
          controller.enqueue(new Uint8Array(chunk as Buffer))
        );
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600, must-revalidate",
      },
      stream: webStream,
    };
  }

  const nodeStream = fs.createReadStream(fullPath);
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk) =>
        controller.enqueue(new Uint8Array(chunk as Buffer))
      );
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  return {
    status: 200,
    headers: {
      "Content-Length": fileSize.toString(),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600, must-revalidate",
    },
    stream: webStream,
  };
}
