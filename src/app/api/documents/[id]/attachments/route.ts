import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
  parseAndValidateJson,
} from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";
import { canUpdateDocument } from "@/server/policies/document-policy";
import { getDocumentById } from "@/lib/documents/document-service";
import { isDocumentImmutable } from "@/lib/documents/state-machine";
import { logAuditEvent } from "@/lib/db/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/api/errors";
import { loadAuthorizationContext } from "@/server/authorization";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Tệp đã tải lên qua `POST /api/upload`; tên, dung lượng, định dạng lấy từ máy chủ, không tin client. */
const AddAttachmentSchema = z.object({ fileId: z.string().trim().min(1).max(64) }).strict();

/**
 * Bổ sung tệp cho văn bản đã có. Cùng điều kiện với cập nhật văn bản (PATCH): có quyền cập nhật
 * và văn bản chưa bất biến (đã ký/ban hành/hoàn thành/lưu trữ). Chỉ gắn được tệp do chính người dùng tải lên.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  let requestId = crypto.randomUUID();
  try {
    assertCsrf(request);
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_JSON_BODY_SIZE);

    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const authUser = requireAuthenticated(apiContext);
    await assertRateLimit(authUser.id, "MUTATION");

    const { id } = await context.params;
    const { fileId } = await parseAndValidateJson(request, AddAttachmentSchema);

    const document = await getDocumentById(id);
    if (!document) throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");

    const authContext = await loadAuthorizationContext(authUser.id);
    if (!canUpdateDocument(authContext, document)) {
      throw new ForbiddenError("Bạn không có quyền bổ sung tệp cho văn bản này");
    }
    if (isDocumentImmutable(document)) {
      throw new ValidationError(
        "Văn bản đã được ký hoặc đã ban hành/hoàn thành/lưu trữ, không thể bổ sung tệp.",
        undefined,
        "IMMUTABLE_DOCUMENT"
      );
    }

    const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file || file.isArchived || file.uploadedById !== authUser.id) {
      throw new NotFoundError("Không tìm thấy tệp đã tải lên", "FILE_NOT_FOUND");
    }
    if (file.scanStatus === "INFECTED") {
      throw new ValidationError("Tệp không an toàn, không thể đính kèm.", undefined, "FILE_INFECTED");
    }

    const attachment = await prisma.$transaction(async (tx) => {
      const created = await tx.documentAttachment.create({
        data: {
          documentId: id,
          fileName: file.originalName,
          fileUrl: `/api/file-objects/${file.id}`,
          fileObjectId: file.id,
          fileSize: Number(file.byteSize),
          mimeType: file.mimeType,
          sha256Hash: file.contentHash,
          isOriginal: false,
        },
      });
      await logAuditEvent(tx, {
        actorId: authUser.id,
        action: "DOCUMENT_ATTACHMENT_ADDED",
        entityType: "Document",
        entityId: id,
        requestId,
        metadata: { attachmentId: created.id, fileName: created.fileName },
      });
      return created;
    });

    return apiSuccess({ attachment }, { requestId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
