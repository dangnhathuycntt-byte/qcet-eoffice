import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { FileScanStatus, Prisma, PrismaClient } from "@prisma/client";
import { getMimeType, isAllowedFileExtension, resolveSafeFilePath } from "../src/lib/storage";

loadEnvConfig(process.cwd());

type LinkKind = "deliverable" | "attachment" | "dossierItem" | "meeting";
interface LegacyLink {
  kind: LinkKind;
  id: string;
  fileUrl: string;
  uploadedById: string;
  originalName: string;
}

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

function toStorageKey(fileUrl: string | null | undefined): string | null {
  if (!fileUrl || /^https?:\/\//i.test(fileUrl)) return null;
  let value = fileUrl.trim();
  if (value.includes("?") || value.includes("#")) return null;
  for (const prefix of ["/api/files/", "api/files/", "/uploads/", "uploads/"]) {
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length);
      break;
    }
  }
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (
    !normalized || normalized === "." || normalized.startsWith("../") ||
    normalized.startsWith("/") || normalized.includes("\u0000") ||
    normalized.split("/").some((segment) => segment === "..") ||
    !isAllowedFileExtension(normalized)
  ) return null;
  return normalized;
}

async function hashFile(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function collectLegacyLinks(): Promise<LegacyLink[]> {
  const [deliverables, attachments, items, meetings] = await Promise.all([
    prisma.taskDeliverable.findMany({
      where: { fileObjectId: null },
      select: { id: true, fileUrl: true, uploadedById: true },
    }),
    prisma.documentAttachment.findMany({
      where: { fileObjectId: null },
      include: { document: { select: { registeredById: true } } },
    }),
    prisma.dossierItem.findMany({
      where: { fileObjectId: null },
      select: { id: true, itemId: true, notes: true, addedById: true, title: true },
    }),
    prisma.meeting.findMany({
      where: { materialsFileObjectId: null, materialsUrl: { not: null } },
      select: { id: true, materialsUrl: true, organizerId: true, title: true },
    }),
  ]);

  const links: LegacyLink[] = deliverables.map((item) => ({
    kind: "deliverable", id: item.id, fileUrl: item.fileUrl, uploadedById: item.uploadedById,
    originalName: path.posix.basename(item.fileUrl),
  }));
  for (const item of attachments) {
    links.push({
      kind: "attachment", id: item.id, fileUrl: item.fileUrl,
      uploadedById: item.document.registeredById, originalName: item.fileName,
    });
  }
  for (const item of items) {
    // DossierItem.itemId/notes are free-form legacy fields. Only exact URL
    // values are eligible; never infer a link from substring or fuzzy text.
    for (const exactValue of [item.itemId, item.notes]) {
      if (exactValue && toStorageKey(exactValue)) {
        links.push({
          kind: "dossierItem", id: item.id, fileUrl: exactValue,
          uploadedById: item.addedById, originalName: item.title,
        });
        break;
      }
    }
  }
  for (const meeting of meetings) {
    if (meeting.materialsUrl) {
      links.push({
        kind: "meeting", id: meeting.id, fileUrl: meeting.materialsUrl,
        uploadedById: meeting.organizerId, originalName: meeting.title,
      });
    }
  }
  return links;
}

async function attachFileObject(tx: Prisma.TransactionClient, link: LegacyLink, fileObjectId: string): Promise<boolean> {
  switch (link.kind) {
    case "deliverable":
      return (await tx.taskDeliverable.updateMany({
        where: { id: link.id, fileObjectId: null }, data: { fileObjectId },
      })).count === 1;
    case "attachment":
      return (await tx.documentAttachment.updateMany({
        where: { id: link.id, fileObjectId: null }, data: { fileObjectId },
      })).count === 1;
    case "dossierItem":
      return (await tx.dossierItem.updateMany({
        where: { id: link.id, fileObjectId: null }, data: { fileObjectId },
      })).count === 1;
    case "meeting":
      return (await tx.meeting.updateMany({
        where: { id: link.id, materialsFileObjectId: null }, data: { materialsFileObjectId: fileObjectId },
      })).count === 1;
  }
}

async function main() {
  const links = await collectLegacyLinks();
  const groups = new Map<string, LegacyLink[]>();
  const unsupported = links.length;
  for (const link of links) {
    const key = toStorageKey(link.fileUrl);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(link);
    groups.set(key, group);
  }

  let missing = 0;
  let linked = 0;
  let skipped = 0;
  for (const [storageKey, references] of groups) {
    let filePath: string;
    let realPath: string;
    try {
      filePath = resolveSafeFilePath(storageKey);
      realPath = await fs.realpath(filePath);
      const uploadsRoot = await fs.realpath(path.resolve(process.env.UPLOADS_DIR || "./uploads"));
      if (!realPath.startsWith(`${uploadsRoot}${path.sep}`)) throw new Error("Path escapes uploads root");
    } catch {
      missing += references.length;
      continue;
    }
    const stat = await fs.stat(realPath);
    if (!stat.isFile()) {
      missing += references.length;
      continue;
    }
    const contentHash = await hashFile(realPath);
    const uploader = references.find((reference) => reference.uploadedById)?.uploadedById;
    if (!uploader) {
      skipped += references.length;
      continue;
    }

    if (!apply) {
      linked += references.length;
      continue;
    }

    const attached = await prisma.$transaction(async (tx) => {
      let fileObject = await tx.fileObject.findUnique({ where: { storageKey } });
      if (fileObject && fileObject.contentHash !== contentHash) {
        throw new Error(`Checksum conflict for storage key ${storageKey}`);
      }
      if (!fileObject) {
        fileObject = await tx.fileObject.create({
          data: {
            storageKey,
            originalName: path.basename(references[0].originalName).slice(0, 255) || path.basename(storageKey),
            mimeType: getMimeType(storageKey),
            extension: path.extname(storageKey).toLowerCase(),
            byteSize: BigInt(stat.size),
            contentHash,
            scanStatus: FileScanStatus.PENDING,
            referenceCount: 0,
            uploadedById: uploader,
            metadata: { backfilled: true },
          },
        });
      }
      let count = 0;
      for (const reference of references) {
        if (await attachFileObject(tx, reference, fileObject.id)) count += 1;
      }
      if (count > 0) {
        await tx.fileObject.update({
          where: { id: fileObject.id },
          data: { referenceCount: { increment: count } },
        });
      }
      return count;
    });
    linked += attached;
  }

  const parity = await prisma.$transaction([
    prisma.taskDeliverable.count({ where: { fileUrl: { not: "" } } }),
    prisma.taskDeliverable.count({ where: { fileUrl: { not: "" }, fileObjectId: { not: null } } }),
    prisma.documentAttachment.count(),
    prisma.documentAttachment.count({ where: { fileObjectId: { not: null } } }),
    prisma.dossierItem.count({ where: { fileObjectId: { not: null } } }),
    prisma.meeting.count({ where: { materialsUrl: { not: null }, materialsFileObjectId: { not: null } } }),
  ]);

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    candidates: links.length,
    localStorageKeys: groups.size,
    linkedOrEligible: linked,
    missingOrUnsafeFiles: missing,
    skippedMissingUploader: skipped,
    unsupportedLegacyValues: unsupported - [...groups.values()].reduce((sum, group) => sum + group.length, 0),
    parity: {
      taskDeliverables: { total: parity[0], linked: parity[1] },
      documentAttachments: { total: parity[2], linked: parity[3] },
      dossierItemsLinked: parity[4],
      meetingsWithCanonicalMaterials: parity[5],
    },
    note: "Backfilled records are PENDING scan and must remain quarantined until a trusted scanner records CLEAN.",
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[backfill-file-objects] FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
