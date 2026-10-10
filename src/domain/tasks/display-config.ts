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
import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  PauseCircle,
} from 'lucide-react';
import {
  StatusSubNew,
  StatusSubInProgress,
  StatusSubReview,
  StatusSubCompleted,
  PrioritySubUrgent,
  PrioritySubHigh,
  PrioritySubNormal,
  PrioritySubLow,
} from '@/lib/icons/task-status-icons';

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
  /** Icon component for this status (Neutral Vector or Lucide) */
  icon: React.ComponentType<any>;
}

export const STATUS_DISPLAY_CONFIG: ReadonlyArray<StatusDisplayConfig> = [
  {
    value: 'NOT_STARTED',
    label: 'Mới',
    shortLabel: 'Mới',
    dotClass: 'bg-muted-foreground/60',
    iconClass: 'text-muted-foreground/70',
    colorClass: 'text-muted-foreground bg-muted/50 border-border/50',
    badgeVariant: 'secondary',
    icon: StatusSubNew,
  },
  {
    value: 'NEW',
    label: 'Mới',
    shortLabel: 'Mới',
    dotClass: 'bg-muted-foreground/60',
    iconClass: 'text-muted-foreground/70',
    colorClass: 'text-muted-foreground bg-muted/50 border-border/50',
    badgeVariant: 'secondary',
    icon: StatusSubNew,
  },
  {
    value: 'IN_PROGRESS',
    label: 'Đang thực hiện',
    shortLabel: 'Đang làm',
    dotClass: 'bg-foreground/80',
    iconClass: 'text-foreground/80',
    colorClass: 'text-foreground bg-muted/80 border-border/80 font-medium',
    badgeVariant: 'secondary',
    icon: StatusSubInProgress,
  },
  {
    value: 'WAITING_APPROVAL',
    label: 'Chờ duyệt',
    shortLabel: 'Chờ duyệt',
    dotClass: 'bg-foreground/70',
    iconClass: 'text-foreground/70',
    colorClass: 'text-foreground/90 bg-muted/60 border-border/60',
    badgeVariant: 'secondary',
    icon: StatusSubReview,
  },
  {
    value: 'PENDING_EXECUTIVE_APPROVAL',
    label: 'Chờ BGH duyệt',
    shortLabel: 'Chờ BGH',
    dotClass: 'bg-foreground/70',
    iconClass: 'text-foreground/70',
    colorClass: 'text-foreground/90 bg-muted/60 border-border/60',
    badgeVariant: 'secondary',
    icon: StatusSubReview,
  },
  {
    value: 'NEEDS_REVIEW',
    label: 'Cần chỉnh sửa',
    shortLabel: 'Chỉnh sửa',
    dotClass: 'bg-foreground/70',
    iconClass: 'text-foreground/70',
    colorClass: 'text-foreground/90 bg-muted/60 border-border/60',
    badgeVariant: 'secondary',
    icon: StatusSubReview,
  },
  {
    value: 'COMPLETED',
    label: 'Hoàn thành',
    shortLabel: 'Xong',
    dotClass: 'bg-foreground/90',
    iconClass: 'text-foreground/90',
    colorClass: 'text-foreground/90 bg-muted/60 border-border/60',
    badgeVariant: 'secondary',
    icon: StatusSubCompleted,
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
  icon: React.ComponentType<any>;
}

export const PRIORITY_DISPLAY_CONFIG: ReadonlyArray<PriorityDisplayConfig> = [
  {
    value: 'URGENT',
    label: 'Khẩn cấp',
    colorClass: 'text-foreground bg-muted/80 border-border/80 font-medium',
    iconClass: 'text-foreground',
    icon: PrioritySubUrgent,
  },
  {
    value: 'HIGH',
    label: 'Cao',
    colorClass: 'text-foreground/90 bg-muted/60 border-border/60 font-medium',
    iconClass: 'text-foreground/80',
    icon: PrioritySubHigh,
  },
  {
    value: 'NORMAL',
    label: 'Bình thường',
    colorClass: 'text-foreground/80 bg-muted/40 border-border/40 font-normal',
    iconClass: 'text-muted-foreground/70',
    icon: PrioritySubNormal,
  },
  {
    value: 'LOW',
    label: 'Thấp',
    colorClass: 'text-muted-foreground bg-muted/30 border-border/30 font-normal',
    iconClass: 'text-muted-foreground/50',
    icon: PrioritySubLow,
  },
];

/** Lookup a single priority display config by value. Falls back to NORMAL. */
export function getPriorityDisplay(priority: TaskPriority | string): PriorityDisplayConfig {
  return (
    PRIORITY_DISPLAY_CONFIG.find((c) => c.value === priority) ??
    PRIORITY_DISPLAY_CONFIG[2] // NORMAL
  );
}

/* ── Dropdown Option Shapes ─────────────────────────────────────── */

/** Compact option shape used by dropdowns in task identity / detail views. */
export interface StatusDropdownOption {
  value: TaskStatus;
  label: string;
  colorClass: string;
  dotClass: string;
  iconClass: string;
}

/** Derived from CORE_STATUS_OPTIONS — single source of truth for status dropdowns. */
export const STATUS_OPTIONS: ReadonlyArray<StatusDropdownOption> = CORE_STATUS_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
  colorClass: opt.colorClass,
  dotClass: opt.dotClass,
  iconClass: opt.iconClass,
}));

/** Compact option shape used by priority dropdowns. */
export interface PriorityDropdownOption {
  value: TaskPriority;
  label: string;
  colorClass: string;
  iconClass: string;
}

/** Derived from PRIORITY_DISPLAY_CONFIG — single source of truth for priority dropdowns. */
export const PRIORITY_OPTIONS: ReadonlyArray<PriorityDropdownOption> = PRIORITY_DISPLAY_CONFIG.map((opt) => ({
  value: opt.value,
  label: opt.label,
  colorClass: opt.colorClass,
  iconClass: opt.iconClass,
}));

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
  { id: "ATTT", label: "An toàn thông tin", color: "bg-rose-500" }, // design-lint-ignore no-signal-palette: màu phân loại, không phải tín hiệu
  { id: "THU_VIEN", label: "Thư viện & Học liệu", color: "bg-amber-500" }, // design-lint-ignore no-signal-palette: màu phân loại, không phải tín hiệu
  { id: "BAO_CAO", label: "Báo cáo & Tổng hợp", color: "bg-cyan-500" },
  { id: "KHAC", label: "Khác", color: "bg-muted-foreground" },
];

/** Get category options array for select/dropdown UI controls. */
export function getCategoryOptions(): ReadonlyArray<CategoryDisplayConfig> {
  return CATEGORY_DISPLAY_CONFIG;
}
