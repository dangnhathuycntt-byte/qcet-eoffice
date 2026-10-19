/**
 * Tệp gửi kèm câu hỏi của Trợ lý (lưu từ 19/10/2026; trước đó tệp chỉ đi theo lượt và mất khi tải lại trang).
 * Mỗi tệp là một FileObject gắn với cuộc và tin qua `metadata` (như `metadata.taskId` của ảnh nhúng nhiệm vụ), không thêm
 * bảng hay cột: `{ assistantConversationId, assistantMessageIds }`, mảng vì "Thử lại" gắn cùng tệp vào câu hỏi mới.
 * - Chỉ chủ cuộc tải được (`authorizeFileObjectDownload`); xóa cuộc hay quá hạn lưu giữ thì xóa tệp qua outbox.
 * - Lượt sau đọc lại tệp của các câu hỏi còn trong lịch sử gửi mô hình (như ChatGPT giữ tệp trong cuộc).
 * - Tệp quét ra nhiễm hoặc quét lỗi không gửi lại; tệp đang chờ quét vẫn gửi, như lượt gửi kèm vốn gửi tệp chưa quét.
 */
import fs from "node:fs/promises";
import { FileScanStatus, Prisma, type FileObject } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import type { DbClient } from "@qcet/db/outbox";
import type { AssistantAttachmentDTO } from "@qcet/contracts/assistant";
import {
  TASK_AGENT_ATTACHMENT_MAX_FILES,
  TASK_AGENT_ATTACHMENT_MAX_TOTAL_BYTES,
  getTaskAgentAttachmentKind,
} from "@qcet/shared/domain/tasks/task-agent-attachments";
import type { TaskAgentContentPart } from "@qcet/shared/domain/tasks/task-agent-draft";
import { storeUploadedFile } from "@/server/files/file-service";
import { resolveSafeFilePath } from "@/server/files/storage";
import { requestFileObjectPurges } from "@/server/files/file-object-purge";
import { logger } from "@/server/observability/logger";
import { prepareTaskAgentAttachment } from "@/server/services/task-agent-attachments";

/** Liên kết của tệp với Trợ lý, ghi trong `FileObject.metadata`. */
export interface AssistantFileLink {
  assistantConversationId: string;
  assistantMessageIds: string[];
}

export function assistantFileLinkOf(metadata: unknown): AssistantFileLink | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const { assistantConversationId, assistantMessageIds } = metadata as Record<string, unknown>;
  if (typeof assistantConversationId !== "string" || !assistantConversationId) return null;
  const ids = Array.isArray(assistantMessageIds) ? assistantMessageIds.filter((id): id is string => typeof id === "string" && id !== "") : [];
  return { assistantConversationId, assistantMessageIds: ids };
}

type StoredFileRow = Pick<FileObject, "id" | "originalName" | "byteSize" | "storageKey" | "metadata">;

const STORED_FILE_SELECT = { id: true, originalName: true, byteSize: true, storageKey: true, metadata: true } as const;

/** Tệp của một cuộc còn dùng được (chưa ẩn, không nhiễm, quét không lỗi); `userId` để chỉ lấy tệp của chủ cuộc. */
function conversationFilesWhere(conversationId: string, userId: string): Prisma.FileObjectWhereInput {
  return {
    uploadedById: userId,
    isArchived: false,
    scanStatus: { notIn: [FileScanStatus.INFECTED, FileScanStatus.FAILED] },
    metadata: { path: ["assistantConversationId"], equals: conversationId },
  };
}

export function toAssistantAttachmentDTO(file: Pick<FileObject, "id" | "originalName" | "byteSize">): AssistantAttachmentDTO {
  return {
    id: file.id,
    name: file.originalName,
    size: Number(file.byteSize),
    kind: getTaskAgentAttachmentKind(file.originalName) ?? "text",
    url: `/api/file-objects/${file.id}`,
  };
}

/**
 * Lưu một tệp mới của câu hỏi `messageId`. Lưu lỗi thì trả null và ghi log: lượt vẫn chạy, mô hình vẫn đọc được tệp
 * trong lượt này, chỉ là mở lại cuộc sẽ không còn tệp.
 */
export async function storeAssistantAttachment(input: {
  userId: string;
  conversationId: string;
  messageId: string;
  name: string;
  data: Buffer;
  requestId: string;
}): Promise<AssistantAttachmentDTO | null> {
  try {
    const row = await storeUploadedFile({
      uploadedById: input.userId,
      originalName: input.name,
      bytes: input.data,
      metadata: { assistantConversationId: input.conversationId, assistantMessageIds: [input.messageId] },
    });
    return toAssistantAttachmentDTO(row);
  } catch (error) {
    // Chỉ ghi tên lỗi: tên tệp và nội dung có thể chứa dữ liệu
    logger.warn("assistant.attachment.store_failed", { requestId: input.requestId, errorName: error instanceof Error ? error.name : "unknown" });
    return null;
  }
}

/** Gắn thêm câu hỏi `messageId` vào các tệp đã lưu (thử lại câu hỏi có tệp). */
export async function linkAssistantAttachments(fileIds: readonly string[], messageId: string): Promise<void> {
  for (const id of fileIds) {
    await prisma.$transaction(async (tx) => {
      const row = await tx.fileObject.findUnique({ where: { id }, select: { metadata: true } });
      const link = assistantFileLinkOf(row?.metadata);
      if (!row || !link || link.assistantMessageIds.includes(messageId)) return;
      const metadata = { ...(row.metadata as Record<string, unknown>), assistantMessageIds: [...link.assistantMessageIds, messageId] };
      await tx.fileObject.update({ where: { id }, data: { metadata: metadata as Prisma.InputJsonValue } });
    });
  }
}

/** Tệp đã lưu của cuộc, theo từng câu hỏi (mã tin), để dựng DTO chi tiết cuộc. */
export async function listConversationAttachments(userId: string, conversationId: string): Promise<Map<string, AssistantAttachmentDTO[]>> {
  const rows = await prisma.fileObject.findMany({
    where: conversationFilesWhere(conversationId, userId),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, originalName: true, byteSize: true, metadata: true },
  });
  const byMessage = new Map<string, AssistantAttachmentDTO[]>();
  for (const row of rows) {
    for (const messageId of assistantFileLinkOf(row.metadata)?.assistantMessageIds ?? []) {
      byMessage.set(messageId, [...(byMessage.get(messageId) ?? []), toAssistantAttachmentDTO(row)]);
    }
  }
  return byMessage;
}

/** Tệp đã lưu theo mã, chỉ khi thuộc cuộc `conversationId` của `userId`; giữ thứ tự mã gửi lên, mã lạ bị bỏ. */
export async function findConversationAttachments(userId: string, conversationId: string, ids: readonly string[]): Promise<StoredFileRow[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.fileObject.findMany({
    where: { ...conversationFilesWhere(conversationId, userId), id: { in: [...ids] } },
    select: STORED_FILE_SELECT,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

export function readStoredAttachment(file: Pick<FileObject, "storageKey">): Promise<Buffer> {
  return fs.readFile(resolveSafeFilePath(file.storageKey));
}

/**
 * Nội dung gửi mô hình của tệp đã lưu ở các câu hỏi `messageIds` (câu hỏi còn trong lịch sử của lượt), để lượt sau vẫn
 * đọc được tệp. Ưu tiên câu hỏi mới, tối đa bằng giới hạn tệp và dung lượng của một lượt; bỏ tệp trong `skipIds` (đã gửi
 * ở câu hỏi hiện tại). Tệp đọc lỗi bỏ qua.
 */
export async function loadHistoryAttachmentParts(
  userId: string,
  conversationId: string,
  messageIds: readonly string[],
  skipIds: ReadonlySet<string>,
): Promise<Map<string, TaskAgentContentPart[]>> {
  const out = new Map<string, TaskAgentContentPart[]>();
  if (messageIds.length === 0) return out;
  const rows = await prisma.fileObject.findMany({
    where: conversationFilesWhere(conversationId, userId),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: STORED_FILE_SELECT,
  });
  const wanted = new Set(messageIds);
  const used = new Set(skipIds);
  let count = 0;
  let bytes = 0;
  for (const messageId of [...messageIds].reverse()) {
    if (!wanted.has(messageId)) continue;
    for (const row of rows) {
      if (used.has(row.id) || !assistantFileLinkOf(row.metadata)?.assistantMessageIds.includes(messageId)) continue;
      const size = Number(row.byteSize);
      if (count >= TASK_AGENT_ATTACHMENT_MAX_FILES || bytes + size > TASK_AGENT_ATTACHMENT_MAX_TOTAL_BYTES) return out;
      try {
        const { parts } = await prepareTaskAgentAttachment(row.originalName, await readStoredAttachment(row));
        out.set(messageId, [...(out.get(messageId) ?? []), ...parts]);
        used.add(row.id);
        count += 1;
        bytes += size;
      } catch {
        logger.warn("assistant.attachment.read_failed", { fileObjectId: row.id });
      }
    }
  }
  return out;
}

/** Mã tệp của các cuộc (kể cả tệp đã ẩn), để xóa theo cuộc. Gọi trong giao dịch xóa cuộc. */
async function attachmentIdsOfConversations(db: DbClient, conversationIds: readonly string[]): Promise<string[]> {
  if (conversationIds.length === 0) return [];
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM file_objects WHERE metadata->>'assistantConversationId' = ANY(${[...conversationIds]}::text[])`;
  return rows.map((row) => row.id);
}

/**
 * Ghi yêu cầu xóa tệp của các cuộc vào outbox, trong cùng giao dịch xóa cuộc. Handler xóa tệp chỉ xóa khi không còn
 * tham chiếu (`countFileObjectReferences` đếm cuộc Trợ lý), nên gọi sau khi đã xóa cuộc.
 */
export async function requestAssistantAttachmentPurges(
  db: DbClient,
  conversationIds: readonly string[],
  requestedById: string | null,
): Promise<string[]> {
  const ids = await attachmentIdsOfConversations(db, conversationIds);
  if (ids.length === 0) return [];
  return requestFileObjectPurges(db, ids, { requestedById, reason: "assistant_conversation_deleted" });
}
