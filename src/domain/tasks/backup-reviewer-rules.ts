/**
 * Quy tắc người duyệt dự phòng (T-05, D12). Hàm thuần, không đọc DB.
 *
 * Người dự phòng chỉ nhận quyền duyệt khi nhiệm vụ chờ duyệt đủ 96 giờ (cùng mốc "người giao
 * được báo" của T-06) và vẫn chịu N4: không phải người tạo, người thực hiện, người nộp kết quả
 * hay người duyệt chính.
 */
import { escalationStage } from "./reminder-rules";

export type BackupRejection = "SAME_AS_CREATOR" | "IS_EXECUTOR" | "IS_SUBMITTER" | "IS_PRIMARY_REVIEWER";

export interface BackupCandidateContext {
  candidateId: string;
  creatorId: string;
  /** Chủ trì và người phối hợp (người thực hiện). */
  executorIds: readonly string[];
  /** Người nộp kết quả và người tải sản phẩm. */
  submitterIds: readonly string[];
  /** Người duyệt chính (REVIEWER, APPROVER). */
  reviewerIds: readonly string[];
}

export const BACKUP_REJECTION_MESSAGE: Record<BackupRejection, string> = {
  SAME_AS_CREATOR: "Người giao không thể làm người duyệt dự phòng của chính nhiệm vụ mình giao.",
  IS_EXECUTOR: "Người thực hiện nhiệm vụ không thể làm người duyệt dự phòng.",
  IS_SUBMITTER: "Người nộp kết quả hoặc tải sản phẩm không thể làm người duyệt dự phòng.",
  IS_PRIMARY_REVIEWER: "Người duyệt chính đã được chỉ định, không chọn lại làm dự phòng.",
};

export function checkBackupCandidate(ctx: BackupCandidateContext): BackupRejection | null {
  if (ctx.candidateId === ctx.creatorId) return "SAME_AS_CREATOR";
  if (ctx.executorIds.includes(ctx.candidateId)) return "IS_EXECUTOR";
  if (ctx.submitterIds.includes(ctx.candidateId)) return "IS_SUBMITTER";
  if (ctx.reviewerIds.includes(ctx.candidateId)) return "IS_PRIMARY_REVIEWER";
  return null;
}

/** Đến mốc 96 giờ chờ duyệt tính từ lúc nộp kết quả. */
export function isBackupDue(waitingSince: Date, now: Date): boolean {
  return escalationStage(waitingSince, now) === "SECOND";
}
