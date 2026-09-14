import type * as React from "react";
import {
  Layers,
  Building2,
  Briefcase,
  GraduationCap,
  Calendar,
} from "lucide-react";
import type { TaskCategory, TaskStatus } from "@/types/dashboard";
import type {
  CategoryTab,
  DepartmentOption,
  SmartFilterTabOption,
  TableDensity,
  TableDensityConfig,
} from "./types";

/**
 * Bảng màu chuẩn OKLCH (Light-Only Standard)
 * Tuyệt đối không dùng dark variant, tối ưu cho môi trường công sở hành chính giáo dục
 */
export const TABLE_OKLCH_COLORS = {
  background: "oklch(0.985 0.002 247.5)",
  card: "oklch(1 0 0)",
  border: "oklch(0.92 0.004 240)",
  borderHover: "oklch(0.85 0.01 250)",
  textPrimary: "oklch(0.145 0.015 250)",
  textSecondary: "oklch(0.48 0.015 250)",
  textMuted: "oklch(0.65 0.015 250)",
  primary: "oklch(0.42 0.18 250)",          // Sapphire Blue #2563EB
  success: "oklch(0.68 0.17 150)",          // Emerald Green #10B981
  warning: "oklch(0.74 0.17 75)",           // Warm Amber #F59E0B
  danger: "oklch(0.63 0.22 25)",            // Crimson Rose #F43F5E
  neutral: "oklch(0.96 0.005 240)",         // Neutral slate
} as const;

/**
 * Cấu hình hiển thị Badge trạng thái
 */
export interface StatusBadgeConfig {
  label: string;
  className: string;
  variant:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "ghost"
    | "success"
    | "progress"
    | "warning"
    | "sapphire"
    | "emerald"
    | "amber"
    | "rose"
    | "violet";
  oklchColor: string;
  oklchBg: string;
}

/**
 * Danh mục cấu hình huy hiệu trạng thái nhiệm vụ (Status Badges)
 */
export const STATUS_BADGE_CONFIGS: Record<string, StatusBadgeConfig> = {
  NEW: {
    label: "Mới",
    className: "border-rose-500/20 bg-rose-500/10 text-rose-700",
    variant: "destructive",
    oklchColor: "oklch(0.63 0.22 25)",
    oklchBg: "oklch(0.96 0.04 25)",
  },
  IN_PROGRESS: {
    label: "Đang thực hiện",
    className: "border-blue-500/20 bg-blue-500/10 text-blue-700",
    variant: "sapphire",
    oklchColor: "oklch(0.42 0.18 250)",
    oklchBg: "oklch(0.95 0.04 250)",
  },
  NEEDS_REVIEW: {
    label: "Cần chỉnh sửa",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    variant: "amber",
    oklchColor: "oklch(0.74 0.17 75)",
    oklchBg: "oklch(0.96 0.05 75)",
  },
  WAITING_APPROVAL: {
    label: "Chờ phê duyệt",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    variant: "amber",
    oklchColor: "oklch(0.74 0.17 75)",
    oklchBg: "oklch(0.96 0.05 75)",
  },
  PENDING_EXECUTIVE_APPROVAL: {
    label: "Chờ BGH duyệt",
    className: "border-purple-500/20 bg-purple-500/10 text-purple-700",
    variant: "violet",
    oklchColor: "oklch(0.65 0.20 300)",
    oklchBg: "oklch(0.96 0.04 300)",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    variant: "emerald",
    oklchColor: "oklch(0.68 0.17 150)",
    oklchBg: "oklch(0.96 0.04 150)",
  },
  OVERDUE: {
    label: "Quá hạn",
    className: "border-rose-500/20 bg-rose-500/10 text-rose-700",
    variant: "rose",
    oklchColor: "oklch(0.63 0.22 25)",
    oklchBg: "oklch(0.96 0.04 25)",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-zinc-300 bg-zinc-100 text-zinc-600",
    variant: "outline",
    oklchColor: "oklch(0.55 0.01 250)",
    oklchBg: "oklch(0.95 0.005 250)",
  },
  NOT_STARTED: {
    label: "Chưa bắt đầu",
    className: "border-zinc-300 bg-zinc-100 text-zinc-600",
    variant: "outline",
    oklchColor: "oklch(0.55 0.01 250)",
    oklchBg: "oklch(0.95 0.005 250)",
  },
  BLOCKED: {
    label: "Tạm dừng",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    variant: "amber",
    oklchColor: "oklch(0.74 0.17 75)",
    oklchBg: "oklch(0.96 0.05 75)",
  },
};

/**
 * Lấy cấu hình nhãn huy hiệu trạng thái an toàn
 */
export function getStatusBadgeConfig(
  status?: TaskStatus | string | null
): StatusBadgeConfig {
  if (status) {
    const config =
      STATUS_BADGE_CONFIGS[status] ||
      STATUS_BADGE_CONFIGS[String(status).toUpperCase()];
    if (config) return config;
  }

  return {
    label: "Chưa xác định",
    className: "border-zinc-200 bg-zinc-50 text-zinc-700",
    variant: "outline",
    oklchColor: "oklch(0.55 0.01 250)",
    oklchBg: "oklch(0.98 0.005 250)",
  };
}

/**
 * Cấu hình hiển thị Badge danh mục DACUM
 */
export interface CategoryBadgeConfig {
  label: string;
  className: string;
  oklchColor?: string;
}

export const CATEGORY_BADGE_CONFIGS: Record<string, CategoryBadgeConfig> = {
  CHUYEN_DOI_SO: {
    label: "Chuyển đổi số",
    className: "bg-secondary text-muted-foreground border-transparent",
    oklchColor: "oklch(0.42 0.18 250)",
  },
  TRUYEN_THONG: {
    label: "Truyền thông",
    className: "bg-secondary text-muted-foreground border-transparent",
    oklchColor: "oklch(0.65 0.15 180)",
  },
  CNTT: {
    label: "CNTT",
    className: "bg-secondary text-muted-foreground border-transparent",
    oklchColor: "oklch(0.45 0.18 240)",
  },
  ATTT: {
    label: "An toàn thông tin",
    className: "bg-secondary text-muted-foreground border-transparent",
    oklchColor: "oklch(0.55 0.18 30)",
  },
  THU_VIEN: {
    label: "Thư viện",
    className: "bg-secondary text-muted-foreground border-transparent",
    oklchColor: "oklch(0.60 0.14 140)",
  },
  BAO_CAO: {
    label: "Báo cáo",
    className: "bg-secondary text-muted-foreground border-transparent",
    oklchColor: "oklch(0.58 0.16 280)",
  },
  KHAC: {
    label: "Khác",
    className: "bg-secondary text-muted-foreground border-transparent",
    oklchColor: "oklch(0.55 0.01 250)",
  },
  OTHER: {
    label: "Khác",
    className: "bg-secondary text-muted-foreground border-transparent",
    oklchColor: "oklch(0.55 0.01 250)",
  },
};

/**
 * Lấy cấu hình nhãn huy hiệu danh mục DACUM
 */
export function getCategoryBadgeConfig(
  category: TaskCategory | string
): CategoryBadgeConfig {
  const config = CATEGORY_BADGE_CONFIGS[category];
  if (config) return config;

  return {
    label: "Khác",
    className: "bg-secondary text-muted-foreground border-transparent",
    oklchColor: "oklch(0.55 0.01 250)",
  };
}

/**
 * Các tab danh mục nhiệm vụ chuyên môn theo chuẩn DACUM (thứ tự cố định)
 */
export const CATEGORY_TABS: CategoryTab[] = [
  { id: "ALL", label: "Tất cả", icon: Layers },
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số", icon: Building2 },
  { id: "TRUYEN_THONG", label: "Truyền thông", icon: Briefcase },
  { id: "CNTT", label: "CNTT", icon: Layers },
  { id: "ATTT", label: "An toàn thông tin", icon: Briefcase },
  { id: "THU_VIEN", label: "Thư viện", icon: GraduationCap },
  { id: "BAO_CAO", label: "Báo cáo", icon: Calendar },
];

/**
 * Danh sách phòng ban và khoa chuẩn toàn trường
 */
export const DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { id: "ALL", label: "Tất cả đơn vị (Toàn trường)" },
  { id: "BGH", label: "Ban Giám hiệu", code: "BGH" },
  { id: "CNTT", label: "Khoa Công nghệ thông tin", code: "K_CNTT" },
  { id: "DAO_TAO", label: "Phòng Đào tạo & QLKH", code: "P_QLDT" },
  { id: "TRUYEN_THONG", label: "TT Truyền thông & Số hóa", code: "TT_STT" },
  { id: "HANH_CHINH", label: "Phòng Hành chính - Quản trị", code: "P_HCQT" },
  { id: "KHAO_THI", label: "Phòng Khảo thí & ĐBCL", code: "P_KTDBCL" },
  { id: "THU_VIEN", label: "TT Ngoại ngữ - TH & Thư viện", code: "TT_NNTH" },
  { id: "KINH_TE", label: "Khoa Kinh tế - Quản trị", code: "K_KTQT" },
  { id: "KY_THUAT", label: "Khoa Kỹ thuật - Công nghệ", code: "K_KTCN" },
  { id: "TAI_CHINH", label: "Phòng Kế hoạch - Tài chính", code: "P_KHTC" },
  { id: "CTHSSV", label: "Phòng Công tác HSSV", code: "P_CTHSSV" },
];

/**
 * Thẻ lọc thông minh chuẩn Linear UX (Smart Filter Pills)
 */
export const SMART_FILTER_TABS: SmartFilterTabOption[] = [
  { id: "all", label: "Tất cả", description: "Toàn bộ danh sách nhiệm vụ" },
  { id: "my_tasks", label: "Việc của tôi", description: "Nhiệm vụ bạn phụ trách chính (DRI) hoặc được giao việc con" },
  { id: "overdue", label: "Quá hạn", description: "Nhiệm vụ trễ hạn chót chưa hoàn thành" },
  { id: "review", label: "Chờ duyệt", description: "Hồ sơ minh chứng đang chờ nghiệm thu / cần chỉnh sửa" },
  { id: "today", label: "Hôm nay", description: "Hạn chót cần xử lý trong ngày hôm nay" },
  { id: "in_progress", label: "Đang làm", description: "Nhiệm vụ đang trong tiến trình xử lý" },
  { id: "completed", label: "Hoàn thành", description: "Nhiệm vụ đã hoàn thành toàn bộ" },
];

/**
 * Cấu hình mật độ hiển thị hàng
 */
export const DENSITY_CONFIGS: Record<TableDensity, TableDensityConfig> = {
  compact: {
    id: "compact",
    label: "Gọn",
    rowHeight: "h-9",
    padding: "py-1.5 px-3",
    fontSize: "text-xs",
  },
  comfortable: {
    id: "comfortable",
    label: "Chuẩn",
    rowHeight: "h-12",
    padding: "py-2.5 px-3",
    fontSize: "text-sm",
  },
};

export const DEFAULT_DENSITY: TableDensity = "comfortable";

/**
 * Cấu hình phân trang mặc định
 */
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

/**
 * Density mapping compatible with numeric/string row heights
 */
export const TABLE_DENSITY_CONFIG = {
  compact: {
    rowHeight: 36,
    padding: "py-1.5 px-3",
    fontSize: "text-xs",
  },
  standard: {
    rowHeight: 48,
    padding: "py-2.5 px-3",
    fontSize: "text-sm",
  },
  comfortable: {
    rowHeight: 56,
    padding: "py-3 px-4",
    fontSize: "text-sm",
  },
};

/**
 * Status config map compatible with STATUS_BADGE_CONFIGS
 */
export const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; borderClass: string; oklchColor: string; oklchBg: string }> = {
  NEW: {
    label: "Mới",
    badgeClass: "border-rose-500/20 bg-rose-500/10 text-rose-700",
    borderClass: "border-rose-500/30",
    oklchColor: "oklch(0.63 0.22 25)",
    oklchBg: "oklch(0.96 0.04 25)",
  },
  IN_PROGRESS: {
    label: "Đang thực hiện",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-700",
    borderClass: "border-blue-500/30",
    oklchColor: "oklch(0.42 0.18 250)",
    oklchBg: "oklch(0.95 0.04 250)",
  },
  NEEDS_REVIEW: {
    label: "Cần chỉnh sửa",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    borderClass: "border-amber-500/30",
    oklchColor: "oklch(0.74 0.17 75)",
    oklchBg: "oklch(0.96 0.05 75)",
  },
  WAITING_APPROVAL: {
    label: "Chờ phê duyệt",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    borderClass: "border-amber-500/30",
    oklchColor: "oklch(0.74 0.17 75)",
    oklchBg: "oklch(0.96 0.05 75)",
  },
  PENDING_EXECUTIVE_APPROVAL: {
    label: "Chờ BGH duyệt",
    badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-700",
    borderClass: "border-purple-500/30",
    oklchColor: "oklch(0.65 0.20 300)",
    oklchBg: "oklch(0.96 0.04 300)",
  },
  COMPLETED: {
    label: "Hoàn thành",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    borderClass: "border-emerald-500/30",
    oklchColor: "oklch(0.68 0.17 150)",
    oklchBg: "oklch(0.96 0.04 150)",
  },
  OVERDUE: {
    label: "Quá hạn",
    badgeClass: "border-rose-500/20 bg-rose-500/10 text-rose-700",
    borderClass: "border-rose-500/30",
    oklchColor: "oklch(0.63 0.22 25)",
    oklchBg: "oklch(0.96 0.04 25)",
  },
  NOT_STARTED: {
    label: "Chưa bắt đầu",
    badgeClass: "border-zinc-300 bg-zinc-100 text-zinc-600",
    borderClass: "border-zinc-300",
    oklchColor: "oklch(0.55 0.01 250)",
    oklchBg: "oklch(0.95 0.005 250)",
  },
  CANCELLED: {
    label: "Đã hủy",
    badgeClass: "border-zinc-300 bg-zinc-100 text-zinc-600",
    borderClass: "border-zinc-300",
    oklchColor: "oklch(0.55 0.01 250)",
    oklchBg: "oklch(0.95 0.005 250)",
  },
  BLOCKED: {
    label: "Tạm dừng",
    badgeClass: "border-zinc-300 bg-zinc-100 text-zinc-600",
    borderClass: "border-zinc-300",
    oklchColor: "oklch(0.55 0.01 250)",
    oklchBg: "oklch(0.95 0.005 250)",
  },
};

export const CATEGORY_LABELS: Record<string, string> = {
  CHUYEN_DOI_SO: "Chuyển đổi số",
  TRUYEN_THONG: "Truyền thông",
  CNTT: "CNTT",
  ATTT: "An toàn thông tin",
  THU_VIEN: "Thư viện",
  BAO_CAO: "Báo cáo",
  KHAC: "Khác",
};

