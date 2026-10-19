/**
 * Đọc chi tiết văn bản cho một người dùng, dùng chung cho GET /api/documents/[id] và công cụ của Trợ lý.
 * Giữ nguyên thứ tự kiểm quyền của route, gồm nhánh người tham gia luồng duyệt tờ trình.
 */
import { getDocumentById } from "@/server/documents/document-service";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { authorize, isUnitLeaderPosition } from "@/server/authorization/authorization-engine";
import { buildDocumentResource } from "@/server/authorization/available-actions";
import { canReadDocument } from "@/server/policies/document-policy";
import { ForbiddenError, NotFoundError } from "@/server/api/errors";
import { isApprovalParticipant } from "@/server/documents/submission-approval-service";
import type { DocumentItem } from "@qcet/contracts/types/document";

export async function readDocumentForUser(
  authContext: AuthorizationContext,
  documentId: string
): Promise<{
  document: DocumentItem;
  docResource: ReturnType<typeof buildDocumentResource>;
  isParticipant: boolean;
}> {
  const document = await getDocumentById(documentId);
  if (!document) {
    throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
  }

  const docResource = buildDocumentResource(document);
  const readDecision = authorize(authContext, "document.read", docResource);
  // Người tham gia luồng duyệt tờ trình được đọc tờ trình đó dù không liên quan theo chính sách chung.
  const headedUnitIds = authContext.positions.filter((p) => isUnitLeaderPosition(p.positionCode)).map((p) => p.unitId);
  const isParticipant =
    document.type === "TO_TRINH_NOI_BO" && (await isApprovalParticipant(authContext.userId, headedUnitIds, documentId));
  if (!isParticipant && (!readDecision.allowed || !canReadDocument(authContext, document))) {
    throw new ForbiddenError(readDecision.reason || "Bạn không có quyền truy cập văn bản này (Forbidden)");
  }

  return { document, docResource, isParticipant };
}
