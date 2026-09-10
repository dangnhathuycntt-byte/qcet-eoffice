import fs from "node:fs";
import path from "node:path";
import { ForbiddenError } from "@/server/api/errors";

export interface StreamResult {
  status: 200 | 206 | 416;
  headers: Record<string, string>;
  stream?: ReadableStream<Uint8Array>;
}

export const ALLOWED_FILE_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".docx",
  ".xlsx",
  ".txt",
  ".csv",
] as const;

export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];

export const SECURE_FILE_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
};

/**
 * Checks if a given filename or path has an allowed extension.
 */
export function isAllowedFileExtension(filenameOrPath: string): boolean {
  if (!filenameOrPath || typeof filenameOrPath !== "string") return false;
  const ext = path.extname(filenameOrPath).toLowerCase();
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Sanitizes a filename for safe download headers.
 * Strips control characters, quotes, newlines, path separators, and restricts to safe ASCII/UTF-8 syntax.
 */
export function sanitizeDownloadFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "download";
  }

  // 1. Take only the basename to strip any path characters
  let clean = path.basename(filename);

  // 2. Strip null bytes and control characters (0-31 and 127)
  clean = clean.replace(/[\x00-\x1f\x7f]/g, "");

  // 3. Remove quotes, backticks, backslashes, slashes, semicolons, angle brackets, pipes, colons, wildcards
  clean = clean.replace(/["'`\\/;:<>*?|]/g, "");

  // 4. Unicode normalization
  clean = clean.normalize("NFC");

  // 5. Trim leading/trailing whitespace and dots
  clean = clean.trim().replace(/^\.+/, "").replace(/\.+$/, "");

  // 6. Restrict length (max 255 chars preserving extension)
  if (clean.length > 255) {
    const ext = path.extname(clean);
    const base = path.basename(clean, ext).slice(0, 255 - ext.length);
    clean = `${base}${ext}`;
  }

  if (!clean || clean.length === 0) {
    return "download";
  }

  return clean;
}

/**
 * Resolves relative path against UPLOADS_DIR safely and prevents path traversal.
 * Also strictly validates against allowed extensions.
 * Throws ForbiddenError on any traversal attempts or unallowed extensions.
 */
export function resolveSafeFilePath(relativePath: string): string {
  if (!relativePath || typeof relativePath !== "string") {
    throw new ForbiddenError("Path traversal detected: Access Denied");
  }

  // Prevent null bytes
  if (relativePath.includes("\0") || relativePath.includes("%00")) {
    throw new ForbiddenError("Path traversal detected: Access Denied");
  }

  // Decode URI component to catch encoded traversal attempts
  let decoded = relativePath;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    throw new ForbiddenError("Invalid path encoding: Access Denied");
  }

  if (
    path.isAbsolute(relativePath) ||
    path.isAbsolute(decoded) ||
    decoded.includes("..") ||
    relativePath.includes("..")
  ) {
    throw new ForbiddenError("Path traversal detected: Access Denied");
  }

  const uploadsRoot = path.resolve(process.env.UPLOADS_DIR || "./uploads");
  const safeResolvedPath = path.resolve(uploadsRoot, decoded);

  if (
    safeResolvedPath === uploadsRoot ||
    !safeResolvedPath.startsWith(uploadsRoot + path.sep)
  ) {
    throw new ForbiddenError("Path traversal detected: Access Denied");
  }

  if (!isAllowedFileExtension(safeResolvedPath)) {
    throw new ForbiddenError("Disallowed file extension: Access Denied");
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
    ".csv": "text/csv; charset=utf-8",
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
          ...SECURE_FILE_HEADERS,
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
        ...SECURE_FILE_HEADERS,
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
      ...SECURE_FILE_HEADERS,
    },
    stream: webStream,
  };
}
