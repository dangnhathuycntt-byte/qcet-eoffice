/**
 * Quy tắc luồng duyệt tờ trình nội bộ (V-06). Hàm thuần: không đọc DB, không có side effect.
 *
 * Luồng: chuyên viên trình → trưởng các đơn vị liên quan duyệt song song → lãnh đạo phê duyệt.
 * Người trình là trưởng đơn vị thì không tự duyệt ở đơn vị mình (bước đó bỏ qua), nhưng các
 * đơn vị liên quan khác vẫn phải duyệt. Đơn vị cho ý kiến Cần bổ sung thì cả tờ trình về người
 * trình; chỉ lãnh đạo mới Không phê duyệt.
 */
import type {
  ApprovalStepStage,
  ApprovalWorkflowStatus,
  DocumentApprovalStepStatus,
  DocumentStatus,
} from "@prisma/client";

export type ApprovalDecision = "APPROVE" | "REVISION" | "REJECT";

/** Thời hạn mong đợi để một bước duyệt xong; dùng cho tỷ lệ đúng hạn trong báo cáo. */
export const APPROVAL_STEP_TARGET_HOURS = 48;

export interface UnitStepPlan {
  /** Đơn vị phải có trưởng đơn vị duyệt. */
  pendingUnitIds: string[];
  /** Đơn vị bỏ qua vì người trình là trưởng của đơn vị đó. */
  skippedUnitIds: string[];
}

export function planUnitSteps(input: { involvedUnitIds: readonly string[]; headOfUnitIds: ReadonlySet<string> }): UnitStepPlan {
  const unique = [...new Set(input.involvedUnitIds.filter(Boolean))];
  return {
    pendingUnitIds: unique.filter((id) => !input.headOfUnitIds.has(id)),
    skippedUnitIds: unique.filter((id) => input.headOfUnitIds.has(id)),
  };
}

export function allowedDecisions(stage: ApprovalStepStage): ApprovalDecision[] {
  return stage === "LEADER" ? ["APPROVE", "REVISION", "REJECT"] : ["APPROVE", "REVISION"];
}

export function decisionRequiresNote(decision: ApprovalDecision): boolean {
  return decision !== "APPROVE";
}

export type SubmitFromStatus = ApprovalWorkflowStatus | null;

/** Chỉ trình được khi chưa có luồng, đang nháp hoặc cần bổ sung. */
export function canSubmitFrom(status: SubmitFromStatus): boolean {
  return status === null || status === "DRAFT" || status === "NEEDS_REVISION";
}

/** Rút lại được khi đang chờ duyệt và chưa ai mở hay quyết định. */
export function canWithdraw(status: ApprovalWorkflowStatus, openedAt: Date | null, decidedStepCount: number): boolean {
  return (status === "WAITING_UNIT_HEAD" || status === "WAITING_LEADER") && openedAt === null && decidedStepCount === 0;
}

export type StepOutcome =
  | { kind: "WAIT_OTHERS" }
  | { kind: "GO_LEADER" }
  | { kind: "APPROVED" }
  | { kind: "NEEDS_REVISION" }
  | { kind: "REJECTED" };

/**
 * Kết quả sau một quyết định. `pendingUnitStepsAfter` là số bước đơn vị còn chờ sau quyết định này
 * (không tính bước vừa quyết định).
 */
export function resolveOutcome(args: {
  stage: ApprovalStepStage;
  decision: ApprovalDecision;
  pendingUnitStepsAfter: number;
}): StepOutcome {
  if (args.decision === "REVISION") return { kind: "NEEDS_REVISION" };
  if (args.decision === "REJECT") return { kind: "REJECTED" };
  if (args.stage === "LEADER") return { kind: "APPROVED" };
  return args.pendingUnitStepsAfter > 0 ? { kind: "WAIT_OTHERS" } : { kind: "GO_LEADER" };
}

export function statusAfter(outcome: StepOutcome): ApprovalWorkflowStatus {
  switch (outcome.kind) {
    case "WAIT_OTHERS":
      return "WAITING_UNIT_HEAD";
    case "GO_LEADER":
      return "WAITING_LEADER";
    case "APPROVED":
      return "APPROVED";
    case "NEEDS_REVISION":
      return "NEEDS_REVISION";
    case "REJECTED":
      return "REJECTED";
  }
}

/** Trạng thái chung của văn bản (dùng ở danh sách, bộ lọc) ứng với trạng thái luồng duyệt. */
export function documentStatusFor(status: ApprovalWorkflowStatus): DocumentStatus {
  switch (status) {
    case "WAITING_UNIT_HEAD":
    case "WAITING_LEADER":
      return "CHO_PHE_DUYET";
    case "APPROVED":
      return "DA_HOAN_THANH";
    case "REJECTED":
      return "LUU_THEO_DOI";
    case "DRAFT":
    case "NEEDS_REVISION":
      return "CHO_PHAN_CONG";
  }
}

export const WORKFLOW_STATUS_LABEL: Record<ApprovalWorkflowStatus, string> = {
  DRAFT: "Nháp",
  WAITING_UNIT_HEAD: "Chờ trưởng đơn vị",
  WAITING_LEADER: "Chờ lãnh đạo",
  APPROVED: "Đã phê duyệt",
  NEEDS_REVISION: "Cần bổ sung",
  REJECTED: "Không phê duyệt",
};

export const STEP_STATUS_LABEL: Record<DocumentApprovalStepStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đồng ý",
  REVISION_REQUIRED: "Cần bổ sung",
  REJECTED: "Không phê duyệt",
  SKIPPED: "Bỏ qua",
};

/** Số giờ giữa hai mốc; âm thì coi là 0. */
export function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 3_600_000);
}
