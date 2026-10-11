"use client";

import * as React from "react";
import * as m from "motion/react-m";

export type DocumentKpiType = "all" | "pending" | "processing" | "urgent" | "completed";

export interface DocumentStatsData {
  /** Tổng số lượng văn bản */
  total?: number;
  /** Văn bản đến */
  totalInbox?: number;
  /** Văn bản đi */
  totalOutbox?: number;
  /** Tờ trình nội bộ */
  totalSubmissions?: number;
  /** Văn bản chờ phân công / chờ bút phê */
  pending?: number;
  /** Văn bản đang xử lý */
  processing?: number;
  /** Văn bản có độ khẩn cao (Hỏa tốc, Thượng khẩn, Khẩn) hoặc trễ hạn */
  urgent?: number;
  /** Văn bản trễ hạn */
  overdue?: number;
  /** Văn bản đã hoàn thành / ký duyệt / lưu sổ */
  completed?: number;
  /** Số văn bản đã liên thông sang Task Hub */
  linkedTasks?: number;
}

export interface DocumentStatsSummaryProps {
  /** Thống kê số lượng */
  stats: DocumentStatsData;
  /** KPI card đang được chọn */
  activeKpi?: DocumentKpiType | null;
  /** Callback khi người dùng click vào một thẻ KPI */
  onSelectKpi?: (kpi: DocumentKpiType) => void;
  /** Callback riêng khi filter theo trạng thái */
  onStatusFilter?: (status: string) => void;
  /** Callback riêng khi filter theo độ khẩn */
  onUrgencyFilter?: (urgency: string) => void;
  /** Callback khi chuyển tab */
  onTabChange?: (tab: string) => void;
  /** Trạng thái filter hiện tại của parent (để tự động highlight thẻ active) */
  currentStatus?: string;
  currentUrgency?: string;
  currentTab?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class */
  className?: string;
}
