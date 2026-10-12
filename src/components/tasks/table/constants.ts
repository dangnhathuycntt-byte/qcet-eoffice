
import {
  Layers,
  Building2,
  Briefcase,
  GraduationCap,
  Calendar,
} from "lucide-react";
import type { TaskCategory, TaskStatus } from "@/types/dashboard";
import type { CategoryTab, DepartmentOption, SmartFilterTabOption, TableDensity } from "./types";

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
    className: "border-destructive/20 bg-destructive/10 text-destructive",
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
    className: "border-warning/20 bg-warning/10 text-warning",
    variant: "amber",
    oklchColor: "oklch(0.74 0.17 75)",
    oklchBg: "oklch(0.96 0.05 75)",
  },
  WAITING_APPROVAL: {
    label: "Chờ phê duyệt",
    className: "border-warning/20 bg-warning/10 text-warning",
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
    label: "Trễ hạn",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
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
    className: "border-warning/20 bg-warning/10 text-warning",
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
 * Thẻ lọc thông minh (Smart Filter Pills)
 */
export const SMART_FILTER_TABS: SmartFilterTabOption[] = [
  { id: "all", label: "Tất cả", description: "Toàn bộ danh sách nhiệm vụ" },
  { id: "my_tasks", label: "Việc của tôi", description: "Nhiệm vụ bạn phụ trách chính (DRI) hoặc được giao việc con" },
  { id: "overdue", label: "Trễ hạn", description: "Nhiệm vụ trễ hạn chót chưa hoàn thành" },
  { id: "review", label: "Chờ duyệt", description: "Hồ sơ minh chứng đang chờ nghiệm thu / cần chỉnh sửa" },
  { id: "today", label: "Hôm nay", description: "Hạn chót cần xử lý trong ngày hôm nay" },
  { id: "in_progress", label: "Đang làm", description: "Nhiệm vụ đang trong tiến trình xử lý" },
  { id: "completed", label: "Hoàn thành", description: "Nhiệm vụ đã hoàn thành toàn bộ" },
];

export const DEFAULT_DENSITY: TableDensity = "compact";

/**
 * Cấu hình phân trang mặc định (20 rows/page on desktop)
 */
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_PAGE_SIZES = [20, 50, 100];

/**
 * Status config map compatible with STATUS_BADGE_CONFIGS
 */
export const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; borderClass: string; oklchColor: string; oklchBg: string }> = {
  NEW: {
    label: "Mới",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    borderClass: "border-destructive/30",
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
    badgeClass: "border-warning/20 bg-warning/10 text-warning",
    borderClass: "border-warning/30",
    oklchColor: "oklch(0.74 0.17 75)",
    oklchBg: "oklch(0.96 0.05 75)",
  },
  WAITING_APPROVAL: {
    label: "Cần chỉnh sửa",
    badgeClass: "border-warning/20 bg-warning/10 text-warning",
    borderClass: "border-warning/30",
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
    label: "Trễ hạn",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    borderClass: "border-destructive/30",
    oklchColor: "oklch(0.63 0.22 25)",
    oklchBg: "oklch(0.96 0.04 25)",
  },
  NOT_STARTED: {
    label: "Mới",
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


/**
 * Độ rộng cột bảng nhiệm vụ — nguồn duy nhất cho `<col>`, `<th>` và `<td>`.
 * Cột phụ tự ẩn theo độ rộng khung bảng (container query, cần `@container` ở khung cuộn)
 * để Tiêu đề, Hạn và Trạng thái luôn thấy được mà không phải cuộn ngang.
 * Ẩn theo thứ tự: ngày tạo/bắt đầu → đơn vị, phối hợp → phụ trách → ưu tiên.
 */
export const TASK_COLUMN_CLASS = {
  title: "min-w-[220px]",
  priority: "w-[84px] @max-[560px]:hidden",
  leadAssignee: "w-[184px] @max-[760px]:hidden",
  coAssignees: "w-[110px] @max-[940px]:hidden",
  department: "w-[176px] @max-[940px]:hidden",
  startDate: "w-[80px] @max-[1120px]:hidden",
  dueDate: "w-[96px]",
  createdAt: "w-[80px] @max-[1120px]:hidden",
  status: "w-[148px]",
} as const;
