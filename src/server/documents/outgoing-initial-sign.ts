/**
 * Ký nháy văn bản đi (V-09, D01, spec task-document-gap-spec.md): tùy chọn, không bắt buộc để đi tiếp.
 *
 * Người có thẩm quyền (trưởng đơn vị, lãnh đạo) xác nhận bản nháp trước khi lãnh đạo ký chính thức.
 * Ghi thành SignatureRecord loại INITIAL của phiên bản hiện tại. Người soạn thảo không tự ký nháy,
 * mỗi người một lần mỗi phiên bản; hết hiệu lực khi văn bản sang phiên bản mới (bản sửa đổi).
 * Ký từ xa qua dịch vụ ký số chưa làm: cần chọn nhà cung cấp (ADR-V08).
 */
import { z } from "zod";
import { OutgoingDocumentStatus, SignatureType, SignatureVerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/jwt-session";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import { authorize } from "@/server/authorization/authorization-engine";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { loadContext, submissionResource } from "@/server/documents/authorize-on-document";

export const InitialSignSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();

const OPEN_STATUSES: ReadonlySet<OutgoingDocumentStatus> = new Set([
  OutgoingDocumentStatus.CONTENT_REVIEW,
  OutgoingDocumentStatus.FORMAT_CHECK,
  OutgoingDocumentStatus.AUTHORIZED_SIGN,
]);

/**
 * Người này ký nháy được văn bản này lúc này không. Văn bản nội bộ chỉ mở cho đơn vị soạn thảo, nên tài nguyên
 * mang đơn vị của người soạn thảo: trưởng đơn vị soạn thảo và lãnh đạo ký nháy được, trưởng đơn vị khác thì không.
 */
export async function evaluateInitialSign(
  ctx: AuthorizationContext,
  userId: string,
  doc: { id: string; securityLevel: string; status: string; registeredById: string },
  wf: { status: OutgoingDocumentStatus; currentVersion: number; authorizedSignedAt: Date | null }
): Promise<{ allowed: true } | { allowed: false; code: "FORBIDDEN" | "INITIAL_SIGN_NOT_ALLOWED" | "INITIAL_SIGN_DUPLICATE"; message: string }> {
  const drafterUnit = await prisma.positionAssignment.findFirst({
    where: { userId: doc.registeredById, status: "ACTIVE" },
    orderBy: { effectiveFrom: "desc" },
    select: { unitId: true },
  });
  const resource = { ...submissionResource(doc), ...(drafterUnit ? { draftingUnitId: drafterUnit.unitId } : {}) };
  const decision = authorize(ctx, "document.outgoing.initial_sign", resource);
  if (!decision.allowed || doc.registeredById === userId) {
    return { allowed: false, code: "FORBIDDEN", message: decision.reason || "Bạn không có quyền ký nháy văn bản này" };
  }
  if (!OPEN_STATUSES.has(wf.status) || wf.authorizedSignedAt) {
    return { allowed: false, code: "INITIAL_SIGN_NOT_ALLOWED", message: "Chỉ ký nháy khi văn bản đang soát xét và lãnh đạo chưa ký chính thức" };
  }
  const already = await prisma.signatureRecord.count({
    where: { documentId: doc.id, version: wf.currentVersion, signerUserId: userId, signatureType: SignatureType.INITIAL },
  });
  if (already > 0) return { allowed: false, code: "INITIAL_SIGN_DUPLICATE", message: "Bạn đã ký nháy phiên bản này" };
  return { allowed: true };
}

export async function initialSignOutgoing(session: SessionPayload, documentId: string, input: unknown, now = new Date()) {
  const { note } = InitialSignSchema.parse(input ?? {});
  const wf = await prisma.documentOutgoingWorkflow.findUnique({ where: { documentId }, include: { document: true } });
  if (!wf) throw new NotFoundError("Không tìm thấy văn bản đi", "DOCUMENT_NOT_FOUND");
  const ctx = await loadContext(session);
  const verdict = await evaluateInitialSign(ctx, session.id, wf.document, wf);
  if (!verdict.allowed) {
    if (verdict.code === "FORBIDDEN") throw new ForbiddenError(verdict.message);
    throw new ConflictError(verdict.message, verdict.code);
  }

  return prisma.$transaction(async (tx) => {
    // Khóa dòng quy trình để hai lần bấm đồng thời không ghi hai bản ký nháy.
    await tx.$queryRaw`SELECT id FROM document_outgoing_workflows WHERE id = ${wf.id} FOR UPDATE`;
    const existing = await tx.signatureRecord.findFirst({
      where: { documentId, version: wf.currentVersion, signerUserId: session.id, signatureType: SignatureType.INITIAL },
      select: { id: true },
    });
    if (existing) throw new ConflictError("Bạn đã ký nháy phiên bản này", "INITIAL_SIGN_DUPLICATE");
    const position = (ctx.positions ?? []).find((p) => !p.effectiveTo || new Date(p.effectiveTo) >= now);
    const record = await tx.signatureRecord.create({
      data: {
        documentId,
        version: wf.currentVersion,
        signerUserId: session.id,
        signingCapacity: `Ký nháy${position?.positionTitle ? ` - ${position.positionTitle}` : ""}`.slice(0, 100),
        signatureType: SignatureType.INITIAL,
        certificateMetadata: { kind: "INITIAL", ...(note ? { note } : {}) },
        signedAt: now,
        verificationStatus: SignatureVerificationStatus.VALID,
      },
    });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.OUTGOING_INITIAL_SIGNED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: documentId,
      beforeData: null,
      afterData: { signatureRecordId: record.id, version: wf.currentVersion, status: wf.status },
    });
    return { id: record.id, documentId, version: wf.currentVersion, signedAt: now.toISOString() };
  });
}
