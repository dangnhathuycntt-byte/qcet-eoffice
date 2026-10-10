/**
 * Trạng thái chữ ký số của văn bản (V-03): kiểm lại văn bản đến, đọc trạng thái.
 * Kiểm khi nhận nằm trong `registerIncomingDocument`. Văn thư (document.incoming.register) kiểm lại.
 */
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/jwt-session";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { ConflictError, NotFoundError } from "@/server/api/errors";
import { buildDocumentReadWhere } from "@/server/policies/document-policy";
import { loadContext, canDo, assertCan } from "@/server/documents/authorize-on-document";
import { isSignatureFlagged, verifySignatureSafely } from "@/server/documents/signature-verifier";
import { evaluateInitialSign } from "@/server/documents/outgoing-initial-sign";

export interface SignatureState {
  documentId: string;
  /** Kết quả kiểm chữ ký của bên gửi (văn bản đến); null với văn bản khác. */
  incoming: {
    status: string;
    flagged: boolean;
    detail: string | null;
    checkedAt: string | null;
  } | null;
  /** Chữ ký do hệ thống tạo cho văn bản đi. */
  records: Array<{ id: string; signatureType: string; signerName: string | null; signedAt: string; verificationStatus: string; version: number }>;
  canRecheck: boolean;
  /** Người xem ký nháy được văn bản đi này lúc này (V-09). */
  canInitialSign: boolean;
}

export async function getSignatureState(session: SessionPayload, documentId: string): Promise<SignatureState> {
  const ctx = await loadContext(session);
  const include = {
    incomingWorkflow: { select: { signatureStatus: true, signatureDetail: true, signatureCheckedAt: true } },
    outgoingWorkflow: { select: { status: true, currentVersion: true, authorizedSignedAt: true } },
    signatures: { orderBy: { signedAt: "asc" as const }, include: { signerUser: { select: { name: true } } } },
  };
  const readable = await prisma.document.findFirst({ where: { AND: [{ id: documentId }, buildDocumentReadWhere(ctx)] }, include });
  // Người có quyền ký nháy (trưởng đơn vị soạn thảo, lãnh đạo) và người đã ký nháy cần thấy bản ghi dù văn bản chưa nằm trong danh sách đọc.
  const doc = readable ?? (await prisma.document.findUnique({ where: { id: documentId }, include }));
  if (!doc) throw new NotFoundError("Không tìm thấy văn bản", "DOCUMENT_NOT_FOUND");
  const initial = doc.outgoingWorkflow ? await evaluateInitialSign(ctx, session.id, doc, doc.outgoingWorkflow) : null;
  const participated = doc.signatures.some((r) => r.signerUserId === session.id);
  if (!readable && !initial?.allowed && !participated) throw new NotFoundError("Không tìm thấy văn bản", "DOCUMENT_NOT_FOUND");
  const wf = doc.incomingWorkflow;
  return {
    documentId,
    incoming:
      readable && wf
        ? { status: wf.signatureStatus, flagged: isSignatureFlagged(wf.signatureStatus), detail: wf.signatureDetail, checkedAt: wf.signatureCheckedAt?.toISOString() ?? null }
        : null,
    records: doc.signatures.map((r) => ({
      id: r.id,
      signatureType: r.signatureType,
      signerName: r.signerUser?.name ?? null,
      signedAt: r.signedAt.toISOString(),
      verificationStatus: r.verificationStatus,
      version: r.version,
    })),
    canRecheck: Boolean(readable && wf) && canDo(ctx, "document.incoming.register", doc),
    canInitialSign: Boolean(initial?.allowed),
  };
}

export async function recheckIncomingSignature(session: SessionPayload, documentId: string, now = new Date()) {
  const ctx = await loadContext(session);
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { incomingWorkflow: true, attachments: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!doc) throw new NotFoundError("Không tìm thấy văn bản", "DOCUMENT_NOT_FOUND");
  assertCan(ctx, "document.incoming.register", doc);
  if (!doc.incomingWorkflow) throw new ConflictError("Chỉ kiểm chữ ký của văn bản đến", "NOT_AN_INCOMING_DOCUMENT");

  const attachment = doc.attachments[0];
  const result = await verifySignatureSafely({ documentId, fileUrl: attachment?.fileUrl ?? null, fileName: attachment?.fileName ?? null, mimeType: attachment?.mimeType ?? null });
  await prisma.$transaction(async (tx) => {
    await tx.documentIncomingWorkflow.update({
      where: { documentId },
      data: { signatureStatus: result.status, signatureDetail: result.detail, signatureCheckedAt: now },
    });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOCUMENT_SIGNATURE_VERIFIED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: documentId,
      beforeData: { status: doc.incomingWorkflow!.signatureStatus },
      afterData: { status: result.status, detail: result.detail },
    });
  });
  return { documentId, status: result.status, flagged: isSignatureFlagged(result.status), detail: result.detail, checkedAt: now.toISOString() };
}
