import { z } from "zod";
import { getDocumentById, setDocumentMark } from "@/server/documents/document-service";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { canReadDocument } from "@/server/policies/document-policy";
import { ForbiddenError, NotFoundError } from "@/server/api/errors";
import { documentActionRoute } from "../shared";

const MarkSchema = z.object({ marked: z.boolean() }).strict();

/** Đánh dấu / hủy đánh dấu văn bản cho riêng người dùng; chỉ người đọc được văn bản mới đánh dấu được. */
export const POST = documentActionRoute(MarkSchema, async (user, body, { documentId }) => {
  const [document, authContext] = await Promise.all([getDocumentById(documentId), loadAuthorizationContext(user.id)]);
  if (!document) throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
  if (!canReadDocument(authContext, document)) throw new ForbiddenError("Bạn không có quyền truy cập văn bản này");

  await setDocumentMark(documentId, user.id, body.marked);
  return { marked: body.marked };
});
