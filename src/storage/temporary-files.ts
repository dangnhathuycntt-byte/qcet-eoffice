import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { detectMimeType } from "./private-files";

export type TemporaryFileStatus = "active" | "expired" | "deleted" | "purged";

export interface TemporaryFileRecord {
  id: string;
  fileName: string;
  relativePath: string;
  absolutePath: string;
  ownerId: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  expiresAt: Date;
  status: TemporaryFileStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateTemporaryFileOptions {
  fileName: string;
  content: Buffer | Uint8Array | string;
  ownerId: string;
  ttlMs?: number; // Time to live in milliseconds (default: 3600000 = 1 hour)
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export interface CleanupSummary {
  cleanedCount: number;
  freedBytes: number;
  errors: string[];
}

export const DEFAULT_TEMP_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns canonical directory for temporary file storage
 */
export function getTempStorageDir(): string {
  if (process.env.TEMP_STORAGE_DIR) {
    return path.resolve(process.env.TEMP_STORAGE_DIR);
  }
  return path.resolve(process.cwd(), "storage/temp");
}

/**
 * Sanitizes base filename to prevent directory traversal
 */
function sanitizeFileName(fileName: string): string {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Checks if a temporary file record has expired
 */
export function isTemporaryFileExpired(record: TemporaryFileRecord, now = new Date()): boolean {
  return now.getTime() > new Date(record.expiresAt).getTime();
}

/**
 * Creates a new temporary file with metadata and automatic expiration
 */
export async function createTemporaryFile(
  options: CreateTemporaryFileOptions
): Promise<TemporaryFileRecord> {
  const id = crypto.randomUUID();
  const safeName = sanitizeFileName(options.fileName) || `temp_${id}`;
  const tempDir = getTempStorageDir();
  const itemDir = path.join(tempDir, id);

  await fs.promises.mkdir(itemDir, { recursive: true });

  const filePath = path.join(itemDir, safeName);
  const buffer = Buffer.isBuffer(options.content)
    ? options.content
    : typeof options.content === "string"
      ? Buffer.from(options.content, "utf-8")
      : Buffer.from(options.content);

  await fs.promises.writeFile(filePath, buffer);

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + (options.ttlMs ?? DEFAULT_TEMP_TTL_MS));
  const mimeType = options.mimeType || detectMimeType(safeName, buffer);

  const record: TemporaryFileRecord = {
    id,
    fileName: safeName,
    relativePath: path.join(id, safeName),
    absolutePath: filePath,
    ownerId: options.ownerId,
    size: buffer.length,
    mimeType,
    createdAt,
    expiresAt,
    status: "active",
    metadata: options.metadata,
  };

  // Write manifest JSON alongside temporary file
  const manifestPath = path.join(itemDir, "manifest.json");
  await fs.promises.writeFile(manifestPath, JSON.stringify(record, null, 2), "utf-8");

  return record;
}

/**
 * Reads metadata of a temporary file by ID
 */
export async function getTemporaryFile(
  id: string,
  now = new Date()
): Promise<TemporaryFileRecord | null> {
  if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return null;
  }

  const manifestPath = path.join(getTempStorageDir(), id, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const raw = await fs.promises.readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(raw);
    const record: TemporaryFileRecord = {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      expiresAt: new Date(parsed.expiresAt),
    };

    if (isTemporaryFileExpired(record, now) && record.status === "active") {
      record.status = "expired";
    }

    return record;
  } catch {
    return null;
  }
}

/**
 * Reads content buffer of a temporary file, verifying active non-expired status
 */
export async function readTemporaryFile(id: string, now = new Date()): Promise<Buffer> {
  const record = await getTemporaryFile(id, now);
  if (!record) {
    throw new Error(`Temporary file not found: ${id}`);
  }

  if (isTemporaryFileExpired(record, now)) {
    throw new Error(`Temporary file ${id} has expired at ${record.expiresAt.toISOString()}`);
  }

  if (!fs.existsSync(record.absolutePath)) {
    throw new Error(`Temporary file data missing from disk: ${id}`);
  }

  return fs.promises.readFile(record.absolutePath);
}

/**
 * Deletes a temporary file and its metadata folder
 */
export async function deleteTemporaryFile(id: string): Promise<boolean> {
  if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return false;
  }

  const itemDir = path.join(getTempStorageDir(), id);
  if (!fs.existsSync(itemDir)) {
    return false;
  }

  try {
    await fs.promises.rm(itemDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Scans temporary file store and purges all expired temporary files
 */
export async function cleanupExpiredTemporaryFiles(options?: {
  forceAll?: boolean;
  now?: Date;
  olderThanMs?: number;
}): Promise<CleanupSummary> {
  const tempDir = getTempStorageDir();
  const summary: CleanupSummary = {
    cleanedCount: 0,
    freedBytes: 0,
    errors: [],
  };

  if (!fs.existsSync(tempDir)) {
    return summary;
  }

  const now = options?.now ?? new Date();
  const entries = await fs.promises.readdir(tempDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const itemDir = path.join(tempDir, entry.name);
    const manifestPath = path.join(itemDir, "manifest.json");

    try {
      if (fs.existsSync(manifestPath)) {
        const raw = await fs.promises.readFile(manifestPath, "utf-8");
        const record = JSON.parse(raw) as TemporaryFileRecord;

        const isExpired = isTemporaryFileExpired(record, now);
        const isOlder = options?.olderThanMs
          ? now.getTime() - new Date(record.createdAt).getTime() > options.olderThanMs
          : false;

        if (options?.forceAll || isExpired || isOlder) {
          summary.freedBytes += record.size || 0;
          await fs.promises.rm(itemDir, { recursive: true, force: true });
          summary.cleanedCount++;
        }
      } else {
        // Orphaned folder without manifest: remove if older than 1 hour
        const stat = await fs.promises.stat(itemDir);
        const age = now.getTime() - stat.mtimeMs;
        if (options?.forceAll || age > (options?.olderThanMs ?? DEFAULT_TEMP_TTL_MS)) {
          await fs.promises.rm(itemDir, { recursive: true, force: true });
          summary.cleanedCount++;
        }
      }
    } catch (err) {
      summary.errors.push(`Failed cleaning ${entry.name}: ${(err as Error).message}`);
    }
  }

  return summary;
}
