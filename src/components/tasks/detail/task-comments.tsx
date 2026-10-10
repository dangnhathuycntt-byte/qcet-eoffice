"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import {
  filterMentionCandidates,
  findMentionQuery,
  insertMention,
  resolveMentionIds,
  type MentionCandidate,
} from "@/domain/tasks/comment-mentions";

interface CommentView {
  id: string;
  author: { id: string; name: string };
  body: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
}

const TZ = "Asia/Ho_Chi_Minh";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

export interface TaskCommentsProps {
  taskId: string;
  /** Người dùng này có được bình luận không (theo quyền server trả về qua availableActions). */
  canComment?: boolean;
  className?: string;
}

/**
 * Bình luận nhiệm vụ (T-03): danh sách, ô soạn có nhắc tên, sửa và xóa bình luận của mình.
 * Nội dung hiển thị dạng văn bản thuần (React tự thoát ký tự).
 */
export function TaskComments({ taskId, canComment = true, className }: TaskCommentsProps) {
  const [comments, setComments] = React.useState<CommentView[]>([]);
  const [participants, setParticipants] = React.useState<MentionCandidate[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState("");
  const [caret, setCaret] = React.useState(0);
  const [chosen, setChosen] = React.useState<MentionCandidate[]>([]);
  const [highlight, setHighlight] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Không tải được bình luận"));
      const json = await res.json();
      setComments(json.comments ?? []);
      setParticipants(json.participants ?? []);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được bình luận");
      setStatus("error");
    }
  }, [taskId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const mention = React.useMemo(() => findMentionQuery(draft, caret), [draft, caret]);
  const suggestions = React.useMemo(
    () => (mention ? filterMentionCandidates(participants, mention.query) : []),
    [mention, participants]
  );
  const listOpen = suggestions.length > 0;

  React.useEffect(() => setHighlight(0), [mention?.query]);

  const pick = (candidate: MentionCandidate) => {
    if (!mention) return;
    const next = insertMention(draft, caret, mention.start, candidate);
    setDraft(next.text);
    setChosen((prev) => (prev.some((c) => c.id === candidate.id) ? prev : [...prev, candidate]));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
      setCaret(next.caret);
    });
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, mentionUserIds: resolveMentionIds(body, chosen) }),
      });
      if (!res.ok) throw new Error(await readError(res, "Không gửi được bình luận"));
      const json = await res.json();
      setComments((prev) => [...prev, json.comment]);
      setDraft("");
      setChosen([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được bình luận");
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error(await readError(res, "Không sửa được bình luận"));
      const json = await res.json();
      setComments((prev) => prev.map((c) => (c.id === id ? json.comment : c)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không sửa được bình luận");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Xóa bình luận này?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Không xóa được bình luận"));
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, deleted: true, body: null, canEdit: false } : c)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được bình luận");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (listOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(suggestions[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setCaret(0);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <section aria-labelledby={`task-comments-${taskId}`} className={cn("space-y-3", className)}>
      <div className="px-2">
        <h2 id={`task-comments-${taskId}`} className="text-compact font-semibold text-foreground tracking-tight">
          Bình luận{status === "ready" && comments.length > 0 ? ` (${comments.filter((c) => !c.deleted).length})` : ""}
        </h2>
      </div>

      {status === "loading" && <p className="px-2 text-xs text-muted-foreground">Đang tải bình luận…</p>}
      {status === "error" && (
        <p role="alert" className="px-2 text-xs text-destructive">
          {error}{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => { setStatus("loading"); setError(null); void load(); }}>
            Thử lại
          </button>
        </p>
      )}

      {status === "ready" && comments.length === 0 && (
        <p className="px-2 text-xs text-muted-foreground">Chưa có bình luận. Trao đổi về nhiệm vụ này ở đây.</p>
      )}

      {status === "ready" && comments.length > 0 && (
        <ul className="space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 px-2">
              <UserAvatar name={c.author.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-foreground">{c.author.name}</span>
                  <time dateTime={c.createdAt} className="tabular-nums text-muted-foreground">
                    {formatWhen(c.createdAt)}
                  </time>
                  {c.editedAt && !c.deleted && <span className="text-muted-foreground">đã sửa</span>}
                  {c.canEdit && editingId !== c.id && (
                    <span className="ml-auto flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Sửa bình luận"
                        onClick={() => { setEditingId(c.id); setEditDraft(c.body ?? ""); }}
                      >
                        <Pencil strokeWidth={1.5} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="Xóa bình luận" onClick={() => void remove(c.id)}>
                        <Trash2 strokeWidth={1.5} />
                      </Button>
                    </span>
                  )}
                </div>

                {c.deleted ? (
                  <p className="text-compact italic text-muted-foreground">Bình luận đã được xóa.</p>
                ) : editingId === c.id ? (
                  <div className="mt-1 space-y-1.5">
                    <Textarea
                      compact
                      value={editDraft}
                      maxLength={2000}
                      aria-label="Sửa bình luận"
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="min-h-16"
                    />
                    <div className="flex gap-1.5">
                      <Button type="button" size="xs" onClick={() => void saveEdit(c.id)} disabled={!editDraft.trim()}>
                        Lưu
                      </Button>
                      <Button type="button" size="xs" variant="ghost" onClick={() => setEditingId(null)}>
                        Hủy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-compact leading-relaxed text-foreground">{c.body}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {status === "ready" && error && (
        <p role="alert" className="px-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {status === "ready" && canComment && (
        <div className="relative px-2">
          <Textarea
            ref={textareaRef}
            compact
            value={draft}
            maxLength={2000}
            placeholder="Viết bình luận. Gõ @ để nhắc tên. Ctrl+Enter để gửi."
            aria-label="Viết bình luận"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listOpen ? `task-mention-${taskId}` : undefined}
            onChange={(e) => { setDraft(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onKeyDown={onKeyDown}
            className="min-h-16"
          />
          {listOpen && (
            <ul
              id={`task-mention-${taskId}`}
              role="listbox"
              aria-label="Nhắc tên"
              className="absolute bottom-full left-2 z-30 mb-1 w-56 rounded-lg bg-popover p-1 shadow-md"
            >
              {suggestions.map((s, i) => (
                <li key={s.id} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs",
                      i === highlight ? "bg-selected text-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <UserAvatar name={s.name} size="sm" />
                    <span className="truncate">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1.5 flex justify-end">
            <Button type="button" size="xs" onClick={() => void send()} disabled={!draft.trim() || sending}>
              {sending ? "Đang gửi…" : "Gửi"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
