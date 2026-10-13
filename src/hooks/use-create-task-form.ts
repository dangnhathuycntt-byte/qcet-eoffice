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
  /** Hộp luôn được gắn sẵn ở nhiều trang: form dựng lại theo props hiện tại mỗi lần mở. Mặc định coi như đang mở. */
  isOpen?: boolean;
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

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** So theo ngày (yyyy-mm-dd); chuỗi không đúng dạng thì bỏ qua để máy chủ quyết định. */
function isStartAfterDue(startDate: string, dueDate: string): boolean {
  if (!ISO_DAY.test(startDate) || !ISO_DAY.test(dueDate)) return false;
  return startDate.slice(0, 10) > dueDate.slice(0, 10);
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

  if (data.startDate && data.dueDate && isStartAfterDue(data.startDate, data.dueDate)) {
    errors.startDate = "Ngày bắt đầu không được sau hạn chót.";
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

// ─── Failure messages ─────────────────────────────────────────
// Máy chủ/adapter trả lỗi tiếng Anh ("Validation failed", "Create task rejected with status 500."): người dùng cần câu
// tiếng Việt nói rõ chuyện gì xảy ra và làm gì tiếp. Câu đã là tiếng Việt (lỗi nghiệp vụ cụ thể) giữ nguyên.
const VIETNAMESE_TEXT =
  /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

export function describeCreateTaskFailure(failure: {
  reason: "validation" | "rejected" | "unknown";
  status?: number;
  error?: string;
}): string {
  const raw = failure.error?.trim() ?? "";
  if (raw && VIETNAMESE_TEXT.test(raw)) return raw;
  const { status } = failure;
  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại; nội dung đang soạn được giữ lại.";
  }
  if (status === 403) return "Bạn không có quyền tạo nhiệm vụ trong đơn vị này.";
  if (status === 404) {
    return "Không tìm thấy nhiệm vụ cha hoặc đơn vị đã chọn. Hãy tải lại trang rồi thử lại.";
  }
  if (status === 409) {
    return "Yêu cầu trước đó đã được ghi nhận hoặc đang xử lý. Kiểm tra danh sách nhiệm vụ; chưa thấy thì đóng hộp và tạo lại.";
  }
  if (status === 413) return "Nội dung quá lớn để gửi. Hãy rút gọn phần mô tả.";
  if (status === 429) return "Thao tác quá nhanh. Chờ vài giây rồi thử lại.";
  if (status !== undefined && status >= 500) {
    return "Máy chủ gặp lỗi. Nội dung đã nhập vẫn được giữ, hãy thử lại sau ít phút.";
  }
  if (status === 400 || status === 422 || failure.reason === "validation") {
    return "Nội dung chưa hợp lệ. Kiểm tra tên (3–255 ký tự), người chủ trì và hạn hoàn thành rồi thử lại.";
  }
  return "Máy chủ từ chối tạo nhiệm vụ.";
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

function loadDraft(): unknown {
  try {
    const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

const DRAFT_PRIORITIES: readonly CreateTaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const DRAFT_LEVELS: readonly CreateTaskLevel[] = ["TRUONG", "DON_VI", "STAFF"];

/**
 * Bản nháp đọc từ sessionStorage chỉ là gợi ý: từng trường phải đúng kiểu (JSON hỏng hoặc bản cũ không được làm sập
 * form), và nháp thuộc ngữ cảnh khác (nhiệm vụ gốc so với việc con của nhiệm vụ cha khác) thì bỏ qua, không gắn nhầm cha.
 */
export function restoreCreateTaskDraft(
  raw: unknown,
  fresh: CreateTaskFormData,
  parentTaskId?: string,
): CreateTaskFormData | null {
  if (!raw || typeof raw !== "object") return null;
  const draft = raw as Record<string, unknown>;
  if (typeof draft.title !== "string" || !draft.title) return null;
  const draftParent = typeof draft.parentTaskId === "string" && draft.parentTaskId ? draft.parentTaskId : undefined;
  if (draftParent !== (parentTaskId || undefined)) return null;

  const text = (key: keyof CreateTaskFormData): string =>
    typeof draft[key] === "string" ? (draft[key] as string) : (fresh[key] as string);
  return {
    ...fresh,
    title: draft.title,
    summary: text("summary"),
    description: text("description"),
    selectedDeptCode: text("selectedDeptCode"),
    leadAssigneeId: text("leadAssigneeId"),
    startDate: text("startDate"),
    dueDate: text("dueDate"),
    category: text("category"),
    priority: DRAFT_PRIORITIES.includes(draft.priority as CreateTaskPriority)
      ? (draft.priority as CreateTaskPriority)
      : fresh.priority,
    level: DRAFT_LEVELS.includes(draft.level as CreateTaskLevel)
      ? (draft.level as CreateTaskLevel)
      : fresh.level,
  };
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
  const { departments: allDepartments, isLoading: isLoadingDepartments } = useDepartmentList({
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
        // Lỗi "bắt đầu sau hạn chót" nằm ở startDate nhưng đổi hạn chót cũng giải quyết được nó
        if (field === "dueDate" && prev.startDate) {
          const { startDate: _s, dueDate: _d, ...rest } = prev;
          return rest;
        }
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

  // ── Mở hộp ─────────────────────────────────────────────────
  // Hộp được gắn sẵn ở lịch, workspace và trang chi tiết nên state sống qua nhiều lần mở: dựng lại theo props hiện tại
  // ngay khi mở (trước khi vẽ) để ngày từ lịch, nhiệm vụ cha, đơn vị không bị giữ từ lần trước, rồi mới thử khôi phục
  // nháp. Không dựng lại lúc đóng để nội dung không biến mất giữa hiệu ứng thoát. Không đụng sessionStorage: nháp chỉ
  // xóa khi người dùng chủ động.
  const isOpen = options.isOpen ?? true;
  const wasOpenRef = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const fresh = buildInitialData();
    initialSnapshot.current = fresh;
    idempotencyKeyRef.current = null;
    setFieldErrors({});
    setSubmissionOutcome(null);
    setSubmissionMessage(null);

    let next = fresh;
    let restored = false;
    // explicit init takes precedence
    if (!options.initialTitle) {
      const draft = restoreCreateTaskDraft(loadDraft(), fresh, options.parentTaskId);
      if (draft) {
        // Enforce policy on restored draft
        if (!isExecutive && draft.level === "TRUONG") draft.level = "DON_VI";
        if (!isExecutive && userDeptCode) draft.selectedDeptCode = userDeptCode;
        next = draft;
        restored = true;
      }
    }
    setFormData(next);
    setHasRestoredDraft(restored);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draft auto-save (debounced) ─────────────────────────────
  React.useEffect(() => {
    if (!isOpen || !isDirty) return;

    const timeout = setTimeout(() => saveDraft(formData), DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [isOpen, isDirty, formData]);

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
  /** Trả về lỗi kiểm tra (để hộp đưa focus tới ô sai đầu tiên); `null` khi đã gửi hoặc đang gửi dở. */
  const handleSubmit = React.useCallback(async (): Promise<CreateTaskFormErrors | null> => {
    if (isSubmittingLockRef.current || isSubmitting) return null;

    // Validate
    const errors = validateCreateTaskForm(formData, {
      parentDueDate: options.parentTaskDueDate,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return errors;
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
        setSubmissionMessage(describeCreateTaskFailure(outcome.result));
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingLockRef.current = false;
    }
    return null;
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
    isLoadingDepartments,
    availablePersonnel,
    handleSubmit,
    handleClearDraft,
    resetForm,
    submissionOutcome,
    submissionMessage,
  };
}
