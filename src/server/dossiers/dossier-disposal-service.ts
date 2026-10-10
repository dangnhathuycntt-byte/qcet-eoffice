/**
 * Xét hủy và gia hạn bảo quản hồ sơ (V-07, spec task-document-gap-spec.md).
 *
 * - Văn thư (dossier.propose_disposal) lập đề nghị kèm số biên bản khi hồ sơ đã lưu trữ và hết hạn
 *   bảo quản. Bảo quản vĩnh viễn không xét hủy.
 * - Lãnh đạo (dossier.dispose) quyết định hủy hoặc gia hạn. Văn thư không tự quyết định.
 * - Hủy là xóa mềm: hồ sơ không còn trong tra cứu thường. Chỉ quản trị hệ thống (dossier.purge) xóa
 *   hẳn, sau khi có quyết định hủy và biên bản, và không đọc nội dung hồ sơ.
 */
import { z } from "zod";
import { DossierStatus, type DossierDisposalProposal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import type { SessionPayload } from "@/lib/jwt-session";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/api/errors";
import { SeparationOfDutiesError } from "@/server/authorization/errors";
import { authorize } from "@/server/authorization/authorization-engine";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import type { CapabilityAction } from "@/server/authorization/capability";
import { isPermanent, isRetentionExpired, retentionEnd, validateExtendYears } from "@/domain/dossiers/disposal-rules";
import { requestFileObjectPurges } from "@/server/files/file-object-purge";

export const ProposeDisposalSchema = z
  .object({
    minutesReference: z.string().trim().min(3, "Cần ghi số biên bản xét hủy").max(100),
    reason: z.string().trim().min(3, "Cần nêu lý do đề nghị").max(1000),
  })
  .strict();

export const DecideDisposalSchema = z
  .object({
    proposalId: z.string().trim().min(1),
    decision: z.enum(["DISPOSE", "EXTEND"]),
    extendYears: z.number().int().min(1).max(70).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export type ProposeDisposalInput = z.infer<typeof ProposeDisposalSchema>;
export type DecideDisposalInput = z.infer<typeof DecideDisposalSchema>;

async function loadDossier(id: string, options: { includeDisposed?: boolean } = {}) {
  const dossier = await prisma.workDossier.findUnique({ where: { id }, include: { retentionRule: true } });
  if (!dossier || (dossier.disposedAt && !options.includeDisposed)) throw new NotFoundError("Không tìm thấy hồ sơ");
  return dossier;
}

function resource(dossier: { id: string; status: string; responsiblePersonId: string }) {
  return { id: dossier.id, type: "dossier" as const, status: dossier.status, dossierOwnerId: dossier.responsiblePersonId };
}

function assertCan(ctx: AuthorizationContext, action: CapabilityAction, dossier: Parameters<typeof resource>[0]) {
  const decision = authorize(ctx, action, resource(dossier));
  if (!decision.allowed) throw new ForbiddenError(decision.reason || "Bạn không có quyền thực hiện thao tác này");
}

const can = (ctx: AuthorizationContext, action: CapabilityAction, dossier: Parameters<typeof resource>[0]) =>
  authorize(ctx, action, resource(dossier)).allowed;

function retentionInput(d: { archivedAt: Date | null; retentionExtraYears: number; retentionRule: { durationYears: number | null } | null }) {
  return { archivedAt: d.archivedAt, ruleYears: d.retentionRule ? d.retentionRule.durationYears : null, extraYears: d.retentionExtraYears };
}

export interface DisposalState {
  dossierId: string;
  permanent: boolean;
  retentionEndsAt: string | null;
  expired: boolean;
  disposed: boolean;
  open: { id: string; minutesReference: string; reason: string; createdAt: string } | null;
  history: Array<{ id: string; status: string; minutesReference: string; decidedAt: string | null; extendYears: number | null; decisionNote: string | null }>;
  canPropose: boolean;
  canDecide: boolean;
}

export async function getDisposalState(session: SessionPayload, dossierId: string, now = new Date()): Promise<DisposalState> {
  const dossier = await loadDossier(dossierId, { includeDisposed: true });
  const ctx = await loadAuthorizationContext(session.id, now, { useCache: true, ttlMs: 10_000 });
  // Xem trạng thái xét hủy dành cho người có thẩm quyền liên quan.
  if (!can(ctx, "dossier.propose_disposal", dossier) && !can(ctx, "dossier.dispose", dossier) && dossier.responsiblePersonId !== session.id) {
    throw new ForbiddenError("Bạn không có quyền xem thông tin xét hủy hồ sơ này");
  }
  const input = retentionInput(dossier);
  const proposals = await prisma.dossierDisposalProposal.findMany({ where: { dossierId }, orderBy: { createdAt: "desc" } });
  const open = proposals.find((p) => p.status === "PROPOSED") ?? null;
  const expired = isRetentionExpired(input, now) && dossier.status === DossierStatus.ARCHIVED;
  const end = retentionEnd(input);
  return {
    dossierId,
    permanent: isPermanent(input.ruleYears),
    retentionEndsAt: end ? end.toISOString() : null,
    expired,
    disposed: Boolean(dossier.disposedAt),
    open: open ? { id: open.id, minutesReference: open.minutesReference, reason: open.reason, createdAt: open.createdAt.toISOString() } : null,
    history: proposals
      .filter((p) => p.status !== "PROPOSED")
      .map((p) => ({ id: p.id, status: p.status, minutesReference: p.minutesReference, decidedAt: p.decidedAt?.toISOString() ?? null, extendYears: p.extendYears, decisionNote: p.decisionNote })),
    canPropose: expired && !dossier.disposedAt && !open && can(ctx, "dossier.propose_disposal", dossier),
    canDecide: Boolean(open) && !dossier.disposedAt && can(ctx, "dossier.dispose", dossier) && open!.proposedById !== session.id,
  };
}

export async function proposeDisposal(session: SessionPayload, dossierId: string, input: ProposeDisposalInput, now = new Date()) {
  const validated = ProposeDisposalSchema.parse(input);
  const dossier = await loadDossier(dossierId);
  const ctx = await loadAuthorizationContext(session.id, now, { useCache: true, ttlMs: 10_000 });
  assertCan(ctx, "dossier.propose_disposal", dossier);

  const retention = retentionInput(dossier);
  if (dossier.status !== DossierStatus.ARCHIVED) {
    throw new ConflictError("Chỉ xét hủy hồ sơ đã lưu trữ cơ quan", "DOSSIER_NOT_ARCHIVED");
  }
  if (isPermanent(retention.ruleYears)) {
    throw new ConflictError("Hồ sơ bảo quản vĩnh viễn hoặc chưa có thời hạn bảo quản nên không xét hủy", "DOSSIER_RETENTION_PERMANENT");
  }
  if (!isRetentionExpired(retention, now)) {
    throw new ConflictError("Hồ sơ chưa hết hạn bảo quản", "DOSSIER_RETENTION_NOT_EXPIRED");
  }

  return prisma.$transaction(async (tx) => {
    const open = await tx.dossierDisposalProposal.findFirst({ where: { dossierId, status: "PROPOSED" } });
    if (open) throw new ConflictError("Hồ sơ đang có đề nghị xét hủy chưa được quyết định", "DISPOSAL_ALREADY_PROPOSED");

    const proposal = await tx.dossierDisposalProposal.create({
      data: { dossierId, proposedById: session.id, minutesReference: validated.minutesReference, reason: validated.reason },
    });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOSSIER_DISPOSAL_PROPOSED,
      entityType: AuditEntityType.WORK_DOSSIER,
      entityId: dossierId,
      beforeData: null,
      afterData: { proposalId: proposal.id, minutesReference: validated.minutesReference },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOSSIER_DISPOSAL_PROPOSED_NOTIFICATION,
      aggregateType: OutboxAggregateType.WORK_DOSSIER,
      aggregateId: dossierId,
      payload: { dossierId, proposalId: proposal.id, proposedById: session.id },
    });
    return { proposalId: proposal.id, dossierId };
  });
}

export async function decideDisposal(session: SessionPayload, dossierId: string, input: DecideDisposalInput, now = new Date()) {
  const validated = DecideDisposalSchema.parse(input);
  const dossier = await loadDossier(dossierId);
  const ctx = await loadAuthorizationContext(session.id, now, { useCache: true, ttlMs: 10_000 });
  assertCan(ctx, "dossier.dispose", dossier);

  const proposal = await prisma.dossierDisposalProposal.findFirst({ where: { id: validated.proposalId, dossierId } });
  if (!proposal) throw new NotFoundError("Không tìm thấy đề nghị xét hủy");
  if (proposal.status !== "PROPOSED") throw new ConflictError("Đề nghị này đã được quyết định", "DISPOSAL_ALREADY_DECIDED");
  if (proposal.proposedById === session.id) {
    throw new SeparationOfDutiesError("Người lập đề nghị xét hủy không tự quyết định đề nghị của mình");
  }

  const retention = retentionInput(dossier);
  if (validated.decision === "EXTEND") {
    if (validated.extendYears === undefined) throw new ValidationError("Cần nhập số năm gia hạn");
    const problem = validateExtendYears(retention.ruleYears, retention.extraYears, validated.extendYears);
    if (problem) throw new ValidationError(problem);
  }

  return prisma.$transaction(async (tx) => {
    const claim = await tx.dossierDisposalProposal.updateMany({
      where: { id: proposal.id, status: "PROPOSED" },
      data: {
        status: validated.decision,
        decidedById: session.id,
        decidedAt: now,
        decisionNote: validated.note || null,
        extendYears: validated.decision === "EXTEND" ? validated.extendYears : null,
      },
    });
    if (claim.count !== 1) throw new ConflictError("Đề nghị này vừa được quyết định", "DISPOSAL_ALREADY_DECIDED");

    if (validated.decision === "DISPOSE") {
      await tx.workDossier.update({ where: { id: dossierId }, data: { disposedAt: now, disposedById: session.id } });
    } else {
      await tx.workDossier.update({ where: { id: dossierId }, data: { retentionExtraYears: { increment: validated.extendYears as number } } });
    }
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOSSIER_DISPOSAL_DECIDED,
      entityType: AuditEntityType.WORK_DOSSIER,
      entityId: dossierId,
      beforeData: { proposalId: proposal.id },
      afterData: { decision: validated.decision, extendYears: validated.extendYears ?? null, note: validated.note ?? null, minutesReference: proposal.minutesReference },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOSSIER_DISPOSAL_DECIDED_NOTIFICATION,
      aggregateType: OutboxAggregateType.WORK_DOSSIER,
      aggregateId: dossierId,
      payload: { dossierId, proposalId: proposal.id, decision: validated.decision, deciderId: session.id, extendYears: validated.extendYears ?? null },
    });
    return { dossierId, proposalId: proposal.id, decision: validated.decision, disposed: validated.decision === "DISPOSE" };
  });
}

/**
 * Xóa hẳn hồ sơ đã được quyết định hủy. Chỉ quản trị hệ thống (engine: dossier.purge) và chỉ khi có
 * quyết định hủy kèm số biên bản. Không đọc nội dung hồ sơ; nhật ký giữ số biên bản và mã hồ sơ.
 * Lưu ý: chỉ xóa bản ghi cơ sở dữ liệu của hồ sơ; tệp vật lý do quy trình dọn tệp xử lý riêng.
 */
export async function purgeDossier(session: SessionPayload, dossierId: string, now = new Date()) {
  const dossier = await loadDossier(dossierId, { includeDisposed: true });
  const ctx = await loadAuthorizationContext(session.id, now, { useCache: true, ttlMs: 10_000 });
  assertCan(ctx, "dossier.purge", dossier);

  if (!dossier.disposedAt) throw new ConflictError("Chỉ xóa hẳn hồ sơ đã có quyết định hủy", "DOSSIER_NOT_DISPOSED");
  const decision: DossierDisposalProposal | null = await prisma.dossierDisposalProposal.findFirst({
    where: { dossierId, status: "DISPOSE" },
    orderBy: { decidedAt: "desc" },
  });
  if (!decision || !decision.minutesReference.trim()) {
    throw new ConflictError("Thiếu biên bản xét hủy nên không xóa hẳn được", "DISPOSAL_MINUTES_MISSING");
  }

  // Chỉ xóa hồ sơ, các mục và tệp gắn trực tiếp vào mục. Văn bản, nhiệm vụ mà mục trỏ tới là bản ghi riêng
  // (sổ đăng ký, số, nhật ký) nên giữ nguyên; tệp chỉ bị xóa khi không còn bản ghi nào khác dùng (xét ở handler).
  return prisma.$transaction(async (tx) => {
    const items = await tx.dossierItem.findMany({ where: { dossierId, fileObjectId: { not: null } }, select: { fileObjectId: true } });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOSSIER_PURGED,
      entityType: AuditEntityType.WORK_DOSSIER,
      entityId: dossierId,
      beforeData: { code: dossier.code, title: dossier.title, disposedAt: dossier.disposedAt?.toISOString(), minutesReference: decision.minutesReference, decidedById: decision.decidedById },
      afterData: null,
    });
    await tx.workDossier.delete({ where: { id: dossierId } });
    const fileObjectIds = await requestFileObjectPurges(
      tx,
      items.map((i) => i.fileObjectId as string),
      { requestedById: session.id, reason: "DOSSIER_PURGED", dossierId }
    );
    return { dossierId, purged: true as const, minutesReference: decision.minutesReference, filePurgesRequested: fileObjectIds.length };
  });
}
