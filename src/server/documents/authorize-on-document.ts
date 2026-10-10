/**
 * Kiểm quyền trên một văn bản theo capability bằng engine canonical (ADR-002), dùng cho các
 * dịch vụ duyệt tờ trình. Không kiểm role chuỗi.
 */
import { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/jwt-session";
import { authorize } from "@/server/authorization/authorization-engine";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import type { AuthorizationResource } from "@/server/authorization/resource";
import type { CapabilityAction } from "@/server/authorization/capability";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/api/errors";

export async function loadSubmissionDocument(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { approvalWorkflow: { include: { steps: true } } } });
  if (!doc) throw new NotFoundError("Không tìm thấy văn bản", "DOCUMENT_NOT_FOUND");
  if (doc.type !== DocumentType.TO_TRINH_NOI_BO) {
    throw new ValidationError("Chỉ tờ trình nội bộ mới có luồng duyệt này", undefined, "NOT_A_SUBMISSION");
  }
  return doc;
}

export function submissionResource(
  doc: { id: string; securityLevel: string; status: string; registeredById: string },
  relatedUserId?: string
): AuthorizationResource {
  return {
    // Người duyệt được chỉ định là người nhận của tờ trình: bộ lọc phân loại văn bản nội bộ coi là có quan hệ trực tiếp.
    ...(relatedUserId ? { targetUserId: relatedUserId } : {}),
    id: doc.id,
    type: "document",
    securityLevel: doc.securityLevel,
    status: doc.status,
    creatorId: doc.registeredById,
    registeredById: doc.registeredById,
    drafterId: doc.registeredById,
  };
}

export async function loadContext(session: SessionPayload): Promise<AuthorizationContext> {
  return loadAuthorizationContext(session.id, new Date(), { useCache: true, ttlMs: 10_000 });
}

/** `related` = người dùng đã được xác minh là người duyệt của một bước trên tờ trình này. */
export function canDo(ctx: AuthorizationContext, action: CapabilityAction, doc: Parameters<typeof submissionResource>[0], related = false): boolean {
  return authorize(ctx, action, submissionResource(doc, related ? ctx.userId : undefined)).allowed;
}

export function assertCan(ctx: AuthorizationContext, action: CapabilityAction, doc: Parameters<typeof submissionResource>[0]): void {
  const decision = authorize(ctx, action, submissionResource(doc));
  if (!decision.allowed) throw new ForbiddenError(decision.reason || "Bạn không có quyền thực hiện thao tác này");
}
