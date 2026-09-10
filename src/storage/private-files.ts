import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { openByteRangeStream, StreamResult } from "@/lib/storage";
import { serverEnv } from "@/config/env.server";

export type PrivateFileClassification = "INTERNAL" | "CONFIDENTIAL" | "SECRET" | "PUBLIC";

export interface PrivateFileMetadata {
  id: string;
  fileName: string;
  relativePath: string;
  absolutePath: string;
  size: number;
  mimeType: string;
  checksum?: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId?: string;
  departmentId?: string;
  classification?: PrivateFileClassification;
}

export interface SavePrivateFileOptions {
  relativePath: string;
  content: Buffer | Uint8Array | string;
  mimeType?: string;
  ownerId?: string;
  departmentId?: string;
  classification?: PrivateFileClassification;
  overwrite?: boolean;
}

export interface MimeValidationResult {
  valid: boolean;
  detectedMime: string;
  error?: string;
}

export interface UserAuthContext {
  id: string;
  role: string;
  departmentId?: string;
}

/**
 * Common MIME types for institutional documents and assets
 */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".zip": "application/zip",
};

/**
 * Returns canonical root directory for private file storage
 */
export function getPrivateStorageDir(): string {
  if (serverEnv.PRIVATE_STORAGE_DIR) {
    return path.resolve(serverEnv.PRIVATE_STORAGE_DIR);
  }
  if (serverEnv.UPLOADS_DIR) {
    return path.resolve(serverEnv.UPLOADS_DIR);
  }
  return path.resolve(process.cwd(), "storage/private");
}

/**
 * Sanitizes and resolves a relative path strictly within the private storage boundary.
 * Throws on any path traversal attempt, absolute path, null byte, or escape sequence.
 */
export function resolveSafePrivatePath(relativePath: string): string {
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("Path traversal detected: Invalid file path");
  }

  // Reject null bytes
  if (relativePath.includes("\0") || relativePath.includes("%00")) {
    throw new Error("Path traversal detected: Null byte injection");
  }

  // Reject URL-encoded traversal patterns
  const lower = relativePath.toLowerCase();
  if (
    lower.includes("%2e%2e") ||
    lower.includes("%2f") ||
    lower.includes("%5c") ||
    lower.includes("..")
  ) {
    throw new Error("Path traversal detected: Traversal sequence forbidden");
  }

  // Reject absolute paths and drive letters (e.g. /etc/passwd or C:\Windows)
  if (
    path.isAbsolute(relativePath) ||
    relativePath.startsWith("/") ||
    relativePath.startsWith("\\") ||
    /^[a-zA-Z]:/.test(relativePath)
  ) {
    throw new Error("Path traversal detected: Absolute path forbidden");
  }

  const storageDir = getPrivateStorageDir();
  const normalized = path.normalize(relativePath);

  if (normalized.startsWith("..") || normalized === ".") {
    throw new Error("Path traversal detected: Relative escape forbidden");
  }

  const resolved = path.resolve(storageDir, normalized);

  if (resolved !== storageDir && !resolved.startsWith(storageDir + path.sep)) {
    throw new Error("Path traversal detected: Access Denied");
  }

  return resolved;
}

/**
 * Detects MIME type from file extension and optional buffer magic numbers
 */
export function detectMimeType(filePathOrName: string, buffer?: Buffer): string {
  const ext = path.extname(filePathOrName).toLowerCase();
  const extMime = ALLOWED_MIME_TYPES[ext];

  if (buffer && buffer.length >= 4) {
    // Magic number checks
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return "application/pdf";
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png";
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
    // ZIP based (DOCX, XLSX, PPTX, ZIP)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      if (ext === ".docx") return ALLOWED_MIME_TYPES[".docx"];
      if (ext === ".xlsx") return ALLOWED_MIME_TYPES[".xlsx"];
      if (ext === ".pptx") return ALLOWED_MIME_TYPES[".pptx"];
      return "application/zip";
    }
    // OLE Compound Document (DOC, XLS, PPT)
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      if (ext === ".xls") return ALLOWED_MIME_TYPES[".xls"];
      if (ext === ".ppt") return ALLOWED_MIME_TYPES[".ppt"];
      return ALLOWED_MIME_TYPES[".doc"];
    }
  }

  return extMime || "application/octet-stream";
}

/**
 * Validates file MIME type against an allowed list or standard institutional whitelist
 */
export function validateMimeType(
  filePathOrName: string,
  allowedMimeTypes?: string[],
  buffer?: Buffer
): MimeValidationResult {
  const detected = detectMimeType(filePathOrName, buffer);

  if (allowedMimeTypes && allowedMimeTypes.length > 0) {
    const isAllowed = allowedMimeTypes.some((allowed) => {
      if (allowed.endsWith("/*")) {
        const prefix = allowed.slice(0, -2);
        return detected.startsWith(prefix);
      }
      return allowed.toLowerCase() === detected.toLowerCase();
    });

    if (!isAllowed) {
      return {
        valid: false,
        detectedMime: detected,
        error: `Định dạng tệp không được phép: ${detected}. Danh sách cho phép: ${allowedMimeTypes.join(", ")}`,
      };
    }
  }

  // Reject executable or dangerous file types
  const ext = path.extname(filePathOrName).toLowerCase();
  const bannedExtensions = [".exe", ".bat", ".sh", ".cmd", ".vbs", ".msi", ".jar", ".ps1", ".scr"];
  if (bannedExtensions.includes(ext)) {
    return {
      valid: false,
      detectedMime: detected,
      error: `Định dạng tệp có nguy cơ bảo mật bị chặn: ${ext}`,
    };
  }

  return { valid: true, detectedMime: detected };
}

/**
 * Saves a file securely inside private storage
 */
export async function savePrivateFile(options: SavePrivateFileOptions): Promise<PrivateFileMetadata> {
  const safePath = resolveSafePrivatePath(options.relativePath);

  const buffer = Buffer.isBuffer(options.content)
    ? options.content
    : typeof options.content === "string"
      ? Buffer.from(options.content, "utf-8")
      : Buffer.from(options.content);

  const mimeValidation = validateMimeType(options.relativePath, undefined, buffer);
  if (!mimeValidation.valid) {
    throw new Error(mimeValidation.error || "File MIME validation failed");
  }

  if (fs.existsSync(safePath) && !options.overwrite) {
    throw new Error(`File already exists at: ${options.relativePath}`);
  }

  const parentDir = path.dirname(safePath);
  await fs.promises.mkdir(parentDir, { recursive: true });
  await fs.promises.writeFile(safePath, buffer);

  const stat = await fs.promises.stat(safePath);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  return {
    id: crypto.randomUUID(),
    fileName: path.basename(safePath),
    relativePath: options.relativePath,
    absolutePath: safePath,
    size: stat.size,
    mimeType: options.mimeType || mimeValidation.detectedMime,
    checksum: hash,
    createdAt: stat.birthtime,
    updatedAt: stat.mtime,
    ownerId: options.ownerId,
    departmentId: options.departmentId,
    classification: options.classification || "INTERNAL",
  };
}

/**
 * Retrieves metadata for an existing private file
 */
export async function getPrivateFileMetadata(relativePath: string): Promise<PrivateFileMetadata> {
  const safePath = resolveSafePrivatePath(relativePath);

  if (!fs.existsSync(safePath)) {
    throw new Error(`Private file not found: ${relativePath}`);
  }

  const stat = await fs.promises.stat(safePath);
  if (!stat.isFile()) {
    throw new Error(`Path is not a regular file: ${relativePath}`);
  }

  return {
    id: path.basename(safePath),
    fileName: path.basename(safePath),
    relativePath,
    absolutePath: safePath,
    size: stat.size,
    mimeType: detectMimeType(safePath),
    createdAt: stat.birthtime,
    updatedAt: stat.mtime,
  };
}

/**
 * Reads the full content buffer of a private file
 */
export async function readPrivateFile(relativePath: string): Promise<Buffer> {
  const safePath = resolveSafePrivatePath(relativePath);
  if (!fs.existsSync(safePath)) {
    throw new Error(`Private file not found: ${relativePath}`);
  }
  return fs.promises.readFile(safePath);
}

/**
 * Checks if a private file exists safely
 */
export function existsPrivateFile(relativePath: string): boolean {
  try {
    const safePath = resolveSafePrivatePath(relativePath);
    return fs.existsSync(safePath) && fs.statSync(safePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Deletes a private file
 */
export async function deletePrivateFile(relativePath: string): Promise<boolean> {
  try {
    const safePath = resolveSafePrivatePath(relativePath);
    if (fs.existsSync(safePath)) {
      await fs.promises.unlink(safePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Opens a byte-range or full stream for a private file
 */
export async function openPrivateFileStream(
  relativePath: string,
  rangeHeader?: string | null
): Promise<StreamResult> {
  const safePath = resolveSafePrivatePath(relativePath);
  if (!fs.existsSync(safePath)) {
    throw new Error(`Private file not found: ${relativePath}`);
  }
  return openByteRangeStream(safePath, rangeHeader);
}

/**
 * Institutional RBAC authorization check for accessing private documents
 */
export function checkFileAuthorization(
  user: UserAuthContext | null | undefined,
  metadata: {
    ownerId?: string;
    departmentId?: string;
    classification?: PrivateFileClassification;
  },
  options?: {
    requiredRoles?: string[];
    allowSameDepartment?: boolean;
  }
): boolean {
  if (!user) {
    return false;
  }

  // System Administrator & Board of Executives (BGH) have school-wide authorization
  const elevatedRoles = ["ADMIN", "BGH", "HIEU_TRUONG", "PHO_HIEU_TRUONG"];
  if (elevatedRoles.includes(user.role)) {
    return true;
  }

  // Public classification is accessible to all authenticated staff
  if (metadata.classification === "PUBLIC") {
    return true;
  }

  // File Owner has direct access
  if (metadata.ownerId && user.id === metadata.ownerId) {
    return true;
  }

  // Department-level scope authorization
  const allowSameDept = options?.allowSameDepartment ?? true;
  if (allowSameDept && metadata.departmentId && user.departmentId === metadata.departmentId) {
    return true;
  }

  // Required roles check
  if (options?.requiredRoles && options.requiredRoles.length > 0) {
    if (options.requiredRoles.includes(user.role)) {
      return true;
    }
  }

  return false;
}
