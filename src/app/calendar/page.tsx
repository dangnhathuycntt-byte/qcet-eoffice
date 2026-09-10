"use client";

import * as React from "react";
import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  Plus,
  AlertCircle,
  Home,
  CheckSquare,
  List,
  Search,
  Building2,
  User,
  Clock,
  MapPin,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SchoolTask, StaffTask, DashboardPayload, TaskStatus, isSchoolTask } from "@/types/dashboard";
import {
  CalendarMonthGrid,
  type CalendarScope,
} from "@/components/calendar/calendar-month-grid";
import {
  CalendarDaySheet,
  type DayTaskItem,
} from "@/components/calendar/calendar-day-sheet";
import {
  CreateTaskModal,
  type CreateTaskFormData,
  type TaskLevel,
} from "@/components/dashboard/create-task-modal";
import {
  TaskDetailSideSheet,
} from "@/components/dashboard/task-detail-side-sheet";
import { useAuth } from "@/lib/auth-context";
import {
  getSystemReferenceDate,
  getAcademicYear,
  getAvailableAcademicYears,
  getAcademicMonthsForYear,
  getAcademicMonthPeriod,
  getAcademicMonthInfo,
  getAdjacentAcademicMonth,
  isTaskPastDue,
  type AcademicMonthPeriod,
} from "@/lib/academic-calendar";
import { computeSchoolTaskRollup } from "@/lib/dashboard-aggregator";
import { cn } from "@/lib/utils";

// ExecutiveCalendarWorkspace compatibility and canonical workspace integration
export type { CalendarScope };

// =========================================================================
// Lightweight Create Event Modal (for "Tạo sự kiện" in global dropdown)
// =========================================================================
interface CreateEventFormData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  department: string;
  description: string;
}

function CreateEventModal({
  isOpen,
  onClose,
  onSubmit,
  initialDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEventFormData) => void;
  initialDate?: string;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || getSystemReferenceDate());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [location, setLocation] = useState("");
  const [department, setDepartment] = useState("Ban Giám hiệu");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate);
    }
  }, [initialDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      date,
      startTime,
      endTime,
      location: location.trim(),
      department: department.trim(),
      description: description.trim(),
    });
    // Reset
    setTitle("");
    setLocation("");
    setDescription("");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-event-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-2xl space-y-4 text-xs text-foreground animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-border/60 pb-3">
          <div className="space-y-0.5">
            <h2 id="create-event-modal-title" className="text-base font-bold text-foreground font-heading">
              Tạo Sự Kiện Lịch Biểu
            </h2>
            <p className="text-xs text-muted-foreground">
              Thêm sự kiện, hội nghị hoặc lịch họp lãnh đạo vào lịch công tác
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Tiêu đề sự kiện <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Họp giao ban Ban Giám hiệu đầu tuần"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Ngày diễn ra <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Đơn vị chủ trì
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Giờ bắt đầu
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Giờ kết thúc
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Địa điểm / Phòng họp
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Phòng họp 1 - Nhà Hiệu bộ"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Ghi chú nội dung
            </label>
            <textarea
              rows={2}
              placeholder="Nội dung tóm tắt sự kiện hoặc thành phần tham dự..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8.5 text-xs rounded-lg cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              Lưu sự kiện
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// Loading Skeleton
// =========================================================================
function CalendarLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Đang tải lịch công tác">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div className="space-y-2">
          <div className="h-4 w-48 bg-muted/60 rounded-md" />
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-muted/70" />
            <div className="space-y-1">
              <div className="h-6 w-64 bg-muted/70 rounded-md" />
              <div className="h-3.5 w-96 bg-muted/50 rounded-md" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-muted/60 rounded-lg" />
          <div className="h-9 w-36 bg-muted/70 rounded-lg" />
        </div>
      </div>

      <div className="h-14 rounded-2xl bg-muted/40 border border-border/60" />

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="h-10 bg-muted/40 border-b border-border/60" />
        <div className="grid grid-cols-7 divide-x divide-border/50 h-[480px]">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-2 space-y-2">
              <div className="h-4 w-12 bg-muted/50 rounded mx-auto" />
              <div className="h-16 w-full bg-muted/30 rounded-lg" />
              <div className="h-14 w-full bg-muted/20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Main Calendar Content
// =========================================================================
function CalendarRouteContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // URL Query Parameters support: ?date=YYYY-MM-DD, ?view=..., ?taskId=..., ?scope=..., ?month=..., ?zone=...
  const dateParam = searchParams?.get("date") || undefined;
  const viewParam = searchParams?.get("view");
  const taskIdParam = searchParams?.get("taskId") || undefined;
  const scopeParam = searchParams?.get("scope") as CalendarScope | null;
  const monthParam = searchParams?.get("month");
  const zoneParam = searchParams?.get("zone");

  const [tasks, setTasks] = useState<SchoolTask[]>([]);
  const [customEvents, setCustomEvents] = useState<Array<{
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    department: string;
    description: string;
  }>>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference Date & Academic Period Configuration
  const sysDate = useMemo(() => getSystemReferenceDate(), []);
  const initialDateStr = dateParam || sysDate;

  // Derive dynamic academic year & months
  const availableAcademicYears = useMemo(() => getAvailableAcademicYears(initialDateStr), [initialDateStr]);
  const initialAcademicYear = useMemo(() => getAcademicYear(initialDateStr), [initialDateStr]);
  const initialMonthInfo = useMemo(() => getAcademicMonthInfo(initialDateStr), [initialDateStr]);

  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(initialAcademicYear);

  // Reconcile ?month= parameter (1..12) or fallback to initialMonthInfo
  const initialMonthNumber = useMemo(() => {
    if (monthParam) {
      const parsed = parseInt(monthParam, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
        return parsed;
      }
    }
    return initialMonthInfo.monthNumber;
  }, [monthParam, initialMonthInfo.monthNumber]);

  const [selectedMonthNumber, setSelectedMonthNumber] = useState<number>(initialMonthNumber);

  // Active academic month period (25th to 24th)
  const currentPeriod = useMemo<AcademicMonthPeriod>(() => {
    return getAcademicMonthPeriod(selectedMonthNumber, selectedAcademicYear);
  }, [selectedMonthNumber, selectedAcademicYear]);

  // All 12 months for current academic year
  const academicMonthsForYear = useMemo(() => {
    return getAcademicMonthsForYear(selectedAcademicYear);
  }, [selectedAcademicYear]);

  // Calendar View Switcher: "month" (Tháng) or "agenda" (Nghị sự)
  // 22-calendar.md Invariant 5: on compact mobile viewports (<640px), default to Agenda view
  const [viewMode, setViewMode] = useState<"month" | "agenda">(() => {
    if (viewParam === "agenda" || viewParam === "agenda_list") return "agenda";
    if (viewParam === "month") return "month";
    if (typeof window !== "undefined" && window.innerWidth < 640) return "agenda";
    return "month";
  });

  // Responsive mobile ergonomics: on initial mount on compact viewports (<640px)
  // default to Agenda view if no explicit viewParam was supplied
  useEffect(() => {
    if (!viewParam && typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
      setViewMode("agenda");
    }
  }, [viewParam]);

  // Scope Tabs: "school" (Toàn trường) | "unit" (Đơn vị) | "my" (Của tôi)
  const [activeScope, setActiveScope] = useState<CalendarScope>(() => {
    if (scopeParam === "unit") return "unit";
    if (scopeParam === "my") return "my";
    return "school";
  });

  // Compact Quick Search Query
  const [searchQuery, setSearchQuery] = useState("");

  // Filters State: Level & Status
  const [levelFilter, setLevelFilter] = useState<"ALL" | "TRUONG" | "DON_VI">("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = levelFilter !== "ALL" || statusFilter !== "ALL";
  const activeFilterCount = (levelFilter !== "ALL" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0);

  const handleResetFilters = useCallback(() => {
    setLevelFilter("ALL");
    setStatusFilter("ALL");
  }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  // Selected Day & Day Detail Side Sheet
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDateStr);
  const [isDaySheetOpen, setIsDaySheetOpen] = useState<boolean>(false);

  // Selected Task State for TaskDetailSideSheet
  const [selectedTask, setSelectedTask] = useState<SchoolTask | StaffTask | null>(null);

  // Global Primary Action (+ Tạo) Dropdown state
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const createDropdownRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [createInitialDueDate, setCreateInitialDueDate] = useState<string | undefined>(undefined);
  const [createInitialLevel, setCreateInitialLevel] = useState<TaskLevel>("TRUONG");

  useEffect(() => {
    document.title = "Lịch Công Tác Học Vụ | QCET E-Office";
  }, []);

  // Close "+ Tạo" dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setIsCreateDropdownOpen(false);
      }
    };
    if (isCreateDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCreateDropdownOpen]);

  // URL synchronization helper
  const updateUrlParam = useCallback((key: string, value: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (value && value.trim()) {
      url.searchParams.set(key, value.trim());
    } else {
      url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url.toString());
  }, []);

  // Handle View Mode Change
  const handleViewChange = useCallback((mode: "month" | "agenda") => {
    setViewMode(mode);
    updateUrlParam("view", mode);
  }, [updateUrlParam]);

  // Handle Scope Change
  const handleScopeChange = useCallback((scope: CalendarScope) => {
    setActiveScope(scope);
    updateUrlParam("scope", scope);
  }, [updateUrlParam]);

  // Handle Day Selection
  const handleSelectDate = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    updateUrlParam("date", dateStr);
  }, [updateUrlParam]);

  // Handle Open Day Detail Side Sheet
  const handleOpenDaySheet = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    updateUrlParam("date", dateStr);
    setIsDaySheetOpen(true);
  }, [updateUrlParam]);

  // Handle Month Navigation
  const handlePrevMonth = useCallback(() => {
    const prev = getAdjacentAcademicMonth(currentPeriod, -1);
    setSelectedAcademicYear(prev.academicYear);
    setSelectedMonthNumber(prev.monthNumber);
    setSelectedDate(prev.startDate);
    updateUrlParam("date", prev.startDate);
    updateUrlParam("month", String(prev.monthNumber));
  }, [currentPeriod, updateUrlParam]);

  const handleNextMonth = useCallback(() => {
    const next = getAdjacentAcademicMonth(currentPeriod, 1);
    setSelectedAcademicYear(next.academicYear);
    setSelectedMonthNumber(next.monthNumber);
    setSelectedDate(next.startDate);
    updateUrlParam("date", next.startDate);
    updateUrlParam("month", String(next.monthNumber));
  }, [currentPeriod, updateUrlParam]);

  const handleCurrentMonth = useCallback(() => {
    const info = getAcademicMonthInfo(sysDate);
    setSelectedAcademicYear(info.academicYear);
    setSelectedMonthNumber(info.monthNumber);
    setSelectedDate(sysDate);
    updateUrlParam("date", sysDate);
    updateUrlParam("month", String(info.monthNumber));
  }, [sysDate, updateUrlParam]);

  // Load tasks data
  const loadTasksData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await fetch("/api/dashboard/overview");
      if (!res.ok) {
        throw new Error("Không thể tải danh sách nhiệm vụ từ máy chủ");
      }
      const data: DashboardPayload = await res.json();
      if (Array.isArray(data?.tasks)) {
        setTasks(data.tasks);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi kết nối dữ liệu lịch biểu";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasksData();
  }, [loadTasksData]);

  // Synchronize task selection from URL ?taskId=...
  useEffect(() => {
    if (!taskIdParam || tasks.length === 0) return;

    const matchedSchool = tasks.find((t) => t.id === taskIdParam);
    if (matchedSchool) {
      setSelectedTask(matchedSchool);
      return;
    }

    for (const st of tasks) {
      if (st.subTasks) {
        const matchedSub = st.subTasks.find((sub) => sub.id === taskIdParam);
        if (matchedSub) {
          setSelectedTask(matchedSub);
          return;
        }
      }
    }
  }, [taskIdParam, tasks]);

  // Handle select task
  const handleSelectTask = useCallback((task: SchoolTask | StaffTask) => {
    setSelectedTask(task);
    updateUrlParam("taskId", task.id);
  }, [updateUrlParam]);

  const handleCloseSideSheet = useCallback(() => {
    setSelectedTask(null);
    updateUrlParam("taskId", null);
  }, [updateUrlParam]);

  // Handle opening task create modal
  const handleOpenAddTask = useCallback((dateStr?: string) => {
    setCreateInitialDueDate(dateStr || selectedDate || undefined);
    setCreateInitialLevel(activeScope === "school" ? "TRUONG" : "DON_VI");
    setIsCreateTaskModalOpen(true);
  }, [activeScope, selectedDate]);

  // Handle opening event create modal
  const handleOpenAddEvent = useCallback((dateStr?: string) => {
    setCreateInitialDueDate(dateStr || selectedDate || undefined);
    setIsCreateEventModalOpen(true);
  }, [selectedDate]);

  // Handle create task submission
  const handleCreateTaskSubmit = useCallback(async (data: CreateTaskFormData) => {
    setIsCreateTaskModalOpen(false);

    const tempId = `task-created-${Date.now()}`;
    const cleanDueDate = data.dueDate ? `${data.dueDate}T17:00:00.000Z` : undefined;

    setTasks((prevTasks) => {
      const updated = [...prevTasks];

      if (data.level === "TRUONG") {
        const newSchoolTask: SchoolTask = {
          id: tempId,
          title: data.title,
          code: `NV-${new Date().getFullYear()}-${String(prevTasks.length + 1).padStart(2, "0")}`,
          taskCode: `NV-${new Date().getFullYear()}-${String(prevTasks.length + 1).padStart(2, "0")}`,
          category: data.category || "CNTT",
          categoryLabel: data.category || "Công nghệ thông tin",
          status: "IN_PROGRESS",
          dueDate: cleanDueDate || `${new Date().toISOString().split("T")[0]}T17:00:00.000Z`,
          progressPercent: 0,
          totalSubTasks: 0,
          completedSubTasks: 0,
          leadAssigneeName: user?.name || "Lãnh đạo phụ trách",
          assignedDate: new Date().toISOString().split("T")[0],
          coAssignees: [],
          subTasks: [],
        };
        updated.unshift(newSchoolTask);
      } else {
        const newSubTask: StaffTask = {
          id: tempId,
          taskId: data.parentTaskId || (updated[0]?.id ?? "task-root"),
          title: data.title,
          status: "IN_PROGRESS",
          dueDate: cleanDueDate || `${new Date().toISOString().split("T")[0]}T17:00:00.000Z`,
          assigneeName: user?.name || "Chuyên viên phụ trách",
          assignedToDepartmentId: user?.departmentCode || user?.department || "",
          assignedToDepartmentName: user?.department || "Đơn vị phụ trách",
          department: user?.department || "Đơn vị phụ trách",
          parentSchoolTaskId: data.parentTaskId || updated[0]?.id,
          updatedAt: new Date().toISOString(),
        };

        if (data.parentTaskId) {
          return updated.map((st) => {
            if (st.id === data.parentTaskId) {
              return {
                ...st,
                subTasks: [newSubTask, ...st.subTasks],
              };
            }
            return st;
          });
        } else if (updated.length > 0) {
          updated[0] = {
            ...updated[0],
            subTasks: [newSubTask, ...updated[0].subTasks],
          };
        }
      }

      return updated.map((t) => computeSchoolTaskRollup(t));
    });

    try {
      const payload = {
        title: data.title,
        description: data.description || data.requiredDeliverables || "",
        dueDate: data.dueDate,
        departmentId: user?.departmentCode || user?.department || "",
        scope: data.level === "TRUONG" ? "SCHOOL" : "DEPARTMENT",
        parentTaskId: data.parentTaskId || undefined,
        creatorId: user?.id,
      };

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn("Không thể lưu nhiệm vụ vào máy chủ:", await res.text().catch(() => ""));
      }
    } catch (err) {
      console.warn("Lỗi khi kết nối đến máy chủ để lưu nhiệm vụ:", err);
    }
  }, [user]);

  // Handle create event submission
  const handleCreateEventSubmit = useCallback((eventData: CreateEventFormData) => {
    setIsCreateEventModalOpen(false);
    const newEvent = {
      id: `evt-${Date.now()}`,
      ...eventData,
    };
    setCustomEvents((prev) => [newEvent, ...prev]);
  }, []);

  // Handle task status update
  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((st) => {
        if (st.id === taskId) {
          return { ...st, status: newStatus };
        }
        if (st.subTasks) {
          const hasSub = st.subTasks.some((sub) => sub.id === taskId);
          if (hasSub) {
            const updatedSubs = st.subTasks.map((sub) =>
              sub.id === taskId ? { ...sub, status: newStatus } : sub
            );
            return computeSchoolTaskRollup({ ...st, subTasks: updatedSubs });
          }
        }
        return st;
      });
      return updated;
    });

    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask((prev) => {
        if (!prev || prev.id !== taskId) return prev;
        return { ...prev, status: newStatus };
      });
    }

    try {
      let actionUrl = `/api/tasks/${taskId}/actions/update-progress`;
      let actionBody: any = {};
      if (newStatus === "IN_PROGRESS") {
        actionUrl = `/api/tasks/${taskId}/actions/start`;
      } else if (newStatus === "COMPLETED") {
        actionUrl = `/api/tasks/${taskId}/actions/approve`;
        actionBody = { note: "Phê duyệt hoàn thành nhiệm vụ" };
      } else if (newStatus === "NEEDS_REVIEW" || newStatus === "WAITING_APPROVAL") {
        actionUrl = `/api/tasks/${taskId}/actions/submit-result`;
        actionBody = { note: "Nộp kết quả chờ phê duyệt", completionRate: 100 };
      } else if (newStatus === "CANCELLED") {
        actionUrl = `/api/tasks/${taskId}/actions/cancel`;
        actionBody = { reason: "Hủy nhiệm vụ" };
      }

      await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionBody),
      });
    } catch (err) {
      console.warn("Lỗi khi kết nối đến máy chủ để cập nhật trạng thái nhiệm vụ:", err);
    }
  }, [selectedTask]);

  // Tasks and Events for Selected Date (consumed by CalendarDaySheet)
  const selectedDateDayItems = useMemo<DayTaskItem[]>(() => {
    if (!selectedDate) return [];

    const items: DayTaskItem[] = [];
    const currentUnitId =
      (typeof searchParams !== "undefined" &&
        (searchParams.get("unitId") || searchParams.get("unit"))) ||
      user?.departmentCode ||
      user?.department ||
      "";

    // 1. School Tasks
    const matchesSchoolLevel = levelFilter === "ALL" || levelFilter === "TRUONG";

    for (const st of tasks) {
      const isOverdueTask =
        st.status !== "COMPLETED" && st.status !== "CANCELLED" && isTaskPastDue(st.dueDate);
      const matchesSchoolStatus =
        statusFilter === "ALL" ||
        (statusFilter === "OVERDUE"
          ? isOverdueTask
          : st.status === statusFilter);

      const matchesSchoolUnit =
        !currentUnitId ||
        st.leadDepartmentId === currentUnitId ||
        st.leadDepartmentCode === currentUnitId ||
        st.leadDepartment === currentUnitId ||
        st.departmentId === currentUnitId ||
        st.department === currentUnitId ||
        (st.subTasks &&
          st.subTasks.some(
            (sub) =>
              sub.departmentId === currentUnitId ||
              sub.department === currentUnitId ||
              sub.assignedToDepartmentId === currentUnitId
          ));

      const isScopeMatch =
        activeScope === "school" ||
        (activeScope === "unit" && matchesSchoolUnit) ||
        (activeScope === "my" &&
          ((user?.id && st.leadAssigneeId === user.id) ||
            (user?.name && st.leadAssigneeName === user.name)));

      if (
        matchesSchoolLevel &&
        matchesSchoolStatus &&
        isScopeMatch &&
        st.dueDate &&
        st.dueDate.split("T")[0] === selectedDate
      ) {
        items.push({
          id: st.id,
          title: st.title,
          level: "Trường",
          category: st.category,
          categoryLabel: st.categoryLabel,
          assigneeName: st.leadAssigneeName,
          assigneeAvatar: st.leadAssigneeAvatar,
          dueDate: st.dueDate,
          status: st.status,
          progressPercent: st.progressPercent,
          originalTask: st,
        });
      }

      // 2. Unit Subtasks
      const matchesSubLevel = levelFilter === "ALL" || levelFilter === "DON_VI";

      if (matchesSubLevel && st.subTasks && Array.isArray(st.subTasks)) {
        for (const sub of st.subTasks) {
          const isOverdueSub =
            sub.status !== "COMPLETED" && sub.status !== "CANCELLED" && isTaskPastDue(sub.dueDate);
          const matchesSubStatus =
            statusFilter === "ALL" ||
            (statusFilter === "OVERDUE"
              ? isOverdueSub
              : sub.status === statusFilter);

          const matchesSubUnit =
            !currentUnitId ||
            sub.departmentId === currentUnitId ||
            sub.department === currentUnitId ||
            sub.assignedToDepartmentId === currentUnitId ||
            st.leadDepartmentId === currentUnitId ||
            st.leadDepartmentCode === currentUnitId;

          const isSubScopeMatch =
            activeScope === "school" ||
            (activeScope === "unit" && matchesSubUnit) ||
            (activeScope === "my" &&
              ((user?.id && (sub.assigneeId === user.id || (sub as any).userId === user.id)) ||
                (user?.name && (sub.assigneeName === user.name || (sub as any).userName === user.name))));

          if (
            matchesSubStatus &&
            isSubScopeMatch &&
            sub.dueDate &&
            sub.dueDate.split("T")[0] === selectedDate
          ) {
            items.push({
              id: sub.id,
              title: sub.title,
              level: "Đơn vị",
              category: st.category,
              categoryLabel: st.categoryLabel,
              assigneeName: sub.assigneeName,
              assigneeAvatar: sub.assigneeAvatar,
              dueDate: sub.dueDate,
              status: sub.status,
              parentSchoolTaskId: st.id,
              parentSchoolTaskTitle: st.title,
              originalTask: sub,
            });
          }
        }
      }
    }

    // 3. Custom Events
    for (const evt of customEvents) {
      if (evt.date === selectedDate) {
        items.push({
          id: evt.id,
          title: evt.title,
          level: "Trường",
          categoryLabel: "Sự kiện",
          dueDate: `${evt.date}T${evt.startTime}:00`,
          status: "IN_PROGRESS",
          isEvent: true,
          time: `${evt.startTime} - ${evt.endTime}`,
          location: evt.location,
          host: evt.department,
        });
      }
    }

    return items;
  }, [selectedDate, tasks, customEvents, activeScope, user, levelFilter, statusFilter]);

  return (
    <div className="space-y-5" data-slot="calendar-page-container">
      {/* ========================================================================= */}
      {/* 1. Page Header with Single Global Primary Action (+ Tạo Dropdown)         */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div className="space-y-1">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" strokeWidth={1.5} />
              <span>Bàn làm việc</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" strokeWidth={1.5} />
            <Link
              href={selectedTask ? `/tasks?taskId=${selectedTask.id}` : "/tasks"}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <CheckSquare className="size-3.5" strokeWidth={1.5} />
              <span>Nhiệm vụ</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" strokeWidth={1.5} />
            <span className="font-semibold text-foreground">Lịch công tác</span>
          </nav>

          {/* Heading & Period Tag */}
          <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
            <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <CalendarIcon className="size-5" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
                  Lịch Công Tác Học Vụ
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 font-mono tabular-nums">
                  {currentPeriod.label} / {currentPeriod.calendarYear} ({currentPeriod.shortDateSpan})
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kế hoạch thời gian đào tạo, sự kiện và hạn chót theo chu kỳ học vụ QCET (ngày 25 - 24)
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions: Refresh (Single Global Primary Action + Tạo is in Control Row 2) */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTasksData(true)}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs font-medium border-border/70 text-muted-foreground hover:text-foreground cursor-pointer rounded-xl"
            title="Làm mới dữ liệu lịch"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} strokeWidth={1.5} />
            <span className="hidden sm:inline">{isRefreshing ? "Đang tải..." : "Làm mới"}</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Unified Calendar Chrome: 2 Unified Rows                                */}
      {/* Row 1: Scope, Period & Month Navigation, View Switcher                    */}
      {/* Row 2: Search, Filters, Single Global + Tạo CTA                           */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:p-4 shadow-card" data-slot="calendar-controls-container">
        {/* Row 1: Scope, Navigation, View switch */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" data-slot="calendar-controls-row-1">
          {/* Scope Tabs: Toàn trường | Đơn vị | Của tôi */}
          <div
            role="tablist"
            aria-label="Phạm vi công việc"
            className="inline-flex items-center rounded-xl border border-border/70 bg-secondary/50 p-0.5 shrink-0 self-start lg:self-auto"
            data-slot="calendar-scope-switcher"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === "school"}
              onClick={() => handleScopeChange("school")}
              className={cn(
                "min-h-[36px] sm:min-h-0 px-3 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeScope === "school"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Toàn trường
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === "unit"}
              onClick={() => handleScopeChange("unit")}
              className={cn(
                "min-h-[36px] sm:min-h-0 px-3 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeScope === "unit"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Đơn vị
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === "my"}
              onClick={() => handleScopeChange("my")}
              className={cn(
                "min-h-[36px] sm:min-h-0 px-3 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeScope === "my"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Của tôi
            </button>
          </div>

          {/* Period & Month Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap" data-slot="calendar-period-navigation">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Tháng trước"
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:size-8.5 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>

            {/* Academic Month Selector */}
            <div className="flex items-center gap-1">
              <label htmlFor="academic-month-select" className="sr-only">
                Kỳ vận hành
              </label>
              <select
                id="academic-month-select"
                value={selectedMonthNumber}
                onChange={(e) => {
                  const mNum = Number(e.target.value);
                  setSelectedMonthNumber(mNum);
                  const p = getAcademicMonthPeriod(mNum, selectedAcademicYear);
                  handleSelectDate(p.startDate);
                  updateUrlParam("month", String(mNum));
                }}
                className="h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer font-mono tabular-nums"
              >
                {academicMonthsForYear.map((m) => (
                  <option key={m.monthNumber} value={m.monthNumber}>
                    {m.label} ({m.shortDateSpan})
                  </option>
                ))}
              </select>
            </div>

            {/* Academic Year Selector */}
            <div className="flex items-center gap-1">
              <label htmlFor="academic-year-select" className="sr-only">
                Năm học
              </label>
              <select
                id="academic-year-select"
                value={selectedAcademicYear}
                onChange={(e) => {
                  setSelectedAcademicYear(e.target.value);
                  const newMonths = getAcademicMonthsForYear(e.target.value);
                  if (newMonths.length > 0) {
                    setSelectedMonthNumber(newMonths[0].monthNumber);
                    handleSelectDate(newMonths[0].startDate);
                    updateUrlParam("month", String(newMonths[0].monthNumber));
                  }
                }}
                className="h-9 px-2 rounded-lg border border-border/70 bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                {availableAcademicYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr.replace("-", " - ")}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Tháng sau"
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:size-8.5 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={handleCurrentMonth}
              className="inline-flex min-h-[44px] sm:min-h-0 h-9 items-center rounded-lg border border-border/70 bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary cursor-pointer"
            >
              Hôm nay
            </button>
          </div>

          {/* View Switcher: Tháng | Nghị sự */}
          <div
            role="tablist"
            aria-label="Chế độ hiển thị lịch"
            className="inline-flex items-center rounded-xl border border-border/70 bg-secondary/50 p-0.5 shrink-0 self-start lg:self-auto"
            data-slot="calendar-view-switcher"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "month"}
              onClick={() => handleViewChange("month")}
              className={cn(
                "inline-flex items-center gap-1.5 min-h-[36px] sm:min-h-0 px-3 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                viewMode === "month"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarIcon className="size-3.5" strokeWidth={1.5} />
              <span>Tháng</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "agenda"}
              onClick={() => handleViewChange("agenda")}
              className={cn(
                "inline-flex items-center gap-1.5 min-h-[36px] sm:min-h-0 px-3 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                viewMode === "agenda"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-3.5" strokeWidth={1.5} />
              <span>Nghị sự</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search, Filters, Single Global + Tạo CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2 border-t border-border/40" data-slot="calendar-controls-row-2">
          {/* Left: Search input & Filters */}
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            {/* Quick Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search
                strokeWidth={1.5}
                className="size-3.5 text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                placeholder="Tìm việc, sự kiện..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-7 rounded-xl border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Filter button ("Bộ lọc") */}
            <div className="relative" ref={filterDropdownRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                aria-expanded={isFilterOpen}
                aria-haspopup="dialog"
                className={cn(
                  "h-9 px-3 text-xs font-medium gap-1.5 border-border/70 rounded-xl cursor-pointer transition-colors",
                  hasActiveFilters
                    ? "border-primary/50 text-primary bg-primary/5 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <SlidersHorizontal className="size-3.5" strokeWidth={1.5} />
                <span>Bộ lọc</span>
                {hasActiveFilters && (
                  <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-xs text-primary-foreground font-mono font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              {/* Filter Dropdown Popover */}
              {isFilterOpen && (
                <div
                  role="dialog"
                  aria-label="Tùy chọn bộ lọc"
                  className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-border/70 bg-card p-3 shadow-lg z-30 space-y-3 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="text-xs font-bold text-foreground">Bộ lọc nâng cao</span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-xs text-primary hover:underline cursor-pointer"
                      >
                        Đặt lại
                      </button>
                    )}
                  </div>

                  {/* Level filter */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Cấp nhiệm vụ</label>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setLevelFilter("ALL")}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border text-center transition-colors cursor-pointer",
                          levelFilter === "ALL"
                            ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setLevelFilter("TRUONG")}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border text-center transition-colors cursor-pointer",
                          levelFilter === "TRUONG"
                            ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Trường
                      </button>
                      <button
                        type="button"
                        onClick={() => setLevelFilter("DON_VI")}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border text-center transition-colors cursor-pointer",
                          levelFilter === "DON_VI"
                            ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Đơn vị
                      </button>
                    </div>
                  </div>

                  {/* Status filter */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Trạng thái</label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setStatusFilter("ALL")}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border text-center transition-colors cursor-pointer",
                          statusFilter === "ALL"
                            ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("IN_PROGRESS")}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border text-center transition-colors cursor-pointer",
                          statusFilter === "IN_PROGRESS"
                            ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Đang làm
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("COMPLETED")}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border text-center transition-colors cursor-pointer",
                          statusFilter === "COMPLETED"
                            ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Hoàn thành
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("OVERDUE")}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border text-center transition-colors cursor-pointer",
                          statusFilter === "OVERDUE"
                            ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                            : "border-border/60 text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Quá hạn
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Single Global Primary Action (+ Tạo Dropdown) */}
          <div className="relative shrink-0 self-end sm:self-auto" ref={createDropdownRef}>
            <Button
              size="sm"
              onClick={() => setIsCreateDropdownOpen((prev) => !prev)}
              aria-expanded={isCreateDropdownOpen}
              aria-haspopup="true"
              className="h-9 gap-1.5 px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs cursor-pointer rounded-xl"
            >
              <Plus className="size-4" strokeWidth={1.5} />
              <span>Tạo</span>
              <ChevronDown
                className={cn("size-3.5 transition-transform duration-200", isCreateDropdownOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            </Button>

            {/* Dropdown Menu */}
            {isCreateDropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border/70 bg-card p-1.5 shadow-lg z-30 animate-in fade-in zoom-in-95 duration-150"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsCreateDropdownOpen(false);
                    handleOpenAddTask();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground rounded-lg hover:bg-secondary cursor-pointer transition-colors text-left"
                >
                  <CheckSquare className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                  <span>Tạo công việc</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsCreateDropdownOpen(false);
                    handleOpenAddEvent();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground rounded-lg hover:bg-secondary cursor-pointer transition-colors text-left"
                >
                  <CalendarIcon className="size-4 text-sky-600 shrink-0" strokeWidth={1.5} />
                  <span>Tạo sự kiện</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center justify-between gap-3 text-destructive">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="size-4 shrink-0" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadTasksData()}
            className="h-7 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive cursor-pointer"
          >
            Thử lại
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Main Calendar Month Grid (with cell density capping max 3 items)        */}
      {/* ========================================================================= */}
      {isLoading && tasks.length === 0 ? (
        <CalendarLoadingSkeleton />
      ) : (
        <CalendarMonthGrid
          period={currentPeriod}
          tasks={tasks}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          onOpenDaySheet={handleOpenDaySheet}
          onSelectTask={handleSelectTask}
          scope={activeScope}
          currentUserId={user?.id}
          currentUserName={user?.name}
          viewMode={viewMode}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          levelFilter={levelFilter}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. Day Detail Side Sheet (Polite empty state & Contextual action)          */}
      {/* ========================================================================= */}
      <CalendarDaySheet
        isOpen={isDaySheetOpen}
        onClose={() => setIsDaySheetOpen(false)}
        selectedDate={selectedDate}
        tasks={selectedDateDayItems}
        onSelectTask={handleSelectTask}
        onAddTaskOnDate={(dateStr) => {
          setIsDaySheetOpen(false);
          handleOpenAddTask(dateStr);
        }}
      />

      {/* ========================================================================= */}
      {/* 5. Modals & Task Detail Side Sheet                                        */}
      {/* ========================================================================= */}
      <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        onSubmit={handleCreateTaskSubmit}
        schoolTasks={tasks}
        initialLevel={createInitialLevel}
        initialDueDate={createInitialDueDate}
      />

      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => setIsCreateEventModalOpen(false)}
        onSubmit={handleCreateEventSubmit}
        initialDate={createInitialDueDate}
      />

      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={handleCloseSideSheet}
        onStatusChange={handleStatusChange}
        currentUser={user || undefined}
        onSelectSubTask={(sub) => {
          if (typeof sub === "string") {
            for (const t of tasks) {
              const found = t.subTasks?.find((st) => st.id === sub);
              if (found) {
                handleSelectTask(found);
                return;
              }
            }
          } else {
            handleSelectTask(sub);
          }
        }}
        parentSchoolTaskTitle={
          selectedTask && !isSchoolTask(selectedTask) && "parentSchoolTaskId" in selectedTask && selectedTask.parentSchoolTaskId
            ? tasks.find((t) => t.id === (selectedTask as StaffTask).parentSchoolTaskId)?.title
            : undefined
        }
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarLoadingSkeleton />}>
      <CalendarRouteContent />
    </Suspense>
  );
}
