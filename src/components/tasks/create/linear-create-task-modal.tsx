"use client";

// Linear Create Task Modal - Full featured creation modal with AI agent assistance
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
  Plus,
  Trash2,
  Check,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import {
  LinearTaskAgentPanel,
  type TaskAgentSuggestion,
  type TaskMilestoneItem,
} from "./linear-task-agent-panel";
import {
  QCET_DEPARTMENT_GROUPS,
  type DepartmentPersonnelGroup,
} from "@/lib/departments";
import {
  submitCreateTask,
  type CreateTaskLevel,
} from "@/lib/adapters/create-task-mapper";

export type LinearPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export interface LinearCreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: (task: unknown) => void;
  initialDepartmentCode?: string;
  initialTitle?: string;
  initialLevel?: CreateTaskLevel;
  initialParentTaskId?: string;
}

const DRAFT_STORAGE_KEY = "qcet_task_create_draft_v1";

interface TaskDraftStorage {
  selectedDeptCode: string;
  level: CreateTaskLevel;
  title: string;
  summary: string;
  description: string;
  priority: LinearPriority;
  status: "TODO" | "IN_PROGRESS";
  leadAssigneeName: string;
  coAssignees: string[];
  startDate: string;
  dueDate: string;
  category: string;
  milestones: TaskMilestoneItem[];
  timestamp: number;
}

const PRIORITY_CONFIG: Record<
  LinearPriority,
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

const PRIORITY_KEYS: LinearPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const CATEGORY_OPTIONS = [
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số" },
  { id: "TRUYEN_THONG", label: "Truyền thông & Tuyển sinh" },
  { id: "CNTT", label: "Hạ tầng & CNTT" },
  { id: "ATTT", label: "An toàn thông tin" },
  { id: "THU_VIEN", label: "Thư viện & Học liệu" },
  { id: "BAO_CAO", label: "Báo cáo & Tổng hợp" },
  { id: "KHAC", label: "Khác" },
];

export function LinearCreateTaskModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  initialDepartmentCode = "P_QLDT",
  initialTitle = "",
  initialLevel = "DON_VI",
  initialParentTaskId,
}: LinearCreateTaskModalProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  const [isAgentOpen, setIsAgentOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showConfirmClose, setShowConfirmClose] = React.useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = React.useState(false);

  // Form states
  const [selectedDeptCode, setSelectedDeptCode] = React.useState(initialDepartmentCode);
  const [level, setLevel] = React.useState<CreateTaskLevel>(initialLevel);
  const [title, setTitle] = React.useState(initialTitle);
  const [summary, setSummary] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<LinearPriority>("MEDIUM");
  const [status, setStatus] = React.useState<"TODO" | "IN_PROGRESS">("IN_PROGRESS");
  const [leadAssigneeName, setLeadAssigneeName] = React.useState("");
  const [coAssignees, setCoAssignees] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [category, setCategory] = React.useState("CHUYEN_DOI_SO");
  const [milestones, setMilestones] = React.useState<TaskMilestoneItem[]>([]);
  const [newMilestoneText, setNewMilestoneText] = React.useState("");
  const [isAddingMilestone, setIsAddingMilestone] = React.useState(false);

  // Validation field errors for P0 fields
  const [fieldErrors, setFieldErrors] = React.useState<{
    title?: string;
    lead?: string;
    dueDate?: string;
  }>({});

  // Active open popovers
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const summaryInputRef = React.useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const milestoneInputRef = React.useRef<HTMLInputElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const isSubmittingLockRef = React.useRef(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Department & personnel lookup
  const currentDept = React.useMemo(() => {
    return (
      QCET_DEPARTMENT_GROUPS.find((d) => d.code === selectedDeptCode) ||
      QCET_DEPARTMENT_GROUPS[0]
    );
  }, [selectedDeptCode]);

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
          setMilestones(draft.milestones || []);
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

  // Set default DRI if empty and personnel changes
  React.useEffect(() => {
    if (!leadAssigneeName && availablePersonnel.length > 0) {
      setLeadAssigneeName(availablePersonnel[0].name);
    }
  }, [availablePersonnel, leadAssigneeName]);

  // Dirty state check
  const isDirty = React.useMemo(() => {
    if (title.trim() !== initialTitle.trim()) return true;
    if (summary.trim() !== "") return true;
    if (description.trim() !== "") return true;
    if (dueDate !== "") return true;
    if (startDate !== "") return true;
    if (milestones.length > 0) return true;
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
    milestones,
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
          milestones,
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
    milestones,
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
    setMilestones([]);
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

  // Request close with dirty-check
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

    // Validate P0 Fields: Title, Unit, DRI, Due Date
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
        milestones.length > 0
          ? `\n[Các mốc thực hiện]\n` +
            milestones
              .map(
                (m, i) =>
                  `${i + 1}. ${m.title}${m.dueDate ? ` (Hạn: ${m.dueDate})` : ""}`
              )
              .join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const personnelRefs = availablePersonnel.map((p, idx) => ({
        id: `person-${idx}-${p.name.replace(/\s+/g, "").toLowerCase()}`,
        name: p.name,
      }));

      const res = await submitCreateTask(
        {
          level,
          title: title.trim(),
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
          departmentId: currentDept.code || currentDept.id,
        }
      );

      if (res.ok) {
        // Clean draft upon successful creation
        try {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // Ignore
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
    milestones,
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
        if (isAddingMilestone) {
          e.preventDefault();
          e.stopPropagation();
          setIsAddingMilestone(false);
          setNewMilestoneText("");
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        handleRequestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openDropdown, showConfirmClose, isAddingMilestone, handleRequestClose, handleSubmit]);

  // Handle outside click to close dropdowns
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdown]);

  // Apply suggestion from AI Agent with overwrite protection
  const handleApplyAiSuggestion = (
    s: TaskAgentSuggestion,
    options?: { onlyEmptyFields?: boolean }
  ) => {
    const onlyEmpty = options?.onlyEmptyFields ?? false;

    if (s.title && (!onlyEmpty || !title.trim())) setTitle(s.title);
    if (s.summary && (!onlyEmpty || !summary.trim())) setSummary(s.summary);
    if (s.priority && (!onlyEmpty || priority === "MEDIUM")) setPriority(s.priority);
    if (s.description && (!onlyEmpty || !description.trim())) setDescription(s.description);
    if (s.targetDate && (!onlyEmpty || !dueDate)) setDueDate(s.targetDate);
    if (s.startDate && (!onlyEmpty || !startDate)) setStartDate(s.startDate);
    if (s.category && (!onlyEmpty || category === "CHUYEN_DOI_SO")) setCategory(s.category);

    if (s.suggestedLeadName && (!onlyEmpty || !leadAssigneeName)) {
      setLeadAssigneeName(s.suggestedLeadName);
    }

    if (
      s.suggestedCoAssignees &&
      s.suggestedCoAssignees.length > 0 &&
      (!onlyEmpty || coAssignees.length === 0)
    ) {
      setCoAssignees(s.suggestedCoAssignees);
    }

    if (s.milestones && s.milestones.length > 0) {
      if (onlyEmpty && milestones.length > 0) {
        setMilestones((prev) => [...prev, ...s.milestones]);
      } else {
        setMilestones(s.milestones);
      }
    }

    // Clear related field errors if resolved
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (s.title) delete next.title;
      if (s.targetDate) delete next.dueDate;
      if (s.suggestedLeadName) delete next.lead;
      return next;
    });
  };

  // Milestone management
  const handleAddMilestone = () => {
    const trimmed = newMilestoneText.trim();
    if (!trimmed) return;
    const newM: TaskMilestoneItem = {
      id: `ms-${Date.now()}-${milestones.length + 1}`,
      title: trimmed,
      dueDate: dueDate || undefined,
      completed: false,
    };
    setMilestones((prev) => [...prev, newM]);
    setNewMilestoneText("");
    setTimeout(() => {
      milestoneInputRef.current?.focus();
    }, 20);
  };

  const handleRemoveMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  const handleToggleMilestone = (id: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
    );
  };

  if (!isOpen) return null;
  if (!isMounted && typeof window !== "undefined") return null;

  const modalElement = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-2 sm:p-4 md:p-6"
      data-slot="linear-create-task-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-modal-title"
    >
      {/* Outer Card: Rigid Left Editor + Seamless Right Agent Drawer */}
      <div
        ref={modalRef}
        className={cn(
          "relative flex flex-col bg-card rounded-xl shadow-2xl border border-border/80 overflow-hidden transition-all duration-200 max-h-[85vh] h-auto",
          isAgentOpen ? "w-full max-w-[1020px]" : "w-full max-w-[680px]",
          "animate-in fade-in zoom-in-95"
        )}
      >
        {/* Modal Top Header - Minimal Linear Breadcrumb */}
        <header className="flex items-center justify-between px-5 sm:px-6 py-2.5 border-b border-border/60 bg-card shrink-0">
          {/* Breadcrumb & Unit Selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />

            {/* Department dropdown selector */}
            <div className="relative inline-block text-left">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown(openDropdown === "dept" ? null : "dept")
                }
                className="inline-flex items-center gap-1 font-medium text-foreground hover:text-foreground/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 py-0.5"
              >
                <span>{currentDept.name}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>

              {openDropdown === "dept" && (
                <div className="absolute left-0 mt-1 w-64 rounded-lg bg-popover border border-border shadow-xl py-1 z-30 max-h-60 overflow-y-auto animate-in fade-in-50 zoom-in-95">
                  {QCET_DEPARTMENT_GROUPS.map((dept) => (
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
                        "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-accent transition-colors cursor-pointer",
                        selectedDeptCode === dept.code
                          ? "font-semibold text-foreground bg-accent"
                          : "text-foreground"
                      )}
                    >
                      <span className="truncate">{dept.name}</span>
                      {selectedDeptCode === dept.code && (
                        <Check className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ChevronRight className="size-3 text-muted-foreground/40" />
            <span
              className="text-muted-foreground font-medium"
              id="create-task-modal-title"
            >
              Tạo nhiệm vụ
            </span>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-1">
            {/* Toggle AI Agent Assistant */}
            <button
              type="button"
              onClick={() => setIsAgentOpen(!isAgentOpen)}
              className={cn(
                "h-7 px-2.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer",
                isAgentOpen
                  ? "bg-accent text-accent-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
              title="Mở trợ lý AI gợi ý và soạn thảo nhiệm vụ"
            >
              <Sparkles
                className={cn(
                  "size-3.5 text-muted-foreground",
                  isAgentOpen && "text-amber-500 fill-amber-500/20"
                )}
                strokeWidth={1.5}
              />
              <span>Tạo cùng Agent</span>
            </button>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={handleRequestClose}
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              aria-label="Đóng biểu mẫu tạo nhiệm vụ"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
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

        {/* Modal Main Body: Fixed-Width Left Composer + Right Sliding Agent Panel */}
        <div className="flex flex-row flex-1 min-h-0 bg-card overflow-hidden items-stretch">
          {/* Left Main Task Composer - Zero Layout Shift on Agent Toggle */}
          <div className="w-full md:w-[680px] md:min-w-[680px] md:max-w-[680px] shrink-0 flex flex-col min-h-0">
            {/* Scrollable Form Area */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 flex flex-col space-y-2.5">
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
                  placeholder="Tên nhiệm vụ... *"
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
                {/* 3.1 Status Chip */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === "status" ? null : "status")
                    }
                    className="inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md text-[11px] font-medium border border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground transition-colors cursor-pointer select-none"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        status === "IN_PROGRESS" ? "bg-blue-500" : "bg-muted-foreground"
                      )}
                    />
                    <span>{status === "IN_PROGRESS" ? "Đang thực hiện" : "Mới"}</span>
                    <ChevronDown className="size-2.5 text-muted-foreground" />
                  </button>

                  {openDropdown === "status" && (
                    <div className="absolute left-0 mt-1 w-36 rounded-lg bg-popover border border-border shadow-xl py-1 z-30 animate-in fade-in-50 zoom-in-95">
                      <button
                        type="button"
                        onClick={() => {
                          setStatus("IN_PROGRESS");
                          setOpenDropdown(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-accent text-foreground cursor-pointer"
                      >
                        <span className="size-1.5 rounded-full bg-blue-500" />
                        <span>Đang thực hiện</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStatus("TODO");
                          setOpenDropdown(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-accent text-foreground cursor-pointer"
                      >
                        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                        <span>Mới</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3.2 Priority Chip */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === "priority" ? null : "priority")
                    }
                    className="inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md text-[11px] font-medium border border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground transition-colors cursor-pointer select-none"
                  >
                    <Flag
                      className={cn("size-3", PRIORITY_CONFIG[priority].iconColor)}
                      strokeWidth={1.75}
                    />
                    <span>{PRIORITY_CONFIG[priority].label}</span>
                    <ChevronDown className="size-2.5 text-muted-foreground" />
                  </button>

                  {openDropdown === "priority" && (
                    <div className="absolute left-0 mt-1 w-36 rounded-lg bg-popover border border-border shadow-xl py-1 z-30 animate-in fade-in-50 zoom-in-95">
                      {PRIORITY_KEYS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setPriority(p);
                            setOpenDropdown(null);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-accent cursor-pointer transition-colors",
                            priority === p
                              ? "font-semibold text-foreground bg-accent"
                              : "text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Flag
                              className={cn(
                                "size-3",
                                PRIORITY_CONFIG[p].iconColor
                              )}
                            />
                            <span>{PRIORITY_CONFIG[p].label}</span>
                          </div>
                          {priority === p && <Check className="size-3 text-foreground" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3.3 Lead Assignee (DRI) Chip (P0 Field) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === "dri" ? null : "dri")
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md text-[11px] font-medium border transition-colors cursor-pointer select-none",
                      fieldErrors.lead
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : "border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground"
                    )}
                  >
                    <User className="size-3 text-muted-foreground" strokeWidth={1.5} />
                    <span>
                      {leadAssigneeName ? `Chủ trì: ${leadAssigneeName}` : "Chủ trì *"}
                    </span>
                    <ChevronDown className="size-2.5 text-muted-foreground" />
                  </button>

                  {openDropdown === "dri" && (
                    <div className="absolute left-0 mt-1 w-56 rounded-lg bg-popover border border-border shadow-xl py-1 z-30 max-h-52 overflow-y-auto animate-in fade-in-50 zoom-in-95">
                      {availablePersonnel.map((person) => (
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
                            "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-accent cursor-pointer transition-colors",
                            leadAssigneeName === person.name
                              ? "font-semibold text-foreground bg-accent"
                              : "text-foreground"
                          )}
                        >
                          <div>
                            <div className="font-medium">{person.name}</div>
                            <div className="text-[10px] text-muted-foreground">{person.role}</div>
                          </div>
                          {leadAssigneeName === person.name && (
                            <Check className="size-3.5 text-foreground" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3.4 Collaborators (Co-assignees) Chip */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === "co" ? null : "co")
                    }
                    className="inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md text-[11px] font-medium border border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground transition-colors cursor-pointer select-none"
                  >
                    <Users className="size-3 text-muted-foreground" strokeWidth={1.5} />
                    <span>
                      {coAssignees.length > 0
                        ? `Phối hợp (${coAssignees.length})`
                        : "+ Phối hợp"}
                    </span>
                    <ChevronDown className="size-2.5 text-muted-foreground" />
                  </button>

                  {openDropdown === "co" && (
                    <div className="absolute left-0 mt-1 w-56 rounded-lg bg-popover border border-border shadow-xl py-1 z-30 max-h-52 overflow-y-auto animate-in fade-in-50 zoom-in-95">
                      {availablePersonnel
                        .filter((p) => p.name !== leadAssigneeName)
                        .map((person) => {
                          const isSelected = coAssignees.includes(person.name);
                          return (
                            <button
                              key={person.name}
                              type="button"
                              onClick={() => {
                                setCoAssignees((prev) =>
                                  isSelected
                                    ? prev.filter((n) => n !== person.name)
                                    : [...prev, person.name]
                                );
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-accent text-foreground cursor-pointer transition-colors"
                            >
                              <div>
                                <div className="font-medium">{person.name}</div>
                                <div className="text-[10px] text-muted-foreground">{person.role}</div>
                              </div>
                              <div
                                className={cn(
                                  "size-4 rounded border flex items-center justify-center text-[10px]",
                                  isSelected
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border"
                                )}
                              >
                                {isSelected && <Check className="size-3" />}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* 3.5 Start Date Chip */}
                <VietnameseDatePicker
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  label="Bắt đầu:"
                  variant="chip"
                  icon={<Calendar className="size-3 text-muted-foreground" strokeWidth={1.5} />}
                  placeholder="dd/mm/yyyy"
                />

                {/* 3.6 Target Due Date Chip (P0 Field) */}
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

                {/* 3.7 Category / Domain Chip */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === "cat" ? null : "cat")
                    }
                    className="inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md text-[11px] font-medium border border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground transition-colors cursor-pointer select-none"
                  >
                    <Tag className="size-3 text-muted-foreground" strokeWidth={1.5} />
                    <span>
                      {CATEGORY_OPTIONS.find((c) => c.id === category)?.label || "Lĩnh vực"}
                    </span>
                    <ChevronDown className="size-2.5 text-muted-foreground" />
                  </button>

                  {openDropdown === "cat" && (
                    <div className="absolute left-0 mt-1 w-48 rounded-lg bg-popover border border-border shadow-xl py-1 z-30 animate-in fade-in-50 zoom-in-95">
                      {CATEGORY_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setCategory(opt.id);
                            setOpenDropdown(null);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-accent cursor-pointer transition-colors",
                            category === opt.id
                              ? "font-semibold text-foreground bg-accent"
                              : "text-foreground"
                          )}
                        >
                          <span>{opt.label}</span>
                          {category === opt.id && <Check className="size-3 text-foreground" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Detailed Description / Canvas */}
              <div className="pt-0.5">
                <textarea
                  ref={descriptionTextareaRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả nội dung chỉ đạo, căn cứ pháp lý, yêu cầu kỹ thuật hoặc tiêu chí nghiệm thu..."
                  rows={3}
                  className="w-full min-h-[72px] max-h-[180px] resize-y bg-transparent border-0 p-0 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 leading-relaxed"
                />
              </div>

              {/* 5. Milestones / Subtasks (Quiet Progressive Disclosure) */}
              <div className="pt-1">
                {milestones.length === 0 && !isAddingMilestone ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingMilestone(true);
                      setTimeout(() => milestoneInputRef.current?.focus(), 40);
                    }}
                    className="inline-flex items-center gap-1.5 py-1 px-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none group"
                  >
                    <Plus className="size-3 text-muted-foreground group-hover:text-foreground" strokeWidth={1.5} />
                    <span>Thêm đầu việc</span>
                  </button>
                ) : (
                  <div className="space-y-1.5 pt-1.5 border-t border-border/60">
                    {/* List of existing milestones */}
                    {milestones.length > 0 && (
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {milestones.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-md hover:bg-accent text-xs group"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleMilestone(m.id)}
                                className={cn(
                                  "size-3.5 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer",
                                  m.completed
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "border-border hover:border-border/80"
                                )}
                              >
                                {m.completed && <Check className="size-2.5" strokeWidth={1.5} />}
                              </button>
                              <span
                                className={cn(
                                  "truncate text-xs",
                                  m.completed
                                    ? "line-through text-muted-foreground"
                                    : "text-foreground font-medium"
                                )}
                              >
                                {m.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {m.dueDate && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {m.dueDate}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveMilestone(m.id)}
                                className="text-muted-foreground/60 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                                aria-label="Xóa mốc này"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline milestone input row or + Button */}
                    {isAddingMilestone ? (
                      <div className="flex items-center gap-2 py-1 px-1.5 text-xs bg-muted/40 rounded-md border border-border/60">
                        <span className="size-3.5 rounded-full border border-dashed border-border shrink-0" />
                        <input
                          ref={milestoneInputRef}
                          type="text"
                          value={newMilestoneText}
                          onChange={(e) => setNewMilestoneText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newMilestoneText.trim()) {
                                handleAddMilestone();
                              }
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewMilestoneText("");
                              setIsAddingMilestone(false);
                            }
                          }}
                          placeholder="Nhập tên đầu việc con..."
                          className="flex-1 bg-transparent border-0 p-0 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                          autoFocus
                        />
                        <span className="text-[10px] text-muted-foreground select-none">
                          Enter để thêm • Esc để hủy
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingMilestone(true);
                          setTimeout(() => milestoneInputRef.current?.focus(), 40);
                        }}
                        className="inline-flex items-center gap-1.5 py-1 px-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
                      >
                        <Plus className="size-3" strokeWidth={1.5} />
                        <span>Thêm đầu việc</span>
                      </button>
                    )}
                  </div>
                )}
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
                <span>để tạo</span>
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
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <span>Tạo nhiệm vụ</span>
                  )}
                </button>
              </div>
            </footer>
          </div>

          {/* Right Sliding AI Agent Panel (340px) */}
          {isAgentOpen && (
            <LinearTaskAgentPanel
              isOpen={isAgentOpen}
              onClose={() => setIsAgentOpen(false)}
              onCollapse={() => setIsAgentOpen(false)}
              onApplySuggestion={handleApplyAiSuggestion}
              currentDraft={{
                title,
                summary,
                description,
                priority,
                dueDate,
                startDate,
                category,
                leadAssigneeName,
                coAssignees,
                milestones,
              }}
              availablePersonnel={availablePersonnel}
            />
          )}
        </div>
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
                <AlertCircle className="size-4" />
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
                className="w-full sm:w-auto text-xs h-8 text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
              >
                Hủy bỏ bản nháp
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setShowConfirmClose(false);
                  onClose();
                }}
                className="w-full sm:w-auto text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Lưu nháp & Đóng
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

export default LinearCreateTaskModal;
