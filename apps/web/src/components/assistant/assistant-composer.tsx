"use client";

import * as React from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { ASSISTANT_MESSAGE_MAX } from "@qcet/contracts/assistant";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Textarea } from "@/components/ui/textarea";
import { isSendKey, isStopKey } from "@/components/assistant/assistant-model";
import { AgentModelPicker } from "@/components/agent-chat/agent-model-picker";
import { AttachmentCard, type ChatAttachment } from "@/components/agent-chat/agent-attachments";
import { TASK_AGENT_ATTACHMENT_ACCEPT } from "@qcet/shared/domain/tasks/task-agent-attachments";

/** Viền mảnh và bóng rất nhẹ của thẻ soạn, như thẻ ô soạn của Linear. */
const COMPOSER_RING = "shadow-[0_0_0_0.5px_rgb(0_0_0/0.09),0_3px_6px_-2px_rgb(0_0_0/0.02),0_1px_1px_0_rgb(0_0_0/0.04)]";

export interface AssistantComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  pending: boolean;
  disabled: boolean;
  /** Mục đang hỏi chưa gửi (chip); bỏ đi thì không gắn vào lượt sau. */
  context: { label: string; onRemove: () => void } | null;
  error: string | null;
  /** hero: màn đầu cuộc trò chuyện (ô hai dòng); dock: ô dính đáy khi đã có tin. */
  variant?: "hero" | "dock";
  /** Ref của khung cha để đưa tiêu điểm về ô nhập sau khi gửi bằng gợi ý (nút gợi ý biến mất khi có tin). */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /**
   * Khung chat nổi trên trang khác: Esc chỉ dừng lượt khi tiêu điểm trong khung này, kẻo Esc để đóng menu hay bỏ chọn
   * của trang làm hủy lượt. Trang Trợ lý không truyền: Esc ở đâu cũng dừng.
   */
  stopScope?: React.RefObject<HTMLElement | null>;
  /** Ảnh/tệp chờ gửi kèm lượt sau. Không truyền `onAddAttachments` thì không có nút ghim, dán hay kéo thả tệp. */
  attachments?: ChatAttachment[];
  onAddAttachments?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
}

/**
 * Thẻ soạn của Trợ lý: Enter gửi, Shift+Enter xuống dòng, an toàn IME; đang trả lời thì nút Dừng (và Esc) hủy lượt.
 * Một thẻ cho cả hai trạng thái để ô nhập giữ nguyên vị trí trong cây giao diện (không mất tiêu điểm khi chuyển).
 */
export function AssistantComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  pending,
  disabled,
  context,
  error,
  variant = "dock",
  inputRef: externalInputRef,
  stopScope,
  attachments = [],
  onAddAttachments,
  onRemoveAttachment,
}: AssistantComposerProps) {
  const ownInputRef = React.useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef ?? ownInputRef;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const [dragging, setDragging] = React.useState(false);
  const acceptsFiles = Boolean(onAddAttachments) && !disabled;
  // Chỉ gửi tệp cũng được: lượt mang câu mặc định "Tóm tắt tệp đính kèm."
  const canSend = (Boolean(value.trim()) || attachments.length > 0) && !disabled;

  // Esc dừng lượt đang chạy; ô đang có Esc riêng (đổi tên) đã chặn sự kiện thì bỏ qua; đang chốt IME thì không dừng
  React.useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isStopKey(event)) return;
      if (stopScope && !(event.target instanceof Node && stopScope.current?.contains(event.target))) return;
      onStop();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, onStop, stopScope]);

  const submit = () => {
    if (!canSend || pending) return;
    onSubmit();
    inputRef.current?.focus();
  };

  const addFiles = (list: FileList) => {
    if (!onAddAttachments || list.length === 0) return;
    onAddAttachments(Array.from(list));
    inputRef.current?.focus();
  };

  return (
    <div className="flex w-full flex-col gap-2" data-slot="assistant-composer" data-variant={variant}>
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      {/* Kéo thả ảnh/tệp vào thẻ soạn như panel Agent tạo nhiệm vụ */}
      <div
        className={cn("relative flex flex-col gap-1 rounded-xl bg-background p-2", COMPOSER_RING)}
        onDragOver={(e) => {
          if (!acceptsFiles || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          setDragging(false);
          if (!acceptsFiles || e.dataTransfer.files.length === 0) return;
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-1 pt-1">
            {attachments.map((a) => (
              <AttachmentCard key={a.id} attachment={a} compact onRemove={onRemoveAttachment ? () => onRemoveAttachment(a.id) : undefined} />
            ))}
          </div>
        ) : null}
        <label htmlFor={inputId} className="sr-only">
          Hỏi Trợ lý
        </label>
        {/* overflow-y-auto đứng sau overflow-hidden của autoResize trong CSS (Tailwind v4 xếp theo thuộc tính) nên thắng */}
        <Textarea
          id={inputId}
          ref={inputRef}
          compact
          autoResize
          rows={variant === "hero" ? 2 : 1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (!isSendKey(e.nativeEvent)) return;
            // Enter gửi; chặn mặc định để không xuống dòng
            e.preventDefault();
            submit();
          }}
          // Dán ảnh chụp màn hình hoặc tệp vào ô soạn
          onPaste={(e) => {
            if (!acceptsFiles || e.clipboardData.files.length === 0) return;
            e.preventDefault();
            addFiles(e.clipboardData.files);
          }}
          maxLength={ASSISTANT_MESSAGE_MAX}
          countOnlyNearLimit
          disabled={disabled}
          placeholder="Hỏi về nhiệm vụ, văn bản, lịch họp…"
          className="max-h-40 overflow-y-auto bg-transparent px-1 hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none"
        />

        <div className="flex min-w-0 items-center gap-2">
          {context ? (
            <div className="flex min-w-0 items-center gap-1 rounded-md bg-muted py-0.5 pl-2 pr-0.5 text-xs text-muted-foreground">
              <span className="shrink-0">Đang hỏi về:</span>
              <span className="min-w-0 truncate text-foreground">{context.label}</span>
              {/* Điện thoại: vùng chạm 44px nhưng chip không cao thêm (âm lề bù phần thừa) */}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={context.onRemove}
                aria-label="Bỏ mục đang hỏi"
                title="Bỏ mục đang hỏi"
                className="size-5 shrink-0 rounded-full sm:size-5 max-md:-my-3 max-md:-mr-2 max-md:size-11"
              >
                <X />
              </Button>
            </div>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <AgentModelPicker className="max-md:h-11" />
            {onAddAttachments ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  aria-label="Đính kèm ảnh hoặc tệp"
                  title="Đính kèm ảnh hoặc tệp (ảnh, PDF, Word, Excel, TXT, CSV; kéo thả hoặc dán cũng được)"
                  className="rounded-full text-muted-foreground max-md:size-11"
                >
                  <Paperclip />
                </Button>
                {/* design-lint-ignore no-raw-control: ô chọn tệp ẩn, mở bằng nút ghim bên trên */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={TASK_AGENT_ATTACHMENT_ACCEPT}
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </>
            ) : null}
            {pending ? (
              <Button variant="toolbar" size="icon-sm" onClick={onStop} aria-label="Dừng" title="Dừng (Esc)" className="rounded-full max-md:size-11">
                <Square className="size-3 fill-current" />
              </Button>
            ) : (
              <Button
                variant={canSend ? "default" : "toolbar"}
                size="icon-sm"
                onClick={submit}
                disabled={!canSend}
                aria-label="Gửi cho Trợ lý"
                title="Gửi (Enter)"
                className="rounded-full max-md:size-11"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>

        {dragging ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-background/85 text-compact font-medium text-foreground">
            Thả ảnh hoặc tệp để gửi cho Trợ lý
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Chân trang chỉ đọc, dưới ô soạn ở cả hai trạng thái. */
export function AssistantFootnote() {
  return (
    <p className="shrink-0 px-4 pb-3 pt-1 text-center text-xs text-muted-foreground md:px-6" data-slot="assistant-footnote">
      Trợ lý AI chỉ đọc dữ liệu Thầy/Cô được xem và có thể sai. Kiểm tra lại ở nguồn.
    </p>
  );
}
