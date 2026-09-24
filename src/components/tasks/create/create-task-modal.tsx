"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
  Sparkles,
  Building2,
  Calendar,
  Tag,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Flag,
  User,
  Users,
  Check,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { Popover } from "@base-ui/react/popover";
import { useDepartmentList } from "@/hooks/use-department-list";
import { toCanonicalUnitCode } from "@/lib/departments";
import {
  submitCreateTask,
  type CreateTaskLevel,
} from "@/lib/adapters/create-task-mapper";

/**
 * Feature Flag: Kích hoạt Trợ lý AI khi hệ thống tích hợp backend AI/LLM.
 * Mặc định: false (không hiển thị trong production).
 */
export const ENABLE_TASK_AGENT_ASSISTANT = false;

export type CreateTaskPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: (task: unknown) => void;
  onSubmit?: (data: any, result?: any) => void | Promise<void>;
  initialDepartmentCode?: string;
  initialTitle?: string;
  initialLevel?: CreateTaskLevel;
  initialParentTaskId?: string;
  initialParentTaskTitle?: string;
  initialLeadAssigneeName?: string;
  initialDueDate?: string;
}

const DRAFT_STORAGE_KEY = "qcet_task_create_draft_v1";

interface TaskDraftStorage {
  selectedDeptCode: string;
  level: CreateTaskLevel;
  title: string;
  summary: string;
  description: string;
  priority: CreateTaskPriority;
  status: "TODO" | "IN_PROGRESS";
  leadAssigneeName: string;
  coAssignees: string[];
  startDate: string;
  dueDate: string;
  category: string;
  timestamp: number;
}

const PRIORITY_CONFIG: Record<
  CreateTaskPriority,
  { label: string; color: string; bg: string; border: string; iconColor: string }
> = {
  URGENT: {
    label: "Khẩn cấp",
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    iconColor: "text-rose-500",
  },
  HIGH: {
    label: "Cao",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconColor: "text-amber-500",
  },
  MEDIUM: {
    label: "Bình thường",
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    iconColor: "text-muted-foreground",
  },
  LOW: {
    label: "Thấp",
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    iconColor: "text-muted-foreground",
  },
};

const PRIORITY_KEYS: CreateTaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const CATEGORY_OPTIONS = [
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số" },
  { id: "TRUYEN_THONG", label: "Truyền thông & Tuyển sinh" },
  { id: "CNTT", label: "Hạ tầng & CNTT" },
  { id: "ATTT", label: "An toàn thông tin" },
  { id: "THU_VIEN", label: "Thư viện & Học liệu" },
  { id: "BAO_CAO", label: "Báo cáo & Tổng hợp" },
  { id: "KHAC", label: "Khác" },
];

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  onSubmit,
  initialDepartmentCode,
  initialTitle = "",
  initialLevel = "DON_VI",
  initialParentTaskId,
  initialParentTaskTitle,
  initialLeadAssigneeName = "",
  initialDueDate = "",
}: CreateTaskModalProps) {
  const { user } = useAuth();
  const { departments } = useDepartmentList({ includePersonnel: true });
  const defaultDepartmentCode =
    initialDepartmentCode ||
    toCanonicalUnitCode(user?.departmentCode || user?.department || "") ||
    departments[0]?.code ||
    "";
  const [isMounted, setIsMounted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showConfirmClose, setShowConfirmClose] = React.useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = React.useState(false);

  // Form states
  const [selectedDeptCode, setSelectedDeptCode] = React.useState(defaultDepartmentCode);
  const [level, setLevel] = React.useState<CreateTaskLevel>(initialLevel);
  const [title, setTitle] = React.useState(initialTitle);
  const [summary, setSummary] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<CreateTaskPriority>("MEDIUM");
  const [status, setStatus] = React.useState<"TODO" | "IN_PROGRESS">("IN_PROGRESS");
  const [leadAssigneeName, setLeadAssigneeName] = React.useState(initialLeadAssigneeName);
  const [coAssignees, setCoAssignees] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState(initialDueDate);
  const [category, setCategory] = React.useState("CHUYEN_DOI_SO");

  React.useEffect(() => {
    if (isOpen) {
      if (initialTitle) setTitle(initialTitle);
      if (initialLeadAssigneeName) setLeadAssigneeName(initialLeadAssigneeName);
      if (initialDueDate) setDueDate(initialDueDate);
      if (initialLevel) setLevel(initialLevel);
      setSelectedDeptCode(defaultDepartmentCode);
    }
  }, [isOpen, initialTitle, initialLeadAssigneeName, initialDueDate, initialLevel, defaultDepartmentCode]);

  // Database users for foreign key safety
  const [dbUsers, setDbUsers] = React.useState<
    Array<{ id: string; name: string; departmentId?: string | null; role?: string; email?: string; title?: string | null }>
  >([]);

  // Validation field errors for P0 fields
  const [fieldErrors, setFieldErrors] = React.useState<{
    title?: string;
    lead?: string;
    dueDate?: string;
  }>({});

  // Active open popovers
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

  // Trigger Refs for Popover
  const deptTriggerRef = React.useRef<HTMLDivElement>(null);
  const statusTriggerRef = React.useRef<HTMLDivElement>(null);
  const priorityTriggerRef = React.useRef<HTMLDivElement>(null);
  const driTriggerRef = React.useRef<HTMLDivElement>(null);
  const coTriggerRef = React.useRef<HTMLDivElement>(null);
  const catTriggerRef = React.useRef<HTMLDivElement>(null);

  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const summaryInputRef = React.useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const isSubmittingLockRef = React.useRef(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch real users on mount to ensure real User IDs are used
  React.useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          setDbUsers(data.users);
        }
      })
      .catch(() => {
        // Silently fallback to static department personnel
      });
  }, []);

  // Department & personnel lookup
  const currentDept = React.useMemo(() => {
    return (
      departments.find((d) => d.code === selectedDeptCode) ||
      departments[0]
    );
  }, [selectedDeptCode, departments]);

  const availablePersonnel = React.useMemo(() => {
    return currentDept?.personnel || [];
  }, [currentDept]);

  // Try restoring draft from sessionStorage on open
  React.useEffect(() => {
    if (!isOpen) return;

    // If initialTitle provided explicitly from caller, do not auto-restore draft
    if (initialTitle) return;

    try {
      const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const draft: TaskDraftStorage = JSON.parse(stored);
        if (draft && draft.title) {
          setTitle(draft.title || "");
          setSummary(draft.summary || "");
          setDescription(draft.description || "");
          setPriority(draft.priority || "MEDIUM");
          setStatus(draft.status || "IN_PROGRESS");
          setLeadAssigneeName(draft.leadAssigneeName || "");
          setCoAssignees(draft.coAssignees || []);
          setStartDate(draft.startDate || "");
          setDueDate(draft.dueDate || "");
          setCategory(draft.category || "CHUYEN_DOI_SO");
          if (draft.selectedDeptCode) setSelectedDeptCode(draft.selectedDeptCode);
          if (draft.level) setLevel(draft.level);
          setHasRestoredDraft(true);
          return;
        }
      }
    } catch {
      // Ignore storage read errors
    }

    // Default DRI assignment if empty
    if (!leadAssigneeName && availablePersonnel.length > 0) {
      setLeadAssigneeName(availablePersonnel[0].name);
    }
  }, [isOpen, initialTitle, availablePersonnel, leadAssigneeName]);

  // Set default DRI if empty or if previous DRI is not in current department
  React.useEffect(() => {
    if (availablePersonnel.length > 0) {
      if (!leadAssigneeName || !availablePersonnel.some((p) => p.name === leadAssigneeName)) {
        setLeadAssigneeName(availablePersonnel[0].name);
      }
    } else {
      setLeadAssigneeName("");
    }
  }, [availablePersonnel, leadAssigneeName]);

  // Dirty state check
  const isDirty = React.useMemo(() => {
    if (title.trim() !== initialTitle.trim()) return true;
    if (summary.trim() !== "") return true;
    if (description.trim() !== "") return true;
    if (dueDate !== "") return true;
    if (startDate !== "") return true;
    if (coAssignees.length > 0) return true;
    if (priority !== "MEDIUM") return true;
    if (category !== "CHUYEN_DOI_SO") return true;
    return false;
  }, [
    title,
    initialTitle,
    summary,
    description,
    dueDate,
    startDate,
    coAssignees,
    priority,
    category,
  ]);

  // Auto-save draft to sessionStorage
  React.useEffect(() => {
    if (!isOpen || !isDirty) return;

    const timeout = setTimeout(() => {
      try {
        const draft: TaskDraftStorage = {
          selectedDeptCode,
          level,
          title,
          summary,
          description,
          priority,
          status,
          leadAssigneeName,
          coAssignees,
          startDate,
          dueDate,
          category,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // Ignore quota/storage errors
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    isOpen,
    isDirty,
    selectedDeptCode,
    level,
    title,
    summary,
    description,
    priority,
    status,
    leadAssigneeName,
    coAssignees,
    startDate,
    dueDate,
    category,
  ]);

  // Clear draft
  const handleClearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setTitle(initialTitle);
    setSummary("");
    setDescription("");
    setDueDate("");
    setStartDate("");
    setCoAssignees([]);
    setPriority("MEDIUM");
    setCategory("CHUYEN_DOI_SO");
    setHasRestoredDraft(false);
    setFieldErrors({});
  };

  // Autofocus title input when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Request close with dirty-check & safe draft preservation
  const handleRequestClose = React.useCallback(() => {
    if (isSubmitting) return;

    if (isDirty) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  }, [isSubmitting, isDirty, onClose]);

  // Submit Handler with P0 Field Validation & Double-submit lock
  const handleSubmit = React.useCallback(async () => {
    if (isSubmittingLockRef.current || isSubmitting) return;

    // Validate P0 Fields: Title, DRI, Due Date
    const errors: { title?: string; lead?: string; dueDate?: string } = {};
    if (!title.trim()) {
      errors.title = "Vui lòng nhập tên nhiệm vụ.";
    }
    if (!leadAssigneeName) {
      errors.lead = "Vui lòng chỉ định Người chủ trì (DRI).";
    }
    if (!dueDate) {
      errors.dueDate = "Vui lòng chọn Hạn hoàn thành.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage("Vui lòng hoàn thiện các thông tin bắt buộc (P0) trước khi tạo.");
      if (errors.title) titleInputRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    isSubmittingLockRef.current = true;
    setErrorMessage(null);

    try {
      const fullDescription = [
        summary.trim() ? `[Tóm tắt] ${summary.trim()}` : "",
        description.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      // Map personnel to real DB users if available
      const personnelRefs =
        dbUsers.length > 0
          ? dbUsers.map((u) => ({
              id: u.id,
              name: u.name,
              departmentId: u.departmentId,
            }))
          : availablePersonnel.map((p, idx) => ({
              id: `person-${idx}-${p.name.replace(/\s+/g, "").toLowerCase()}`,
              name: p.name,
            }));

      // Find real user IDs for DRI and collaborators if matched
      const matchedDri = dbUsers.find(
        (u) => u.name.trim().toLowerCase() === leadAssigneeName.trim().toLowerCase()
      );
      const matchedCoIds = coAssignees
        .map(
          (name) =>
            dbUsers.find(
              (u) => u.name.trim().toLowerCase() === name.trim().toLowerCase()
            )?.id
        )
        .filter((id): id is string => Boolean(id));

      const res = await submitCreateTask(
        {
          level,
          title: title.trim(),
          startDate: startDate || undefined,
          dueDate,
          description: fullDescription,
          leadAssigneeName: leadAssigneeName || undefined,
          coAssignees: coAssignees.length > 0 ? coAssignees : undefined,
          parentTaskId: initialParentTaskId,
          priority,
          category,
        },
        {
          personnel: personnelRefs,
          departmentId: currentDept?.id || currentDept?.code,
          assigneeId: matchedDri?.id,
          collaboratorIds: matchedCoIds.length > 0 ? matchedCoIds : undefined,
        }
      );

      if (res.ok) {
        // Clean draft upon successful creation
        try {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // Ignore
        }
        if (onSubmit) {
          try {
            await onSubmit(
              {
                level,
                title: title.trim(),
                summary,
                startDate,
                dueDate,
                description: fullDescription,
                leadAssigneeName,
                coAssignees,
                parentTaskId: initialParentTaskId,
                priority,
                category,
              },
              res
            );
          } catch {
            // Ignore callback error if network already committed
          }
        }
        onSubmitSuccess?.(res.task);
        onClose();
      } else {
        setErrorMessage(
          res.error || "Không thể tạo nhiệm vụ. Vui lòng kiểm tra lại dữ liệu."
        );
      }
    } catch {
      setErrorMessage("Đã xảy ra lỗi khi tạo nhiệm vụ. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
      isSubmittingLockRef.current = false;
    }
  }, [
    isSubmitting,
    title,
    leadAssigneeName,
    dueDate,
    summary,
    description,
    dbUsers,
    availablePersonnel,
    level,
    coAssignees,
    initialParentTaskId,
    priority,
    category,
    currentDept,
    onSubmitSuccess,
    onClose,
  ]);

  // Global modal keyboard handling: Esc to close & Cmd/Ctrl+Enter to submit
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // 1. Cmd/Ctrl + Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
        return;
      }

      // 2. Escape handling with layered focus guard
      if (e.key === "Escape") {
        if (showConfirmClose) {
          e.preventDefault();
          e.stopPropagation();
          setShowConfirmClose(false);
          return;
        }
        if (openDropdown) {
          e.preventDefault();
          e.stopPropagation();
          setOpenDropdown(null);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        handleRequestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openDropdown, showConfirmClose, handleRequestClose, handleSubmit]);

  if (!isOpen) return null;
  if (!isMounted && typeof window !== "undefined") return null;

  const modalElement = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-2 sm:p-4 md:p-6"
      data-slot="create-task-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-modal-title"
      onMouseDown={(e) => {
        // Dismiss on clicking backdrop directly (never when clicking inside modal or portal)
        if (e.target === e.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      {/* Outer Card: Compact task composer */}
      <div
        ref={modalRef}
        className={cn(
          "relative flex flex-col bg-card rounded-xl shadow-2xl border border-border/80 overflow-hidden",
          "w-full max-w-[680px] h-[540px] max-h-[85vh]",
          "animate-in fade-in zoom-in-95"
        )}
      >
        {/* Modal Top Header */}
        <header className="flex items-center justify-between px-5 sm:px-6 py-2.5 border-b border-border/60 bg-card shrink-0">
          {/* Breadcrumb & Unit Selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />

            {/* Department dropdown selector */}
            <Popover.Root open={openDropdown === "dept"} onOpenChange={(open) => setOpenDropdown(open ? "dept" : null)}>
            <div ref={deptTriggerRef} className="relative inline-block text-left">
              <Popover.Trigger
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1.5 py-0.5 cursor-pointer",
                  openDropdown === "dept"
                    ? "text-foreground bg-accent shadow-2xs"
                    : "text-foreground hover:text-foreground/80 hover:bg-accent/50"
                )}
              >
                <span>{currentDept?.name ?? "Đang tải..."}</span>
                <ChevronDown
                  className={cn(
                    "size-3 text-muted-foreground transition-transform duration-200 ease-out",
                    openDropdown === "dept" && "rotate-180 text-foreground"
                  )}
                />
              </Popover.Trigger>

              {/* Department Floating Portal Dropdown */}

              <Popover.Portal>
              <Popover.Positioner className="z-50" align="start" sideOffset={4} collisionPadding={12}>
              <Popover.Popup style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }} className="w-64 p-1 space-y-0.5 rounded-xl border border-border bg-popover shadow-2xl" aria-label="Chọn đơn vị phòng ban">
                {departments.map((dept) => (
                  <button
                    key={dept.code}
                    type="button"
                    onClick={() => {
                      setSelectedDeptCode(dept.code);
                      setLeadAssigneeName("");
                      setCoAssignees([]);
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all duration-150 active:scale-[0.99] cursor-pointer",
                      selectedDeptCode === dept.code
                        ? "font-semibold text-foreground bg-accent"
                        : "text-foreground hover:bg-accent/70"
                    )}
                  >
                    <span className="truncate">{dept.name}</span>
                    {selectedDeptCode === dept.code && (
                      <Check className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                    )}
                  </button>
                ))}
              </Popover.Popup>
              </Popover.Positioner>
              </Popover.Portal>

            </div>
            </Popover.Root>

            {initialParentTaskTitle && (
              <>
                <ChevronRight className="size-3 text-muted-foreground/40 shrink-0" />
                <span className="text-muted-foreground font-normal truncate max-w-[140px] sm:max-w-[200px]" title={initialParentTaskTitle}>
                  {initialParentTaskTitle}
                </span>
              </>
            )}
            <ChevronRight className="size-3 text-muted-foreground/40 shrink-0" />
            <span
              className="text-muted-foreground font-medium truncate"
              id="create-task-modal-title"
            >
              {initialParentTaskId ? "Giao việc con" : "Tạo nhiệm vụ"}
            </span>
          </div>

          {/* Header Action: Close Button */}
          <button
            type="button"
            onClick={handleRequestClose}
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            aria-label="Đóng biểu mẫu tạo nhiệm vụ"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </header>

        {/* Restored Draft Banner if applicable */}
        {hasRestoredDraft && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-1.5 bg-muted/40 border-b border-border/60 text-[11px] text-muted-foreground shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
              <span>Đã tự động khôi phục bản nháp chưa lưu từ phiên làm việc trước.</span>
            </div>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-[11px] text-muted-foreground hover:text-rose-600 transition-colors underline underline-offset-2 cursor-pointer"
            >
              Xóa bản nháp
            </button>
          </div>
        )}

        {/* Modal Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 flex flex-col space-y-2.5 min-h-0">
          {/* Error banner if any */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 shrink-0">
              <AlertCircle className="size-4 shrink-0 text-rose-500" />
              <span className="flex-1 font-medium">{errorMessage}</span>
            </div>
          )}

          {/* 1. Task Title (P0 Field) */}
          <div className="space-y-0.5 shrink-0">
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) {
                  setFieldErrors((prev) => ({ ...prev, title: undefined }));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  summaryInputRef.current?.focus();
                }
              }}
              placeholder={initialParentTaskId ? "Tên việc con... *" : "Tên nhiệm vụ... *"}
              className={cn(
                "w-full text-lg sm:text-xl font-semibold text-foreground placeholder:text-muted-foreground bg-transparent border-0 p-0 focus:outline-none focus:ring-0 leading-snug",
                fieldErrors.title && "placeholder:text-rose-400 text-rose-900"
              )}
            />
            {fieldErrors.title && (
              <p className="text-[11px] text-rose-600 font-medium">
                {fieldErrors.title}
              </p>
            )}
          </div>

          {/* 2. Short Summary */}
          <div className="shrink-0">
            <input
              ref={summaryInputRef}
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  descriptionTextareaRef.current?.focus();
                }
              }}
              placeholder="Thêm mô tả ngắn hoặc kết quả kỳ vọng..."
              className="w-full text-xs text-muted-foreground placeholder:text-muted-foreground/70 bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
            />
          </div>

          {/* 3. Compact Properties Chips Bar (Wrap max 2 rows) */}
          <div className="flex flex-wrap items-center gap-1.5 py-2 my-0.5 border-y border-border/60 shrink-0">
            {/* 3.1 Priority Chip */}
            <Popover.Root open={openDropdown === "priority"} onOpenChange={(open) => setOpenDropdown(open ? "priority" : null)}>
            <div ref={priorityTriggerRef} className="relative">
              <Popover.Trigger
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md text-[11px] font-medium border transition-all duration-150 cursor-pointer select-none",
                  openDropdown === "priority"
                    ? "border-border bg-accent text-foreground shadow-2xs"
                    : "border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground"
                )}
              >
                <Flag
                  className={cn("size-3", PRIORITY_CONFIG[priority].iconColor)}
                  strokeWidth={1.5}
                />
                <span>{PRIORITY_CONFIG[priority].label}</span>
                <ChevronDown
                  className={cn(
                    "size-2.5 text-muted-foreground transition-transform duration-200 ease-out",
                    openDropdown === "priority" && "rotate-180 text-foreground"
                  )}
                />
              </Popover.Trigger>


              <Popover.Portal>
              <Popover.Positioner className="z-50" align="start" sideOffset={4} collisionPadding={12}>
              <Popover.Popup style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }} className="w-40 p-1 space-y-0.5 rounded-xl border border-border bg-popover shadow-2xl" aria-label="Chọn mức độ ưu tiên">
                {PRIORITY_KEYS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPriority(p);
                      setOpenDropdown(null);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all duration-150 active:scale-[0.99]",
                      priority === p
                        ? "font-semibold text-foreground bg-accent"
                        : "text-foreground hover:bg-accent/70"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Flag
                        className={cn("size-3", PRIORITY_CONFIG[p].iconColor)}
                        strokeWidth={1.5}
                      />
                      <span>{PRIORITY_CONFIG[p].label}</span>
                    </div>
                    {priority === p && <Check className="size-3 text-foreground shrink-0" strokeWidth={1.5} />}
                  </button>
                ))}
              </Popover.Popup>
              </Popover.Positioner>
              </Popover.Portal>

            </div>
            </Popover.Root>

            {/* 3.3 Lead Assignee (DRI) Chip (P0 Field) */}
            <Popover.Root open={openDropdown === "dri"} onOpenChange={(open) => setOpenDropdown(open ? "dri" : null)}>
            <div ref={driTriggerRef} className="relative">
              <Popover.Trigger
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md text-[11px] font-medium border transition-all duration-150 cursor-pointer select-none",
                  fieldErrors.lead
                    ? "bg-rose-50 text-rose-700 border-rose-300"
                    : openDropdown === "dri"
                    ? "border-border bg-accent text-foreground shadow-2xs"
                    : "border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground"
                )}
              >
                <User className="size-3 text-muted-foreground" strokeWidth={1.5} />
                <span>
                  {leadAssigneeName ? `Chủ trì: ${leadAssigneeName}` : "Chủ trì *"}
                </span>
                <ChevronDown
                  className={cn(
                    "size-2.5 text-muted-foreground transition-transform duration-200 ease-out",
                    openDropdown === "dri" && "rotate-180 text-foreground"
                  )}
                />
              </Popover.Trigger>


              <Popover.Portal>
              <Popover.Positioner className="z-50" align="start" sideOffset={4} collisionPadding={12}>
              <Popover.Popup style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }} className="w-60 p-1 space-y-0.5 max-h-56 rounded-xl border border-border bg-popover shadow-2xl overflow-y-auto" aria-label="Chọn người chủ trì">
                {availablePersonnel.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                    Chưa có nhân sự trong đơn vị này
                  </div>
                ) : (
                  availablePersonnel.map((person) => (
                    <button
                      key={person.name}
                      type="button"
                      onClick={() => {
                        setLeadAssigneeName(person.name);
                        if (fieldErrors.lead) {
                          setFieldErrors((prev) => ({ ...prev, lead: undefined }));
                        }
                        setOpenDropdown(null);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all duration-150 active:scale-[0.99]",
                        leadAssigneeName === person.name
                          ? "font-semibold text-foreground bg-accent"
                          : "text-foreground hover:bg-accent/70"
                      )}
                    >
                      <div>
                        <div className="font-medium">{person.name}</div>
                        <div className="text-[10px] text-muted-foreground">{person.role}</div>
                      </div>
                      {leadAssigneeName === person.name && (
                        <Check className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                      )}
                    </button>
                  ))
                )}
              </Popover.Popup>
              </Popover.Positioner>
              </Popover.Portal>

            </div>
            </Popover.Root>

            {/* 3.3 Start Date Chip */}
            <VietnameseDatePicker
              value={startDate}
              onChange={(val) => setStartDate(val)}
              label="Bắt đầu:"
              variant="chip"
              icon={<Calendar className="size-3 text-muted-foreground" strokeWidth={1.5} />}
              placeholder="dd/mm/yyyy"
            />

            {/* 3.4 Target Due Date Chip (P0 Field) */}
            <VietnameseDatePicker
              value={dueDate}
              required
              onChange={(val) => {
                setDueDate(val);
                if (fieldErrors.dueDate) {
                  setFieldErrors((prev) => ({ ...prev, dueDate: undefined }));
                }
              }}
              label="Hạn: *"
              variant="chip"
              error={Boolean(fieldErrors.dueDate)}
              icon={
                <CalendarClock
                  className={cn(
                    "size-3",
                    fieldErrors.dueDate ? "text-rose-500" : "text-muted-foreground"
                  )}
                  strokeWidth={1.5}
                />
              }
              placeholder="dd/mm/yyyy"
            />
          </div>

          {/* 4. Detailed Description / Canvas */}
          <div className="pt-0.5 flex-1 flex flex-col min-h-[120px]">
            <textarea
              ref={descriptionTextareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả nội dung chỉ đạo, căn cứ pháp lý, yêu cầu kỹ thuật hoặc tiêu chí nghiệm thu..."
              rows={4}
              className="w-full flex-1 min-h-[100px] resize-none bg-transparent border-0 p-0 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 leading-relaxed"
            />
          </div>
        </div>

        {/* Modal Bottom Footer - Sticky at bottom */}
        <footer className="flex items-center justify-between px-5 sm:px-6 py-2.5 border-t border-border/60 bg-muted/20 shrink-0">
          {/* Shortcut Hint */}
          <div className="text-[11px] text-muted-foreground select-none hidden sm:inline-flex items-center gap-1">
            <kbd className="font-mono bg-background border border-border px-1 py-0.2 rounded text-[10px] text-foreground shadow-2xs">
              ⌘ / Ctrl
            </kbd>
            <span>+</span>
            <kbd className="font-mono bg-background border border-border px-1 py-0.2 rounded text-[10px] text-foreground shadow-2xs">
              Enter
            </kbd>
            <span>{initialParentTaskId ? "để giao việc" : "để tạo"}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={isSubmitting}
              className="h-7.5 px-3 text-xs font-medium text-foreground hover:bg-accent rounded-md transition-colors cursor-pointer"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting || !title.trim()}
              className="h-7.5 px-3.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <span className="size-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" />
                  <span>{initialParentTaskId ? "Đang giao việc..." : "Đang tạo..."}</span>
                </>
              ) : (
                <span>{initialParentTaskId ? "Giao việc con" : "Tạo nhiệm vụ"}</span>
              )}
            </button>
          </div>
        </footer>
      </div>

      {/* Confirmation Dialog on Unsaved Changes */}
      {showConfirmClose && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="bg-card rounded-xl shadow-2xl border border-border max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircle className="size-4" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h4
                  id="confirm-dialog-title"
                  className="text-sm font-semibold text-foreground"
                >
                  Bản nháp có thay đổi chưa lưu
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Biểu mẫu tạo nhiệm vụ đang có dữ liệu chưa lưu. Bạn muốn lưu tạm bản nháp trong phiên làm việc hay hủy bỏ hoàn toàn?
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmClose(false)}
                className="w-full sm:w-auto text-xs h-8"
              >
                Tiếp tục soạn thảo
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  handleClearDraft();
                  setShowConfirmClose(false);
                  onClose();
                }}
                className="w-full sm:w-auto text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                Hủy và xóa nháp
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") {
    return modalElement;
  }

  return createPortal(modalElement, document.body);
}

export default CreateTaskModal;
