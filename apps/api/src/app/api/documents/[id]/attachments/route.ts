import { NextRequest } from "next/server";
import { z } from "zod";
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
import { addUploadedFileAttachment, getDocumentById } from "@/server/documents/document-service";
import { isDocumentImmutable } from "@/server/documents/state-machine";
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

    const attachment = await addUploadedFileAttachment({ documentId: id, fileId, actorId: authUser.id, requestId });

    return apiSuccess({ attachment }, { requestId });
  } catch (error) {
    return apiError(error, requestId);
  }
}
