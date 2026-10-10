/**
 * Luồng duyệt tờ trình nội bộ (V-06, spec task-document-gap-spec.md).
 *
 * Chuyên viên trình → trưởng các đơn vị liên quan duyệt song song → lãnh đạo phê duyệt.
 * Dùng workflow riêng (Q13), không dùng luồng văn bản đi vì tờ trình không phát hành ra ngoài.
 * Mọi lệnh ghi: kiểm quyền bằng engine canonical, khóa dòng luồng, audit và outbox trong
 * cùng transaction. Người trình không tự duyệt (ADR-001).
 */
import { z } from "zod";
import {
  AssignmentStatus,
  Prisma,
  UnitStatus,
  type ApprovalStepStage,
  type DocumentApprovalStep,
  type DocumentApprovalWorkflow,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";
import { publishOutboxEvent, OutboxEventType, OutboxAggregateType } from "@/lib/db/outbox";
import type { SessionPayload } from "@/lib/jwt-session";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/api/errors";
import { SeparationOfDutiesError } from "@/server/authorization/errors";
import { isUnitLeaderPosition } from "@/server/authorization/authorization-engine";
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import {
  allowedDecisions,
  canSubmitFrom,
  canWithdraw,
  APPROVAL_STEP_TARGET_HOURS,
  decisionRequiresNote,
  documentStatusFor,
  hoursBetween,
  planUnitSteps,
  resolveOutcome,
  statusAfter,
  type ApprovalDecision,
} from "@/domain/documents/submission-rules";
import { assertCan, canDo, loadContext, loadSubmissionDocument } from "./authorize-on-document";

const READ_COMMITTED = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted } as const;
const NOTE = z.string().trim().max(1000);

export const SubmitApprovalSchema = z
  .object({ involvedUnitIds: z.array(z.string().trim().min(1)).max(20).optional(), note: NOTE.optional() })
  .strict();

export const DecideApprovalSchema = z
  .object({
    stepId: z.string().trim().min(1),
    decision: z.enum(["APPROVE", "REVISION", "REJECT"]),
    note: NOTE.optional(),
  })
  .strict();

export const ReassignStepSchema = z
  .object({
    stepId: z.string().trim().min(1),
    approverUserId: z.string().trim().min(1),
    reason: z.string().trim().min(3, "Cần ghi lý do thay người xử lý").max(1000),
  })
  .strict();

export const AskConsultationSchema = z
  .object({
    consultantId: z.string().trim().min(1),
    question: z.string().trim().min(3, "Cần nhập nội dung xin ý kiến").max(1000),
  })
  .strict();

export const AnswerConsultationSchema = z
  .object({ consultationId: z.string().trim().min(1), answer: z.string().trim().min(1, "Cần nhập ý kiến").max(2000) })
  .strict();

export type SubmitApprovalInput = z.infer<typeof SubmitApprovalSchema>;
export type DecideApprovalInput = z.infer<typeof DecideApprovalSchema>;
export type ReassignStepInput = z.infer<typeof ReassignStepSchema>;
export type AskConsultationInput = z.infer<typeof AskConsultationSchema>;
export type AnswerConsultationInput = z.infer<typeof AnswerConsultationSchema>;

// ---------------------------------------------------------------------------
// Vị trí và người tham gia
// ---------------------------------------------------------------------------

function unitsHeadedBy(ctx: AuthorizationContext): Set<string> {
  return new Set(ctx.positions.filter((p) => isUnitLeaderPosition(p.positionCode)).map((p) => p.unitId));
}

function ownUnitIds(ctx: AuthorizationContext): string[] {
  return [...new Set([...ctx.positions.map((p) => p.unitId), ...(ctx.primaryUnitIds ?? [])])];
}

/** Người có thể duyệt một bước: người được chỉ định thay, hoặc trưởng đơn vị của bước, hoặc lãnh đạo. */
function canActOnStep(
  ctx: AuthorizationContext,
  step: Pick<DocumentApprovalStep, "stage" | "unitId" | "approverUserId">,
  doc: Parameters<typeof canDo>[2]
): boolean {
  if (step.approverUserId) return step.approverUserId === ctx.userId;
  if (step.stage === "LEADER") return canDo(ctx, "document.submission.approve", doc);
  return Boolean(step.unitId) && unitsHeadedBy(ctx).has(step.unitId as string) && canDo(ctx, "document.submission.review_unit", doc, true);
}

async function recipientsForPendingSteps(db: Prisma.TransactionClient | typeof prisma, workflowId: string): Promise<string[]> {
  const steps = await db.documentApprovalStep.findMany({ where: { workflowId, status: "PENDING" } });
  const ids = new Set<string>();
  for (const step of steps) {
    if (step.approverUserId) {
      ids.add(step.approverUserId);
      continue;
    }
    const where =
      step.stage === "UNIT_HEAD"
        ? { unitId: step.unitId ?? "", status: AssignmentStatus.ACTIVE }
        : { status: AssignmentStatus.ACTIVE };
    const rows = await db.positionAssignment.findMany({ where, include: { positionDefinition: { select: { code: true } } } });
    for (const r of rows) {
      const code = r.positionDefinition.code.toUpperCase();
      const isExec = code === "HIEU_TRUONG" || code === "PHO_HIEU_TRUONG" || code.startsWith("PHO_HIEU_TRUONG") || code.startsWith("BGH");
      if (step.stage === "UNIT_HEAD" ? isUnitLeaderPosition(code) : isExec) ids.add(r.userId);
    }
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Trình
// ---------------------------------------------------------------------------

export async function submitForApproval(session: SessionPayload, documentId: string, input: SubmitApprovalInput) {
  const validated = SubmitApprovalSchema.parse(input);
  const doc = await loadSubmissionDocument(documentId);
  const ctx = await loadContext(session);
  assertCan(ctx, "document.submission.submit", doc);
  if (doc.registeredById !== session.id) throw new ForbiddenError("Chỉ người lập tờ trình được trình");

  const current = doc.approvalWorkflow?.status ?? null;
  if (!canSubmitFrom(current)) {
    throw new ConflictError("Tờ trình đang chờ duyệt hoặc đã có kết quả nên không trình lại được", "APPROVAL_NOT_SUBMITTABLE");
  }

  const headed = unitsHeadedBy(ctx);
  const involved = [...new Set([...ownUnitIds(ctx), ...(validated.involvedUnitIds ?? [])])];
  const units = involved.length
    ? await prisma.organizationalUnit.findMany({ where: { id: { in: involved } }, select: { id: true, status: true } })
    : [];
  const requestedMissing = (validated.involvedUnitIds ?? []).filter((id) => !units.some((u) => u.id === id));
  if (requestedMissing.length > 0) throw new ValidationError("Có đơn vị liên quan không tồn tại", { involvedUnitIds: requestedMissing });
  const inactive = units.filter((u) => u.status !== UnitStatus.ACTIVE && (validated.involvedUnitIds ?? []).includes(u.id));
  if (inactive.length > 0) throw new ValidationError("Có đơn vị liên quan không còn hoạt động", { involvedUnitIds: inactive.map((u) => u.id) });

  const plan = planUnitSteps({ involvedUnitIds: units.filter((u) => u.status === UnitStatus.ACTIVE).map((u) => u.id), headOfUnitIds: headed });
  const goesStraightToLeader = plan.pendingUnitIds.length === 0;

  return prisma.$transaction(async (tx) => {
    const workflow = doc.approvalWorkflow
      ? await tx.documentApprovalWorkflow.findUniqueOrThrow({ where: { id: doc.approvalWorkflow.id } })
      : await tx.documentApprovalWorkflow.create({ data: { documentId: doc.id } });

    // Khóa dòng luồng và kiểm lại trạng thái, để hai lần trình đồng thời không tạo hai vòng.
    const locked = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM document_approval_workflows WHERE id = ${workflow.id} FOR UPDATE`;
    if (!canSubmitFrom(locked[0].status as never)) {
      throw new ConflictError("Tờ trình vừa được trình bởi yêu cầu khác. Hãy tải lại.", "APPROVAL_NOT_SUBMITTABLE");
    }

    const round = workflow.round + 1;
    const now = new Date();
    for (const unitId of plan.skippedUnitIds) {
      await tx.documentApprovalStep.create({
        data: { workflowId: workflow.id, round, stage: "UNIT_HEAD", unitId, status: "SKIPPED", note: "Người trình là trưởng đơn vị", decidedAt: now },
      });
    }
    for (const unitId of plan.pendingUnitIds) {
      await tx.documentApprovalStep.create({ data: { workflowId: workflow.id, round, stage: "UNIT_HEAD", unitId } });
    }
    if (goesStraightToLeader) {
      await tx.documentApprovalStep.create({ data: { workflowId: workflow.id, round, stage: "LEADER" } });
    }

    const status = goesStraightToLeader ? "WAITING_LEADER" : "WAITING_UNIT_HEAD";
    await tx.documentApprovalWorkflow.update({
      where: { id: workflow.id },
      data: {
        status,
        round,
        submittedById: session.id,
        submittedAt: now,
        openedAt: null,
        decidedById: null,
        decidedAt: null,
        decisionNote: null,
      },
    });
    await tx.document.update({ where: { id: doc.id }, data: { status: documentStatusFor(status) } });

    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOCUMENT_SUBMITTED_FOR_APPROVAL,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      beforeData: { status: current },
      afterData: { status, round, pendingUnitIds: plan.pendingUnitIds, skippedUnitIds: plan.skippedUnitIds, note: validated.note ?? null },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_APPROVAL_REQUESTED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: { documentId: doc.id, workflowId: workflow.id, round, submittedById: session.id },
    });

    return { documentId: doc.id, status, round, pendingUnitIds: plan.pendingUnitIds, skippedUnitIds: plan.skippedUnitIds };
  }, READ_COMMITTED);
}

// ---------------------------------------------------------------------------
// Quyết định
// ---------------------------------------------------------------------------

export async function decideApproval(session: SessionPayload, documentId: string, input: DecideApprovalInput) {
  const validated = DecideApprovalSchema.parse(input);
  const doc = await loadSubmissionDocument(documentId);
  const workflow = doc.approvalWorkflow;
  if (!workflow) throw new ConflictError("Tờ trình chưa được trình duyệt", "APPROVAL_NOT_STARTED");
  if (workflow.status !== "WAITING_UNIT_HEAD" && workflow.status !== "WAITING_LEADER") {
    throw new ConflictError("Tờ trình không ở bước chờ duyệt", "APPROVAL_NOT_PENDING");
  }

  const step = workflow.steps.find((s) => s.id === validated.stepId && s.round === workflow.round);
  if (!step) throw new NotFoundError("Không tìm thấy bước duyệt của vòng hiện tại");
  if (step.status !== "PENDING") throw new ConflictError("Bước duyệt này đã được xử lý", "APPROVAL_STEP_DECIDED");

  const ctx = await loadContext(session);
  if (!canActOnStep(ctx, step, doc)) throw new ForbiddenError("Bạn không phải người duyệt bước này");
  if (session.id === workflow.submittedById || session.id === doc.registeredById) {
    throw new SeparationOfDutiesError("Người trình tờ trình không tự duyệt tờ trình của mình");
  }

  const decision = validated.decision as ApprovalDecision;
  if (!allowedDecisions(step.stage as ApprovalStepStage).includes(decision)) {
    throw new ValidationError("Bước này không có lựa chọn Không phê duyệt; chọn Cần bổ sung hoặc Đồng ý", undefined, "DECISION_NOT_ALLOWED");
  }
  if (decisionRequiresNote(decision) && (validated.note ?? "").length < 3) {
    throw new ValidationError("Cần ghi lý do (tối thiểu 3 ký tự) khi yêu cầu bổ sung hoặc không phê duyệt");
  }

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: string; round: number }[]>`SELECT status, round FROM document_approval_workflows WHERE id = ${workflow.id} FOR UPDATE`;
    if (locked[0].status !== workflow.status || locked[0].round !== workflow.round) {
      throw new ConflictError("Tờ trình vừa được thay đổi. Hãy tải lại.", "APPROVAL_CONFLICT");
    }

    const now = new Date();
    const claim = await tx.documentApprovalStep.updateMany({
      where: { id: step.id, status: "PENDING" },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : decision === "REVISION" ? "REVISION_REQUIRED" : "REJECTED",
        decidedById: session.id,
        decidedAt: now,
        note: validated.note || null,
        openedAt: step.openedAt ?? now,
      },
    });
    if (claim.count !== 1) throw new ConflictError("Bước duyệt này vừa được xử lý", "APPROVAL_STEP_DECIDED");

    const stillPending = await tx.documentApprovalStep.count({
      where: { workflowId: workflow.id, round: workflow.round, stage: "UNIT_HEAD", status: "PENDING" },
    });
    const outcome = resolveOutcome({ stage: step.stage as ApprovalStepStage, decision, pendingUnitStepsAfter: stillPending });
    const nextStatus = statusAfter(outcome);

    if (outcome.kind === "GO_LEADER") {
      await tx.documentApprovalStep.create({ data: { workflowId: workflow.id, round: workflow.round, stage: "LEADER" } });
    }
    if (outcome.kind === "NEEDS_REVISION" || outcome.kind === "REJECTED") {
      await tx.documentApprovalStep.updateMany({
        where: { workflowId: workflow.id, round: workflow.round, status: "PENDING" },
        data: { status: "SKIPPED", note: "Dừng vì một bước khác đã trả về hoặc không phê duyệt", decidedAt: now },
      });
    }

    const closing = outcome.kind === "APPROVED" || outcome.kind === "REJECTED" || outcome.kind === "NEEDS_REVISION";
    await tx.documentApprovalWorkflow.update({
      where: { id: workflow.id },
      data: {
        status: nextStatus,
        openedAt: workflow.openedAt ?? now,
        ...(closing ? { decidedById: session.id, decidedAt: now, decisionNote: validated.note || null } : {}),
      },
    });
    await tx.document.update({ where: { id: doc.id }, data: { status: documentStatusFor(nextStatus) } });

    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOCUMENT_APPROVAL_DECIDED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      beforeData: { status: workflow.status, stepId: step.id, stage: step.stage },
      afterData: { status: nextStatus, decision, note: validated.note ?? null, round: workflow.round },
    });

    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_APPROVAL_DECIDED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: { documentId: doc.id, workflowId: workflow.id, decision, outcome: outcome.kind, deciderId: session.id, note: validated.note ?? null },
    });
    if (outcome.kind === "GO_LEADER") {
      await publishOutboxEvent(tx, {
        eventType: OutboxEventType.DOCUMENT_APPROVAL_REQUESTED_NOTIFICATION,
        aggregateType: OutboxAggregateType.DOCUMENT,
        aggregateId: doc.id,
        payload: { documentId: doc.id, workflowId: workflow.id, round: workflow.round, submittedById: workflow.submittedById },
      });
    }

    return { documentId: doc.id, status: nextStatus, outcome: outcome.kind, round: workflow.round };
  }, READ_COMMITTED);
}

// ---------------------------------------------------------------------------
// Rút lại
// ---------------------------------------------------------------------------

export async function withdrawApproval(session: SessionPayload, documentId: string) {
  const doc = await loadSubmissionDocument(documentId);
  const workflow = doc.approvalWorkflow;
  if (!workflow) throw new ConflictError("Tờ trình chưa được trình duyệt", "APPROVAL_NOT_STARTED");
  if (workflow.submittedById !== session.id) throw new ForbiddenError("Chỉ người trình được rút lại tờ trình");

  const decided = workflow.steps.filter((s) => s.round === workflow.round && s.status !== "PENDING" && s.status !== "SKIPPED").length;
  if (!canWithdraw(workflow.status, workflow.openedAt, decided)) {
    throw new ConflictError(
      "Tờ trình đã có người mở hoặc xử lý nên không rút lại được. Đề nghị người duyệt trả lại.",
      "APPROVAL_ALREADY_OPENED"
    );
  }

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: string; opened_at: Date | null }[]>`SELECT status, opened_at FROM document_approval_workflows WHERE id = ${workflow.id} FOR UPDATE`;
    if (locked[0].status !== workflow.status || locked[0].opened_at !== null) {
      throw new ConflictError("Tờ trình vừa có người mở. Không rút lại được.", "APPROVAL_ALREADY_OPENED");
    }
    await tx.documentApprovalStep.updateMany({
      where: { workflowId: workflow.id, round: workflow.round, status: "PENDING" },
      data: { status: "SKIPPED", note: "Người trình đã rút lại", decidedAt: new Date() },
    });
    await tx.documentApprovalWorkflow.update({ where: { id: workflow.id }, data: { status: "DRAFT" } });
    await tx.document.update({ where: { id: doc.id }, data: { status: documentStatusFor("DRAFT") } });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOCUMENT_APPROVAL_WITHDRAWN,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      beforeData: { status: workflow.status },
      afterData: { status: "DRAFT", round: workflow.round },
    });
    return { documentId: doc.id, status: "DRAFT" as const };
  }, READ_COMMITTED);
}

// ---------------------------------------------------------------------------
// Xin trả lại khi đã có người mở (V-06)
// ---------------------------------------------------------------------------

export const RequestReturnSchema = z.object({ note: z.string().trim().min(3, "Cần nêu lý do xin trả lại").max(1000) }).strict();
export const DecideReturnSchema = z.object({ accept: z.boolean(), note: z.string().trim().max(1000).optional() }).strict();

/**
 * Người trình xin trả lại khi tờ trình đã có người mở hoặc xử lý (không còn rút lại được). Một người duyệt đang
 * có bước chờ đồng ý thì tờ trình về Nháp để sửa; từ chối thì giữ nguyên luồng.
 */
export async function requestApprovalReturn(session: SessionPayload, documentId: string, input: unknown) {
  const { note } = RequestReturnSchema.parse(input);
  const doc = await loadSubmissionDocument(documentId);
  const workflow = doc.approvalWorkflow;
  if (!workflow) throw new ConflictError("Tờ trình chưa được trình duyệt", "APPROVAL_NOT_STARTED");
  if (workflow.submittedById !== session.id) throw new ForbiddenError("Chỉ người trình được xin trả lại tờ trình");
  if (workflow.status !== "WAITING_UNIT_HEAD" && workflow.status !== "WAITING_LEADER") {
    throw new ConflictError("Tờ trình không còn ở bước chờ duyệt", "APPROVAL_NOT_WAITING");
  }
  const decided = workflow.steps.filter((s) => s.round === workflow.round && s.status !== "PENDING" && s.status !== "SKIPPED").length;
  if (canWithdraw(workflow.status, workflow.openedAt, decided)) {
    throw new ConflictError("Chưa ai mở tờ trình nên dùng Rút lại", "APPROVAL_CAN_WITHDRAW");
  }
  if (workflow.returnRequestedAt) throw new ConflictError("Đã có đề nghị trả lại đang chờ", "RETURN_ALREADY_REQUESTED");

  return prisma.$transaction(async (tx) => {
    const claim = await tx.documentApprovalWorkflow.updateMany({
      where: { id: workflow.id, returnRequestedAt: null, status: workflow.status },
      data: { returnRequestedAt: new Date(), returnRequestNote: note },
    });
    if (claim.count !== 1) throw new ConflictError("Đã có đề nghị trả lại đang chờ", "RETURN_ALREADY_REQUESTED");
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOCUMENT_APPROVAL_RETURN_REQUESTED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      beforeData: null,
      afterData: { round: workflow.round, note },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_APPROVAL_RETURN_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: { documentId: doc.id, workflowId: workflow.id, kind: "REQUESTED", actorId: session.id },
    });
    return { documentId: doc.id, requested: true };
  }, READ_COMMITTED);
}

export async function decideApprovalReturn(session: SessionPayload, documentId: string, input: unknown) {
  const body = DecideReturnSchema.parse(input);
  const doc = await loadSubmissionDocument(documentId);
  const workflow = doc.approvalWorkflow;
  if (!workflow || !workflow.returnRequestedAt) throw new ConflictError("Không có đề nghị trả lại nào đang chờ", "RETURN_NOT_REQUESTED");
  const ctx = await loadContext(session);
  const pending = workflow.steps.filter((s) => s.round === workflow.round && s.status === "PENDING");
  if (session.id === workflow.submittedById || !pending.some((s) => canActOnStep(ctx, s, doc))) {
    throw new ForbiddenError("Chỉ người đang có bước chờ duyệt mới trả lời đề nghị trả lại");
  }

  return prisma.$transaction(async (tx) => {
    const claim = await tx.documentApprovalWorkflow.updateMany({
      where: { id: workflow.id, returnRequestedAt: { not: null }, status: workflow.status },
      data: { returnRequestedAt: null, returnRequestNote: null, ...(body.accept ? { status: "DRAFT" } : {}) },
    });
    if (claim.count !== 1) throw new ConflictError("Đề nghị trả lại đã được xử lý", "RETURN_NOT_REQUESTED");
    if (body.accept) {
      await tx.documentApprovalStep.updateMany({
        where: { workflowId: workflow.id, round: workflow.round, status: "PENDING" },
        data: { status: "SKIPPED", note: "Trả lại theo đề nghị của người trình", decidedAt: new Date() },
      });
      await tx.document.update({ where: { id: doc.id }, data: { status: documentStatusFor("DRAFT") } });
    }
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOCUMENT_APPROVAL_RETURN_DECIDED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      beforeData: { returnRequestNote: workflow.returnRequestNote },
      afterData: { accept: body.accept, note: body.note ?? null, status: body.accept ? "DRAFT" : workflow.status },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_APPROVAL_RETURN_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: { documentId: doc.id, workflowId: workflow.id, kind: "DECIDED", accept: body.accept, note: body.note ?? null, actorId: session.id },
    });
    return { documentId: doc.id, accepted: body.accept, status: body.accept ? ("DRAFT" as const) : workflow.status };
  }, READ_COMMITTED);
}

// ---------------------------------------------------------------------------
// Thay người xử lý (người nghỉ giữa chừng)
// ---------------------------------------------------------------------------

export async function reassignApprovalStep(session: SessionPayload, documentId: string, input: ReassignStepInput) {
  const validated = ReassignStepSchema.parse(input);
  const doc = await loadSubmissionDocument(documentId);
  const workflow = doc.approvalWorkflow;
  if (!workflow) throw new ConflictError("Tờ trình chưa được trình duyệt", "APPROVAL_NOT_STARTED");
  const step = workflow.steps.find((s) => s.id === validated.stepId && s.round === workflow.round);
  if (!step) throw new NotFoundError("Không tìm thấy bước duyệt của vòng hiện tại");
  if (step.status !== "PENDING") throw new ConflictError("Chỉ thay người ở bước đang chờ", "APPROVAL_STEP_DECIDED");

  // Lãnh đạo, hoặc trưởng đơn vị của bước đơn vị; người trong cuộc không tự chỉ định mình thay.
  const ctx = await loadContext(session);
  const allowed =
    canDo(ctx, "document.submission.approve", doc) ||
    (step.stage === "UNIT_HEAD" && Boolean(step.unitId) && unitsHeadedBy(ctx).has(step.unitId as string));
  if (!allowed) throw new ForbiddenError("Bạn không có quyền thay người xử lý bước này");

  if (validated.approverUserId === workflow.submittedById || validated.approverUserId === doc.registeredById) {
    throw new SeparationOfDutiesError("Không chỉ định người trình tờ trình làm người duyệt");
  }
  const target = await prisma.user.findUnique({ where: { id: validated.approverUserId }, select: { id: true, isActive: true } });
  if (!target) throw new NotFoundError("Không tìm thấy người được chỉ định");
  if (!target.isActive) throw new ValidationError("Tài khoản được chỉ định đã ngừng hoạt động");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.documentApprovalStep.updateMany({
      where: { id: step.id, status: "PENDING" },
      data: { approverUserId: target.id },
    });
    if (updated.count !== 1) throw new ConflictError("Bước duyệt vừa được xử lý", "APPROVAL_STEP_DECIDED");
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOCUMENT_APPROVAL_STEP_REASSIGNED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      beforeData: { stepId: step.id, approverUserId: step.approverUserId },
      afterData: { stepId: step.id, approverUserId: target.id, reason: validated.reason },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_APPROVAL_REQUESTED_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: { documentId: doc.id, workflowId: workflow.id, round: workflow.round, submittedById: workflow.submittedById },
    });
    return { documentId: doc.id, stepId: step.id, approverUserId: target.id };
  }, READ_COMMITTED);
}

// ---------------------------------------------------------------------------
// Xin ý kiến tham khảo
// ---------------------------------------------------------------------------

export async function askConsultation(session: SessionPayload, documentId: string, input: AskConsultationInput) {
  const validated = AskConsultationSchema.parse(input);
  const doc = await loadSubmissionDocument(documentId);
  const workflow = doc.approvalWorkflow;
  if (!workflow || (workflow.status !== "WAITING_UNIT_HEAD" && workflow.status !== "WAITING_LEADER")) {
    throw new ConflictError("Chỉ xin ý kiến khi tờ trình đang chờ duyệt", "APPROVAL_NOT_PENDING");
  }
  const ctx = await loadContext(session);
  const pending = workflow.steps.filter((s) => s.round === workflow.round && s.status === "PENDING");
  if (!pending.some((s) => canActOnStep(ctx, s, doc))) throw new ForbiddenError("Chỉ người đang phải duyệt được xin ý kiến");
  if (validated.consultantId === session.id) throw new ValidationError("Không xin ý kiến chính mình");
  const consultant = await prisma.user.findUnique({ where: { id: validated.consultantId }, select: { id: true, isActive: true } });
  if (!consultant || !consultant.isActive) throw new NotFoundError("Không tìm thấy người được xin ý kiến");

  return prisma.$transaction(async (tx) => {
    const row = await tx.documentConsultation.create({
      data: { workflowId: workflow.id, askedById: session.id, consultantId: consultant.id, question: validated.question },
    });
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOCUMENT_CONSULTATION_ASKED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      beforeData: null,
      afterData: { consultationId: row.id, consultantId: consultant.id },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_CONSULTATION_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: { documentId: doc.id, consultationId: row.id, kind: "ASKED", actorId: session.id },
    });
    return { consultationId: row.id };
  });
}

export async function answerConsultation(session: SessionPayload, documentId: string, input: AnswerConsultationInput) {
  const validated = AnswerConsultationSchema.parse(input);
  const doc = await loadSubmissionDocument(documentId);
  const workflow = doc.approvalWorkflow;
  if (!workflow) throw new NotFoundError("Tờ trình chưa có luồng duyệt");
  const row = await prisma.documentConsultation.findFirst({ where: { id: validated.consultationId, workflowId: workflow.id } });
  if (!row) throw new NotFoundError("Không tìm thấy phiếu xin ý kiến");
  if (row.consultantId !== session.id) throw new ForbiddenError("Chỉ người được xin ý kiến được trả lời");
  if (row.answeredAt) throw new ConflictError("Phiếu này đã được trả lời", "CONSULTATION_ANSWERED");

  return prisma.$transaction(async (tx) => {
    const claim = await tx.documentConsultation.updateMany({
      where: { id: row.id, answeredAt: null },
      data: { answer: validated.answer, answeredAt: new Date() },
    });
    if (claim.count !== 1) throw new ConflictError("Phiếu này vừa được trả lời", "CONSULTATION_ANSWERED");
    await auditService.logEvent(tx, {
      actorId: session.id,
      action: AuditAction.DOCUMENT_CONSULTATION_ANSWERED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: doc.id,
      beforeData: null,
      afterData: { consultationId: row.id },
    });
    await publishOutboxEvent(tx, {
      eventType: OutboxEventType.DOCUMENT_CONSULTATION_NOTIFICATION,
      aggregateType: OutboxAggregateType.DOCUMENT,
      aggregateId: doc.id,
      payload: { documentId: doc.id, consultationId: row.id, kind: "ANSWERED", actorId: session.id },
    });
    return { consultationId: row.id };
  });
}

// ---------------------------------------------------------------------------
// Trạng thái hiển thị
// ---------------------------------------------------------------------------

export interface ApprovalStepView {
  id: string;
  round: number;
  stage: ApprovalStepStage;
  unit: { id: string; name: string } | null;
  approver: { id: string; name: string } | null;
  status: DocumentApprovalStep["status"];
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  note: string | null;
}

export interface ApprovalState {
  workflow: { status: DocumentApprovalWorkflow["status"]; round: number; submittedAt: string | null; decisionNote: string | null } | null;
  steps: ApprovalStepView[];
  consultations: Array<{
    id: string;
    askedBy: { id: string; name: string };
    consultant: { id: string; name: string };
    question: string;
    answer: string | null;
    answeredAt: string | null;
    canAnswer: boolean;
  }>;
  canSubmit: boolean;
  canWithdraw: boolean;
  /** Bước chờ mà người xem duyệt được, cùng các lựa chọn cho phép. */
  myStep: { id: string; decisions: ApprovalDecision[] } | null;
  canAskConsultation: boolean;
  /** Các bước chờ của vòng hiện tại mà người xem được thay người xử lý (lãnh đạo, hoặc trưởng đơn vị của bước). */
  reassignableStepIds: string[];
  /** Đề nghị trả lại đang chờ của người trình (V-06). */
  returnRequest: { note: string | null; requestedAt: string } | null;
  /** Người trình xin trả lại được lúc này (đã có người mở nên không rút lại được). */
  canRequestReturn: boolean;
  /** Người xem trả lời được đề nghị trả lại đang chờ. */
  canDecideReturn: boolean;
}

/** Người tham gia luồng: người trình, người duyệt, người được xin ý kiến. Họ được đọc tờ trình. */
export async function isApprovalParticipant(userId: string, unitIds: string[], documentId: string): Promise<boolean> {
  const hit = await prisma.documentApprovalWorkflow.findFirst({
    where: {
      documentId,
      OR: [
        { submittedById: userId },
        { steps: { some: { OR: [{ approverUserId: userId }, ...(unitIds.length ? [{ unitId: { in: unitIds } }] : [])] } } },
        { consultations: { some: { OR: [{ consultantId: userId }, { askedById: userId }] } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function getApprovalState(session: SessionPayload, documentId: string): Promise<ApprovalState> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      approvalWorkflow: {
        include: {
          steps: { include: { unit: { select: { id: true, name: true } }, approver: { select: { id: true, name: true } }, decidedBy: { select: { id: true, name: true } } }, orderBy: [{ round: "asc" }, { createdAt: "asc" }] },
          consultations: { include: { askedBy: { select: { id: true, name: true } }, consultant: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!doc) throw new NotFoundError("Không tìm thấy văn bản", "DOCUMENT_NOT_FOUND");
  if (doc.type !== "TO_TRINH_NOI_BO") throw new ValidationError("Chỉ tờ trình nội bộ mới có luồng duyệt", undefined, "NOT_A_SUBMISSION");

  const ctx = await loadContext(session);
  const participant = await isApprovalParticipant(session.id, [...unitsHeadedBy(ctx)], documentId);
  const privileged = canDo(ctx, "document.submission.approve", doc);
  if (!participant && !privileged && doc.registeredById !== session.id) {
    throw new ForbiddenError("Bạn không có quyền xem luồng duyệt tờ trình này");
  }

  const workflow = doc.approvalWorkflow;
  const currentRoundPending = workflow ? workflow.steps.filter((s) => s.round === workflow.round && s.status === "PENDING") : [];
  const mine = workflow && (workflow.status === "WAITING_UNIT_HEAD" || workflow.status === "WAITING_LEADER")
    ? currentRoundPending.find((s) => canActOnStep(ctx, s, doc) && session.id !== workflow.submittedById && session.id !== doc.registeredById)
    : undefined;
  const decided = workflow ? workflow.steps.filter((s) => s.round === workflow.round && s.status !== "PENDING" && s.status !== "SKIPPED").length : 0;

  return {
    workflow: workflow
      ? { status: workflow.status, round: workflow.round, submittedAt: workflow.submittedAt?.toISOString() ?? null, decisionNote: workflow.decisionNote }
      : null,
    steps: (workflow?.steps ?? []).map((s) => ({
      id: s.id,
      round: s.round,
      stage: s.stage,
      unit: s.unit,
      approver: s.approver,
      status: s.status,
      decidedBy: s.decidedBy,
      decidedAt: s.decidedAt?.toISOString() ?? null,
      note: s.note,
    })),
    consultations: (workflow?.consultations ?? []).map((c) => ({
      id: c.id,
      askedBy: c.askedBy,
      consultant: c.consultant,
      question: c.question,
      answer: c.answer,
      answeredAt: c.answeredAt?.toISOString() ?? null,
      canAnswer: c.consultantId === session.id && !c.answeredAt,
    })),
    canSubmit: doc.registeredById === session.id && canSubmitFrom(workflow?.status ?? null),
    canWithdraw: Boolean(workflow) && workflow!.submittedById === session.id && canWithdraw(workflow!.status, workflow!.openedAt, decided),
    myStep: mine ? { id: mine.id, decisions: allowedDecisions(mine.stage) } : null,
    canAskConsultation: Boolean(mine),
    returnRequest: workflow?.returnRequestedAt ? { note: workflow.returnRequestNote, requestedAt: workflow.returnRequestedAt.toISOString() } : null,
    canRequestReturn:
      Boolean(workflow) &&
      workflow!.submittedById === session.id &&
      (workflow!.status === "WAITING_UNIT_HEAD" || workflow!.status === "WAITING_LEADER") &&
      !workflow!.returnRequestedAt &&
      !canWithdraw(workflow!.status, workflow!.openedAt, decided),
    canDecideReturn:
      Boolean(workflow?.returnRequestedAt) &&
      session.id !== workflow!.submittedById &&
      currentRoundPending.some((s) => canActOnStep(ctx, s, doc)),
    reassignableStepIds:
      workflow && (workflow.status === "WAITING_UNIT_HEAD" || workflow.status === "WAITING_LEADER")
        ? currentRoundPending
            .filter((s) => canDo(ctx, "document.submission.approve", doc) || (s.stage === "UNIT_HEAD" && Boolean(s.unitId) && unitsHeadedBy(ctx).has(s.unitId as string)))
            .map((s) => s.id)
        : [],
  };
}

/** Đánh dấu bước đã được người duyệt mở (cho điều kiện rút lại). Gọi khi người duyệt xem tờ trình. */
export async function markApprovalOpened(session: SessionPayload, documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { approvalWorkflow: { include: { steps: true } } } });
  const workflow = doc?.approvalWorkflow;
  if (!doc || !workflow || (workflow.status !== "WAITING_UNIT_HEAD" && workflow.status !== "WAITING_LEADER")) return;
  if (session.id === workflow.submittedById || session.id === doc.registeredById) return;

  const ctx = await loadContext(session);
  const mine = workflow.steps.filter((s) => s.round === workflow.round && s.status === "PENDING" && canActOnStep(ctx, s, doc));
  if (mine.length === 0) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.documentApprovalStep.updateMany({ where: { id: { in: mine.map((s) => s.id) }, openedAt: null }, data: { openedAt: now } }),
    prisma.documentApprovalWorkflow.updateMany({ where: { id: workflow.id, openedAt: null }, data: { openedAt: now } }),
  ]);
}

export { recipientsForPendingSteps };

// ---------------------------------------------------------------------------
// Báo cáo thời gian duyệt
// ---------------------------------------------------------------------------

export const ApprovalReportQuerySchema = z
  .object({
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
  })
  .strict();

export interface ApprovalReportRow {
  key: string;
  label: string;
  stage: ApprovalStepStage | "ALL";
  decided: number;
  avgHours: number;
  onTimePercent: number;
}

export interface ApprovalReport {
  from: string;
  to: string;
  targetHours: number;
  total: { decided: number; avgHours: number; onTimePercent: number };
  byUnit: ApprovalReportRow[];
  byApprover: ApprovalReportRow[];
}

function toRow(key: string, label: string, stage: ApprovalReportRow["stage"], hours: number[]): ApprovalReportRow {
  const decided = hours.length;
  const avg = decided ? hours.reduce((a, b) => a + b, 0) / decided : 0;
  const onTime = decided ? (hours.filter((h) => h <= APPROVAL_STEP_TARGET_HOURS).length / decided) * 100 : 0;
  return { key, label, stage, decided, avgHours: Math.round(avg * 10) / 10, onTimePercent: Math.round(onTime * 10) / 10 };
}

/**
 * Thống kê thời gian từ lúc bước duyệt được giao đến lúc có quyết định, theo đơn vị và theo người.
 * Lãnh đạo xem toàn bộ; trưởng đơn vị chỉ xem bước của đơn vị mình phụ trách.
 */
const REPORT_PROBE = { id: "report", securityLevel: "THUONG", status: "CHO_PHE_DUYET", registeredById: "" };

/** Lãnh đạo hoặc trưởng đơn vị mới xem được báo cáo; thanh bên dùng cùng điều kiện để ẩn mục. */
export async function canViewApprovalReport(session: SessionPayload): Promise<boolean> {
  const ctx = await loadContext(session);
  return canDo(ctx, "document.submission.approve", REPORT_PROBE) || unitsHeadedBy(ctx).size > 0;
}

export async function getApprovalReport(session: SessionPayload, query: { from?: string; to?: string } = {}): Promise<ApprovalReport> {
  const q = ApprovalReportQuerySchema.parse(query);
  const ctx = await loadContext(session);
  const all = canDo(ctx, "document.submission.approve", REPORT_PROBE);
  const headed = [...unitsHeadedBy(ctx)];
  if (!all && headed.length === 0) throw new ForbiddenError("Chỉ lãnh đạo và trưởng đơn vị xem báo cáo thời gian duyệt");

  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 90 * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new ValidationError("Khoảng thời gian không hợp lệ");

  const steps = await prisma.documentApprovalStep.findMany({
    where: {
      status: { in: ["APPROVED", "REVISION_REQUIRED", "REJECTED"] },
      decidedAt: { gte: from, lte: to },
      ...(all ? {} : { stage: "UNIT_HEAD", unitId: { in: headed } }),
    },
    include: { unit: { select: { id: true, name: true } }, decidedBy: { select: { id: true, name: true } } },
  });

  const hoursOf = (s: (typeof steps)[number]) => hoursBetween(s.createdAt, s.decidedAt as Date);
  const group = (keyOf: (s: (typeof steps)[number]) => [string, string, ApprovalReportRow["stage"]] | null) => {
    const map = new Map<string, { label: string; stage: ApprovalReportRow["stage"]; hours: number[] }>();
    for (const s of steps) {
      const k = keyOf(s);
      if (!k) continue;
      const entry = map.get(k[0]) ?? { label: k[1], stage: k[2], hours: [] };
      entry.hours.push(hoursOf(s));
      map.set(k[0], entry);
    }
    return [...map.entries()].map(([key, v]) => toRow(key, v.label, v.stage, v.hours)).sort((a, b) => b.avgHours - a.avgHours);
  };

  const total = toRow("all", "Tất cả", "ALL", steps.map(hoursOf));
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    targetHours: APPROVAL_STEP_TARGET_HOURS,
    total: { decided: total.decided, avgHours: total.avgHours, onTimePercent: total.onTimePercent },
    byUnit: group((s) => (s.stage === "UNIT_HEAD" && s.unit ? [s.unit.id, s.unit.name, "UNIT_HEAD"] : s.stage === "LEADER" ? ["leader", "Lãnh đạo", "LEADER"] : null)),
    byApprover: group((s) => (s.decidedBy ? [s.decidedBy.id, s.decidedBy.name, s.stage] : null)),
  };
}

/** CSV (UTF-8 có BOM) mở được trực tiếp bằng Excel. */
export function approvalReportToCsv(report: ApprovalReport): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["Nhóm", "Tên", "Bước", "Số quyết định", "Giờ trung bình", `Đúng hạn (≤${report.targetHours} giờ) %`].map(esc).join(",")];
  const emit = (group: string, rows: ApprovalReportRow[]) =>
    rows.forEach((r) => lines.push([group, r.label, r.stage === "LEADER" ? "Lãnh đạo" : r.stage === "UNIT_HEAD" ? "Trưởng đơn vị" : "", r.decided, r.avgHours, r.onTimePercent].map(esc).join(",")));
  lines.push(["Tổng", "Tất cả", "", report.total.decided, report.total.avgHours, report.total.onTimePercent].map(esc).join(","));
  emit("Theo đơn vị", report.byUnit);
  emit("Theo người", report.byApprover);
  return `﻿${lines.join("\r\n")}\r\n`;
}
