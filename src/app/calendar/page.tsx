"use client";

import * as React from "react";
import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  MoreHorizontal,
  Plus,
  Search,
  X,
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
import { TaskDetailSideSheet } from "@/components/dashboard/task-detail-side-sheet";
import type { CreateTaskSubmitResult } from "@/lib/adapters/create-task-mapper";
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

interface CreateEventFormData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  department: string;
  description: string;
}

interface CalendarMeeting {
  id: string;
  title: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  agenda?: string | null;
  unit?: { id: string; name: string } | null;
  organizer?: { id: string; name: string; email?: string } | null;
}

interface MeetingListResponse {
  items: CalendarMeeting[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ICT_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ICT_TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function getMeetingDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return ICT_DATE_FORMATTER.format(date);
}

function getMeetingTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return ICT_TIME_FORMATTER.format(date);
}

function toMeetingIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

function CreateEventModal({
  isOpen,
  onClose,
  onSubmit,
  initialDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEventFormData) => Promise<void> | void;
  initialDate?: string;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || getSystemReferenceDate());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [location, setLocation] = useState("");
  const [department, setDepartment] = useState("Ban Giám hiệu");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (!isOpen) setSubmitError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        title: title.trim(),
        date,
        startTime,
        endTime,
        location: location.trim(),
        department: department.trim(),
        description: description.trim(),
      });
      setTitle("");
      setLocation("");
      setDescription("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không thể lưu sự kiện");
    } finally {
      setIsSubmitting(false);
    }
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
        onClick={isSubmitting ? undefined : onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-2xl space-y-4 text-xs text-foreground animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-border/60 pb-3">
          <div className="space-y-0.5">
            <h2 id="create-event-modal-title" className="text-base font-bold text-foreground font-heading">
              Tạo Sự Kiện Lịch Biểu
            </h2>
            <p className="text-xs text-muted-foreground">
              Sự kiện được lưu vào lịch họp chính thức của hệ thống
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-9 min-w-9 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="mx-auto size-4" strokeWidth={1.5} />
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
              onChange={(event) => setTitle(event.target.value)}
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
                onChange={(event) => setDate(event.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Đơn vị chủ trì</label>
              <input
                type="text"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Giờ bắt đầu</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Giờ kết thúc</label>
              <input
                type="time"
                required
                value={endTime}
                min={startTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Địa điểm / Phòng họp</label>
            <input
              type="text"
              placeholder="Ví dụ: Phòng họp 1 - Nhà Hiệu bộ"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Ghi chú nội dung</label>
            <textarea
              rows={2}
              placeholder="Nội dung tóm tắt sự kiện hoặc thành phần tham dự..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full p-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          {submitError && (
            <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-9 text-xs rounded-lg">
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-9 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting ? "Đang lưu..." : "Lưu sự kiện"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="p-2 space-y-2">
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

function CalendarRouteContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // ExecutiveCalendarWorkspace compatibility and zone URL routing
  const zoneParam = searchParams?.get("zone") || "calendar";
  const dateParam = searchParams?.get("date") || undefined;
  const viewParam = searchParams?.get("view");
  const taskIdParam = searchParams?.get("taskId") || undefined;
  const scopeParam = searchParams?.get("scope") as CalendarScope | null;
  const monthParam = searchParams?.get("month");

  const [tasks, setTasks] = useState<SchoolTask[]>([]);
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sysDate = useMemo(() => getSystemReferenceDate(), []);
  const initialDateStr = dateParam || sysDate;
  const availableAcademicYears = useMemo(() => getAvailableAcademicYears(initialDateStr), [initialDateStr]);
  const initialAcademicYear = useMemo(() => getAcademicYear(initialDateStr), [initialDateStr]);
  const initialMonthInfo = useMemo(() => getAcademicMonthInfo(initialDateStr), [initialDateStr]);

  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(initialAcademicYear);
  const initialMonthNumber = useMemo(() => {
    if (monthParam) {
      const parsed = Number.parseInt(monthParam, 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
    }
    return initialMonthInfo.monthNumber;
  }, [monthParam, initialMonthInfo.monthNumber]);
  const [selectedMonthNumber, setSelectedMonthNumber] = useState<number>(initialMonthNumber);

  const currentPeriod = useMemo<AcademicMonthPeriod>(
    () => getAcademicMonthPeriod(selectedMonthNumber, selectedAcademicYear),
    [selectedMonthNumber, selectedAcademicYear]
  );
  const academicMonthsForYear = useMemo(
    () => getAcademicMonthsForYear(selectedAcademicYear),
    [selectedAcademicYear]
  );

  const [viewMode, setViewMode] = useState<"month" | "agenda">(() => {
    if (viewParam === "agenda" || viewParam === "agenda_list") return "agenda";
    if (viewParam === "month") return "month";
    if (typeof window !== "undefined" && window.innerWidth < 640) return "agenda";
    return "month";
  });

  useEffect(() => {
    if (!viewParam && typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
      setViewMode("agenda");
    }
  }, [viewParam]);

  const [activeScope, setActiveScope] = useState<CalendarScope>(() => {
    if (scopeParam === "unit") return "unit";
    if (scopeParam === "my") return "my";
    return "school";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<"ALL" | "TRUONG" | "DON_VI">("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(false);
  const secondaryRef = useRef<HTMLDivElement>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const hasActiveFilters = levelFilter !== "ALL" || statusFilter !== "ALL";
  const activeFilterCount = (levelFilter !== "ALL" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0);

  const [selectedDate, setSelectedDate] = useState<string | null>(initialDateStr);
  const [isDaySheetOpen, setIsDaySheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SchoolTask | StaffTask | null>(null);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const createDropdownRef = useRef<HTMLDivElement>(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [createInitialDueDate, setCreateInitialDueDate] = useState<string | undefined>(undefined);
  const [createInitialLevel, setCreateInitialLevel] = useState<TaskLevel>("TRUONG");

  useEffect(() => {
    document.title = "Lịch Công Tác Học Vụ | QCET E-Office";
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (secondaryRef.current && !secondaryRef.current.contains(event.target as Node)) {
        setIsSecondaryOpen(false);
      }
    };
    if (isSecondaryOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSecondaryOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setIsCreateDropdownOpen(false);
      }
    };
    if (isCreateDropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCreateDropdownOpen]);

  const updateUrlParam = useCallback((key: string, value: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (value?.trim()) url.searchParams.set(key, value.trim());
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const handleViewChange = useCallback((mode: "month" | "agenda") => {
    setViewMode(mode);
    updateUrlParam("view", mode);
  }, [updateUrlParam]);

  const handleScopeChange = useCallback((scope: CalendarScope) => {
    setActiveScope(scope);
    updateUrlParam("scope", scope);
  }, [updateUrlParam]);

  const handleSelectDate = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    updateUrlParam("date", dateStr);
  }, [updateUrlParam]);

  const handleOpenDaySheet = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    updateUrlParam("date", dateStr);
    setIsDaySheetOpen(true);
  }, [updateUrlParam]);

  const handlePrevMonth = useCallback(() => {
    const previous = getAdjacentAcademicMonth(currentPeriod, -1);
    setSelectedAcademicYear(previous.academicYear);
    setSelectedMonthNumber(previous.monthNumber);
    setSelectedDate(previous.startDate);
    updateUrlParam("date", previous.startDate);
    updateUrlParam("month", String(previous.monthNumber));
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

  const loadCalendarData = useCallback(async (showRefreshingSpinner = false) => {
    void showRefreshingSpinner;
    setIsLoading(true);
    setError(null);

    try {
      const meetingParams = new URLSearchParams({
        from: new Date(`${currentPeriod.startDate}T00:00:00+07:00`).toISOString(),
        to: new Date(`${currentPeriod.endDate}T23:59:59+07:00`).toISOString(),
        limit: "100",
        page: "1",
      });

      const [taskResponse, meetingResponse] = await Promise.all([
        fetch("/api/dashboard/overview"),
        fetch(`/api/meetings?${meetingParams.toString()}`),
      ]);

      if (!taskResponse.ok) throw new Error("Không thể tải danh sách nhiệm vụ từ máy chủ");
      if (!meetingResponse.ok) throw new Error("Không thể tải lịch họp / sự kiện từ máy chủ");

      const taskData: DashboardPayload = await taskResponse.json();
      const meetingData: MeetingListResponse = await meetingResponse.json();
      setTasks(Array.isArray(taskData?.tasks) ? taskData.tasks : []);
      setMeetings(Array.isArray(meetingData?.items) ? meetingData.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Đã xảy ra lỗi khi kết nối dữ liệu lịch biểu");
    } finally {
      setIsLoading(false);
    }
  }, [currentPeriod.startDate, currentPeriod.endDate]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  useEffect(() => {
    if (!taskIdParam || tasks.length === 0) return;
    const matchedSchool = tasks.find((task) => task.id === taskIdParam);
    if (matchedSchool) {
      setSelectedTask(matchedSchool);
      return;
    }
    for (const schoolTask of tasks) {
      const matchedSubTask = schoolTask.subTasks?.find((subTask) => subTask.id === taskIdParam);
      if (matchedSubTask) {
        setSelectedTask(matchedSubTask);
        return;
      }
    }
  }, [taskIdParam, tasks]);

  const handleSelectTask = useCallback((task: SchoolTask | StaffTask) => {
    setSelectedTask(task);
    updateUrlParam("taskId", task.id);
  }, [updateUrlParam]);

  const handleCloseSideSheet = useCallback(() => {
    setSelectedTask(null);
    updateUrlParam("taskId", null);
  }, [updateUrlParam]);

  const handleOpenAddTask = useCallback((dateStr?: string) => {
    setCreateInitialDueDate(dateStr || selectedDate || undefined);
    setCreateInitialLevel(activeScope === "school" ? "TRUONG" : "DON_VI");
    setIsCreateTaskModalOpen(true);
  }, [activeScope, selectedDate]);

  const handleOpenAddEvent = useCallback((dateStr?: string) => {
    setCreateInitialDueDate(dateStr || selectedDate || undefined);
    setIsCreateEventModalOpen(true);
  }, [selectedDate]);

  const handleCreateTaskSubmit = useCallback(
    (_data: CreateTaskFormData, result?: CreateTaskSubmitResult) => {
      setIsCreateTaskModalOpen(false);

      // The create-task modal owns the canonical create: it POSTs through the
      // create-task adapter and invokes this consumer only on a server-confirmed
      // success. This handler must NEVER issue a second create request and must
      // NEVER synthesize a local task from the form draft — fields such as
      // status, progress, assignee identity and category label are server-derived
      // and the raw `category` enum code is not part of the persisted contract
      // (create-task-mapper.ts), so fabricating them here would render data the
      // server never set (C1/T73, Server-Truth-Wins, Data-Dignity).
      // Reconciliation is performed by re-loading canonical server truth, the
      // same path confirmed event creation takes, so the created task carries
      // exactly what the server persisted.
      const serverTask = result?.ok ? result.task : undefined;
      if (!serverTask) return;

      void loadCalendarData();
    },
    [loadCalendarData]
  );

  const handleCreateEventSubmit = useCallback(async (eventData: CreateEventFormData) => {
    if (eventData.endTime <= eventData.startTime) {
      throw new Error("Giờ kết thúc phải sau giờ bắt đầu");
    }

    const agenda = [
      eventData.department ? `Đơn vị chủ trì: ${eventData.department}` : "",
      eventData.description,
    ].filter(Boolean).join("\n");

    const response = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: eventData.title,
        startTime: toMeetingIso(eventData.date, eventData.startTime),
        endTime: toMeetingIso(eventData.date, eventData.endTime),
        location: eventData.location || undefined,
        agenda: agenda || undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || body?.error || "Không thể lưu sự kiện vào máy chủ");
    }

    await loadCalendarData();
    setIsCreateEventModalOpen(false);
  }, [loadCalendarData]);

  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    setTasks((previousTasks) => previousTasks.map((schoolTask) => {
      if (schoolTask.id === taskId) return { ...schoolTask, status: newStatus };
      if (schoolTask.subTasks?.some((subTask) => subTask.id === taskId)) {
        const subTasks = schoolTask.subTasks.map((subTask) =>
          subTask.id === taskId ? { ...subTask, status: newStatus } : subTask
        );
        return computeSchoolTaskRollup({ ...schoolTask, subTasks });
      }
      return schoolTask;
    }));

    if (selectedTask?.id === taskId) {
      setSelectedTask((previous) => previous?.id === taskId ? { ...previous, status: newStatus } : previous);
    }

    try {
      let actionUrl = `/api/tasks/${taskId}/actions/update-progress`;
      let actionBody: Record<string, unknown> = {};
      if (newStatus === "IN_PROGRESS") actionUrl = `/api/tasks/${taskId}/actions/start`;
      else if (newStatus === "COMPLETED") {
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
    } catch (statusError) {
      console.warn("Lỗi khi kết nối đến máy chủ để cập nhật trạng thái nhiệm vụ:", statusError);
    }
  }, [selectedTask]);

  const meetingDayItems = useMemo<DayTaskItem[]>(() => meetings.map((meeting) => {
    const dateKey = getMeetingDateKey(meeting.startTime);
    const startTime = getMeetingTime(meeting.startTime);
    const endTime = getMeetingTime(meeting.endTime);
    return {
      id: `meeting:${meeting.id}`,
      title: meeting.title,
      level: meeting.unit ? "Đơn vị" : "Trường",
      categoryLabel: "Sự kiện",
      dueDate: `${dateKey}T${startTime || "00:00"}:00`,
      status: "EVENT",
      isEvent: true,
      time: [startTime, endTime].filter(Boolean).join(" - ") || undefined,
      location: meeting.location || undefined,
      host: meeting.organizer?.name || meeting.unit?.name || undefined,
      assigneeName: meeting.organizer?.name || undefined,
    };
  }), [meetings]);

  const selectedDateDayItems = useMemo<DayTaskItem[]>(() => {
    if (!selectedDate) return [];
    const items: DayTaskItem[] = [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch = (values: Array<string | undefined | null>) =>
      !normalizedQuery || values.filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery));
    const matchesStatus = (status: string, dueDate?: string) =>
      statusFilter === "ALL" ||
      (statusFilter === "OVERDUE"
        ? status !== "COMPLETED" && status !== "CANCELLED" && isTaskPastDue(dueDate)
        : status === statusFilter);

    for (const schoolTask of tasks) {
      const schoolScopeMatch =
        activeScope === "school" ||
        (activeScope === "my" &&
          ((user?.id && schoolTask.leadAssigneeId === user.id) ||
            (user?.name && schoolTask.leadAssigneeName === user.name)));
      if (
        schoolScopeMatch &&
        (levelFilter === "ALL" || levelFilter === "TRUONG") &&
        schoolTask.dueDate?.split("T")[0] === selectedDate &&
        matchesStatus(schoolTask.status, schoolTask.dueDate) &&
        matchesSearch([schoolTask.title, schoolTask.leadAssigneeName])
      ) {
        items.push({
          id: schoolTask.id,
          title: schoolTask.title,
          level: "Trường",
          category: schoolTask.category,
          categoryLabel: schoolTask.categoryLabel,
          assigneeName: schoolTask.leadAssigneeName,
          assigneeAvatar: schoolTask.leadAssigneeAvatar,
          dueDate: schoolTask.dueDate,
          status: schoolTask.status,
          progressPercent: schoolTask.progressPercent,
          originalTask: schoolTask,
        });
      }

      if (!(levelFilter === "ALL" || levelFilter === "DON_VI") || !Array.isArray(schoolTask.subTasks)) continue;
      for (const subTask of schoolTask.subTasks) {
        const subScopeMatch =
          activeScope === "unit" ||
          (activeScope === "my" &&
            ((user?.id && subTask.assigneeId === user.id) ||
              (user?.name && subTask.assigneeName === user.name)));
        if (
          subScopeMatch &&
          subTask.dueDate?.split("T")[0] === selectedDate &&
          matchesStatus(subTask.status, subTask.dueDate) &&
          matchesSearch([subTask.title, subTask.assigneeName])
        ) {
          items.push({
            id: subTask.id,
            title: subTask.title,
            level: "Đơn vị",
            category: schoolTask.category,
            categoryLabel: schoolTask.categoryLabel,
            assigneeName: subTask.assigneeName,
            assigneeAvatar: subTask.assigneeAvatar,
            dueDate: subTask.dueDate,
            status: subTask.status,
            parentSchoolTaskId: schoolTask.id,
            parentSchoolTaskTitle: schoolTask.title,
            originalTask: subTask,
          });
        }
      }
    }

    if (statusFilter === "ALL") {
      for (const meeting of meetingDayItems) {
        const meetingScopeMatch =
          activeScope === "my" ||
          (activeScope === "school" && meeting.level === "Trường") ||
          (activeScope === "unit" && meeting.level === "Đơn vị");
        const meetingLevelMatch =
          levelFilter === "ALL" ||
          (levelFilter === "TRUONG" && meeting.level === "Trường") ||
          (levelFilter === "DON_VI" && meeting.level === "Đơn vị");
        if (
          meetingScopeMatch &&
          meetingLevelMatch &&
          meeting.dueDate.split("T")[0] === selectedDate &&
          matchesSearch([meeting.title, meeting.assigneeName, meeting.host, meeting.location])
        ) {
          items.push(meeting);
        }
      }
    }

    return items;
  }, [
    selectedDate,
    tasks,
    meetingDayItems,
    activeScope,
    user,
    levelFilter,
    statusFilter,
    searchQuery,
  ]);

  const handleResetFilters = useCallback(() => {
    setLevelFilter("ALL");
    setStatusFilter("ALL");
  }, []);

  return (
    <div className="space-y-4" data-slot="calendar-page-container">
      {/* Page header: title + primary action */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground font-heading">
          Lịch công tác
        </h1>

        {/* + Tạo dropdown */}
        <div className="relative shrink-0" ref={createDropdownRef}>
          <Button
            size="sm"
            onClick={() => setIsCreateDropdownOpen((previous) => !previous)}
            aria-expanded={isCreateDropdownOpen}
            aria-haspopup="true"
            className="h-9 gap-1.5 px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs rounded-xl"
          >
            <Plus className="size-4" strokeWidth={1.5} />
            <span>Tạo</span>
          </Button>
          {isCreateDropdownOpen && (
            <div role="menu" className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border/70 bg-card p-1.5 shadow-lg z-30 animate-in fade-in zoom-in-95 duration-150">
              <button type="button" role="menuitem" onClick={() => { setIsCreateDropdownOpen(false); handleOpenAddTask(); }} className="w-full min-h-9 flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground rounded-lg hover:bg-secondary text-left">
                <CheckSquare className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                Tạo công việc
              </button>
              <button type="button" role="menuitem" onClick={() => { setIsCreateDropdownOpen(false); handleOpenAddEvent(); }} className="w-full min-h-9 flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground rounded-lg hover:bg-secondary text-left">
                <CalendarIcon className="size-4 text-sky-600 shrink-0" strokeWidth={1.5} />
                Tạo sự kiện
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Primary calendar chrome — exactly 1 row */}
      <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-2.5 py-1.5 shadow-xs" data-slot="calendar-controls-container">
        {/* Month navigation: ‹ Tháng 9 › */}
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="Tháng trước"
          className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="size-4" strokeWidth={1.5} />
        </button>

        <span className="font-mono tabular-nums text-sm font-semibold text-foreground select-none min-w-[6rem] text-center">
          {currentPeriod.label}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="Tháng sau"
          className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronRight className="size-4" strokeWidth={1.5} />
        </button>

        <div className="w-px h-5 bg-border/60 mx-0.5 shrink-0" aria-hidden="true" />

        {/* Hôm nay */}
        <button
          type="button"
          onClick={handleCurrentMonth}
          className="inline-flex min-h-[44px] sm:min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          Hôm nay
        </button>

        <div className="w-px h-5 bg-border/60 mx-0.5 shrink-0" aria-hidden="true" />

        {/* Scope selector: Toàn trường ▾ */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            type="button"
            onClick={() => setIsFilterOpen((previous) => !previous)}
            aria-expanded={isFilterOpen}
            aria-haspopup="listbox"
            className={cn(
              "inline-flex min-h-[44px] sm:min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors",
              (hasActiveFilters || activeScope !== "school")
                ? "text-primary bg-primary/5"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {activeScope === "school" ? "Toàn trường" : activeScope === "unit" ? "Đơn vị" : "Của tôi"}
            {hasActiveFilters && (
              <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-xs text-primary-foreground font-mono font-bold">{activeFilterCount}</span>
            )}
            <ChevronDown className={cn("size-3 transition-transform duration-150", isFilterOpen && "rotate-180")} strokeWidth={1.5} />
          </button>

          {isFilterOpen && (
            <div role="dialog" aria-label="Phạm vi và bộ lọc" className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-border/70 bg-card p-3 shadow-lg z-30 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              {/* Scope */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Phạm vi</span>
                <div role="tablist" aria-label="Phạm vi công việc" className="inline-flex w-full items-center rounded-lg border border-border/70 bg-secondary/50 p-0.5 gap-0.5">
                  {([["school", "Toàn trường"], ["unit", "Đơn vị"], ["my", "Của tôi"]] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={activeScope === value}
                      onClick={() => handleScopeChange(value)}
                      className={cn(
                        "flex-1 min-h-8 px-2 rounded text-xs font-semibold transition-all text-center",
                        activeScope === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/40" />

              {/* Level filter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Cấp nhiệm vụ</span>
                  {hasActiveFilters && (
                    <button type="button" onClick={handleResetFilters} className="text-xs text-primary hover:underline">Đặt lại</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {([["ALL", "Tất cả"], ["TRUONG", "Trường"], ["DON_VI", "Đơn vị"]] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLevelFilter(value)}
                      aria-pressed={levelFilter === value}
                      className={cn("min-h-8 px-2 rounded text-xs font-medium border text-center transition-colors", levelFilter === value ? "bg-primary/10 border-primary/30 text-primary font-semibold" : "border-border/60 text-muted-foreground hover:bg-secondary")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status filter */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Trạng thái</span>
                <div className="grid grid-cols-2 gap-1">
                  {([["ALL", "Tất cả"], ["IN_PROGRESS", "Đang làm"], ["COMPLETED", "Hoàn thành"], ["OVERDUE", "Quá hạn"]] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      aria-pressed={statusFilter === value}
                      className={cn("min-h-8 px-2 rounded text-xs font-medium border text-center transition-colors", statusFilter === value ? "bg-primary/10 border-primary/30 text-primary font-semibold" : "border-border/60 text-muted-foreground hover:bg-secondary")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" aria-hidden="true" />

        {/* Secondary disclosure ⋯ */}
        <div className="relative" ref={secondaryRef}>
          <button
            type="button"
            onClick={() => setIsSecondaryOpen((previous) => !previous)}
            aria-expanded={isSecondaryOpen}
            aria-haspopup="dialog"
            aria-label="Tùy chọn thêm"
            className={cn(
              "inline-flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center rounded-lg transition-colors",
              isSecondaryOpen ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.5} />
          </button>

          {isSecondaryOpen && (
            <div role="dialog" aria-label="Tùy chọn hiển thị" className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border/70 bg-card p-3 shadow-lg z-30 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              {/* View mode */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Chế độ xem</span>
                <div role="tablist" aria-label="Chế độ hiển thị lịch" className="inline-flex w-full items-center rounded-lg border border-border/70 bg-secondary/50 p-0.5 gap-0.5">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "month"}
                    onClick={() => { handleViewChange("month"); }}
                    className={cn("flex-1 inline-flex items-center justify-center gap-1.5 min-h-8 px-3 rounded text-xs font-semibold transition-all", viewMode === "month" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
                  >
                    <CalendarIcon className="size-3.5" strokeWidth={1.5} />
                    Tháng
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "agenda"}
                    onClick={() => { handleViewChange("agenda"); }}
                    className={cn("flex-1 inline-flex items-center justify-center gap-1.5 min-h-8 px-3 rounded text-xs font-semibold transition-all", viewMode === "agenda" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
                  >
                    <List className="size-3.5" strokeWidth={1.5} />
                    Danh sách
                  </button>
                </div>
              </div>

              <div className="border-t border-border/40" />

              {/* Academic year */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Năm học</span>
                <label htmlFor="academic-year-select" className="sr-only">Năm học</label>
                <select
                  id="academic-year-select"
                  value={selectedAcademicYear}
                  onChange={(event) => {
                    const academicYear = event.target.value;
                    setSelectedAcademicYear(academicYear);
                const newMonths = getAcademicMonthsForYear(academicYear);
                if (newMonths.length > 0) {
                  setSelectedMonthNumber(newMonths[0].monthNumber);
                  handleSelectDate(newMonths[0].startDate);
                  updateUrlParam("month", String(newMonths[0].monthNumber));
                }
                updateUrlParam("year", academicYear);
              }}
                  className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono tabular-nums"
                >
                  {availableAcademicYears.map((year) => (
                    <option key={year} value={year}>{year.replace("-", " - ")}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-border/40" />

              {/* Search — inline expandable, not a permanent row */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Tìm kiếm</span>
                {isSearchExpanded ? (
                  <div className="relative">
                    <Search className="size-3.5 text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                    <input
                      type="search"
                      autoFocus
                      placeholder="Tìm việc, sự kiện..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full h-9 pl-8 pr-7 rounded-lg border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-7 min-w-7 text-muted-foreground hover:text-foreground"
                        aria-label="Xóa tìm kiếm"
                      >
                        <X className="mx-auto size-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSearchExpanded(true)}
                    className={cn(
                      "w-full min-h-9 flex items-center gap-2 px-2.5 rounded-lg border text-xs transition-colors text-left",
                      searchQuery
                        ? "border-primary/30 bg-primary/5 text-primary font-semibold"
                        : "border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Search className="size-3.5 shrink-0" strokeWidth={1.5} />
                    {searchQuery || "Tìm việc, sự kiện..."}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Content: Month Grid or Agenda List */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center justify-between gap-3 text-destructive">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="size-4 shrink-0" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadCalendarData()} className="h-8 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive">
            Thử lại
          </Button>
        </div>
      )}

      {isLoading && tasks.length === 0 && meetings.length === 0 ? (
        <CalendarLoadingSkeleton />
      ) : (
        <CalendarMonthGrid
          period={currentPeriod}
          tasks={tasks}
          events={meetingDayItems}
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
        onSelectSubTask={(subTask) => {
          if (typeof subTask === "string") {
            for (const task of tasks) {
              const found = task.subTasks?.find((candidate) => candidate.id === subTask);
              if (found) {
                handleSelectTask(found);
                return;
              }
            }
          } else {
            handleSelectTask(subTask);
          }
        }}
        parentSchoolTaskTitle={
          selectedTask && !isSchoolTask(selectedTask) && "parentSchoolTaskId" in selectedTask && selectedTask.parentSchoolTaskId
            ? tasks.find((task) => task.id === (selectedTask as StaffTask).parentSchoolTaskId)?.title
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
