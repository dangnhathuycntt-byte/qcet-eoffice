import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import type { DocumentStatus, DocumentUrgency } from "@/types/document";

/** Cấu hình hiển thị nhãn mức khẩn và trạng thái của văn bản (dùng ở bảng, thẻ danh sách). */
export function getUrgencyBadgeConfig(urgency: DocumentUrgency): {
  label: string;
  className: string;
} {
  switch (urgency) {
    case "flash":
    case "HOA_TOC":
      return {
        label: "Hỏa tốc",
        className: "bg-red-500/15 text-red-700 border-red-500/30 font-bold animate-pulse",
      };
    case "top_urgent":
    case "THUONG_KHAN":
      return {
        label: "Thượng khẩn",
        className: "bg-rose-500/15 text-rose-700 border-rose-500/30 font-semibold",
      };
    case "urgent":
    case "KHAN":
      return {
        label: "Khẩn",
        className: "bg-amber-500/15 text-amber-700 border-amber-500/30 font-medium",
      };
    case "normal":
    case "THUONG":
    default:
      return {
        label: "Thường",
        className: "bg-muted text-muted-foreground border-border/60",
      };
  }
}

export function getStatusBadgeConfig(status: DocumentStatus): {
  label: string;
  className: string;
  icon: typeof Clock;
} {
  switch (status) {
    case "pending_assignment":
    case "CHO_PHAN_CONG":
      return {
        label: "Chờ bút phê",
        className: "bg-amber-500/10 text-amber-700 border-amber-500/20",
        icon: Clock,
      };
    case "processing":
    case "DANG_XU_LY":
      return {
        label: "Đang xử lý",
        className: "bg-blue-500/10 text-blue-700 border-blue-500/20",
        icon: Clock,
      };
    case "delegated":
      return {
        label: "Đã liên thông giao việc",
        className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-medium",
        icon: CheckCircle2,
      };
    case "approved":
    case "CHO_PHE_DUYET":
      return {
        label: "Đã ký duyệt",
        className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
        icon: ShieldCheck,
      };
    case "completed":
    case "DA_HOAN_THANH":
    case "LUU_THEO_DOI":
    default:
      return {
        label: "Hoàn tất & Lưu trữ",
        className: "bg-muted text-muted-foreground border-border/60",
        icon: CheckCircle2,
      };
  }
}
