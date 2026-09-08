"use client";

import * as React from "react";
import {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  ActivityEvent,
  DashboardStats,
} from "@/types/dashboard";
import { AuthUser } from "@/types/auth";
import { WorkspaceZone } from "@/types/workspace";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Network,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  Kanban,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface BentoPortalHubProps {
  tasks: SchoolTask[];
  stats: DashboardStats;
  upcoming: UpcomingItem[];
  activities: ActivityEvent[];
  user: AuthUser | null;
  onNavigateZone: (zone: WorkspaceZone) => void;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onOpenCreateTask: (level?: "TRUONG" | "DON_VI", parentId?: string) => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
}

function getSchoolTaskPriority(t: SchoolTask): "URGENT" | "HIGH" | "NORMAL" {
  if (t.status === "PENDING_EXECUTIVE_APPROVAL") return "URGENT";
  if (t.dueDate <= "2026-09-08") return "URGENT";
  if (t.category === "ATTT" || t.category === "CHUYEN_DOI_SO") return "HIGH";
  return "NORMAL";
}

export function BentoPortalHub({
  tasks,
  stats,
  upcoming,
  activities,
  user,
  onNavigateZone,
  onSelectTask,
  onOpenCreateTask,
  onManualRefresh,
  isRefreshing,
}: BentoPortalHubProps) {
  const isExecutive = user?.role === "ADMIN";
  const isManager = user?.role === "MANAGER";

  // Aggregate stats calculations
  const totalTasksCount = (stats.totalSchoolTasks || 0) + (stats.totalStaffTasks || 0);
  const inProgressTasksCount = (stats.schoolTasksInProgress || 0) + (stats.staffTasksInProgress || 0);
  const completedTasksCount = (stats.schoolTasksCompleted || 0) + (stats.staffTasksCompleted || 0);
  const completionRate = stats.averageSchoolProgressPercent || 0;
  const overdueTasksCount = stats.overdueTasksCount || 0;

  // Greeting based on role
  const greeting = React.useMemo(() => {
    if (!user) return "Chào mừng đến với Cổng điều hành QCET E-Office";
    if (user.role === "ADMIN") {
      return `Kính chào Ban Giám hiệu — ${user.name}`;
    }
    if (user.role === "MANAGER") {
      return `Kính chào Trưởng đơn vị — ${user.name} (${user.department || "Đơn vị"})`;
    }
    return `Xin chào — ${user.name} (${user.department || "Cán bộ giảng viên"})`;
  }, [user]);

  // Top 3 priority tasks
  const topPriorityTasks = React.useMemo(() => {
    const pWeight = { URGENT: 3, HIGH: 2, NORMAL: 1 };
    return [...tasks]
      .filter((t) => t.status !== "COMPLETED")
      .sort((a, b) => {
        const diffP = pWeight[getSchoolTaskPriority(b)] - pWeight[getSchoolTaskPriority(a)];
        if (diffP !== 0) return diffP;
        // Earliest due date first
        return a.dueDate.localeCompare(b.dueDate);
      })
      .slice(0, 3);
  }, [tasks]);

  // Top 3 upcoming events
  const nextUpcoming = React.useMemo(() => {
    return upcoming.slice(0, 3);
  }, [upcoming]);

  const canCreate = isExecutive || isManager;

  return (
    <div className="space-y-6" data-slot="bento-portal-hub">
      {/* Top Welcome & Context Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-card via-card/90 to-primary/5 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                <Sparkles size={12} strokeWidth={1.5} className="shrink-0" />
                Hệ thống E-Office v1.2 Enterprise
              </span>
              <span className="hidden sm:inline-flex text-xs text-muted-foreground">
                Năm học 2025 - 2026
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight truncate">
              {greeting}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Không gian điều hành tập trung: Chọn một phân khu dưới đây để bắt đầu làm việc.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canCreate && (
              <Button
                onClick={() => onOpenCreateTask("TRUONG")}
                className="gap-1.5 text-xs font-bold rounded-xl shadow-xs"
              >
                <Plus size={15} strokeWidth={1.5} />
                <span>Giao việc mới (N)</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={onManualRefresh}
              disabled={isRefreshing}
              title="Làm mới dữ liệu"
              className="rounded-xl border-border/70 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw
                size={15}
                strokeWidth={1.5}
                className={cn(isRefreshing && "animate-spin text-primary")}
              />
            </Button>
          </div>
        </div>

        {/* Quick KPI Metric Pills */}
        <div className="mt-6 pt-5 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex flex-col p-3 rounded-2xl bg-background/80 border border-border/60">
            <span className="text-xs font-medium text-muted-foreground">Tổng nhiệm vụ</span>
            <span className="text-xl font-black text-foreground font-mono mt-0.5">
              {totalTasksCount}
            </span>
          </div>
          <div className="flex flex-col p-3 rounded-2xl bg-background/80 border border-border/60">
            <span className="text-xs font-medium text-muted-foreground">Đang tiến hành</span>
            <span className="text-xl font-black text-amber-600 font-mono mt-0.5">
              {inProgressTasksCount}
            </span>
          </div>
          <div className="flex flex-col p-3 rounded-2xl bg-background/80 border border-border/60">
            <span className="text-xs font-medium text-muted-foreground">Tỷ lệ hoàn thành</span>
            <span className="text-xl font-black text-emerald-600 font-mono mt-0.5">
              {completionRate}%
            </span>
          </div>
          <div className="flex flex-col p-3 rounded-2xl bg-background/80 border border-border/60">
            <span className="text-xs font-medium text-muted-foreground">Gấp / Quá hạn</span>
            <span className="text-xl font-black text-destructive font-mono mt-0.5">
              {overdueTasksCount}
            </span>
          </div>
        </div>
      </div>

      {/* Main Bento Grid (12 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Card 1: Khu Dashboard Điều Hành (col-span-12 lg:col-span-7) */}
        <div className="md:col-span-12 lg:col-span-7 flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <LayoutDashboard size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    Phân khu 1
                  </span>
                  <h2 className="text-base font-bold text-foreground">
                    Dashboard Điều Hành & Báo Cáo KPI
                  </h2>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary">
                BGH & Trưởng Đơn vị
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Theo dõi toàn cảnh tiến độ 11 Khoa/Phòng, chỉ số hoàn thành toàn trường, ma trận tắc nghẽn và hàng đợi duyệt việc chiến lược.
            </p>

            {/* Visual Progress Bar Breakdown */}
            <div className="p-4 rounded-2xl bg-secondary/40 border border-border/50 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Tiến độ tổng thể</span>
                <span className="font-mono text-primary font-bold">{completionRate}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                  title={`Đã xong: ${completedTasksCount}`}
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      totalTasksCount > 0
                        ? (inProgressTasksCount / totalTasksCount) * 100
                        : 0
                    }%`,
                  }}
                  title={`Đang làm: ${inProgressTasksCount}`}
                />
                <div
                  className="bg-destructive h-full transition-all duration-500"
                  style={{
                    width: `${
                      totalTasksCount > 0
                        ? (overdueTasksCount / totalTasksCount) * 100
                        : 0
                    }%`,
                  }}
                  title={`Quá hạn: ${overdueTasksCount}`}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Đã xong ({completedTasksCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  Đang xử lý ({inProgressTasksCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-destructive" />
                  Quá hạn ({overdueTasksCount})
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {isExecutive ? "Toàn quyền giám sát 11 đơn vị" : "Xem chỉ số đơn vị của bạn"}
            </span>
            <Button
              variant="default"
              size="sm"
              onClick={() => onNavigateZone("dashboard")}
              className="gap-1.5 text-xs font-bold rounded-xl group-hover:translate-x-0.5 transition-transform"
            >
              <span>Vào Dashboard điều hành</span>
              <ArrowRight size={14} strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {/* Card 2: Khu Quản Lý Công Việc (col-span-12 lg:col-span-5) */}
        <div className="md:col-span-12 lg:col-span-5 flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <CheckSquare size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    Phân khu 2
                  </span>
                  <h2 className="text-base font-bold text-foreground">
                    Quản Lý Công Việc 2 Cấp
                  </h2>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-bold border-blue-500/30 text-blue-600">
                {tasks.length} nhiệm vụ
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Bảng nhiệm vụ cấp Trường & Đơn vị: Phân cấp rõ ràng, giao việc nhanh, tìm kiếm và phân trang tối ưu không giật lag.
            </p>

            {/* Mini Priority Task List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Việc ưu tiên cần xử lý:
              </span>
              {topPriorityTasks.length === 0 ? (
                <div className="p-3 rounded-xl bg-secondary/30 text-xs text-muted-foreground text-center">
                  Không có việc nào cần xử lý gấp.
                </div>
              ) : (
                topPriorityTasks.map((t) => {
                  const p = getSchoolTaskPriority(t);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/70 border border-border/40 hover:border-primary/40 transition-colors cursor-pointer text-xs group/item"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-foreground truncate group-hover/item:text-primary transition-colors">
                          {t.title}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          Hạn: {t.dueDate} • {t.leadAssigneeName || "Chưa giao"}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-xs font-mono font-bold",
                          p === "URGENT" && "border-destructive text-destructive bg-destructive/10",
                          p === "HIGH" && "border-amber-500 text-amber-600 bg-amber-500/10"
                        )}
                      >
                        {p === "URGENT" ? "Khẩn" : p === "HIGH" ? "Cao" : "Tiêu chuẩn"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
            {canCreate ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenCreateTask("TRUONG")}
                className="gap-1 text-xs text-primary hover:text-primary font-bold px-2"
              >
                <Plus size={13} strokeWidth={1.5} />
                <span>Giao việc mới</span>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Bảng việc 2 cấp</span>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => onNavigateZone("tasks")}
              className="gap-1.5 text-xs font-bold rounded-xl group-hover:translate-x-0.5 transition-transform"
            >
              <span>Vào bảng công việc</span>
              <ArrowRight size={14} strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {/* Card 3: Khu Lịch Công Tác (col-span-12 md:col-span-6 lg:col-span-4) */}
        <div className="md:col-span-6 lg:col-span-4 flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Calendar size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                    Phân khu 3
                  </span>
                  <h2 className="text-base font-bold text-foreground">
                    Lịch Công Tác & Hạn Chót
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Lưới lịch công tác tháng/tuần tối ưu hóa O(1), tự động phản ánh các mốc báo cáo trọng tâm và sự kiện BGH.
            </p>

            <div className="space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Mốc quan trọng sắp tới:
              </span>
              {nextUpcoming.length === 0 ? (
                <div className="p-3 rounded-xl bg-secondary/30 text-xs text-muted-foreground text-center">
                  Không có sự kiện sắp tới.
                </div>
              ) : (
                nextUpcoming.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-secondary/30 border border-border/30 text-xs"
                  >
                    <span className="truncate text-foreground font-medium pr-2">
                      {item.title}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-amber-600 font-bold">
                      {item.dueDate}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Theo dõi tiến độ</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateZone("calendar")}
              className="gap-1.5 text-xs font-bold rounded-xl group-hover:border-primary/50"
            >
              <span>Xem lịch biểu</span>
              <ArrowRight size={13} strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {/* Card 4: Khu Cơ Cấu Tổ Chức & Danh Bạ (col-span-12 md:col-span-6 lg:col-span-4) */}
        <div className="md:col-span-6 lg:col-span-4 flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                  <Network size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                    Phân khu 4
                  </span>
                  <h2 className="text-base font-bold text-foreground">
                    Cơ Cấu Tổ Chức & Danh Bạ
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Sơ đồ phân cấp toàn trường gồm 11 đơn vị, danh bạ 95 cán bộ viên chức chuẩn xác, hỗ trợ giao việc trực tiếp theo người.
            </p>

            <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-secondary/30 border border-border/40">
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground">Khoa & Phòng ban</span>
                <p className="text-sm font-black text-foreground font-mono">11 đơn vị</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground">Cán bộ viên chức</span>
                <p className="text-sm font-black text-foreground font-mono">95 nhân sự</p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tra cứu nhân sự</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateZone("org")}
              className="gap-1.5 text-xs font-bold rounded-xl group-hover:border-primary/50"
            >
              <span>Xem danh bạ</span>
              <ArrowRight size={13} strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {/* Card 5: Tác Vụ Nhanh & Kết Nối (col-span-12 lg:col-span-4) */}
        <div className="md:col-span-12 lg:col-span-4 flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-6 shadow-xs hover:border-primary/40 hover:shadow-md transition-all group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <TrendingUp size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                    Tiện ích
                  </span>
                  <h2 className="text-base font-bold text-foreground">
                    Lối Tắt Thao Tác Nhanh
                  </h2>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onNavigateZone("tasks")}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/80 hover:border-primary/30 transition-all text-xs font-semibold text-foreground text-left cursor-pointer"
              >
                <Kanban size={14} strokeWidth={1.5} className="text-primary shrink-0" />
                <span className="truncate">Chế độ Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateZone("tasks")}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/80 hover:border-primary/30 transition-all text-xs font-semibold text-foreground text-left cursor-pointer"
              >
                <CheckSquare size={14} strokeWidth={1.5} className="text-primary shrink-0" />
                <span className="truncate">Bảng Cascading</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateZone("calendar")}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/80 hover:border-primary/30 transition-all text-xs font-semibold text-foreground text-left cursor-pointer"
              >
                <Calendar size={14} strokeWidth={1.5} className="text-primary shrink-0" />
                <span className="truncate">Lịch biểu tuần</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateZone("org")}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/80 hover:border-primary/30 transition-all text-xs font-semibold text-foreground text-left cursor-pointer"
              >
                <FileSpreadsheet size={14} strokeWidth={1.5} className="text-primary shrink-0" />
                <span className="truncate">Xuất danh bạ</span>
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 font-medium">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Dữ liệu đồng bộ trực tiếp • 0s trễ</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Phím tắt: Nhấn Alt + 1..5 để đổi phân khu</span>
          </div>
        </div>
      </div>
    </div>
  );
}
