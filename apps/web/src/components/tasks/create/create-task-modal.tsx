"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Calendar,
  CheckCircle2,
  CalendarClock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import { Select } from "@base-ui/react/select";
import { Dialog } from "@base-ui/react/dialog";
import { DialogBreadcrumb } from "@/components/ui/dialog";
import { getPlatformModifierKey } from "@/lib/shortcuts/platform";
import type { CreateTaskLevel } from "@/lib/adapters/create-task-mapper";
import {
  useCreateTaskForm,
  type CreateTaskPriority,
} from "@/hooks/use-create-task-form";
import { Pressable } from "@/components/ui/pressable";
import { SheetKeyboardSync } from "@/components/ui/menu";
import { useIsPhone } from "@/hooks/use-is-phone";
import { useFeedback } from "@/components/ui/feedback-layer";
import { Button, PROPERTY_PILL_CLASS } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MENU_OPTION_ROW_CLASS, MENU_POPUP_CLASS, MenuSheetHeader, SHEET_BACKDROP_CLASS, SHEET_POPUP_CLASS, SHEET_POSITIONER_CLASS } from "@/components/ui/menu";
import { SourceDocumentChip, linkTaskToDocument, type SourceDocumentOption } from "@/components/tasks/create/source-document-chip";
import { PersonPillPicker } from "@/components/tasks/create/person-pill-picker";
import { CreateTaskSubtasks, nextSubtaskDraftId } from "@/components/tasks/create/create-task-subtasks";
import { CREATE_TASK_MAX_SUBTASKS } from "@qcet/contracts/tasks";
import type { CreateTaskSubtaskSummary } from "@/lib/adapters/create-task-mapper";
import { TaskAgentPanel, useTaskAgentAvailable } from "@/components/tasks/create/task-agent-panel";
import { AgentIcon } from "@/components/icons/agent-icon";
import { TASK_AGENT_DESCRIPTION_MAX, type TaskAgentDraft } from "@qcet/shared/domain/tasks/task-agent-draft";
import {
  contentToPlainText,
  parseContentToBlocks,
  plainTextToContent,
  serializeBlocksToContent,
  type ContentBlockItem,
} from "@qcet/shared/lib/tasks/plate-block-codec";
import { uploadFile } from "@/lib/files/upload-file";
import { motionDuration } from "@/lib/motion/tokens";
import type { AssistantTaskProposal } from "@qcet/contracts/assistant";
import { proposalToTaskDraft } from "@qcet/shared/domain/assistant/assistant-task-proposal";

const DESCRIPTION_PLACEHOLDER = "Nội dung chỉ đạo, căn cứ pháp lý, yêu cầu kỹ thuật hoặc tiêu chí nghiệm thu. Gõ / để chèn khối";

/**
 * Chỗ giữ ô mô tả khi editor khối chưa gắn (đang nạp, hoặc hộp còn đang phóng to): cùng cỡ chữ, vị trí và độ mờ
 * placeholder của Plate (0,333) nên lúc editor thay vào không giật; có nội dung (khôi phục nháp) thì hiện bản chữ thuần.
 */
function DescriptionFallback({ value }: { value?: string }) {
  const text = value ? contentToPlainText(value) : "";
  return (
    <p aria-hidden="true" className={cn("min-h-[140px] whitespace-pre-line text-sm leading-relaxed", text ? "text-foreground" : "text-foreground/33")}>
      {text || DESCRIPTION_PLACEHOLDER}
    </p>
  );
}

// Editor khối (Plate) như mô tả ở chi tiết nhiệm vụ: nặng nên tách chunk, không kéo vào bundle của mọi trang có nút Tạo việc
const loadTaskBlockEditor = () => import("@/components/tasks/detail/task-block-editor");
const TaskBlockEditor = dynamic(() => loadTaskBlockEditor().then((m) => m.TaskBlockEditor), {
  ssr: false,
  loading: () => <DescriptionFallback />,
});

// Re-export types for downstream consumers
export type { CreateTaskPriority } from "@/hooks/use-create-task-form";

// ─── Visual Config ─────────────────────────────────────────────
const PRIORITY_CONFIG: Record<
  CreateTaskPriority,
  { label: string; color: string; bg: string; border: string; iconColor: string }
> = {
  NONE: {
    label: "Không ưu tiên",
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    iconColor: "text-muted-foreground",
  },
  URGENT: {
    label: "Khẩn cấp",
    color: "text-destructive",
    bg: "bg-danger-soft",
    border: "border-destructive/20",
    iconColor: "text-destructive",
  },
  HIGH: {
    label: "Cao",
    color: "text-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    iconColor: "text-foreground/70",
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

// Như menu ưu tiên của Linear: Không ưu tiên đứng đầu (mặc định khi mở hộp)
const PRIORITY_KEYS: CreateTaskPriority[] = ["NONE", "URGENT", "HIGH", "MEDIUM", "LOW"];

// Khớp CreateTaskInputSchema (title tối đa 255): dán dài hơn bị cắt, nên báo trước khi chạm giới hạn
const TITLE_MAX_LENGTH = 255;
const TITLE_COUNTER_FROM = 200;

// Biểu mẫu dùng MEDIUM, bảng dùng NORMAL: chuẩn hóa để icon tín hiệu khớp với bảng danh sách
const toSignalPriority = (p: CreateTaskPriority) => (p === "MEDIUM" ? "NORMAL" : p);

// ─── Props ─────────────────────────────────────────────────────
export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: (task: unknown) => void;
  /** Nhận nhiệm vụ vừa tạo từ server (có `id`), dùng khi cần liên kết ngay sau khi tạo; `subtasks` cho biết việc con lỗi
   *  một phần (hộp đã tự báo cảnh báo). */
  onCreated?: (task: { id: string; code?: string }, extra: { subtasks: CreateTaskSubtaskSummary | null }) => void;
  /** Mở từ chính văn bản (văn bản tự gắn sau khi tạo): không hiện chip chọn văn bản nguồn. */
  hideSourceDocument?: boolean;
  onSubmit?: (data: any, result?: any) => void | Promise<void>;
  initialDepartmentCode?: string;
  initialTitle?: string;
  initialLevel?: CreateTaskLevel;
  initialParentTaskId?: string;
  initialParentTaskTitle?: string;
  /** @deprecated Use initialLeadAssigneeId instead — kept for backward compat */
  initialLeadAssigneeName?: string;
  initialLeadAssigneeId?: string;
  initialDueDate?: string;
  /** Đề xuất của Trợ lý (ADR-010): điền sẵn form, tên người khớp với nhân sự đơn vị; người dùng vẫn tự bấm Tạo. */
  initialProposal?: AssistantTaskProposal;
  /**
   * Tệp của lượt hỏi Trợ lý sinh ra `initialProposal` (chỉ còn trong phiên): đính kèm cuối mô tả để người được giao đọc
   * được văn bản gốc, và đưa vào ô soạn của Agent để Agent làm tiếp có ngữ cảnh.
   */
  initialContextFiles?: File[];
}

/** "1.4 MB" như khối tệp của editor tự ghi khi người dùng chèn tệp. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ─────────────────────────────────────────────────
export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  onCreated,
  hideSourceDocument = false,
  onSubmit,
  initialDepartmentCode,
  initialTitle,
  initialLevel,
  initialParentTaskId,
  initialParentTaskTitle,
  initialLeadAssigneeId,
  initialDueDate,
  initialProposal,
  initialContextFiles,
}: CreateTaskModalProps) {
  // Văn bản nguồn chọn trong hộp: gắn vào nhiệm vụ ngay sau khi tạo xong (hộp đóng ngay nên đọc qua ref)
  const [sourceDocument, setSourceDocument] = React.useState<SourceDocumentOption | null>(null);
  const sourceDocumentRef = React.useRef<SourceDocumentOption | null>(null);
  sourceDocumentRef.current = sourceDocument;
  const { showToast } = useFeedback();
  // Đã bấm chọn đơn vị trong menu: chip hiện tên kể cả khi chọn đúng đơn vị mặc định (bấm mục đang chọn không đổi giá trị
  // nên trước đây chip vẫn ghi "Đơn vị", người dùng tưởng "không chọn được đơn vị" 21/10/2026)
  const [deptPicked, setDeptPicked] = React.useState(false);
  React.useEffect(() => {
    if (!isOpen) {
      setSourceDocument(null);
      setDeptPicked(false);
    }
  }, [isOpen]);
  const form = useCreateTaskForm({
    isOpen,
    initialLevel,
    // Có đề xuất thì tiêu đề, hạn vào form ngay lúc mở và không khôi phục nháp cũ (như initialTitle)
    initialTitle: initialTitle ?? initialProposal?.title,
    initialAssigneeId: initialLeadAssigneeId,
    initialDueDate: initialDueDate ?? initialProposal?.dueDate,
    initialDepartmentCode,
    parentTaskId: initialParentTaskId,
    onSuccess: (task, { subtasks }) => {
      const created = task as { id: string; code?: string };
      // Như lịch lặp lại (T-09): việc cha đã tạo, việc con lỗi thì báo để bổ sung ở trang nhiệm vụ
      if (subtasks && subtasks.failed.length > 0) {
        const names = subtasks.failed.map((f) => `"${f.title}"`).join(", ");
        showToast({
          variant: "warning",
          message: `Đã tạo nhiệm vụ và ${subtasks.created.length} việc con. Chưa tạo được ${subtasks.failed.length} việc con: ${names}. ${subtasks.failed[0].message}`,
          action: { label: "Mở nhiệm vụ", onClick: () => window.location.assign(`/tasks/${created.id}`) },
        });
      }
      const doc = sourceDocumentRef.current;
      if (doc) {
        void linkTaskToDocument(doc.id, created.id).then((ok) => {
          if (ok) return;
          showToast({
            variant: "warning",
            message: `Đã tạo nhiệm vụ nhưng chưa gắn được văn bản ${doc.number}. Văn bản có thể đã gắn nhiệm vụ khác hoặc bạn chưa có quyền.`,
            action: { label: "Mở nhiệm vụ", onClick: () => window.location.assign(`/tasks/${created.id}`) },
          });
        });
      }
      onCreated?.(created, { subtasks });
    },
  });

  // ── Local UI state ──────────────────────────────────────────
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);
  // Agent soạn nháp (panel bên phải như "Create with Agent" của Linear), chỉ màn rộng ≥ lg
  const agentAvailable = useTaskAgentAvailable(isOpen);
  const [agentOpen, setAgentOpen] = React.useState(false);
  // Ẩn panel vẫn giữ cuộc trò chuyện; đóng hộp mới bỏ
  const [agentStarted, setAgentStarted] = React.useState(false);
  const agentToggleRef = React.useRef<HTMLButtonElement>(null);
  // Mở sẵn panel Agent mỗi lần mở hộp (người dùng chọn 19/10/2026), chỉ màn ≥ lg vì panel ẩn dưới lg; bấm Ẩn thì giữ ẩn
  // tới khi đóng hộp. Con trỏ vẫn ở ô tên nhiệm vụ (`agentFocusOnMount`), bấm vào ô soạn mới chuyển sang Agent.
  // Layout effect: đặt trạng thái trước khi vẽ để hộp hiện thẳng ở bề rộng có panel, không nới ra ngay sau khi mở.
  const agentAutoOpenedRef = React.useRef(false);
  const [agentFocusOnMount, setAgentFocusOnMount] = React.useState(true);
  React.useLayoutEffect(() => {
    if (!isOpen) {
      agentAutoOpenedRef.current = false;
      setAgentOpen(false);
      setAgentStarted(false);
      setAgentFocusOnMount(true);
      return;
    }
    if (!agentAvailable || agentAutoOpenedRef.current || !window.matchMedia("(min-width: 64rem)").matches) return;
    agentAutoOpenedRef.current = true;
    setAgentFocusOnMount(false);
    setAgentStarted(true);
    setAgentOpen(true);
  }, [isOpen, agentAvailable]);
  const isPhone = useIsPhone();
  // Điện thoại: mở menu ưu tiên/đơn vị (không có ô nhập) thì bỏ focus ô đang gõ để bàn phím không che menu.
  // Menu chủ trì có ô tìm riêng nên giữ nguyên.
  React.useEffect(() => {
    if (!isPhone || !openDropdown || openDropdown === "dri" || openDropdown === "document") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches("input, textarea")) active.blur();
  }, [isPhone, openDropdown]);
  // Đọc nền tảng sau khi mount để không lệch HTML giữa server và client
  const [modKey, setModKey] = React.useState<"⌘" | "Ctrl">("Ctrl");
  React.useEffect(() => setModKey(getPlatformModifierKey()), []);

  const titleInputRef = React.useRef<HTMLTextAreaElement>(null);
  const descriptionRef = React.useRef<HTMLDivElement>(null);
  // Gắn editor khối khi hộp mở xong (desktop phóng to, điện thoại trượt lên đều dài --motion-duration-panel).
  // Đếm giờ thay cho onOpenChangeComplete: trên điện thoại hiệu ứng nằm ở khung con nên Popup báo xong ngay.
  const [editorMounted, setEditorMounted] = React.useState(false);
  React.useEffect(() => {
    if (!isOpen) {
      setEditorMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setEditorMounted(true), motionDuration.panel * 1000);
    return () => window.clearTimeout(timer);
  }, [isOpen]);
  // Nạp sẵn chunk editor lúc rảnh để lần mở đầu không phải chờ tải
  React.useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") return;
    const id = window.requestIdleCallback(() => void loadTaskBlockEditor());
    return () => window.cancelIdleCallback(id);
  }, []);
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const focusDescription = React.useCallback(() => {
    descriptionRef.current?.querySelector<HTMLElement>("[data-slate-editor]")?.focus();
  }, []);
  const leadTriggerRef = React.useRef<HTMLButtonElement>(null);

  // Tên dài (tiếng Việt thường 100+ ký tự) xuống dòng thay vì cuộn ngang trong ô một dòng
  const fitTitleHeight = React.useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  // Hộp mở sau khi gắn: ô chỉ có mặt khi Popup đã mount, nên đo cả lúc gắn ref (bản nháp khôi phục) lẫn khi gõ
  const setTitleRef = React.useCallback(
    (el: HTMLTextAreaElement | null) => {
      titleInputRef.current = el;
      fitTitleHeight(el);
    },
    [fitTitleHeight],
  );
  React.useLayoutEffect(() => fitTitleHeight(titleInputRef.current), [form.formData.title, fitTitleHeight]);
  // Tên đã điền sẵn (thẻ đề xuất của Trợ lý, nháp khôi phục): con trỏ đứng cuối tên để gõ tiếp, không ở đầu dòng
  const focusTitleEnd = React.useCallback(() => {
    const el = titleInputRef.current;
    el?.setSelectionRange(el.value.length, el.value.length);
    return el;
  }, []);
  // Xoay màn hình hoặc đổi cỡ cửa sổ làm đổi chỗ ngắt dòng: đo lại để không cắt dòng cuối
  React.useEffect(() => {
    if (!isOpen) return;
    const refit = () => fitTitleHeight(titleInputRef.current);
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, [isOpen, fitTitleHeight]);

  // Cmd/Ctrl+Enter to submit. Trình nghe gắn một lần khi mở nên gọi qua ref: closure lúc mở còn giữ form rỗng.
  const submitRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        submitRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // ── Handlers ────────────────────────────────────────────────
  const handleRequestClose = React.useCallback(() => {
    if (form.isSubmitting) return;
    // Đóng (nhấn ra ngoài hoặc Esc) = bỏ luôn nội dung đang soạn, không giữ bản nháp
    if (form.isDirty) form.handleClearDraft();
    onClose();
  }, [form, onClose]);

  // Kiểm tra không qua thì đưa focus tới ô sai đầu tiên (người dùng bàn phím/đọc màn hình không thấy chip đổi màu)
  const handleFormSubmit = React.useCallback(async () => {
    // Tệp từ Trợ lý đang tải lên: tạo lúc này thì nhiệm vụ thiếu tệp trong mô tả
    if (contextUploadingRef.current) return;
    const errors = await form.handleSubmit();
    if (!errors) return;
    if (errors.title) titleInputRef.current?.focus();
    else if (errors.lead) leadTriggerRef.current?.focus();
    else if (errors.startDate) document.getElementById("create-task-start-date")?.focus();
    else if (errors.dueDate) document.getElementById("create-task-due-date")?.focus();
  }, [form]);
  submitRef.current = handleFormSubmit;

  // React to submission outcome
  React.useEffect(() => {
    if (form.submissionOutcome === "created") {
      onSubmit?.(form.formData);
      onSubmitSuccess?.(form.formData);
      onClose();
    }
  }, [form.submissionOutcome]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived display values ──────────────────────────────────

  const currentDeptName = React.useMemo(() => {
    const dept = form.availableDepartments.find((d) => d.code === form.formData.selectedDeptCode);
    if (dept) return dept.name;
    // Danh sách rỗng sau khi đã tải xong (tài khoản chưa gắn đơn vị, hoặc tải lỗi) không phải đang tải
    return form.isLoadingDepartments ? "Đang tải…" : "Chưa có đơn vị";
  }, [form.availableDepartments, form.formData.selectedDeptCode, form.isLoadingDepartments]);

  const deptIsDefault =
    !deptPicked && (!form.formData.selectedDeptCode || form.formData.selectedDeptCode === form.defaultDeptCode);

  // Editor khối chỉ đọc giá trị lúc gắn: mô tả đổi từ bên ngoài (Agent điền, khôi phục nháp, làm mới form) thì gắn lại
  const editorDescriptionRef = React.useRef(form.formData.description);
  const [descriptionEditorKey, setDescriptionEditorKey] = React.useState(0);
  React.useEffect(() => {
    if (form.formData.description === editorDescriptionRef.current) return;
    editorDescriptionRef.current = form.formData.description;
    setDescriptionEditorKey((key) => key + 1);
  }, [form.formData.description]);
  const { setField } = form;
  const handleDescriptionChange = React.useCallback(
    (value: string) => {
      editorDescriptionRef.current = value;
      setField("description", value);
    },
    [setField],
  );

  // Agent chỉ điền form; người dùng vẫn tự bấm Tạo nhiệm vụ
  const applyAgentDraft = React.useCallback(
    (patch: TaskAgentDraft) => {
      const changed: Array<keyof TaskAgentDraft> = [];
      const { formData } = form;
      const apply = <K extends keyof TaskAgentDraft & keyof typeof formData>(key: K, value: (typeof formData)[K] | undefined) => {
        if (value === undefined || value === "" || value === formData[key]) return;
        form.setField(key, value);
        changed.push(key);
      };
      apply("title", patch.title?.slice(0, TITLE_MAX_LENGTH));
      // Agent trả chữ thuần: dòng "- "/"1. " thành danh sách của editor khối
      apply("description", patch.description ? plainTextToContent(patch.description) : undefined);
      apply("priority", patch.priority);
      apply("startDate", patch.startDate);
      apply("dueDate", patch.dueDate);
      // Chỉ nhận người chủ trì đang có trong danh sách của đơn vị đang chọn
      if (form.availablePersonnel.some((p) => p.id === patch.leadAssigneeId)) apply("leadAssigneeId", patch.leadAssigneeId);
      // Việc con Agent đề xuất: thêm vào cuối khối Việc con (không thay việc đã có), trong giới hạn 20;
      // chủ trì ngoài đơn vị hoặc hạn sau hạn nhiệm vụ thì để trống (việc con kế thừa nhiệm vụ)
      if (patch.subtasks?.length && !initialParentTaskId) {
        const room = CREATE_TASK_MAX_SUBTASKS - formData.subtasks.length;
        const parentDue = (patch.dueDate ?? formData.dueDate).slice(0, 10);
        // Bỏ việc trùng tên với việc đã có (Agent đôi khi trả lại cả danh sách)
        const titleKey = (title: string) => title.trim().toLocaleLowerCase("vi");
        const existing = new Set(formData.subtasks.map((item) => titleKey(item.title)));
        const fresh = patch.subtasks.filter((item) => !existing.has(titleKey(item.title)));
        const added = fresh.slice(0, Math.max(0, room)).map((item) => ({
          id: nextSubtaskDraftId(),
          title: item.title,
          description: item.description ?? "",
          assigneeId: item.assigneeId && form.availablePersonnel.some((p) => p.id === item.assigneeId) ? item.assigneeId : "",
          dueDate: item.dueDate && (!parentDue || item.dueDate <= parentDue) ? item.dueDate : "",
        }));
        if (added.length > 0) {
          form.setField("subtasks", [...formData.subtasks, ...added]);
          changed.push("subtasks");
        }
      }
      return changed;
    },
    [form, initialParentTaskId],
  );
  // Tệp từ Trợ lý: tải lên lần lượt (máy chủ giới hạn tần suất) rồi thêm khối tệp cuối mô tả đang có. Chạy sau khi đề
  // xuất đã điền vì điền mô tả thay cả nội dung; đóng hộp giữa chừng thì bỏ kết quả. Mọi loại tệp đều thành khối tệp:
  // khối ảnh chèn từ ngoài editor không có bản xem trước cục bộ, ảnh lúc soạn chưa tải lại được từ máy chủ.
  const [contextUpload, setContextUpload] = React.useState<{ pending: number; errors: string[] }>({ pending: 0, errors: [] });
  const contextUploadingRef = React.useRef(false);
  contextUploadingRef.current = contextUpload.pending > 0;
  const formRef = React.useRef(form);
  formRef.current = form;
  const contextRunRef = React.useRef(0);
  const attachContextFiles = React.useCallback(async (files: File[]) => {
    const run = ++contextRunRef.current;
    setContextUpload({ pending: files.length, errors: [] });
    const blocks: ContentBlockItem[] = [];
    const errors: string[] = [];
    for (const [index, file] of files.entries()) {
      try {
        const uploaded = await uploadFile(file);
        blocks.push({
          id: `context-file-${Date.now().toString(36)}-${index}`,
          type: "attachment",
          content: file.name,
          url: uploaded.fileUrl,
          fileName: file.name,
          fileSize: formatFileSize(file.size),
          fileType: file.name.split(".").pop()?.toUpperCase() || "TỆP",
        });
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "chưa tải lên được"}`);
      }
      if (run !== contextRunRef.current) return;
      setContextUpload((prev) => ({ ...prev, pending: prev.pending - 1 }));
    }
    if (run !== contextRunRef.current) return;
    if (blocks.length > 0) {
      const current = parseContentToBlocks(formRef.current.formData.description);
      formRef.current.setField("description", serializeBlocksToContent([...current, ...blocks]));
    }
    setContextUpload({ pending: 0, errors });
  }, []);
  const contextFilesRef = React.useRef<File[]>([]);
  contextFilesRef.current = initialContextFiles ?? [];
  React.useEffect(() => {
    if (isOpen) return;
    contextRunRef.current += 1;
    setContextUpload({ pending: 0, errors: [] });
  }, [isOpen]);

  // Phần còn lại của đề xuất điền một lần mỗi lần mở, sau khi danh sách nhân sự tải xong để khớp tên người. Chờ một
  // khung hình để chạy sau lần dựng lại form lúc mở: closure của lượt render mở hộp còn giữ form của lần mở trước.
  const applyAgentDraftRef = React.useRef(applyAgentDraft);
  applyAgentDraftRef.current = applyAgentDraft;
  const personnelRef = React.useRef(form.availablePersonnel);
  personnelRef.current = form.availablePersonnel;
  const appliedProposalRef = React.useRef<AssistantTaskProposal | null>(null);
  React.useEffect(() => {
    if (!isOpen) {
      appliedProposalRef.current = null;
      return;
    }
    if (!initialProposal || form.isLoadingDepartments || appliedProposalRef.current === initialProposal) return;
    const frame = requestAnimationFrame(() => {
      appliedProposalRef.current = initialProposal;
      applyAgentDraftRef.current(proposalToTaskDraft(initialProposal, personnelRef.current));
      if (contextFilesRef.current.length > 0) void attachContextFiles(contextFilesRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, initialProposal, form.isLoadingDepartments, attachContextFiles]);
  const closeAgent = React.useCallback(() => {
    setAgentOpen(false);
    requestAnimationFrame(() => agentToggleRef.current?.focus());
  }, []);

  // Thiếu chủ trì/hạn: chip tự đỏ lên, chữ lỗi chỉ dành cho trình đọc màn hình.
  // Ngày bắt đầu sau hạn thì cần chữ hiện ra mới biết sai ở đâu.
  const requiredErrorText = [form.fieldErrors.lead, form.fieldErrors.dueDate].filter(Boolean).join(" ");
  const fieldErrorText = form.fieldErrors.startDate;

  // Submission error message for banner
  const errorMessage = form.submissionOutcome === "rejected" || form.submissionOutcome === "unknown"
    ? form.submissionMessage
    : null;

  return (
    <>
      {/* ── Main Dialog ──────────────────────────────────────── */}
      <Dialog.Root
        open={isOpen}
        onOpenChange={(open, details) => {
          if (open) return;
          const target = details.event?.target instanceof Node ? details.event.target : null;
          // Esc trong ô mô tả chỉ thoát ô soạn (menu "/" tự đóng), không đóng hộp và bỏ nháp
          if (details.reason === "escape-key" && target && descriptionRef.current?.contains(target)) {
            if (target instanceof HTMLElement) target.blur();
            return;
          }
          // Menu "/", thanh định dạng của editor nằm ở portal ngoài hộp: chỉ nhấn vào nền mờ mới là nhấn ra ngoài
          if (details.reason === "outside-press" && target && !backdropRef.current?.contains(target)) return;
          handleRequestClose();
        }}
      >
        <Dialog.Portal keepMounted={isOpen}>
          <Dialog.Backdrop
            ref={backdropRef}
            className="fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 md:data-[ending-style]:duration-[var(--motion-duration-normal)]"
          />
          <Dialog.Popup
            // Mở hộp thì focus ngay ô tên (Base UI làm sau khi gắn), không chuyển focus giữa lúc hộp đang phóng to
            initialFocus={focusTitleEnd}
            className={cn(
              "group/dlg pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-3 py-[6vh] outline-none max-md:p-3 max-md:pt-[calc(env(safe-area-inset-top,0px)+47px)] max-md:pb-[max(calc(env(safe-area-inset-bottom,0px)+47px),calc(var(--keyboard-height,0px)+8px))]",
              // Desktop: phóng từ 95% kèm hiện dần như hộp của Linear (đo 16/10/2026: scale 0,95 → 1, xong ~200ms); điện thoại trượt lên ở khung bên dưới
              "md:transition-[opacity,scale] md:duration-[var(--motion-duration-panel)] md:ease-[var(--motion-ease-enter)] md:data-[starting-style]:scale-95 md:data-[starting-style]:opacity-0 md:data-[ending-style]:scale-95 md:data-[ending-style]:opacity-0 md:data-[ending-style]:duration-[var(--motion-duration-normal)] md:data-[ending-style]:ease-[var(--motion-ease-exit)]",
            )}
          >
            {/* Điện thoại: đẩy hộp lên khi bàn phím ảo hiện (như sheet chọn thuộc tính) */}
            {isOpen ? <SheetKeyboardSync /> : null}
            {/* Khung ngoài theo hộp New project của Linear (đo 16/10/2026): rộng 920px, cao hết màn trừ 6vh trên/dưới.
                Mở Agent thì nới rộng, chuyển nền màu sidebar và bọc thẻ form như "Create with Agent"
                (max-width 220ms trễ 80ms, nền 100ms; thẻ form thụt vào 8px, bo 12px = rounded-md) */}
            <div
              data-slot="create-task-shell"
              className={cn(
                "pointer-events-auto relative flex h-full w-full max-w-[920px] overflow-hidden rounded-2xl bg-background shadow-dialog border-0",
                "lg:[transition:max-width_220ms_cubic-bezier(0.43,0.07,0.59,0.94)_80ms,background-color_100ms_ease] motion-reduce:lg:[transition:none]",
                // 920 thẻ + 16 lề + 380 panel
                agentOpen && "lg:max-w-[1316px] lg:bg-sidebar",
                // Điện thoại: thẻ cao gần hết màn hình như hộp tạo mới của Linear
                "max-md:h-full max-md:max-h-none max-md:min-h-0",
                // Điện thoại: trượt lên từ đáy như sheet (dự án không nạp tw-animate nên dùng data-starting-style của Dialog)
                "max-md:transition-[translate,opacity] max-md:duration-[var(--motion-duration-panel)] max-md:ease-[var(--motion-ease-enter)] max-md:group-data-[starting-style]/dlg:translate-y-10 max-md:group-data-[starting-style]/dlg:opacity-0 max-md:group-data-[ending-style]/dlg:translate-y-10 max-md:group-data-[ending-style]/dlg:opacity-0 max-md:group-data-[ending-style]/dlg:duration-[var(--motion-duration-normal)] max-md:group-data-[ending-style]/dlg:ease-[var(--motion-ease-exit)] motion-reduce:max-md:transition-none",
              )}
            >
              {/* Thẻ form */}
              <div
                data-slot="create-task-modal"
                className={cn(
                  "relative flex w-full shrink-0 basis-full max-w-[920px] flex-col overflow-hidden bg-background",
                  "lg:[transition:max-width_220ms_cubic-bezier(0.43,0.07,0.59,0.94)_80ms,margin_220ms_cubic-bezier(0.43,0.07,0.59,0.94)_80ms,border-radius_220ms_cubic-bezier(0.43,0.07,0.59,0.94)_80ms,box-shadow_220ms_cubic-bezier(0.43,0.07,0.59,0.94)_80ms] motion-reduce:lg:[transition:none]",
                  // Màn lg hẹp (khung không nới đủ 1316px): thẻ co lại chừa chỗ panel, tính theo viewport để không co theo khung đang nới
                  agentOpen && "lg:m-2 lg:max-w-[min(920px,calc(100vw-420px))] lg:rounded-md lg:shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.09),0_3px_6px_-2px_rgb(0_0_0/0.02),0_1px_1px_0_rgb(0_0_0/0.04)]",
                )}
              >
                {/* ── Modal Top Header ──────────────────────────── */}
                <header className="flex shrink-0 items-center gap-2 px-5 pt-5 max-md:pt-3 md:pl-6">
                  {/* Breadcrumb như hộp Tạo cuộc họp (người dùng yêu cầu thêm lại 21/10/2026, thay quyết định bỏ ngày 17/10);
                      tiêu đề hộp cho trình đọc màn hình. Giao việc con thì nêu việc cha ở giữa cho rõ ngữ cảnh */}
                  <Dialog.Title className="sr-only">{initialParentTaskId ? "Giao việc con" : "Tạo nhiệm vụ"}</Dialog.Title>
                  <DialogBreadcrumb
                    items={
                      initialParentTaskTitle
                        ? ["Nhiệm vụ", <span key="parent" title={initialParentTaskTitle}>{initialParentTaskTitle}</span>, "Tạo việc con"]
                        : ["Nhiệm vụ", "Tạo mới"]
                    }
                  />

                  {agentAvailable && !agentOpen && (
                    <Button
                      ref={agentToggleRef}
                      variant="toolbar"
                      size="pill-xs"
                      onClick={() => {
                        setAgentStarted(true);
                        setAgentOpen(true);
                      }}
                      aria-expanded="false"
                      className="ml-auto shrink-0 max-lg:hidden"
                    >
                      <AgentIcon data-icon="inline-start" />
                      Tạo với Agent
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleRequestClose}
                    aria-label="Đóng"
                    title="Đóng (Esc)"
                    className={cn("ml-auto shrink-0 rounded-full max-md:size-8", agentAvailable && !agentOpen && "lg:ml-0", agentOpen && "lg:hidden")}
                  >
                    <X />
                  </Button>
                </header>

                {/* ── Restored Draft Banner ────────────────────── */}
                {form.hasRestoredDraft && (
                  <div className="mx-5 mt-3 flex shrink-0 items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                      <span>Đã tự động khôi phục bản nháp chưa lưu từ phiên làm việc trước.</span>
                    </div>
                    <Pressable
                      onClick={form.handleClearDraft}
                      className="inline-flex shrink-0 items-center whitespace-nowrap max-md:min-h-8 text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
                    >
                      Xóa bản nháp
                    </Pressable>
                  </div>
                )}

                {/* Lỗi gửi: nằm ngoài vùng cuộn để luôn thấy dù đang cuộn mô tả dài */}
                {errorMessage && (
                  <div className="px-5 sm:px-6 pt-3 shrink-0">
                    <InlineAlert variant="error" aria-live="assertive">
                      {errorMessage}
                    </InlineAlert>
                  </div>
                )}
                {contextUpload.errors.length > 0 && (
                  <div className="px-5 sm:px-6 pt-3 shrink-0">
                    <InlineAlert variant="warning">
                      Chưa đính kèm được tệp từ Trợ lý vào mô tả. {contextUpload.errors.join("; ")}
                    </InlineAlert>
                  </div>
                )}

                {/* ── Thân: tên, hàng thuộc tính, mô tả (thứ tự như hộp New project của Linear) ── */}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-4 md:px-6">
                  {/* 1. Task Title (P0 Field) */}
                  <div className="space-y-0.5 shrink-0">
                    <label htmlFor="create-task-title" className="sr-only">
                      {initialParentTaskId ? "Tên việc con" : "Tên nhiệm vụ"}
                    </label>
                    {/* design-lint-ignore no-raw-control: tiêu đề không viền hòa vào trang, ui/Textarea ép nền, đệm và bộ đếm */}
                    <textarea
                      id="create-task-title"
                      ref={setTitleRef}
                      rows={1}
                      // Giữ 20px trên điện thoại (không bị quy tắc chống phóng to ép về 16px)
                      data-large-text
                      name="task-title"
                      autoComplete="off"
                      value={form.formData.title}
                      maxLength={TITLE_MAX_LENGTH}
                      aria-required="true"
                      aria-invalid={Boolean(form.fieldErrors.title)}
                      aria-describedby={form.fieldErrors.title ? "create-task-title-error" : undefined}
                      onChange={(e) => {
                        form.setField("title", e.target.value.replace(/\s*\n+\s*/g, " "));
                        if (form.fieldErrors.title) {
                          form.setFieldErrors((prev) => ({ ...prev, title: undefined }));
                        }
                      }}
                      onKeyDown={(e) => {
                        // Gõ Telex/IME: Enter chốt âm tiết đang soạn, không phải lệnh chuyển ô
                        if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          focusDescription();
                        }
                      }}
                      placeholder={initialParentTaskId ? "Tên việc con" : "Tên nhiệm vụ"}
                      className={cn(
                        "block w-full resize-none overflow-hidden text-2xl font-semibold text-foreground placeholder:text-faint bg-transparent border-0 p-0 focus:outline-none focus:ring-0 leading-normal max-md:text-xl",
                        form.fieldErrors.title && "placeholder:text-destructive/60 text-destructive",
                      )}
                    />
                    {form.fieldErrors.title && (
                      <p id="create-task-title-error" role="alert" className="text-xs text-destructive font-medium">
                        {form.fieldErrors.title}
                      </p>
                    )}
                    {form.formData.title.length >= TITLE_COUNTER_FROM && (
                      <p
                        aria-live="polite"
                        className={cn(
                          "text-xs tabular-nums",
                          form.formData.title.length >= TITLE_MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {form.formData.title.length}/{TITLE_MAX_LENGTH} ký tự
                      </p>
                    )}
                  </div>

                  {/* 2. Thuộc tính: pill ngay dưới tên, luôn thấy kể cả khi mô tả dài */}
                  <div className="mt-2.5 flex shrink-0 flex-wrap items-center gap-2">
                    {/* 3.0 Đơn vị chủ trì, luôn hiện (người dùng yêu cầu 21/10/2026): mặc định đơn vị của người tạo; người không thuộc
                        lãnh đạo chỉ có đơn vị mình (máy chủ chặn tạo ngoài đơn vị). Đổi đơn vị thì xóa chủ trì đã chọn và mở luôn
                        danh sách nhân sự của đơn vị mới: chọn đơn vị → chọn người chủ trì. */}
                    {(form.availableDepartments.length > 0 || form.isLoadingDepartments) && (
                    <Select.Root
                      value={form.formData.selectedDeptCode}
                      open={openDropdown === "dept"}
                      onOpenChange={(open, details) => {
                        setOpenDropdown(open ? "dept" : null);
                        if (!open && details.reason === "item-press") {
                          setDeptPicked(true);
                          // Chọn lại đúng đơn vị đang có mà chưa có chủ trì: vẫn đi tiếp sang chọn người như khi đổi đơn vị
                          if (!form.formData.leadAssigneeId) window.setTimeout(() => setOpenDropdown("dri"), 0);
                        }
                      }}
                      onValueChange={(code) => {
                        if (!code || code === form.formData.selectedDeptCode) return;
                        form.setField("selectedDeptCode", code);
                        form.setField("leadAssigneeId", "");
                        // Sau khi menu đơn vị đóng (cùng lượt bấm nó đặt openDropdown về null)
                        window.setTimeout(() => setOpenDropdown("dri"), 0);
                      }}
                    >
                        {/* Chưa bấm chọn và đang ở đơn vị mặc định thì chỉ ghi "Đơn vị" mờ như các chip chưa chọn (người dùng: "để mỗi chữ
                            đơn vị thôi rồi chọn cho đẹp" 21/10/2026); bấm chọn (kể cả đơn vị mặc định) thì hiện tên. Tên đầy đủ luôn ở
                            tooltip và nhãn đọc màn hình. */}
                        <Select.Trigger
                          aria-label={`Đơn vị: ${currentDeptName}`}
                          title={`Đơn vị: ${currentDeptName}`}
                          disabled={form.availableDepartments.length === 0}
                          className={cn(PROPERTY_PILL_CLASS, deptIsDefault && "text-muted-foreground")}
                        >
                          <Building2 className="text-muted-foreground" />
                          <span className="max-w-[240px] truncate max-md:max-w-[120px]">{deptIsDefault ? "Đơn vị" : currentDeptName}</span>
                        </Select.Trigger>

                        <Select.Portal>
                          <Select.Backdrop className={SHEET_BACKDROP_CLASS} />
                          <Select.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)} side="bottom" align="start" sideOffset={4} collisionPadding={12} alignItemWithTrigger={false}>
                            <Select.Popup
                              style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
                              className={cn("w-64", MENU_POPUP_CLASS, SHEET_POPUP_CLASS)}
                              aria-label="Chọn đơn vị phòng ban"
                            >
                              <MenuSheetHeader title="Đơn vị" />
                              <Select.List>
                                {form.availableDepartments.map((dept) => (
                                  <Select.Item key={dept.code} value={dept.code} className={MENU_OPTION_ROW_CLASS}>
                                    <Select.ItemText className="truncate">{dept.name}</Select.ItemText>
                                  </Select.Item>
                                ))}
                              </Select.List>
                            </Select.Popup>
                          </Select.Positioner>
                        </Select.Portal>
                    </Select.Root>
                    )}

                    {/* 3.1 Lead Assignee (DRI) Chip (P0 Field) */}
                    <PersonPillPicker
                      people={form.availablePersonnel}
                      valueId={form.formData.leadAssigneeId}
                      onSelect={(person) => {
                        form.setField("leadAssigneeId", person.id);
                        if (form.fieldErrors.lead) form.setFieldErrors((prev) => ({ ...prev, lead: undefined }));
                      }}
                      open={openDropdown === "dri"}
                      onOpenChange={(open) => setOpenDropdown(open ? "dri" : null)}
                      loading={form.isLoadingDepartments}
                      invalid={Boolean(form.fieldErrors.lead)}
                      required
                      compactWhenEmpty
                      triggerRef={leadTriggerRef}
                    />

                    {/* 3.2 Start Date Chip */}
                    <VietnameseDatePicker
                      id="create-task-start-date"
                      value={form.formData.startDate}
                      onChange={(val) => form.setField("startDate", val)}
                      label={form.formData.startDate ? "Bắt đầu:" : undefined}
                      variant="pill"
                      // Bọc inline-block lệch dòng 1px so với các pill khác trong hàng flex
                      className="flex"
                      compactWhenEmpty
                      error={Boolean(form.fieldErrors.startDate)}
                      icon={<Calendar className="text-muted-foreground" />}
                      placeholder="Bắt đầu"
                    />

                    {/* 3.3 Target Due Date Chip (P0 Field) */}
                    <VietnameseDatePicker
                      id="create-task-due-date"
                      value={form.formData.dueDate}
                      required
                      onChange={(val) => {
                        form.setField("dueDate", val);
                        if (form.fieldErrors.dueDate) {
                          form.setFieldErrors((prev) => ({ ...prev, dueDate: undefined }));
                        }
                      }}
                      label={form.formData.dueDate ? "Hạn:" : undefined}
                      variant="pill"
                      className="flex"
                      compactWhenEmpty
                      error={Boolean(form.fieldErrors.dueDate)}
                      icon={<CalendarClock className={form.fieldErrors.dueDate ? "text-destructive" : "text-muted-foreground"} />}
                      // Nhãn ngắn như "Target" của Linear; tooltip và tên đọc màn hình vẫn là "Hạn hoàn thành"
                      placeholder="Hạn"
                      title="Hạn hoàn thành"
                    />

                    {/* 3.4 Priority Chip: đứng ngay trước Văn bản (người dùng chọn 16/10/2026) */}
                    <Select.Root
                      value={form.formData.priority}
                      open={openDropdown === "priority"}
                      onOpenChange={(open) => setOpenDropdown(open ? "priority" : null)}
                      onValueChange={(p) => {
                        if (p) form.setField("priority", p);
                      }}
                    >
                        <Select.Trigger
                          aria-label={`Mức ưu tiên: ${PRIORITY_CONFIG[form.formData.priority].label}`}
                          title={`Mức ưu tiên: ${PRIORITY_CONFIG[form.formData.priority].label}`}
                          className={cn(PROPERTY_PILL_CLASS, "max-md:aspect-square max-md:gap-0 max-md:px-0")}
                        >
                          {/* Icon 14px như các chip bên cạnh (component vẽ sẵn 16px) */}
                          <PrioritySignalBars priority={toSignalPriority(form.formData.priority)} className="shrink-0 [&_svg]:size-3.5" />
                          <span className="max-md:hidden">{PRIORITY_CONFIG[form.formData.priority].label}</span>
                        </Select.Trigger>

                        <Select.Portal>
                          <Select.Backdrop className={SHEET_BACKDROP_CLASS} />
                          <Select.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)} side="bottom" align="start" sideOffset={4} collisionPadding={12} alignItemWithTrigger={false}>
                            <Select.Popup
                              style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
                              className={cn("w-56", MENU_POPUP_CLASS, SHEET_POPUP_CLASS)}
                              aria-label="Chọn mức độ ưu tiên"
                            >
                              <MenuSheetHeader title="Mức ưu tiên" />
                              <Select.List>
                                {PRIORITY_KEYS.map((p) => (
                                  <Select.Item key={p} value={p} className={MENU_OPTION_ROW_CLASS}>
                                    <PrioritySignalBars priority={toSignalPriority(p)} className="shrink-0" />
                                    <Select.ItemText>{PRIORITY_CONFIG[p].label}</Select.ItemText>
                                  </Select.Item>
                                ))}
                              </Select.List>
                            </Select.Popup>
                          </Select.Positioner>
                        </Select.Portal>
                    </Select.Root>

                    {/* 3.5 Văn bản nguồn (chỉ nhiệm vụ gốc, và khi không mở từ chính văn bản) */}
                    {!hideSourceDocument && !initialParentTaskId ? (
                      <SourceDocumentChip
                        value={sourceDocument}
                        onChange={setSourceDocument}
                        open={openDropdown === "document"}
                        onOpenChange={(open) => setOpenDropdown(open ? "document" : null)}
                      />
                    ) : null}
                  </div>
                  {requiredErrorText && (
                    <p role="alert" className="sr-only">
                      {requiredErrorText}
                    </p>
                  )}
                  {fieldErrorText && (
                    <p role="alert" className="mt-1.5 shrink-0 text-xs font-medium text-destructive">
                      {fieldErrorText}
                    </p>
                  )}

                  {/* 3. Mô tả: kẻ ngang ngăn với phần thuộc tính, chiếm hết phần còn lại như hộp New project của Linear */}
                  <div className="mt-5 flex min-h-[160px] flex-1 flex-col border-t border-border/60 pt-6 pb-4 max-md:mt-4 max-md:pt-4">
                    <div id="create-task-description" ref={descriptionRef} className="flex min-h-[140px] flex-1 flex-col">
                      {/* Gắn editor sau khi hộp phóng to xong: dựng Plate mất ~60ms, chạy giữa hiệu ứng mở làm khựng khung hình */}
                      {!editorMounted ? (
                        <DescriptionFallback value={form.formData.description} />
                      ) : (
                        <TaskBlockEditor
                          key={descriptionEditorKey}
                          variant="compose"
                          taskId="create-task-description"
                          initialDescription={form.formData.description}
                          onSaveContent={handleDescriptionChange}
                          globalFileDrop={false}
                          ariaLabel="Mô tả chi tiết nhiệm vụ"
                          placeholder={DESCRIPTION_PLACEHOLDER}
                        />
                      )}
                    </div>
                  </div>

                  {/* 4. Việc con tạo kèm (như Milestones của Linear); đang giao việc con thì không có */}
                  {!initialParentTaskId && (
                    <CreateTaskSubtasks
                      items={form.formData.subtasks}
                      onChange={(items) => form.setField("subtasks", items)}
                      people={form.availablePersonnel}
                      loadingPeople={form.isLoadingDepartments}
                      parentLeadId={form.formData.leadAssigneeId}
                      parentDueDate={form.formData.dueDate}
                      error={form.fieldErrors.subtasks}
                      className="mb-4 shrink-0"
                    />
                  )}
                </div>

                {/* ── Modal Bottom Footer ──────────────────────── */}
                <footer className="flex shrink-0 items-center justify-between border-t border-border/60 bg-background px-5 py-3">
                  {/* Chỉ nút chính; đóng bằng Esc hoặc nhấn ra ngoài */}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      size="pill"
                      onClick={handleFormSubmit}
                      loading={form.isSubmitting || contextUpload.pending > 0}
                      // Luôn bấm được như Linear: thiếu tên thì báo lỗi và đưa con trỏ về ô tên, không để nút mờ không rõ lý do
                      aria-keyshortcuts="Meta+Enter Control+Enter"
                      title={`${modKey} + Enter`}
                      className="max-md:px-4"
                    >
                      <span>
                        {form.isSubmitting
                          ? initialParentTaskId ? "Đang giao việc…" : "Đang tạo…"
                          : contextUpload.pending > 0 ? "Đang đính kèm tệp…"
                          : initialParentTaskId ? "Giao việc con" : "Tạo nhiệm vụ"}
                      </span>
                      {/* Phím tắt nằm gọn trong nút, nhạt hơn nhãn */}
                      {form.isSubmitting || contextUpload.pending > 0 ? null : (
                        <kbd className="hidden sm:inline font-sans text-micro text-primary-foreground/60" aria-hidden="true">
                          {modKey === "⌘" ? "⌘↵" : "Ctrl ↵"}
                        </kbd>
                      )}
                    </Button>

                  </div>
                </footer>
              </div>
              {agentStarted && (
                <TaskAgentPanel
                  departmentName={currentDeptName}
                  parentTaskTitle={initialParentTaskTitle}
                  personnel={form.availablePersonnel.map((p) => ({ id: p.id, name: p.name, position: p.position ?? p.title ?? null }))}
                  draft={{
                    title: form.formData.title,
                    // Mô tả lưu dạng khối (JSON): gửi Agent bản chữ thuần cho gọn
                    description: contentToPlainText(form.formData.description).slice(0, TASK_AGENT_DESCRIPTION_MAX),
                    priority: form.formData.priority,
                    leadAssigneeId: form.formData.leadAssigneeId || undefined,
                    startDate: form.formData.startDate || undefined,
                    dueDate: form.formData.dueDate || undefined,
                    // Việc con đang có (không kèm mô tả cho gọn): Agent chỉ thêm việc mới, không trùng
                    subtasks: initialParentTaskId
                      ? undefined
                      : form.formData.subtasks.map((item) => ({
                          title: item.title,
                          assigneeId: item.assigneeId || undefined,
                          dueDate: item.dueDate || undefined,
                        })),
                  }}
                  onApply={applyAgentDraft}
                  initialFiles={initialContextFiles}
                  onHide={closeAgent}
                  onClose={handleRequestClose}
                  inactive={!agentOpen}
                  focusOnMount={agentFocusOnMount}
                  className={cn(
                    "w-[380px] shrink-0 max-lg:hidden",
                    // Hiện dần khi khung đã nới ra; Ẩn thì rời luồng (nằm ngoài mép phải, bị khung cắt) để khung thu lại mượt
                    agentOpen
                      ? "lg:transition-opacity lg:duration-200 lg:delay-100 starting:opacity-0 motion-reduce:lg:transition-none"
                      : "absolute top-0 left-full h-full opacity-0",
                  )}
                />
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>

        <Dialog.Description className="sr-only">
          Biểu mẫu tạo nhiệm vụ mới
        </Dialog.Description>
      </Dialog.Root>
    </>
  );
}

export default CreateTaskModal;
