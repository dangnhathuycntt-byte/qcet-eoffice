"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useDepartmentList } from "@/hooks/use-department-list";

export interface DocumentFilterBarProps {
  /** Search query string */
  searchQuery: string;
  /** Search change handler */
  onSearchChange: (value: string) => void;

  /** Urgency filter value ('ALL', 'flash', 'top_urgent', 'urgent', 'normal', etc.) */
  urgencyFilter: string;
  /** Urgency change handler */
  onUrgencyChange: (urgency: string) => void;

  /** Status filter value ('ALL', 'pending_assignment', 'processing', 'delegated', 'approved', 'completed', etc.) */
  statusFilter: string;
  /** Status change handler */
  onStatusChange: (status: string) => void;

  /** Department/Lead Unit ID filter value ('ALL' or department ID) */
  departmentFilter?: string;
  /** Department change handler */
  onDepartmentChange?: (departmentId: string) => void;

  /** Year filter value ('ALL' or year as string e.g. '2026') */
  yearFilter?: string;
  /** Year change handler */
  onYearChange?: (year: string) => void;

  /** Optional department list override; if omitted, automatically uses `useDepartmentList()` */
  departments?: Array<{ id: string; name: string; code?: string }>;

  /** Optional custom year options */
  years?: Array<{ value: string; label: string }>;

  /** Export Excel handler */
  onExportExcel?: () => void;
  /** Is Excel export currently loading */
  isExporting?: boolean;

  /** Reset all filters handler */
  onResetFilters?: () => void;

  /** Whether to show the density toggle (default: true) */
  showDensityToggle?: boolean;

  /** Additional CSS class names */
  className?: string;
}

export const URGENCY_FILTER_OPTIONS: Array<{
  value: string;
  label: string;
  badgeClass?: string;
}> = [
  { value: "ALL", label: "Độ khẩn: Tất cả" },
  { value: "flash", label: "Hỏa tốc", badgeClass: "text-red-700 bg-red-500/10" },
  { value: "top_urgent", label: "Thượng khẩn", badgeClass: "text-warning bg-warning/10" },
  { value: "urgent", label: "Khẩn", badgeClass: "text-warning bg-warning/10" },
  { value: "normal", label: "Thường", badgeClass: "text-muted-foreground bg-muted" },
];

export const STATUS_FILTER_OPTIONS: Array<{
  value: string;
  label: string;
  dotClass?: string;
}> = [
  { value: "ALL", label: "Trạng thái: Tất cả" },
  { value: "pending_assignment", label: "Chờ phân công / Bút phê", dotClass: "bg-warning" },
  { value: "processing", label: "Đang xử lý", dotClass: "bg-blue-500" },
  { value: "delegated", label: "Đã giao việc", dotClass: "bg-emerald-500" },
  { value: "approved", label: "Chờ phê duyệt", dotClass: "bg-indigo-500" },
  { value: "completed", label: "Đã hoàn thành", dotClass: "bg-emerald-500" },
];

const currentYear = new Date().getFullYear();
export const DEFAULT_YEAR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "Năm ban hành: Tất cả" },
  { value: String(currentYear), label: `Năm ${currentYear}` },
  { value: String(currentYear - 1), label: `Năm ${currentYear - 1}` },
  { value: String(currentYear - 2), label: `Năm ${currentYear - 2}` },
  { value: String(currentYear - 3), label: `Năm ${currentYear - 3}` },
];
