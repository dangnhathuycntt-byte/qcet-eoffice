import type { SchoolBottleneckItem } from "@/types/workspace";
import type {
  ExecutiveResolutionPayload,
  ExecutiveResolutionResult,
} from "@/types/executive-resolution";

export function applyExecutiveResolution(
  bottlenecks: SchoolBottleneckItem[],
  payload: ExecutiveResolutionPayload
): ExecutiveResolutionResult {
  const targetIndex = bottlenecks.findIndex((b) => b.id === payload.taskId);
  const resolvedItem = targetIndex >= 0 ? bottlenecks[targetIndex] : undefined;

  const updatedBottlenecks = bottlenecks.filter((b) => b.id !== payload.taskId);

  let actionSummary = "Đã xử lý điểm nghẽn";
  switch (payload.type) {
    case "EXTEND_DEADLINE":
      actionSummary = `Gia hạn tiến độ thêm ${payload.extensionDays || 3} ngày`;
      break;
    case "REASSIGN":
      actionSummary = `Giao cho ${payload.newAssigneeName || "nhân sự thay thế"} xử lý`;
      break;
    case "DEMAND_EXPLANATION":
      actionSummary = "Yêu cầu Trưởng đơn vị giải trình khẩn cấp";
      break;
    case "DIRECT_DIRECTIVE":
      actionSummary = `Ban hành chỉ đạo trực tiếp: ${payload.directiveNote || "Giải quyết ngay"}`;
      break;
  }

  return {
    updatedBottlenecks,
    resolvedItem,
    actionSummary,
  };
}
