"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  MapPin,
  Plus,
  RefreshCw,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardNav,
} from "@/components/dashboard/dashboard-context";
import { resolveCreateTaskPolicy } from "@/domain/tasks/create-task-policy";
import { isTaskPastDue, getSystemReferenceDate, getSystemReferenceDateStr } from "@/lib/unified-task-hub";
import { isTaskWaitingApproval } from "@/lib/workspace-metrics-aggregator";
import { cn } from "@/lib/utils";
import type { AgendaEventItem } from "@/components/dashboard/today-agenda-widget";
import type { TaskScope } from "@/components/dashboard/unified-task-toolbar";
import type { SchoolTask } from "@/types/dashboard";

interface AttentionItem {
  id: string;
  code?: string;
  title: string;
  reason: "WAITING_APPROVAL" | "OVERDUE" | "APPROACHING_DEADLINE";
  reasonLabel: string;
  badgeStyle: string;
  departmentName?: string;
  assigneeName?: string;
  dueDate?: string;
  targetUrl: string;
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "Chưa đặt hạn";
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return "Vừa xong";
  try {
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return timestamp;
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
  } catch {
    return timestamp;
  }
}

export function DashboardZone() {
  const {
    tasks,
    user,
    activities,
    isExecutive,
    isManager,
    isRefreshing,
  } = useDashboardData();

  const { scope, handleScopeChange } = useDashboardNav();
  const { handleManualRefresh } = useDashboardActions();

  const createPolicy = React.useMemo(() => resolveCreateTaskPolicy(user), [user]);

  const handleOpenCreateTask = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
    }
  };

  // 1. Resolve user's actual department label
  const unitLabel = React.useMemo(() => {
    const dept = user?.department || (user as any)?.departmentName;
    if (dept) return dept;
    if (user?.departmentCode) return user.departmentCode;
    return "Đơn vị";
  }, [user?.department, (user as any)?.departmentName, user?.departmentCode]);

  // 2. Available scopes based on user role/capability
  const availableScopes = React.useMemo(() => {
    const list: Array<{ id: TaskScope; label: string }> = [];
    if (isExecutive) {
      list.push({ id: "SCHOOL_TASKS", label: "Toàn trường" });
      list.push({ id: "UNIT_TASKS", label: unitLabel });
      list.push({ id: "MY_TASKS", label: "Cá nhân" });
    } else if (isManager) {
      list.push({ id: "UNIT_TASKS", label: unitLabel });
      list.push({ id: "MY_TASKS", label: "Cá nhân" });
    } else {
      list.push({ id: "MY_TASKS", label: "Cá nhân" });
    }
    return list;
  }, [isExecutive, isManager, unitLabel]);

  // 3. Current reference date & academic semester
  const refDateStr = getSystemReferenceDateStr(); // "2026-09-15"
  const formattedTodayDate = React.useMemo(() => {
    try {
      const parts = refDateStr.split("-").map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const formatter = new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const str = formatter.format(d);
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return "15/09/2026";
    }
  }, [refDateStr]);

  // 4. Derive ONLY high-signal exceptions requiring attention (Cần chú ý)
  const attentionItems = React.useMemo<AttentionItem[]>(() => {
    const list: AttentionItem[] = [];

    for (const t of tasks) {
      if (t.status === "COMPLETED" || t.status === "CANCELLED") continue;

      const isWaiting =
        isTaskWaitingApproval(t.status) ||
        (t as any).requiresReview ||
        t.status === "PENDING_EXECUTIVE_APPROVAL";

      const isOverdue =
        t.isOverdue ||
        (t.dueDate && isTaskPastDue(t.dueDate, refDateStr));

      const isDueTodayOrSoon =
        !isOverdue &&
        t.dueDate &&
        (t.dueDate.startsWith(refDateStr) || t.dueDate.startsWith("2026-09-16"));

      if (isWaiting) {
        list.push({
          id: t.id,
          code: t.taskCode || t.code,
          title: t.title,
          reason: "WAITING_APPROVAL",
          reasonLabel: "Chờ phê duyệt",
          badgeStyle: "bg-amber-50 text-amber-700 border-amber-200/80",
          departmentName: t.leadDepartment || t.department || t.departmentName,
          assigneeName: t.leadAssigneeName || t.assignedTo,
          dueDate: t.dueDate,
          targetUrl: `/tasks?taskId=${t.id}`,
        });
      } else if (isOverdue) {
        list.push({
          id: t.id,
          code: t.taskCode || t.code,
          title: t.title,
          reason: "OVERDUE",
          reasonLabel: "Quá hạn",
          badgeStyle: "bg-rose-50 text-rose-700 border-rose-200/80",
          departmentName: t.leadDepartment || t.department || t.departmentName,
          assigneeName: t.leadAssigneeName || t.assignedTo,
          dueDate: t.dueDate,
          targetUrl: `/tasks?taskId=${t.id}`,
        });
      } else if (isDueTodayOrSoon) {
        list.push({
          id: t.id,
          code: t.taskCode || t.code,
          title: t.title,
          reason: "APPROACHING_DEADLINE",
          reasonLabel: "Đến hạn",
          badgeStyle: "bg-blue-50 text-blue-700 border-blue-200/80",
          departmentName: t.leadDepartment || t.department || t.departmentName,
          assigneeName: t.leadAssigneeName || t.assignedTo,
          dueDate: t.dueDate,
          targetUrl: `/tasks?taskId=${t.id}`,
        });
      }
    }

    // Sort order: WAITING_APPROVAL first, then OVERDUE, then APPROACHING_DEADLINE
    const priorityOrder: Record<string, number> = {
      WAITING_APPROVAL: 1,
      OVERDUE: 2,
      APPROACHING_DEADLINE: 3,
    };

    return list.sort((a, b) => (priorityOrder[a.reason] || 9) - (priorityOrder[b.reason] || 9));
  }, [tasks, refDateStr]);

  // Today's schedule events
  const todayEvents: AgendaEventItem[] = [];

  // Recent meaningful activities
  const recentActivities = (activities || []).slice(0, 5);

  return (
    <div
      className="w-full max-w-7xl mx-auto space-y-8 pb-12 pt-1 text-slate-900"
      data-slot="orientation-workbench"
    >
      {/* ============================================================
          HEADER & CONTEXT BAR
          ============================================================ */}
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
              Bàn làm việc
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Làm mới dữ liệu"
              aria-label="Làm mới dữ liệu"
              className="size-8 flex items-center justify-center rounded-md border border-slate-200/80 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw
                size={13}
                className={isRefreshing ? "animate-spin text-slate-800" : ""}
                strokeWidth={1.75}
              />
            </button>

            {createPolicy.canCreate && (
              <Button
                size="sm"
                onClick={handleOpenCreateTask}
                className="h-8 gap-1.5 px-3 text-xs font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus size={14} strokeWidth={2} />
                <span>Tạo nhiệm vụ</span>
              </Button>
            )}
          </div>
        </div>

        {/* Scope selector (when > 1 available) + Date/Period info */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-b border-slate-200/80 pb-3 text-xs">
          <div className="flex items-center gap-1.5">
            {availableScopes.length > 1 ? (
              <div
                className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50/60 p-0.5"
                role="tablist"
                aria-label="Phạm vi dữ liệu"
              >
                {availableScopes.map((item) => {
                  const isSelected = scope === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => handleScopeChange(item.id)}
                      className={cn(
                        "h-6.5 px-2.5 rounded text-xs font-medium transition-colors cursor-pointer",
                        isSelected
                          ? "bg-white text-slate-900 shadow-2xs font-semibold"
                          : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-500 font-medium">
                Phạm vi: <span className="text-slate-800">{availableScopes[0]?.label || "Cá nhân"}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
            <span>{formattedTodayDate}</span>
            <span className="text-slate-300">·</span>
            <span>Học kỳ I (2026-2027)</span>
            <span className="text-slate-300">·</span>
            <span>ICT (UTC+7)</span>
          </div>
        </div>
      </header>

      {/* ============================================================
          MAIN BODY: 2-COLUMN RESTITUTED ADAPTIVE WORKSPACE
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ============================================================
            SECTION 1: CẦN CHÚ Ý (Dominant Column: 7 cols)
            ============================================================ */}
        <section
          aria-label="Cần chú ý"
          className="lg:col-span-7 space-y-3"
          data-slot="section-attention"
        >
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                Cần chú ý
              </h2>
              {attentionItems.length > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                  {attentionItems.length}
                </span>
              )}
            </div>

            <Link
              href="/tasks"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
            >
              <span>Mở trong Nhiệm vụ</span>
              <ArrowUpRight size={12} strokeWidth={2} />
            </Link>
          </div>

          {/* Exceptions List or Quiet Empty State */}
          {attentionItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center bg-slate-50/40">
              <CheckCircle2 className="size-5 text-emerald-600 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-xs font-medium text-slate-700">
                Không có vấn đề cần xử lý khẩn cấp
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Mọi công việc trong phạm vi đang diễn ra đúng kế hoạch.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200/80 bg-white divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {attentionItems.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  href={item.targetUrl}
                  className="group flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
                        item.badgeStyle
                      )}
                    >
                      {item.reasonLabel}
                    </span>

                    {item.code && (
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">
                        {item.code}
                      </span>
                    )}

                    <span className="text-xs text-slate-800 font-medium truncate group-hover:text-slate-900">
                      {item.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400">
                    {item.departmentName && (
                      <span className="hidden sm:inline-block max-w-[120px] truncate text-slate-500">
                        {item.departmentName}
                      </span>
                    )}
                    {item.dueDate && (
                      <span className="font-mono text-slate-500">
                        {formatDisplayDate(item.dueDate)}
                      </span>
                    )}
                    <ArrowUpRight
                      size={13}
                      className="text-slate-300 group-hover:text-slate-600 transition-colors"
                    />
                  </div>
                </Link>
              ))}

              {attentionItems.length > 8 && (
                <div className="px-3.5 py-2 text-center bg-slate-50/50">
                  <Link
                    href="/tasks"
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    Xem thêm {attentionItems.length - 8} mục khác trong Nhiệm vụ →
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ============================================================
            SECTIONS 2 & 3: LỊCH HÔM NAY & THÔNG BÁO (Side Column: 5 cols)
            ============================================================ */}
        <div className="lg:col-span-5 space-y-6">
          {/* ============================================================
              SECTION 2: LỊCH HÔM NAY (Today's Orientation)
              ============================================================ */}
          <section aria-label="Lịch hôm nay" className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <CalendarIcon size={14} className="text-slate-400" strokeWidth={1.75} />
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                  Lịch hôm nay
                </h2>
              </div>

              <Link
                href="/calendar"
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
              >
                <span>Xem lịch công tác</span>
                <ArrowUpRight size={12} strokeWidth={2} />
              </Link>
            </div>

            <div className="rounded-lg border border-slate-200/80 bg-white divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {todayEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="px-3.5 py-2.5 hover:bg-slate-50/60 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[11px] font-medium text-slate-700">
                      {evt.startTime} - {evt.endTime}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded font-medium",
                        evt.status === "IN_PROGRESS"
                          ? "bg-emerald-50 text-emerald-700"
                          : evt.status === "COMPLETED"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-blue-50 text-blue-700"
                      )}
                    >
                      {evt.status === "IN_PROGRESS"
                        ? "Đang diễn ra"
                        : evt.status === "COMPLETED"
                        ? "Đã diễn ra"
                        : "Sắp tới"}
                    </span>
                  </div>

                  <p className="font-medium text-slate-900 leading-snug mb-1">
                    {evt.title}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1 truncate">
                      {evt.isOnline ? (
                        <Video size={11} className="text-blue-500 shrink-0" />
                      ) : (
                        <MapPin size={11} className="shrink-0" />
                      )}
                      <span className="truncate">{evt.location}</span>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="truncate text-slate-500">{evt.chairPerson}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ============================================================
              SECTION 3: THÔNG BÁO & HOẠT ĐỘNG QUAN TRỌNG
              ============================================================ */}
          <section aria-label="Thông báo và Hoạt động" className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <History size={14} className="text-slate-400" strokeWidth={1.75} />
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                  Hoạt động gần đây
                </h2>
              </div>

              <Link
                href="/notifications"
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
              >
                <span>Tất cả thông báo</span>
                <ArrowUpRight size={12} strokeWidth={2} />
              </Link>
            </div>

            <div className="rounded-lg border border-slate-200/80 bg-white divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {recentActivities.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Không có hoạt động mới trong kỳ này
                </div>
              ) : (
                recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="px-3.5 py-2.5 hover:bg-slate-50/60 transition-colors text-xs flex items-start gap-2.5"
                  >
                    <div className="size-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 font-medium text-[10px] mt-0.5">
                      {act.actorName ? act.actorName.charAt(0).toUpperCase() : "Q"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-slate-700 leading-snug">
                        <span className="font-semibold text-slate-900">{act.actorName}</span>{" "}
                        {act.action}{" "}
                        <span className="font-medium text-slate-900">{act.targetTitle}</span>
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                        {formatRelativeTime(act.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
