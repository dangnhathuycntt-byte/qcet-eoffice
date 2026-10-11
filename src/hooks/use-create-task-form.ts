"use client";

import * as React from "react";
import {
  useDepartmentList,
  type DepartmentPersonnel,
  type DepartmentOption,
} from "@/hooks/use-department-list";
import {
  submitCreateTask,
  type CreateTaskDraft,
  type CreateTaskLevel,
  type CreateTaskSubmitResult,
} from "@/lib/adapters/create-task-mapper";
import { isExecutiveUser } from "@/domain/tasks/create-task-policy";
import { useAuth } from "@/lib/auth-context";
import { toCanonicalUnitCode } from "@/lib/departments";

// ─── Types ────────────────────────────────────────────────────
export type CreateTaskPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export interface CreateTaskFormData {
  title: string;
  summary: string;
  description: string;
  priority: CreateTaskPriority;
  level: CreateTaskLevel;
  selectedDeptCode: string;
  leadAssigneeId: string;
  startDate: string;
  dueDate: string;
  category: string;
  parentTaskId?: string;
}

export interface CreateTaskFormErrors {
  title?: string;
  lead?: string;
  dueDate?: string;
  [key: string]: string | undefined;
}

export type SubmissionOutcome = "created" | "rejected" | "unknown";

export interface CreateTaskSubmissionResult {
  status: SubmissionOutcome;
  message?: string;
  result: CreateTaskSubmitResult;
}

export interface UseCreateTaskFormOptions {
  initialLevel?: CreateTaskLevel;
  initialTitle?: string;
  initialAssigneeId?: string;
  initialDueDate?: string;
  initialDepartmentCode?: string;
  parentTaskId?: string;
  parentTaskDueDate?: string;
  onSuccess?: (task: unknown) => void;
}

// ─── Constants ────────────────────────────────────────────────
const DRAFT_STORAGE_KEY = "qcet_task_create_draft_v2";
const DRAFT_DEBOUNCE_MS = 400;

// ─── Validation ───────────────────────────────────────────────
/** Hạn nhiệm vụ con không được muộn hơn hạn nhiệm vụ cha; ngày không đọc được là không hợp lệ. */
export function validateSubtaskDueDate(parentDueDate: string, subtaskDueDate: string): boolean {
  if (!parentDueDate || !subtaskDueDate) return true;
  const parentTime = new Date(parentDueDate).getTime();
  const subtaskTime = new Date(subtaskDueDate).getTime();
  if (Number.isNaN(parentTime) || Number.isNaN(subtaskTime)) return false;
  return subtaskTime <= parentTime;
}

function formatDateVi(isoDate: string): string {
  const [year, month, day] = isoDate.split("T")[0].split("-");
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

export function validateCreateTaskForm(
  data: CreateTaskFormData,
  options?: { parentDueDate?: string },
): CreateTaskFormErrors {
  const errors: CreateTaskFormErrors = {};

  if (!data.title.trim()) {
    errors.title = "Vui lòng nhập tên nhiệm vụ.";
  } else if (data.title.trim().length < 3) {
    errors.title = "Tên nhiệm vụ phải có ít nhất 3 ký tự.";
  }

  if (!data.leadAssigneeId) {
    errors.lead = "Vui lòng chọn người phụ trách.";
  }

  if (!data.dueDate) {
    errors.dueDate = "Vui lòng chọn thời hạn.";
  }

  if (
    data.dueDate &&
    options?.parentDueDate &&
    !validateSubtaskDueDate(options.parentDueDate, data.dueDate)
  ) {
    errors.dueDate = `Thời hạn nhiệm vụ con không được vượt quá hạn nhiệm vụ cha (${formatDateVi(options.parentDueDate)}).`;
  }

  return errors;
}

/** Form có nội dung khác bản ban đầu (dùng để hỏi trước khi đóng và lưu nháp). */
export function isCreateTaskFormDirty(
  current: CreateTaskFormData,
  initial: CreateTaskFormData,
): boolean {
  return (
    current.title.trim() !== initial.title.trim() ||
    current.summary.trim() !== "" ||
    current.description.trim() !== "" ||
    current.dueDate !== initial.dueDate ||
    current.startDate !== "" ||
    current.priority !== "MEDIUM" ||
    current.category !== "CHUYEN_DOI_SO" ||
    current.leadAssigneeId !== initial.leadAssigneeId
  );
}

// ─── Submission ───────────────────────────────────────────────
/**
 * Canonical create (C1 / T26 / T27 / T72 / T73), one outcome for the UI:
 * - `created`: server-confirmed — the only state that may be treated as success.
 * - `rejected`: the server (or local contract validation) refused the mutation.
 * - `unknown`: transport failure / timeout. The request may or may not have been
 *   applied. Keep the draft and retry with the SAME idempotency key
 *   (`result.idempotencyKey`), never with a fresh one.
 */
export async function performCreateTaskSubmission(
  draft: CreateTaskDraft,
  options: Parameters<typeof submitCreateTask>[1] = {},
): Promise<CreateTaskSubmissionResult> {
  const result = await submitCreateTask(draft, options);
  if (result.ok) return { status: "created", result };
  return {
    status: result.reason === "unknown" ? "unknown" : "rejected",
    message: result.error,
    result,
  };
}

// ─── Draft helpers ────────────────────────────────────────────
interface DraftPayload extends CreateTaskFormData {
  timestamp: number;
}

function saveDraft(data: CreateTaskFormData): void {
  try {
    const payload: DraftPayload = { ...data, timestamp: Date.now() };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/storage errors
  }
}

function loadDraft(): CreateTaskFormData | null {
  try {
    const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) return null;
    const parsed: DraftPayload = JSON.parse(stored);
    if (!parsed || !parsed.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearDraftStorage(): void {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// ─── Hook ─────────────────────────────────────────────────────
export function useCreateTaskForm(options: UseCreateTaskFormOptions = {}) {
  const { user } = useAuth();
  const isExecutive = isExecutiveUser(user);

  const userDeptCode = React.useMemo(
    () =>
      toCanonicalUnitCode(
        user?.departmentCode || user?.department || "",
      ) || "",
    [user],
  );

  // ── Department + Personnel ──────────────────────────────────
  const { departments: allDepartments } = useDepartmentList({
    includePersonnel: true,
  });

  const availableDepartments = React.useMemo<DepartmentOption[]>(() => {
    if (isExecutive) return allDepartments;
    // Fail-closed: non-exec with no dept code sees nothing
    if (!userDeptCode) return [];
    const filtered = allDepartments.filter(
      (d) => d.code === userDeptCode || d.name === user?.department,
    );
    return filtered.length > 0 ? filtered : [];
  }, [isExecutive, allDepartments, userDeptCode, user?.department]);

  // ── Initial form data ───────────────────────────────────────
  const defaultDeptCode =
    options.initialDepartmentCode ||
    userDeptCode ||
    availableDepartments[0]?.code ||
    "";

  const buildInitialData = React.useCallback((): CreateTaskFormData => {
    const effectiveLevel: CreateTaskLevel = isExecutive
      ? (options.initialLevel ?? "TRUONG")
      : "DON_VI";
    return {
      title: options.initialTitle ?? "",
      summary: "",
      description: "",
      priority: "MEDIUM",
      level: effectiveLevel,
      selectedDeptCode: defaultDeptCode,
      leadAssigneeId: options.initialAssigneeId ?? "",
      startDate: "",
      dueDate: options.initialDueDate ?? "",
      category: "CHUYEN_DOI_SO",
      parentTaskId: options.parentTaskId,
    };
  }, [
    isExecutive,
    options.initialLevel,
    options.initialTitle,
    options.initialAssigneeId,
    options.initialDueDate,
    options.parentTaskId,
    defaultDeptCode,
  ]);

  const initialSnapshot = React.useRef<CreateTaskFormData>(buildInitialData());

  // ── Form state ──────────────────────────────────────────────
  const [formData, setFormData] = React.useState<CreateTaskFormData>(
    () => initialSnapshot.current,
  );
  const [fieldErrors, setFieldErrors] = React.useState<CreateTaskFormErrors>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = React.useState(false);
  const [submissionOutcome, setSubmissionOutcome] =
    React.useState<SubmissionOutcome | null>(null);
  const [submissionMessage, setSubmissionMessage] = React.useState<
    string | null
  >(null);

  const idempotencyKeyRef = React.useRef<string | null>(null);
  const isSubmittingLockRef = React.useRef(false);

  // ── setField helper ──────────��──────────────────────────────
  const setField = React.useCallback(
    <K extends keyof CreateTaskFormData>(
      field: K,
      value: CreateTaskFormData[K],
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear field error on edit
      setFieldErrors((prev) => {
        if (field === "leadAssigneeId" && prev.lead) {
          const { lead: _, ...rest } = prev;
          return rest;
        }
        if (prev[field as string]) {
          const next = { ...prev };
          delete next[field as string];
          return next;
        }
        return prev;
      });
    },
    [],
  );

  // ── Personnel from selected department ──────────────────────
  const currentDept = React.useMemo(
    () =>
      availableDepartments.find((d) => d.code === formData.selectedDeptCode) ||
      availableDepartments[0],
    [formData.selectedDeptCode, availableDepartments],
  );

  const availablePersonnel = React.useMemo<DepartmentPersonnel[]>(
    () => currentDept?.personnel || [],
    [currentDept],
  );

  // Clear DRI when department changes and current DRI is not in new list
  React.useEffect(() => {
    if (availablePersonnel.length > 0) {
      if (
        formData.leadAssigneeId &&
        !availablePersonnel.some((p) => p.id === formData.leadAssigneeId)
      ) {
        setFormData((prev) => ({ ...prev, leadAssigneeId: "" }));
      }
    } else if (formData.leadAssigneeId) {
      setFormData((prev) => ({ ...prev, leadAssigneeId: "" }));
    }
  }, [availablePersonnel, formData.leadAssigneeId]);

  // ── Dirty state ─────────────────────────────────────────────
  const isDirty = React.useMemo(
    () => isCreateTaskFormDirty(formData, initialSnapshot.current),
    [formData],
  );

  // ── Draft restore on mount ──────────────────────────────────
  const didRestoreDraftRef = React.useRef(false);
  React.useEffect(() => {
    if (didRestoreDraftRef.current) return;
    if (options.initialTitle) return; // explicit init takes precedence

    const draft = loadDraft();
    if (draft) {
      // Enforce policy on restored draft
      if (!isExecutive && draft.level === "TRUONG") {
        draft.level = "DON_VI";
      }
      if (!isExecutive && userDeptCode) {
        draft.selectedDeptCode = userDeptCode;
      }
      setFormData(draft);
      setHasRestoredDraft(true);
    }
    didRestoreDraftRef.current = true;
  }, [options.initialTitle, isExecutive, userDeptCode]);

  // ── Draft auto-save (debounced) ─────────────────────────────
  React.useEffect(() => {
    if (!isDirty) return;

    const timeout = setTimeout(() => saveDraft(formData), DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [isDirty, formData]);

  // ── handleClearDraft ────────────────────────────────────────
  const handleClearDraft = React.useCallback(() => {
    clearDraftStorage();
    const fresh = buildInitialData();
    initialSnapshot.current = fresh;
    setFormData(fresh);
    setHasRestoredDraft(false);
    setFieldErrors({});
    setSubmissionOutcome(null);
    setSubmissionMessage(null);
  }, [buildInitialData]);

  // ── resetForm ───────────────────────────────────────────────
  const resetForm = React.useCallback(() => {
    clearDraftStorage();
    const fresh = buildInitialData();
    initialSnapshot.current = fresh;
    setFormData(fresh);
    setFieldErrors({});
    setIsSubmitting(false);
    setHasRestoredDraft(false);
    setSubmissionOutcome(null);
    setSubmissionMessage(null);
    idempotencyKeyRef.current = null;
    isSubmittingLockRef.current = false;
  }, [buildInitialData]);

  // ── handleSubmit ────────────────────────────────────────────
  const handleSubmit = React.useCallback(async () => {
    if (isSubmittingLockRef.current || isSubmitting) return;

    // Validate
    const errors = validateCreateTaskForm(formData, {
      parentDueDate: options.parentTaskDueDate,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    isSubmittingLockRef.current = true;
    setSubmissionOutcome(null);
    setSubmissionMessage(null);

    // Compute effective level (non-exec forced to DON_VI)
    const effectiveLevel: CreateTaskLevel = isExecutive
      ? formData.level
      : formData.level === "TRUONG"
        ? "DON_VI"
        : formData.level;

    // Build description with summary prefix
    const fullDescription = [
      formData.summary.trim() ? `[Tóm tắt] ${formData.summary.trim()}` : "",
      formData.description.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    // Resolve DRI display name from personnel
    const leadName =
      availablePersonnel.find((p) => p.id === formData.leadAssigneeId)?.name ??
      "";

    // submitCreateTask never throws: transport failures come back as `unknown`.
    try {
      const outcome = await performCreateTaskSubmission(
        {
          level: effectiveLevel,
          title: formData.title.trim(),
          startDate: formData.startDate || undefined,
          dueDate: formData.dueDate,
          description: fullDescription,
          leadAssigneeName: leadName || undefined,
          parentTaskId: formData.parentTaskId,
          priority: formData.priority,
          category: formData.category,
        },
        {
          personnel: availablePersonnel.map((p) => ({
            id: p.id,
            name: p.name,
          })),
          assigneeId: formData.leadAssigneeId || undefined,
          departmentId: currentDept?.code || currentDept?.id || userDeptCode,
          // Undefined on a fresh submit: the adapter generates one and returns it.
          idempotencyKey: idempotencyKeyRef.current ?? undefined,
        },
      );

      if (outcome.result.ok) {
        // Success: clear draft, clear idempotency key
        clearDraftStorage();
        idempotencyKeyRef.current = null;
        setSubmissionOutcome("created");
        setSubmissionMessage(null);
        options.onSuccess?.(outcome.result.task);
      } else if (outcome.status === "unknown") {
        // Unknown: keep draft + the same idempotency key for a safe retry
        idempotencyKeyRef.current = outcome.result.idempotencyKey;
        setSubmissionOutcome("unknown");
        setSubmissionMessage(
          "Chưa xác nhận được kết quả từ máy chủ. Nội dung đã nhập vẫn được giữ nguyên, có thể thử lại an toàn.",
        );
      } else {
        // Rejected
        setSubmissionOutcome("rejected");
        setSubmissionMessage(
          outcome.message || "Máy chủ từ chối tạo nhiệm vụ.",
        );
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingLockRef.current = false;
    }
  }, [
    isSubmitting,
    formData,
    isExecutive,
    options.parentTaskDueDate,
    options.onSuccess,
    availablePersonnel,
    currentDept,
    userDeptCode,
  ]);

  return {
    formData,
    setField,
    fieldErrors,
    setFieldErrors,
    isSubmitting,
    isDirty,
    hasRestoredDraft,
    isExecutive,
    availableDepartments,
    availablePersonnel,
    handleSubmit,
    handleClearDraft,
    resetForm,
    submissionOutcome,
    submissionMessage,
  };
}
