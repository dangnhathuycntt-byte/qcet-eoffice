"use client";

import * as React from "react";
import { ArrowUp, FileText, Paperclip, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRuntimeFeature } from "@/lib/runtime-features";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineAlert } from "@/components/ui/inline-alert";
import { AgentIcon } from "@/components/icons/agent-icon";
import { AgentEmptyPattern, AgentReplyText, AgentWorkLog, CopyMessageButton } from "@/components/agent-chat/agent-chat-parts";
import { AttachmentCard, createChatAttachment, type ChatAttachment } from "@/components/agent-chat/agent-attachments";
import { AgentModelPicker } from "@/components/agent-chat/agent-model-picker";
import { useAgentModel } from "@/components/agent-chat/agent-models";
import type { TaskAgentDraft, TaskAgentPerson } from "@/domain/tasks/task-agent-draft";
import { TASK_AGENT_ATTACHMENT_ACCEPT, checkTaskAgentAttachments } from "@/domain/tasks/task-agent-attachments";
import { parseTaskAgentStreamEvent, splitNdjson, type TaskAgentStreamResult } from "@/domain/tasks/task-agent-stream";
import { agentReplyToPlainText } from "@/domain/tasks/agent-reply-format";

// ─── Bật/tắt theo cấu hình server ──────────────────────────────
/** Agent chỉ hiện khi cờ `taskAgent` bật và server có cấu hình gateway (đọc một lần từ /api/runtime-config). */
export function useTaskAgentAvailable(enabled: boolean): boolean {
  return useRuntimeFeature("taskAgent", enabled);
}

// ─── Panel ─────────────────────────────────────────────────────
const FIELD_LABELS: Record<keyof TaskAgentDraft, string> = {
  title: "Tên",
  description: "Mô tả",
  priority: "Ưu tiên",
  leadAssigneeId: "Chủ trì",
  startDate: "Bắt đầu",
  dueDate: "Hạn",
  subtasks: "Việc con",
};

// Nhiệm vụ gốc: chia thành việc con (thêm vào khối Việc con); đang giao việc con thì chỉ chia bước trong mô tả
const SPLIT_SUBTASKS = { label: "Chia thành việc con", prompt: "Chia nhiệm vụ thành các việc con cụ thể, đề xuất người chủ trì và hạn cho từng việc nếu phù hợp." };
const SPLIT_STEPS = { label: "Chia thành các bước", prompt: "Chia nhiệm vụ thành các bước thực hiện và ghi vào mô tả dạng danh sách." };
const SUGGESTIONS: Array<{ label: string; prompt: string }> = [
  { label: "Viết mô tả chi tiết", prompt: "Viết mô tả chi tiết cho nhiệm vụ này từ tên và nội dung hiện có: mục tiêu, việc cần làm, kết quả cần nộp." },
  SPLIT_SUBTASKS,
  { label: "Đề xuất người chủ trì", prompt: "Đề xuất người chủ trì phù hợp trong đơn vị dựa trên chức vụ." },
  { label: "Đặt thời hạn", prompt: "Đề xuất thời hạn hợp lý cho nhiệm vụ này." },
];

const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Ảnh/tệp gửi kèm tin nhắn người dùng; gửi lại mỗi lượt vì server không lưu. */
  attachments?: ChatAttachment[];
  /** Các trường Agent đã điền vào form ở lượt này. */
  applied?: string[];
  /** Số giây Agent soạn lượt này. */
  seconds?: number;
  /** Suy nghĩ thật của mô hình (reasoning), chỉ có khi model trả. */
  thinking?: string;
  /** Bước máy chủ đã làm: đọc tệp, xem ảnh. */
  steps?: string[];
}

/** Câu mặc định khi chỉ gửi tệp, không gõ chữ. */
const ATTACHMENT_ONLY_PROMPT = "Soạn nhiệm vụ từ tệp đính kèm.";

const RING = "shadow-[0_0_0_0.5px_rgb(0_0_0/0.09),0_3px_6px_-2px_rgb(0_0_0/0.02),0_1px_1px_0_rgb(0_0_0/0.04)]";

export interface TaskAgentPanelProps {
  departmentName: string;
  parentTaskTitle?: string;
  personnel: TaskAgentPerson[];
  draft: TaskAgentDraft;
  /** Điền bản nháp vào form; trả về các trường đã đổi. */
  onApply: (patch: TaskAgentDraft) => Array<keyof TaskAgentDraft>;
  onHide: () => void;
  onClose: () => void;
  /** Panel đang ẩn (vẫn giữ cuộc trò chuyện): bỏ khỏi thứ tự Tab và trình đọc màn hình. */
  inactive?: boolean;
  className?: string;
}

async function readErrorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { detail?: string; message?: string } | null;
  if (res.status === 429) return "Thầy/Cô gửi hơi nhanh. Chờ một phút rồi thử lại.";
  return body?.detail || body?.message || "Agent chưa trả lời được. Thầy/Cô thử lại sau.";
}

export function TaskAgentPanel({
  departmentName,
  parentTaskTitle,
  personnel,
  draft,
  onApply,
  onHide,
  onClose,
  inactive = false,
  className,
}: TaskAgentPanelProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [startedAt, setStartedAt] = React.useState<Date | null>(null);
  const [input, setInput] = React.useState("");
  const [files, setFiles] = React.useState<ChatAttachment[]>([]);
  const [pending, setPending] = React.useState(false);
  // Lượt đang chạy: các bước và suy nghĩ tới dần theo luồng
  const [live, setLive] = React.useState<{ steps: string[]; thinking: string } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const previewUrls = React.useRef(new Set<string>());
  // Model chọn ở ô soạn, chung với Trợ lý; không có danh sách thì để máy chủ dùng model mặc định
  const { model } = useAgentModel();

  // Đóng hộp thì hủy lượt đang chờ và thu hồi ảnh xem trước
  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  React.useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending, live]);
  // Mở lại panel: đưa con trỏ về ô soạn
  React.useEffect(() => {
    if (!inactive) inputRef.current?.focus();
  }, [inactive]);

  const stop = () => abortRef.current?.abort();

  const addFiles = React.useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list);
      if (incoming.length === 0) return;
      const sent = messages.flatMap((m) => m.attachments ?? []).map((a) => a.file);
      const problem = checkTaskAgentAttachments([...sent, ...files.map((a) => a.file), ...incoming]);
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
      setFiles((prev) => [...prev, ...incoming.map((file) => createChatAttachment(file, previewUrls.current))]);
      inputRef.current?.focus();
    },
    [files, messages],
  );

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrls.current.delete(target.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
    inputRef.current?.focus();
  };

  const send = React.useCallback(
    async (content: string) => {
      const text = content.trim() || (files.length > 0 ? ATTACHMENT_ONLY_PROMPT : "");
      if (!text || pending) return;
      const history: ChatMessage[] = [...messages, { role: "user", content: text, attachments: files.length > 0 ? files : undefined }];
      setMessages(history);
      setStartedAt((prev) => prev ?? new Date());
      setInput("");
      setFiles([]);
      setError(null);
      setPending(true);
      setLive({ steps: [], thinking: "" });
      const controller = new AbortController();
      abortRef.current = controller;
      const sentAt = Date.now();

      // Server không lưu gì: gửi 10 tin gần nhất cùng mọi tệp của chúng, tệp gắn theo vị trí tin trong cửa sổ này
      const recent = history.slice(-10);
      const payload = {
        messages: recent.map(({ role, content: c }) => ({ role, content: c.slice(0, 2000) })),
        departmentName,
        parentTaskTitle,
        personnel: personnel.slice(0, 200),
        draft,
        attachments: recent.flatMap((m, messageIndex) => (m.attachments ?? []).map(() => ({ messageIndex }))),
        ...(model ? { model } : {}),
      };
      let body: BodyInit;
      const headers: Record<string, string> = {};
      if (payload.attachments.length > 0) {
        const form = new FormData();
        form.append("payload", JSON.stringify(payload));
        recent.forEach((m) => m.attachments?.forEach((a) => form.append("files", a.file, a.file.name)));
        body = form;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
      }

      try {
        const res = await fetch("/api/tasks/agent-draft", { method: "POST", headers, credentials: "same-origin", signal: controller.signal, body });
        if (!res.ok || !res.body) {
          setError(await readErrorMessage(res));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let result: TaskAgentStreamResult | null = null;
        const handle = (line: string) => {
          const event = parseTaskAgentStreamEvent(line);
          if (!event) return;
          if (event.type === "step") setLive((prev) => prev && { ...prev, steps: [...prev.steps, event.label] });
          else if (event.type === "thinking") setLive((prev) => prev && { ...prev, thinking: prev.thinking + event.delta });
          else if (event.type === "result") result = event.data;
          else setError(event.error.message);
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const { lines, rest } = splitNdjson(buffer + decoder.decode(value, { stream: true }));
          buffer = rest;
          lines.forEach(handle);
        }
        if (buffer.trim()) handle(buffer.trim());
        const final = result as TaskAgentStreamResult | null;
        if (!final) {
          setError((prev) => prev ?? "Agent chưa trả lời được. Thầy/Cô thử lại sau.");
          return;
        }
        const changed = onApply(final.draft ?? {});
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: final.reply,
            applied: changed.map((key) => FIELD_LABELS[key]),
            seconds: Math.max(1, Math.round((Date.now() - sentAt) / 1000)),
            thinking: final.thinking,
            steps: final.steps,
          },
        ]);
      } catch {
        setError(controller.signal.aborted ? "Đã dừng. Thầy/Cô có thể sửa yêu cầu rồi gửi lại." : "Mất kết nối tới Agent. Thầy/Cô thử lại.");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setLive(null);
        setPending(false);
        inputRef.current?.focus();
      }
    },
    [departmentName, draft, files, messages, model, onApply, parentTaskTitle, pending, personnel],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    // Enter (kể cả ⌘/Ctrl+Enter) gửi cho Agent; chặn mặc định để phím tắt Tạo nhiệm vụ của hộp không chạy
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  // Dán ảnh chụp màn hình hoặc tệp vào ô soạn
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files.length === 0) return;
    e.preventDefault();
    addFiles(e.clipboardData.files);
  };

  const canSend = Boolean(input.trim()) || files.length > 0;

  return (
    <aside
      aria-label="Trợ lý soạn nhiệm vụ"
      inert={inactive}
      className={cn("pointer-events-auto relative flex min-h-0 flex-col", className)}
      onDragOver={(e) => {
        if (pending || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex shrink-0 items-center justify-end gap-1 px-3 py-2.5">
        <Button variant="toolbar" size="pill-xs" onClick={onHide} aria-expanded="true" aria-label="Ẩn Agent" title="Ẩn Agent">
          <AgentIcon filled data-icon="inline-start" />
          Ẩn
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)" className="rounded-full">
          <X />
        </Button>
      </div>

      <div
        ref={listRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-3",
          // Panel thấp thì lưới nền chạm mép trên: làm mờ thay vì cắt thẳng
          messages.length === 0 && "[mask-image:linear-gradient(transparent,#000_1.5rem)]",
        )}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          // Như Linear (đo panel cao 833 và 877px): cụm lưới + lời giới thiệu canh giữa vùng trống, lệch xuống 12px (pt-6),
          // nên panel cao thêm thì khoảng dưới tăng theo. Panel thấp thì chỗ của lưới co lại trước, chữ không bị đẩy ra ngoài.
          <div className="flex min-h-0 flex-1 flex-col pt-6">
            <div className="flex-1" />
            <div aria-hidden="true" className="h-66" />
            <div className="relative flex flex-col items-center pt-1.5 text-center">
              <AgentEmptyPattern trackRef={listRef} />
              <p className="text-compact font-semibold text-foreground">Soạn nhiệm vụ cùng Agent</p>
              {/* Mỗi câu một dòng để không ngắt giữa cụm từ */}
              <p className="mt-1 text-compact text-muted-foreground">
                <span className="block">Tả việc cần giao, có thể kèm ảnh hoặc tệp.</span>
                <span className="block">Agent soạn, Thầy/Cô xem lại rồi bấm Tạo nhiệm vụ.</span>
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((item) => (item === SPLIT_SUBTASKS && parentTaskTitle ? SPLIT_STEPS : item)).map((s) => (
                  <Button key={s.label} variant="toolbar" size="pill" onClick={() => void send(s.prompt)} disabled={pending} className="font-normal">
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex-1" />
          </div>
        ) : (
          <>
            {startedAt && (
              <p className="py-1 text-center text-xs font-medium text-muted-foreground/70">Hôm nay {timeFormat.format(startedAt)}</p>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-10 flex flex-col items-end gap-1.5 motion-safe:animate-[fade-in_0.3s_cubic-bezier(0.16,1,0.3,1)]">
                  {m.attachments?.map((a) => <AttachmentCard key={a.id} attachment={a} />)}
                  <p className="whitespace-pre-wrap text-right text-compact text-foreground">{m.content}</p>
                  {i === 0 && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="size-3.5" />
                      Bản nháp nhiệm vụ
                      <span className="text-muted-foreground/70">đã đưa vào ngữ cảnh</span>
                    </p>
                  )}
                </div>
              ) : (
                <div key={i} className="flex flex-col gap-3 motion-safe:animate-[fade-in_0.3s_cubic-bezier(0.16,1,0.3,1)]">
                  {m.seconds !== undefined && <AgentWorkLog seconds={m.seconds} thinking={m.thinking} steps={m.steps ?? []} />}
                  <AgentReplyText text={m.content} />
                  <div className="flex flex-col gap-1">
                    {m.applied && m.applied.length > 0 && (
                      <p className="text-xs text-muted-foreground">Đã điền: {m.applied.join(", ")}</p>
                    )}
                    <div className="flex items-center">
                      <CopyMessageButton text={agentReplyToPlainText(m.content)} />
                    </div>
                  </div>
                </div>
              ),
            )}
          </>
        )}
        {pending && (
          <div className="flex flex-col gap-2">
            <p className="animate-text-shimmer w-fit text-compact">Đang suy nghĩ…</p>
            {live?.steps.map((step, i) => (
              <p key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{step}</span>
              </p>
            ))}
            {/* Suy nghĩ tới dần: giữ dòng mới nhất ở đáy, dòng cũ mờ dần phía trên */}
            {live?.thinking && (
              <div className="flex max-h-28 flex-col justify-end overflow-hidden border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground [mask-image:linear-gradient(to_bottom,transparent,black_2.5rem)]">
                <p className="whitespace-pre-wrap">{live.thinking}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="shrink-0 px-3 pb-2">
          <InlineAlert variant="error">{error}</InlineAlert>
        </div>
      )}

      <div className="shrink-0 p-2 pt-0">
        {/* Như Linear: khung ô soạn giữ nguyên viền mảnh khi đang gõ, chỉ có con trỏ nhập báo focus */}
        <div className={cn("flex flex-col gap-1 rounded-xl bg-background p-2", RING)}>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1 pt-1">
              {files.map((a) => (
                <AttachmentCard key={a.id} attachment={a} compact onRemove={() => removeFile(a.id)} />
              ))}
            </div>
          )}
          <label htmlFor="task-agent-input" className="sr-only">
            Nhắn cho Agent
          </label>
          <Textarea
            id="task-agent-input"
            ref={inputRef}
            compact
            autoResize
            autoFocus
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            maxLength={2000}
            countOnlyNearLimit
            placeholder="Tả việc cần giao cho Agent…"
            className="max-h-40 overflow-y-auto bg-transparent px-1 hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none"
          />
          {/* Như Linear: model, ghim cạnh nút gửi ở bên phải */}
          <div className="flex items-center justify-end gap-2">
            {/* Panel nằm trong hộp Tạo nhiệm vụ (z-50): menu cùng lớp với hộp như các Select của hộp */}
            <AgentModelPicker positionerClassName="z-50" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
              aria-label="Đính kèm ảnh hoặc tệp"
              title="Đính kèm ảnh hoặc tệp (ảnh, PDF, Word, Excel, TXT, CSV; kéo thả hoặc dán cũng được)"
              className="rounded-full"
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
            {pending ? (
              <Button variant="toolbar" size="icon-xs" onClick={stop} aria-label="Dừng" title="Dừng" className="rounded-full">
                <Square className="size-3 fill-current" />
              </Button>
            ) : (
              <Button
                variant={canSend ? "default" : "toolbar"}
                size="icon-xs"
                onClick={() => void send(input)}
                disabled={!canSend}
                aria-label="Gửi cho Agent"
                title="Gửi (Enter)"
                className="rounded-full"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-background/85 text-compact font-medium text-foreground">
          Thả ảnh hoặc tệp để gửi cho Agent
        </div>
      )}
    </aside>
  );
}
