"use client";

import * as React from "react";
import { ArrowUp, Paperclip, Sparkles, Square, X } from "lucide-react";
import { ASSISTANT_MESSAGE_MAX, type AssistantSkillDTO } from "@qcet/contracts/assistant";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MENU_OPTION_ROW_CLASS, MENU_POPUP_CLASS } from "@/components/ui/menu";
import { Pressable } from "@/components/ui/pressable";
import { Textarea } from "@/components/ui/textarea";
import { foldSkillText, useAssistantSkills } from "@/components/assistant/use-assistant-skills";
import { isSendKey, isStopKey } from "@/components/assistant/assistant-model";
import { AgentModelPicker } from "@/components/agent-chat/agent-model-picker";
import { AttachmentCard, type ChatAttachment } from "@/components/agent-chat/agent-attachments";
import { AGENT_COMPOSER_CLASS, AGENT_COMPOSER_INPUT_CLASS, AgentDropOverlay } from "@/components/agent-chat/agent-chat-parts";
import { TASK_AGENT_ATTACHMENT_ACCEPT } from "@qcet/shared/domain/tasks/task-agent-attachments";

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
  /**
   * Kỹ năng (ADR-012): gõ "/" ở đầu ô mở menu kỹ năng đã lưu, chọn thì chữ của kỹ năng thay vào ô và `onPickSkill` nhận
   * kỹ năng đó. Không truyền thì không có menu.
   */
  onPickSkill?: (skill: AssistantSkillDTO) => void;
  /** Kỹ năng đang dùng cho lượt sau (chip, bỏ được). */
  selectedSkill?: { name: string; onRemove: () => void } | null;
}

/** Số kỹ năng hiện trong menu "/"; gõ thêm chữ để lọc. */
const SKILL_MENU_LIMIT = 8;

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
  onPickSkill,
  selectedSkill = null,
}: AssistantComposerProps) {
  const ownInputRef = React.useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef ?? ownInputRef;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const [dragging, setDragging] = React.useState(false);
  const acceptsFiles = Boolean(onAddAttachments) && !disabled;
  // Chỉ gửi tệp cũng được: lượt mang câu mặc định "Tóm tắt tệp đính kèm."
  const canSend = (Boolean(value.trim()) || attachments.length > 0) && !disabled;

  // Menu kỹ năng: ô bắt đầu bằng "/" và chưa xuống dòng; Esc đóng tới khi chữ đổi
  const menuId = React.useId();
  const [skillMenuClosedFor, setSkillMenuClosedFor] = React.useState<string | null>(null);
  const [highlight, setHighlight] = React.useState(0);
  const slashQuery = onPickSkill && value.startsWith("/") && !value.includes("\n") ? value.slice(1) : null;
  const skillMenuOpen = slashQuery !== null && skillMenuClosedFor !== value && !disabled;
  const skills = useAssistantSkills(skillMenuOpen);
  const matches = React.useMemo(() => {
    if (slashQuery === null || !skills) return [];
    const query = foldSkillText(slashQuery.trim());
    return skills.filter((skill) => foldSkillText(skill.name).includes(query)).slice(0, SKILL_MENU_LIMIT);
  }, [skills, slashQuery]);
  const activeIndex = Math.min(highlight, Math.max(0, matches.length - 1));
  const pickSkill = (skill: AssistantSkillDTO) => {
    onChange(skill.prompt);
    onPickSkill?.(skill);
    setHighlight(0);
    inputRef.current?.focus();
  };

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
        className={cn("relative", AGENT_COMPOSER_CLASS)}
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
          <div data-image-viewer-group="" className="flex flex-wrap gap-1.5 px-1 pt-1">
            {attachments.map((a) => (
              <AttachmentCard key={a.id} attachment={a} compact onRemove={onRemoveAttachment ? () => onRemoveAttachment(a.id) : undefined} />
            ))}
          </div>
        ) : null}
        <label htmlFor={inputId} className="sr-only">
          Hỏi Trợ lý
        </label>
        <Textarea
          id={inputId}
          ref={inputRef}
          compact
          variant="bare"
          autoResize
          rows={variant === "hero" ? 2 : 1}
          value={value}
          onChange={(e) => {
            setHighlight(0);
            onChange(e.target.value);
          }}
          role={skillMenuOpen ? "combobox" : undefined}
          aria-expanded={skillMenuOpen ? true : undefined}
          aria-controls={skillMenuOpen ? menuId : undefined}
          aria-activedescendant={skillMenuOpen && matches.length > 0 ? `${menuId}-${activeIndex}` : undefined}
          onKeyDown={(e) => {
            if (skillMenuOpen && !e.nativeEvent.isComposing) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (matches.length > 0) setHighlight((activeIndex + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
                return;
              }
              if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey && matches[activeIndex]) {
                e.preventDefault();
                pickSkill(matches[activeIndex]);
                return;
              }
              if (e.key === "Escape") {
                // Esc chỉ đóng menu, không dừng lượt hay đóng khung
                e.preventDefault();
                e.stopPropagation();
                setSkillMenuClosedFor(value);
                return;
              }
            }
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
          className={AGENT_COMPOSER_INPUT_CLASS}
        />

        <div className="flex min-w-0 items-center gap-2">
          {selectedSkill ? (
            <div className="flex min-w-0 items-center gap-1 rounded-md bg-muted py-0.5 pl-2 pr-0.5 text-xs text-muted-foreground">
              <Sparkles className="size-3 shrink-0" aria-hidden />
              <span className="min-w-0 truncate text-foreground">{selectedSkill.name}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={selectedSkill.onRemove}
                aria-label="Bỏ kỹ năng"
                title="Bỏ kỹ năng"
                className="size-5 shrink-0 rounded-full sm:size-5 max-md:-my-3 max-md:-mr-2 max-md:size-11"
              >
                <X />
              </Button>
            </div>
          ) : null}
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

        {skillMenuOpen ? (
          <div
            id={menuId}
            role="listbox"
            aria-label="Kỹ năng"
            className={cn(MENU_POPUP_CLASS, "absolute bottom-full left-0 mb-2 flex w-64 flex-col")}
          >
            {skills === null ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Đang tải kỹ năng…</p>
            ) : matches.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {skills.length === 0 ? "Chưa có kỹ năng. Lưu một câu hỏi thành kỹ năng bằng nút trên câu hỏi đó." : "Không có kỹ năng khớp."}
              </p>
            ) : (
              matches.map((skill, index) => (
                <Pressable
                  key={skill.id}
                  id={`${menuId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  tabIndex={-1}
                  data-highlighted={index === activeIndex ? "" : undefined}
                  // Giữ tiêu điểm ở ô soạn khi bấm chuột
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pickSkill(skill)}
                  className={MENU_OPTION_ROW_CLASS}
                >
                  <Sparkles className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate" title={skill.name}>
                    {skill.name}
                  </span>
                </Pressable>
              ))
            )}
          </div>
        ) : null}

        {dragging ? (
          <AgentDropOverlay>Thả ảnh hoặc tệp để gửi cho Trợ lý</AgentDropOverlay>
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
