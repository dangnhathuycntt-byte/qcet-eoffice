import crypto from "node:crypto";
import net from "node:net";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { FileScanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  detectUploadMimeType,
  isAllowedFileExtension,
  resolveSafeFilePath,
  sanitizeDownloadFilename,
} from "@/lib/storage";
import { ConflictError, ValidationError } from "@/server/api/errors";

export interface StoreUploadedFileInput {
  uploadedById: string;
  originalName: string;
  declaredMimeType?: string;
  bytes: Buffer;
  metadata?: Record<string, unknown>;
}

export type ClamAvScanResult =
  | { status: "CLEAN"; result: string }
  | { status: "INFECTED"; result: string }
  | { status: "FAILED"; result: string };

function writeSocket(socket: net.Socket, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.destroyed) {
      reject(new Error("ClamAV connection closed"));
      return;
    }
    if (socket.write(data)) {
      resolve();
      return;
    }
    const cleanup = () => {
      socket.removeListener("drain", onDrain);
      socket.removeListener("error", onError);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    socket.once("drain", onDrain);
    socket.once("error", onError);
  });
}

/** Sends bytes to clamd using the framed INSTREAM protocol. */
export async function scanReadableWithClamAv(
  chunks: AsyncIterable<Uint8Array>,
  host: string,
  port: number,
  timeoutMs = 30_000
): Promise<ClamAvScanResult> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = Buffer.alloc(0);
    let settled = false;
    const finish = (error?: Error, result?: ClamAvScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(result!);
    };

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => finish(new Error("ClamAV scan timed out")));
    socket.on("error", (error) => finish(error));
    socket.on("data", (chunk: Buffer) => {
      response = Buffer.concat([response, chunk]);
      if (response.length > 4096) finish(new Error("ClamAV response exceeded limit"));
    });
    socket.on("end", () => {
      const message = response.toString("utf8").replaceAll("\0", "").trim().slice(0, 1000);
      if (/\bFOUND\b/i.test(message)) {
        finish(undefined, { status: "INFECTED", result: message });
      } else if (/\bOK\b/i.test(message)) {
        finish(undefined, { status: "CLEAN", result: message });
      } else if (/\bERROR\b/i.test(message)) {
        finish(undefined, { status: "FAILED", result: message || "ClamAV scan error" });
      } else {
        finish(new Error("ClamAV returned an unrecognized scan response"));
      }
    });

    socket.on("connect", () => {
      void (async () => {
        await writeSocket(socket, Buffer.from("zINSTREAM\0", "ascii"));
        for await (const chunk of chunks) {
          const bytes = Buffer.from(chunk);
          if (bytes.length === 0) continue;
          const header = Buffer.allocUnsafe(4);
          header.writeUInt32BE(bytes.length, 0);
          await writeSocket(socket, Buffer.concat([header, bytes]));
        }
        await writeSocket(socket, Buffer.alloc(4));
      })().catch((error: unknown) => {
        finish(error instanceof Error ? error : new Error("ClamAV stream failed"));
      });
    });
  });
}

export async function scanPendingFileObject(fileObjectId: string) {
  const host = process.env.CLAMAV_HOST?.trim();
  const port = Number.parseInt(process.env.CLAMAV_PORT || "3310", 10);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { scanStatus: FileScanStatus.PENDING, scanned: false };
  }

  const file = await prisma.fileObject.findUnique({
    where: { id: fileObjectId },
    select: { id: true, storageKey: true, byteSize: true, contentHash: true, scanStatus: true },
  });
  if (!file) throw new ValidationError("Không tìm thấy FileObject cần quét");
  if (file.scanStatus !== FileScanStatus.PENDING) {
    return { scanStatus: file.scanStatus, scanned: false };
  }

  const finalizeFailure = async (reason: string) => {
    const updated = await recordFileScanResult(file.id, FileScanStatus.FAILED, reason);
    if (updated.count > 0) return FileScanStatus.FAILED;
    const current = await prisma.fileObject.findUnique({ where: { id: file.id }, select: { scanStatus: true } });
    return current?.scanStatus ?? FileScanStatus.FAILED;
  };

  const absolutePath = resolveSafeFilePath(file.storageKey);
  let realPath: string;
  let uploadsRoot: string;
  try {
    [realPath, uploadsRoot] = await Promise.all([
      fs.realpath(absolutePath),
      fs.realpath(path.resolve(process.env.UPLOADS_DIR || "./uploads")),
    ]);
  } catch {
    return { scanStatus: await finalizeFailure("Stored file is missing"), scanned: true };
  }
  if (!realPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return { scanStatus: await finalizeFailure("Stored file escapes the upload root"), scanned: true };
  }
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(realPath);
  } catch {
    return { scanStatus: await finalizeFailure("Stored file is missing"), scanned: true };
  }
  if (!stat.isFile() || BigInt(stat.size) !== file.byteSize) {
    return { scanStatus: await finalizeFailure("File size/type integrity check failed"), scanned: true };
  }

  const hash = crypto.createHash("sha256");
  const stream = createReadStream(realPath);
  const observedChunks = (async function* () {
    for await (const chunk of stream) {
      const bytes = Buffer.from(chunk as Buffer);
      hash.update(bytes);
      yield bytes;
    }
  })();

  let result: ClamAvScanResult;
  try {
    result = await scanReadableWithClamAv(observedChunks, host, port);
  } catch (error) {
    stream.destroy();
    throw error;
  }

  if (hash.digest("hex") !== file.contentHash) {
    result = { status: "FAILED", result: "File checksum integrity check failed" };
  }
  const status =
    result.status === "CLEAN"
      ? FileScanStatus.CLEAN
      : result.status === "INFECTED"
        ? FileScanStatus.INFECTED
        : FileScanStatus.FAILED;
  const updated = await recordFileScanResult(file.id, status, result.result);
  if (updated.count === 0) {
    const current = await prisma.fileObject.findUnique({ where: { id: file.id }, select: { scanStatus: true } });
    return { scanStatus: current?.scanStatus ?? FileScanStatus.FAILED, scanned: true };
  }
  return { scanStatus: status, scanned: true };
}

export async function storeUploadedFile(input: StoreUploadedFileInput) {
  const extension = path.extname(input.originalName).toLowerCase();
  if (!isAllowedFileExtension(input.originalName)) {
    throw new ValidationError(`Loại tệp không được phép: ${extension}`);
  }

  const mimeType = detectUploadMimeType(input.originalName, input.bytes);
  const contentHash = crypto.createHash("sha256").update(input.bytes).digest("hex");

  // Reuse only files that have passed the configured scan workflow. Pending
  // uploads remain isolated so one upload cannot inherit another's scan state.
  const cleanDuplicate = await prisma.fileObject.findFirst({
    where: { contentHash, scanStatus: FileScanStatus.CLEAN, isArchived: false },
    orderBy: { createdAt: "asc" },
  });
  if (cleanDuplicate) {
    const updated = await prisma.fileObject.updateMany({
      where: {
        id: cleanDuplicate.id,
        scanStatus: FileScanStatus.CLEAN,
        isArchived: false,
      },
      data: { referenceCount: { increment: 1 } },
    });
    if (updated.count === 1) {
      return {
        id: cleanDuplicate.id,
        storageKey: cleanDuplicate.storageKey,
        originalName: cleanDuplicate.originalName,
        mimeType: cleanDuplicate.mimeType,
        byteSize: cleanDuplicate.byteSize,
        contentHash: cleanDuplicate.contentHash,
        scanStatus: cleanDuplicate.scanStatus,
        deduplicated: true,
      };
    }
  }

  const storageDirectory = path.posix.join(contentHash.slice(0, 2), contentHash.slice(2, 4));
  let storageKey = path.posix.join(storageDirectory, `${contentHash}${extension}`);
  let absolutePath = resolveSafeFilePath(storageKey);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  // The canonical hash key is used for the first copy. Concurrent uploads or
  // another still-pending copy get a unique suffix; only CLEAN objects dedupe.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fs.writeFile(absolutePath, input.bytes, { flag: "wx", mode: 0o600 });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || attempt === 2) {
        throw error;
      }
      const suffix = crypto.randomUUID();
      storageKey = path.posix.join(storageDirectory, `${contentHash}-${suffix}${extension}`);
      absolutePath = resolveSafeFilePath(storageKey);
    }
  }

  const safeOriginalName = sanitizeDownloadFilename(input.originalName).slice(0, 255) || `file${extension}`;
  const isDevOrNoScanner =
    !process.env.CLAMAV_HOST?.trim() &&
    process.env.NODE_ENV !== "test" &&
    process.env.NODE_ENV !== "production";
  const initialScanStatus = isDevOrNoScanner ? FileScanStatus.CLEAN : FileScanStatus.PENDING;

  try {
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey,
        originalName: safeOriginalName,
        mimeType,
        extension,
        byteSize: BigInt(input.bytes.byteLength),
        contentHash,
        scanStatus: initialScanStatus,
        uploadedById: input.uploadedById,
        metadata: {
          ...(input.declaredMimeType ? { declaredMimeType: input.declaredMimeType.slice(0, 100) } : {}),
          ...(input.metadata || {}),
        },
      },
    });
    let scanStatus = fileObject.scanStatus;
    if (process.env.NODE_ENV !== "test" && process.env.CLAMAV_HOST?.trim()) {
      try {
        const result = await scanReadableWithClamAv(
          (async function* () { yield input.bytes; })(),
          process.env.CLAMAV_HOST.trim(),
          Number.parseInt(process.env.CLAMAV_PORT || "3310", 10)
        );
        const status =
          result.status === "CLEAN"
            ? FileScanStatus.CLEAN
            : result.status === "INFECTED"
              ? FileScanStatus.INFECTED
              : FileScanStatus.FAILED;
        const updated = await recordFileScanResult(fileObject.id, status, result.result);
        if (updated.count === 1) scanStatus = status;
      } catch {
        // An unavailable scanner never turns a quarantined upload into CLEAN.
        // Leave it PENDING so an asynchronous retry can process it later.
      }
    }
    return {
      id: fileObject.id,
      storageKey: fileObject.storageKey,
      originalName: fileObject.originalName,
      mimeType: fileObject.mimeType,
      byteSize: fileObject.byteSize,
      contentHash: fileObject.contentHash,
      scanStatus,
      deduplicated: false,
    };
  } catch (error) {
    await fs.rm(absolutePath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function getFileObjectIdFromUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const match = fileUrl.trim().match(
    /^\/api\/file-objects\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i
  );
  return match?.[1] ?? null;
}

export async function recordFileScanResult(
  fileObjectId: string,
  status: Exclude<FileScanStatus, "PENDING">,
  result?: string
) {
  if (![FileScanStatus.CLEAN, FileScanStatus.INFECTED, FileScanStatus.FAILED].includes(status)) {
    throw new ConflictError("Trạng thái quét tệp không hợp lệ", "INVALID_FILE_SCAN_TRANSITION");
  }
  const file = await prisma.fileObject.findUnique({
    where: { id: fileObjectId },
    select: { id: true, scanStatus: true },
  });
  if (!file) throw new ValidationError("Không tìm thấy tệp cần cập nhật trạng thái quét");
  if (file.scanStatus !== FileScanStatus.PENDING) {
    throw new ConflictError("Tệp đã được xử lý quét", "FILE_SCAN_ALREADY_FINALIZED");
  }
  return prisma.fileObject.updateMany({
    where: { id: fileObjectId, scanStatus: FileScanStatus.PENDING },
    data: {
      scanStatus: status,
      scanResult: result?.slice(0, 1000) ?? null,
    },
  });
}
