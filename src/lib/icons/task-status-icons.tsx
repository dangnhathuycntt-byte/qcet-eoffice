/**
 * Tương thích ngược: các tên StatusSub* / PrioritySub* nay trỏ về bộ icon chuẩn
 * ở ./task-icons (nguồn duy nhất cho trạng thái và ưu tiên toàn dự án).
 * Nằm trong lib/ để domain display-config tham chiếu mà không vượt ranh giới domain→UI.
 */
import * as React from "react";
import {
  TaskIconStatusNew,
  TaskIconStatusInProgress,
  TaskIconStatusReview,
  TaskIconStatusDone,
  TaskIconPriority,
  TaskIconPriorityUrgent,
  TaskIconPriorityHigh,
  TaskIconPriorityNormal,
  TaskIconPriorityLow,
  type TaskActionIconProps,
} from "./task-icons";

export const StatusSubNew = TaskIconStatusNew;
export const StatusSubInProgress = TaskIconStatusInProgress;
export const StatusSubReview = TaskIconStatusReview;
export const StatusSubCompleted = TaskIconStatusDone;

export const PrioritySubUrgent = TaskIconPriorityUrgent;
export const PrioritySubHigh = TaskIconPriorityHigh;
export const PrioritySubNormal = TaskIconPriorityNormal;
export const PrioritySubLow = TaskIconPriorityLow;

/** Theo mức cũ: 3 = khẩn cấp, 2 = cao, 1 = bình thường, 0 = (tất cả) ba cột trung tính. */
export const PrioritySubBars = ({
  level,
  ...props
}: TaskActionIconProps & { level: 0 | 1 | 2 | 3 }) => {
  if (level === 3) return <TaskIconPriorityUrgent {...props} />;
  if (level === 2) return <TaskIconPriorityHigh {...props} />;
  if (level === 1) return <TaskIconPriorityNormal {...props} />;
  return <TaskIconPriority {...props} />;
};
