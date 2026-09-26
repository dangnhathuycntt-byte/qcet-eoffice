/**
 * Canonical Display Configuration for Task Status & Priority
 *
 * Single source of truth for all UI presentation attributes: labels, colors,
 * dot indicators, icons, and badge variants. All UI surfaces derive their
 * status/priority styling from this config instead of maintaining local duplicates.
 *
 * Label standards (frozen):
 * - NOT_STARTED → "Mới"
 * - IN_PROGRESS → "Đang thực hiện"
 * - WAITING_APPROVAL → "Chờ duyệt"
 * - PENDING_EXECUTIVE_APPROVAL → "Chờ BGH duyệt"
 * - NEEDS_REVIEW → "Cần chỉnh sửa"
 * - COMPLETED → "Hoàn thành"
 * - OVERDUE → removed from enum (Phase 9 WI-9.4)
 * - CANCELLED → "Đã hủy"
 * - BLOCKED → "Tạm dừng"
 */

import type { TaskStatus, TaskPriority } from '@/types/dashboard';
import type { LucideIcon } from 'lucide-react';
import {
  CircleDashed,
  Clock,
  AlertCircle,
  CheckCircle2,
  Ban,
  AlertTriangle,
  ShieldAlert,
  FileSearch,
  PauseCircle,
} from 'lucide-react';

/* ── Status Display ──────────────────────────────────────────────── */

export interface StatusDisplayConfig {
  /** Canonical TaskStatus value */
  value: TaskStatus;
  /** Vietnamese label for UI display */
  label: string;
  /** Abbreviated label for compact views */
  shortLabel: string;
  /** Tailwind classes for the status dot indicator */
  dotClass: string;
  /** Tailwind text color for the status icon */
  iconClass: string;
  /** Full badge styling: text + bg + border */
  colorClass: string;
  /** Badge variant name from badge.tsx (when available) */
  badgeVariant?: string;
  /** Additional badge className override */
  badgeClassName?: string;
  /** Lucide icon component for this status */
  icon: LucideIcon;
}

export const STATUS_DISPLAY_CONFIG: ReadonlyArray<StatusDisplayConfig> = [
  {
    value: 'NOT_STARTED',
    label: 'Mới',
    shortLabel: 'Mới',
    dotClass: 'bg-muted-foreground/60',
    iconClass: 'text-muted-foreground/60',
    colorClass: 'text-muted-foreground bg-muted/60 border-border/60',
    badgeVariant: 'secondary',
    icon: CircleDashed,
  },
  {
    value: 'NEW',
    label: 'Mới',
    shortLabel: 'Mới',
    dotClass: 'bg-muted-foreground/60',
    iconClass: 'text-muted-foreground/60',
    colorClass: 'text-muted-foreground bg-muted/60 border-border/60',
    badgeVariant: 'secondary',
    icon: CircleDashed,
  },
  {
    value: 'IN_PROGRESS',
    label: 'Đang thực hiện',
    shortLabel: 'Đang làm',
    dotClass: 'bg-blue-600',
    iconClass: 'text-blue-600',
    colorClass: 'text-blue-700 bg-blue-50/80 border-blue-200/80',
    badgeVariant: 'sapphire',
    icon: Clock,
  },
  {
    value: 'WAITING_APPROVAL',
    label: 'Chờ duyệt',
    shortLabel: 'Chờ duyệt',
    dotClass: 'bg-amber-600',
    iconClass: 'text-amber-600',
    colorClass: 'text-amber-700 bg-amber-50/80 border-amber-200/80',
    badgeVariant: 'amber',
    icon: AlertCircle,
  },
  {
    value: 'PENDING_EXECUTIVE_APPROVAL',
    label: 'Chờ BGH duyệt',
    shortLabel: 'Chờ BGH',
    dotClass: 'bg-violet-600',
    iconClass: 'text-violet-600',
    colorClass: 'text-violet-700 bg-violet-50/80 border-violet-200/80',
    badgeVariant: 'violet',
    icon: ShieldAlert,
  },
  {
    value: 'NEEDS_REVIEW',
    label: 'Cần chỉnh sửa',
    shortLabel: 'Chỉnh sửa',
    dotClass: 'bg-orange-500',
    iconClass: 'text-orange-500',
    colorClass: 'text-orange-700 bg-orange-50/80 border-orange-200/80',
    badgeVariant: 'amber',
    badgeClassName: 'border-orange-200 bg-orange-50 text-orange-700',
    icon: FileSearch,
  },
  {
    value: 'COMPLETED',
    label: 'Hoàn thành',
    shortLabel: 'Xong',
    dotClass: 'bg-emerald-600',
    iconClass: 'text-emerald-600',
    colorClass: 'text-emerald-700 bg-emerald-50/80 border-emerald-200/80',
    badgeVariant: 'emerald',
    icon: CheckCircle2,
  },
  {
    value: 'CANCELLED',
    label: 'Đã hủy',
    shortLabel: 'Hủy',
    dotClass: 'bg-muted-foreground/40',
    iconClass: 'text-muted-foreground/40',
    colorClass: 'text-muted-foreground bg-muted/40 border-border/40',
    badgeVariant: 'secondary',
    badgeClassName: 'line-through opacity-70',
    icon: Ban,
  },
  {
    value: 'BLOCKED',
    label: 'Tạm dừng',
    shortLabel: 'Dừng',
    dotClass: 'bg-muted-foreground/60',
    iconClass: 'text-muted-foreground/60',
    colorClass: 'text-muted-foreground bg-muted/50 border-border/50',
    badgeVariant: 'secondary',
    icon: PauseCircle,
  },
];

/** Lookup a single status display config by value. Falls back to NOT_STARTED. */
export function getStatusDisplay(status: TaskStatus | string): StatusDisplayConfig {
  return (
    STATUS_DISPLAY_CONFIG.find((c) => c.value === status) ??
    STATUS_DISPLAY_CONFIG[0]
  );
}

/**
 * Subset for the common 4-status workflow dropdown.
 * Use for task status select controls where only the core statuses are selectable.
 */
export const CORE_STATUS_OPTIONS = STATUS_DISPLAY_CONFIG.filter((c) =>
  (['NOT_STARTED', 'IN_PROGRESS', 'WAITING_APPROVAL', 'COMPLETED'] as string[]).includes(c.value),
);

/* ── Priority Display ────────────────────────────────────────────── */

export interface PriorityDisplayConfig {
  value: TaskPriority;
  label: string;
  colorClass: string;
  iconClass: string;
  icon: LucideIcon;
}

export const PRIORITY_DISPLAY_CONFIG: ReadonlyArray<PriorityDisplayConfig> = [
  {
    value: 'URGENT',
    label: 'Khẩn cấp',
    colorClass: 'text-rose-700 bg-rose-50/80 border-rose-200/80',
    iconClass: 'text-rose-600',
    icon: AlertTriangle,
  },
  {
    value: 'HIGH',
    label: 'Cao',
    colorClass: 'text-amber-700 bg-amber-50/80 border-amber-200/80',
    iconClass: 'text-amber-600',
    icon: AlertCircle,
  },
  {
    value: 'NORMAL',
    label: 'Bình thường',
    colorClass: 'text-blue-700 bg-blue-50/80 border-blue-200/80',
    iconClass: 'text-blue-600',
    icon: CircleDashed,
  },
  {
    value: 'LOW',
    label: 'Thấp',
    colorClass: 'text-muted-foreground bg-muted/60 border-border/60',
    iconClass: 'text-muted-foreground',
    icon: CircleDashed,
  },
];

/** Lookup a single priority display config by value. Falls back to NORMAL. */
export function getPriorityDisplay(priority: TaskPriority | string): PriorityDisplayConfig {
  return (
    PRIORITY_DISPLAY_CONFIG.find((c) => c.value === priority) ??
    PRIORITY_DISPLAY_CONFIG[2] // NORMAL
  );
}

/* ── Category Display ────────────────────────────────────────────── */

export interface CategoryDisplayConfig {
  /** Canonical category ID */
  id: string;
  /** Vietnamese label for UI display */
  label: string;
  /** Tailwind background-color class for category indicator */
  color: string;
}

export const CATEGORY_DISPLAY_CONFIG: ReadonlyArray<CategoryDisplayConfig> = [
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số", color: "bg-blue-500" },
  { id: "TRUYEN_THONG", label: "Truyền thông & Tuyển sinh", color: "bg-purple-500" },
  { id: "CNTT", label: "Hạ tầng & CNTT", color: "bg-emerald-500" },
  { id: "ATTT", label: "An toàn thông tin", color: "bg-rose-500" },
  { id: "THU_VIEN", label: "Thư viện & Học liệu", color: "bg-amber-500" },
  { id: "BAO_CAO", label: "Báo cáo & Tổng hợp", color: "bg-cyan-500" },
  { id: "KHAC", label: "Khác", color: "bg-muted-foreground" },
];

/** Get category options array for select/dropdown UI controls. */
export function getCategoryOptions(): ReadonlyArray<CategoryDisplayConfig> {
  return CATEGORY_DISPLAY_CONFIG;
}
