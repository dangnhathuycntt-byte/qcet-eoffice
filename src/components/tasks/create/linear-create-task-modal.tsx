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
  Layers,
  Flag,
  User,
  Users,
  Plus,
  Trash2,
  Clock,
  Check,
  CalendarClock,
  ArrowRight,
  ShieldCheck,
  Play,
  Save,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
    iconColor: "text-slate-400",
  },
  LOW: {
    label: "Thấp",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    iconColor: "text-slate-400",
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
  const [isMilestonesExpanded, setIsMilestonesExpanded] = React.useState(false);
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
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 60);
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

  // Close on Escape with layered modal guard
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openDropdown, showConfirmClose, isAddingMilestone, handleRequestClose]);

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
        // Append instead of overwrite
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

  // Submit Handler with P0 Field Validation & Double-submit lock
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

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
          departmentId: currentDept.id,
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
  };

  if (!isOpen || !isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-2 sm:p-4 md:p-6"
      data-slot="linear-create-task-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-modal-title"
    >
      <div
        ref={modalRef}
        className={cn(
          "relative flex flex-col w-full bg-white rounded-xl shadow-2xl border border-slate-200/90 overflow-hidden transition-all duration-200",
          isAgentOpen
            ? "max-w-6xl h-[82vh] min-h-[560px] max-h-[88vh]"
            : "max-w-[840px] max-h-[85vh] h-auto min-h-[440px]",
          "animate-in fade-in zoom-in-95"
        )}
      >
        {/* Modal Top Header - Linear Context Breadcrumb */}
        <header className="flex items-center justify-between px-5 sm:px-7 py-3 border-b border-slate-100 bg-white shrink-0">
          {/* Breadcrumb & Unit Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 className="size-3.5 text-slate-400" strokeWidth={1.5} />

            {/* Department dropdown selector */}
            <div className="relative inline-block text-left">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown(openDropdown === "dept" ? null : "dept")
                }
                className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 rounded px-1 py-0.5"
              >
                <span>{currentDept.name}</span>
                <ChevronDown className="size-3 text-slate-400" />
              </button>

              {openDropdown === "dept" && (
                <div className="absolute left-0 mt-1 w-64 rounded-md bg-white border border-slate-200/90 shadow-lg py-1 z-30 max-h-60 overflow-y-auto">
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
                        "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors",
                        selectedDeptCode === dept.code
                          ? "font-semibold text-slate-900 bg-slate-50"
                          : "text-slate-700"
                      )}
                    >
                      <span className="truncate">{dept.name}</span>
                      {selectedDeptCode === dept.code && (
                        <Check className="size-3.5 text-slate-700 shrink-0" strokeWidth={2} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ChevronRight className="size-3 text-slate-300" />
            <span
              className="text-slate-500"
              id="create-task-modal-title"
            >
              Tạo việc mới
            </span>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Toggle AI Agent Assistant */}
            <button
              type="button"
              onClick={() => setIsAgentOpen(!isAgentOpen)}
              className={cn(
                "h-7 px-2.5 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer",
                isAgentOpen
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Sparkles
                className={cn(
                  "size-3 text-slate-400",
                  isAgentOpen && "text-slate-700"
                )}
                strokeWidth={1.5}
              />
              <span>Tạo cùng Agent</span>
            </button>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={handleRequestClose}
              className="size-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Đóng biểu mẫu tạo nhiệm vụ"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* Restored Draft Banner if applicable */}
        {hasRestoredDraft && (
          <div className="flex items-center justify-between px-6 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-700 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
              <span>Đã tự động khôi phục bản nháp chưa lưu từ phiên làm việc trước.</span>
            </div>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-xs text-slate-500 hover:text-rose-600 transition-colors underline underline-offset-2"
            >
              Xóa bản nháp
            </button>
          </div>
        )}

        {/* Modal Main Body: Form + Optional AI Panel */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 bg-white">
          {/* Main Task Form - Document-like Canvas */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 flex flex-col space-y-4"
          >
            {/* Error banner if any */}
            {errorMessage && (
              <div className="flex items-center gap-2 p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 shrink-0">
                <AlertCircle className="size-4 shrink-0 text-rose-500" />
                <span className="flex-1 font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Title Section (P0 Field) - Strong Visual Anchor */}
            <div className="space-y-1 shrink-0">
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
                placeholder="Tên nhiệm vụ... *"
                className={cn(
                  "w-full text-xl sm:text-2xl font-semibold text-slate-900 placeholder:text-slate-300 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 leading-snug",
                  fieldErrors.title && "placeholder:text-rose-400"
                )}
              />
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Thêm tóm tắt ngắn gọn hoặc kết quả kỳ vọng..."
                className="w-full text-xs text-slate-500 placeholder:text-slate-300 bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
              />
              {fieldErrors.title && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {fieldErrors.title}
                </p>
              )}
            </div>

            {/* Linear Property Chips Bar - Borderless & Interactive */}
            <div className="flex flex-wrap items-center gap-1 py-1.5 border-y border-slate-100 shrink-0">
              {/* 1. Status Chip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(openDropdown === "status" ? null : "status")
                  }
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      status === "IN_PROGRESS" ? "bg-blue-500" : "bg-slate-400"
                    )}
                  />
                  <span>{status === "IN_PROGRESS" ? "Đang thực hiện" : "Mới"}</span>
                  <ChevronDown className="size-2.5 text-slate-400" />
                </button>

                {openDropdown === "status" && (
                  <div className="absolute left-0 mt-1 w-36 rounded-md bg-white border border-slate-200 shadow-md py-1 z-20">
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("IN_PROGRESS");
                        setOpenDropdown(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"
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
                      className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                    >
                      <span className="size-1.5 rounded-full bg-slate-300" />
                      <span>Mới</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Priority Chip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(openDropdown === "priority" ? null : "priority")
                  }
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Flag
                    className={cn("size-3", PRIORITY_CONFIG[priority].iconColor)}
                    strokeWidth={1.75}
                  />
                  <span>{PRIORITY_CONFIG[priority].label}</span>
                  <ChevronDown className="size-2.5 text-slate-400" />
                </button>

                {openDropdown === "priority" && (
                  <div className="absolute left-0 mt-1 w-36 rounded-lg bg-white border border-slate-200 shadow-md py-1 z-20">
                    {PRIORITY_KEYS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setPriority(p);
                          setOpenDropdown(null);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50",
                          priority === p
                            ? "font-semibold text-slate-900 bg-slate-100"
                            : "text-slate-700"
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
                        {priority === p && <Check className="size-3 text-slate-800" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Lead Assignee (DRI) Chip (P0 Field) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(openDropdown === "dri" ? null : "dri")
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-normal transition-colors cursor-pointer",
                    fieldErrors.lead
                      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <User className="size-3 text-slate-400" strokeWidth={1.5} />
                  <span>
                    {leadAssigneeName ? `Chủ trì: ${leadAssigneeName}` : "Chủ trì *"}
                  </span>
                  <ChevronDown className="size-2.5 text-slate-400" />
                </button>

                {openDropdown === "dri" && (
                  <div className="absolute left-0 mt-1 w-56 rounded-md bg-white border border-slate-200 shadow-md py-1 z-20 max-h-52 overflow-y-auto">
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
                          "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50",
                          leadAssigneeName === person.name
                            ? "font-semibold text-slate-900 bg-slate-100"
                            : "text-slate-700"
                        )}
                      >
                        <div>
                          <div className="font-medium">{person.name}</div>
                          <div className="text-[10px] text-slate-400">{person.role}</div>
                        </div>
                        {leadAssigneeName === person.name && (
                          <Check className="size-3.5 text-slate-800" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Collaborators (Co-assignees) Chip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(openDropdown === "co" ? null : "co")
                  }
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Users className="size-3 text-slate-400" strokeWidth={1.5} />
                  <span>
                    {coAssignees.length > 0
                      ? `Phối hợp (${coAssignees.length})`
                      : "+ Phối hợp"}
                  </span>
                  <ChevronDown className="size-2.5 text-slate-400" />
                </button>

                {openDropdown === "co" && (
                  <div className="absolute left-0 mt-1 w-56 rounded-md bg-white border border-slate-200 shadow-md py-1 z-20 max-h-52 overflow-y-auto">
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
                            className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 text-slate-700"
                          >
                            <div>
                              <div className="font-medium">{person.name}</div>
                              <div className="text-[10px] text-slate-400">{person.role}</div>
                            </div>
                            <div
                              className={cn(
                                "size-4 rounded border flex items-center justify-center text-[10px]",
                                isSelected
                                  ? "bg-slate-800 border-slate-800 text-white"
                                  : "border-slate-300"
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

              {/* 5. Start Date Chip */}
              <div className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-normal text-slate-600 hover:bg-slate-100 transition-colors">
                <Calendar className="size-3 text-slate-400" strokeWidth={1.5} />
                <span className="text-slate-400">Bắt đầu:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-0 p-0 text-xs font-normal text-slate-700 focus:outline-none cursor-pointer"
                />
              </div>

              {/* 6. Target Due Date Chip (P0 Field) */}
              <div
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-normal transition-colors",
                  fieldErrors.dueDate
                    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <CalendarClock
                  className={cn(
                    "size-3",
                    fieldErrors.dueDate ? "text-rose-500" : "text-slate-400"
                  )}
                  strokeWidth={1.5}
                />
                <span className={cn(fieldErrors.dueDate ? "text-rose-600 font-medium" : "text-slate-700 font-medium")}>
                  Hạn chót: *
                </span>
                <input
                  type="date"
                  value={dueDate}
                  required
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    if (fieldErrors.dueDate) {
                      setFieldErrors((prev) => ({ ...prev, dueDate: undefined }));
                    }
                  }}
                  className="bg-transparent border-0 p-0 text-xs font-medium text-slate-900 focus:outline-none cursor-pointer"
                />
              </div>

              {/* 7. Category / Domain Chip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(openDropdown === "cat" ? null : "cat")
                  }
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Tag className="size-3 text-slate-400" strokeWidth={1.5} />
                  <span>
                    {CATEGORY_OPTIONS.find((c) => c.id === category)?.label || "Lĩnh vực"}
                  </span>
                  <ChevronDown className="size-2.5 text-slate-400" />
                </button>

                {openDropdown === "cat" && (
                  <div className="absolute left-0 mt-1 w-48 rounded-md bg-white border border-slate-200 shadow-md py-1 z-20">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setCategory(opt.id);
                          setOpenDropdown(null);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50",
                          category === opt.id
                            ? "font-semibold text-slate-900 bg-slate-100"
                            : "text-slate-700"
                        )}
                      >
                        <span>{opt.label}</span>
                        {category === opt.id && <Check className="size-3 text-slate-800" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description - Large borderless task composition canvas */}
            <div className="flex flex-col min-h-[110px] sm:min-h-[130px] pt-1">
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block select-none">
                Nội dung chỉ đạo & yêu cầu thực hiện
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả nội dung chỉ đạo, căn cứ pháp lý, yêu cầu kỹ thuật hoặc tiêu chí nghiệm thu..."
                rows={4}
                className="w-full min-h-[100px] max-h-[220px] resize-y bg-transparent border-0 p-0 text-xs sm:text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-0 leading-relaxed"
              />
            </div>

            {/* Milestones / Subtasks Section - Quiet inline insertion */}
            <div className="pt-2 border-t border-slate-100 shrink-0 space-y-2">
              <div className="flex items-center justify-between py-0.5 text-xs text-slate-500">
                <span className="font-medium text-slate-700 select-none">
                  Mốc thực hiện / Đầu việc con{milestones.length > 0 ? ` (${milestones.length})` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsMilestonesExpanded(true);
                    setIsAddingMilestone(true);
                  }}
                  className="size-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Thêm đầu việc"
                  aria-label="Thêm đầu việc"
                >
                  <Plus className="size-3.5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Milestone items list */}
              {milestones.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {milestones.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 py-1 px-1.5 rounded hover:bg-slate-50 text-xs group"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleMilestone(m.id)}
                          className={cn(
                            "size-3.5 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer",
                            m.completed
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-slate-300 hover:border-slate-400"
                          )}
                        >
                          {m.completed && <Check className="size-2.5" strokeWidth={2} />}
                        </button>
                        <span
                          className={cn(
                            "truncate",
                            m.completed
                              ? "line-through text-slate-400"
                              : "text-slate-800 font-medium"
                          )}
                        >
                          {m.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {m.dueDate && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {m.dueDate}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(m.id)}
                          className="text-slate-300 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                          aria-label="Xóa mốc này"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline Insertion Row */}
              {isAddingMilestone ? (
                <div className="flex items-center gap-2 py-1 px-1 text-xs">
                  <span className="size-3.5 rounded-full border border-dashed border-slate-300 shrink-0" />
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
                    placeholder="Nhập tên đầu việc..."
                    className="flex-1 bg-transparent border-0 p-0 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-400 select-none">
                    Enter để thêm • Esc để hủy
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingMilestone(true)}
                  className="inline-flex items-center gap-1.5 py-1 px-1 text-xs text-slate-400 hover:text-slate-700 transition-colors cursor-pointer select-none"
                >
                  <Plus className="size-3" strokeWidth={1.5} />
                  <span>Thêm đầu việc</span>
                </button>
              )}
            </div>
          </form>

          {/* Right Sliding AI Agent Panel */}
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

        {/* Modal Bottom Footer - Restrained & Clean */}
        <footer className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            onClick={handleRequestClose}
            disabled={isSubmitting}
            className="h-7.5 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors cursor-pointer"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting || !title.trim()}
            className="h-7.5 px-3.5 text-xs font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5 inline-block" />
                Đang tạo...
              </>
            ) : (
              "Tạo việc"
            )}
          </button>
        </footer>
      </div>

      {/* Confirmation Dialog on Unsaved Changes */}
      {showConfirmClose && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircle className="size-4" />
              </div>
              <div className="space-y-1">
                <h4
                  id="confirm-dialog-title"
                  className="text-sm font-semibold text-slate-900"
                >
                  Bản nháp có thay đổi chưa lưu
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Biểu mẫu tạo nhiệm vụ đang có dữ liệu chưa lưu. B���n muốn lưu tạm bản nháp trong phiên làm việc hay hủy bỏ hoàn toàn?
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
                className="w-full sm:w-auto text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Lưu nháp & Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export default LinearCreateTaskModal;
