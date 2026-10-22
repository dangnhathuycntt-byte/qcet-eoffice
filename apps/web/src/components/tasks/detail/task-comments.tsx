"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { fetchWithRetry, RATE_LIMIT_MESSAGE } from "@/lib/fetch-with-retry";
import { useBlockSeed } from "@/hooks/use-block-seed";
import { ArrowUp, AtSign, ChevronRight, MoreHorizontal, Pencil, SmilePlus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-host";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { NOTIFICATION_COMMENT_PARAM, NOTIFICATION_FOCUS_PARAM } from "@/lib/notification-inbox";
import {
  filterMentionCandidates,
  findMentionQuery,
  insertMention,
  MENTION_ALL_ID,
  MENTION_ALL_LEGACY_NAMES,
  MENTION_ALL_NAME,
  offersMentionAll,
  resolveMentionIds,
  splitMentions,
  type MentionCandidate,
} from "@qcet/shared/domain/tasks/comment-mentions";
import { Pressable } from "@/components/ui/pressable";
import { Popover } from "@/components/ui/popover";
import {
  MENU_POPUP_CLASS,
  Menu,
  MenuActionItem,
  MenuItem,
  MenuPopup,
  MenuPositioner,
  MenuSheetHeader,
  MenuTrigger,
  SHEET_BACKDROP_CLASS,
  SHEET_POPUP_CLASS,
  SHEET_POSITIONER_CLASS,
} from "@/components/ui/menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { revealAboveKeyboard } from "@/hooks/use-virtual-keyboard";
import { COMMENT_REACTION_EMOJIS, joinReactionNames, reactionNamesLabel, type CommentReactionSummary } from "@qcet/shared/domain/tasks/comment-reactions";

interface CommentView {
  id: string;
  author: { id: string; name: string; avatarUrl?: string | null };
  body: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
  reactions?: CommentReactionSummary[];
}

/** Gập/mở khối bình luận là tiện ích riêng của từng người, nhớ trên trình duyệt (lỗi lưu trữ thì mặc định mở). */
const COLLAPSED_KEY = "qcet.task-comments.collapsed";

/** Áp lượt thả/gỡ emoji của người đang xem lên danh sách (cập nhật lạc quan trước khi server trả lời). */
function applyReaction(list: CommentReactionSummary[], emoji: CommentReactionSummary["emoji"], active: boolean, viewerName: string) {
  const next = list.map((r) => ({ ...r, names: [...r.names] }));
  const hit = next.find((r) => r.emoji === emoji);
  if (active) {
    if (hit) {
      if (!hit.reacted) Object.assign(hit, { reacted: true, count: hit.count + 1, names: [...hit.names, viewerName] });
    } else {
      next.push({ emoji, count: 1, reacted: true, names: [viewerName] });
    }
  } else if (hit?.reacted) {
    Object.assign(hit, { reacted: false, count: hit.count - 1, names: hit.names.filter((n) => n !== viewerName) });
  }
  const order = COMMENT_REACTION_EMOJIS as readonly string[];
  return next.filter((r) => r.count > 0).sort((a, b) => order.indexOf(a.emoji) - order.indexOf(b.emoji));
}

/** Ô emoji dạng viên thuốc nhỏ, nền nhạt không viền (kiểu Notion). */
/** Điện thoại: bàn phím chiếm nửa dưới nên gợi ý nhắc tên mở lên phía trên ô viết, không bị che */
const MENTION_ABOVE_ON_PHONE = "max-md:top-auto max-md:bottom-full max-md:mt-0 max-md:mb-1";

const REACTION_PILL_CLASS = "inline-flex h-6 items-center gap-1 rounded-full bg-secondary px-2 text-xs tabular-nums transition-colors max-md:h-8 max-md:px-2.5";

/**
 * Điện thoại: không có rê chuột nên gom thả cảm xúc, sửa, xóa vào một nút "⋯" mở bottom sheet
 * (hàng emoji to dễ bấm ở trên, thao tác bên dưới) thay vì để ba nút luôn hiện trên mỗi bình luận.
 */
function CommentActionsSheet({
  canReact,
  canEdit,
  onReact,
  onEdit,
  onDelete,
}: {
  canReact: boolean;
  canEdit: boolean;
  onReact: (emoji: CommentReactionSummary["emoji"]) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu.Root>
      <MenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Thao tác bình luận" className="text-muted-foreground" />}>
        <MoreHorizontal />
      </MenuTrigger>
      <Menu.Portal>
        <Menu.Backdrop className={SHEET_BACKDROP_CLASS} />
        <MenuPositioner align="end" sideOffset={4} className={cn("z-50", SHEET_POSITIONER_CLASS)}>
          <MenuPopup className={cn(MENU_POPUP_CLASS, "w-56", SHEET_POPUP_CLASS)}>
            <MenuSheetHeader title="Bình luận" />
            {canReact && (
              <div className="flex justify-between px-1 py-1">
                {COMMENT_REACTION_EMOJIS.map((emoji) => (
                  <MenuItem
                    key={emoji}
                    aria-label={`Thả ${emoji}`}
                    onClick={() => onReact(emoji)}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-xl outline-none active:bg-accent data-[highlighted]:bg-accent"
                  >
                    {emoji}
                  </MenuItem>
                ))}
              </div>
            )}
            {canEdit && (
              <>
                <MenuActionItem leading={<Pencil />} onClick={onEdit}>Sửa bình luận</MenuActionItem>
                <MenuActionItem leading={<Trash2 />} destructive onClick={onDelete}>Xóa bình luận</MenuActionItem>
              </>
            )}
          </MenuPopup>
        </MenuPositioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Nút mặt cười mở hàng emoji cố định; chọn xong tự đóng. */
function ReactionPicker({ onPick, pill = false }: { onPick: (emoji: CommentReactionSummary["emoji"]) => void; pill?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          pill ? (
            <Pressable aria-label="Thả cảm xúc" className={cn(REACTION_PILL_CLASS, "w-7 justify-center px-0 text-muted-foreground hover:bg-accent hover:text-foreground data-[popup-open]:bg-selected")} />
          ) : (
            <Button variant="ghost" size="icon-xs" aria-label="Thả cảm xúc" className="size-6 sm:size-6" />
          )
        }
      >
        <SmilePlus className="size-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="end" sideOffset={4} collisionPadding={8} className="z-50">
          <Popover.Popup aria-label="Chọn cảm xúc" className={cn(MENU_POPUP_CLASS, "flex gap-0.5")}>
            {COMMENT_REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                aria-label={`Thả ${emoji}`}
                onClick={() => { onPick(emoji); setOpen(false); }}
                className="flex size-7 items-center justify-center rounded-md text-base hover:bg-accent"
              >
                {emoji}
              </Pressable>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
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
  if (res.status === 429) return RATE_LIMIT_MESSAGE;
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

export interface TaskCommentsProps {
  taskId: string;
  /** Người dùng này có được bình luận không (theo quyền server trả về qua availableActions). */
  canComment?: boolean;
  /** Dữ liệu GET /api/tasks/[id]/comments gửi kèm page-data: có thì lần mở trang không gọi GET riêng. */
  initialData?: Record<string, unknown>;
  className?: string;
}

type Viewer = { id: string; name: string; avatarUrl: string | null };
type CommentList = { comments?: CommentView[]; participants?: MentionCandidate[]; viewer?: Viewer | null; canComment?: boolean };

/** Quá số này thì gập bình luận cũ, chỉ hiện các bình luận mới nhất để không đẩy mô tả xuống quá xa. */
const VISIBLE_COMMENTS = 3;

/**
 * Thu gọn chỉ áp dụng khi đã có bình luận: nút "Bình luận" để mở lại chỉ hiện khi có bình luận, nên nhiệm vụ chưa có
 * bình luận luôn phải thấy ô viết, kể cả khi người dùng từng thu gọn ở nhiệm vụ khác (lựa chọn lưu chung trong localStorage).
 */
export function isCommentListCollapsed(preferCollapsed: boolean, commentCount: number): boolean {
  return preferCollapsed && commentCount > 0;
}

/**
 * Bình luận nhiệm vụ (T-03) kiểu Notion, đặt ngay dưới tên nhiệm vụ: cũ trước mới sau, đường nối dọc giữa các bình luận,
 * ô "Thêm bình luận…" một dòng có avatar ở cuối (Enter gửi, Shift+Enter xuống dòng, gõ @ để nhắc tên).
 * Nội dung hiển thị dạng văn bản thuần (React tự thoát ký tự).
 */
export function TaskComments({ taskId, canComment: canCommentProp = true, initialData, className }: TaskCommentsProps) {
  const { seed, skipLoad } = useBlockSeed(initialData as CommentList | undefined);
  const [comments, setComments] = React.useState<CommentView[]>(seed?.comments ?? []);
  const [participants, setParticipants] = React.useState<MentionCandidate[]>(seed?.participants ?? []);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(seed ? "ready" : "loading");
  const [error, setError] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState("");
  const [caret, setCaret] = React.useState(0);
  const [chosen, setChosen] = React.useState<MentionCandidate[]>([]);
  const [highlight, setHighlight] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [viewer, setViewer] = React.useState<Viewer | null>(seed?.viewer ?? null);
  const [serverCanComment, setServerCanComment] = React.useState(seed?.canComment !== false);
  const [showAll, setShowAll] = React.useState(false);
  const canComment = canCommentProp && serverCanComment;

  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* trình duyệt chặn lưu trữ: giữ mặc định mở */
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* bỏ qua: chỉ là tiện ích ghi nhớ */
      }
      return next;
    });
  };

  const react = async (commentId: string, emoji: CommentReactionSummary["emoji"], active: boolean) => {
    const viewerName = viewer?.name ?? "Bạn";
    const before = comments.find((c) => c.id === commentId)?.reactions ?? [];
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, reactions: applyReaction(c.reactions ?? [], emoji, active, viewerName) } : c)));
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}/reactions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, active }),
      });
      if (!res.ok) throw new Error(await readError(res, "Không thả được cảm xúc"));
      const json = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, reactions: json.reactions ?? [] } : c)));
    } catch (e) {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, reactions: before } : c)));
      setError(e instanceof Error ? e.message : "Không thả được cảm xúc");
    }
  };

  const load = React.useCallback(async () => {
    try {
      const res = await fetchWithRetry(`/api/tasks/${taskId}/comments`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Không tải được bình luận"));
      const json: CommentList = await res.json();
      setComments(json.comments ?? []);
      setParticipants(json.participants ?? []);
      setViewer(json.viewer ?? null);
      setServerCanComment(json.canComment !== false);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được bình luận");
      setStatus("error");
    }
  }, [taskId]);

  React.useEffect(() => {
    if (skipLoad(taskId)) return;
    void load();
  }, [load]);

  // Mở từ thông báo nhắc tên (`?focus=comments&comment=<id>`): mở danh sách và hiện cả bình luận cũ để tô được bình luận đó.
  // Chỉ đổi trạng thái lần này, không ghi đè lựa chọn thu gọn đã lưu.
  const searchParams = useSearchParams();
  const focusComments = searchParams?.get(NOTIFICATION_FOCUS_PARAM) === "comments";
  const focusCommentId = searchParams?.get(NOTIFICATION_COMMENT_PARAM) ?? null;
  React.useEffect(() => {
    if (status !== "ready" || !focusComments) return;
    setCollapsed(false);
    if (focusCommentId) setShowAll(true);
  }, [status, focusComments, focusCommentId]);

  const listCollapsed = isCommentListCollapsed(collapsed, comments.length);
  const hiddenCount = showAll ? 0 : Math.max(0, comments.length - VISIBLE_COMMENTS);
  const visibleComments = comments.slice(hiddenCount);

  const mention = React.useMemo(() => findMentionQuery(draft, caret), [draft, caret]);
  // "all" đứng cuối khi từ đang gõ khớp (xem offersMentionAll): gõ "@" rồi Enter vẫn nhắc người đầu danh sách như
  // trước, không lỡ tay nhắc cả đơn vị; gõ "moi"/"every"/"all" thì nó là mục duy nhất
  const suggestions = React.useMemo<MentionCandidate[]>(
    () =>
      mention
        ? [
            ...filterMentionCandidates(participants, mention.query),
            ...(offersMentionAll(participants, mention.query) ? [{ id: MENTION_ALL_ID, name: MENTION_ALL_NAME }] : []),
          ]
        : [],
    [mention, participants]
  );
  // Gợi ý chỉ hiện khi đang gõ trong ô viết; rời ô thì đóng
  const [composerFocused, setComposerFocused] = React.useState(false);
  const listOpen = composerFocused && suggestions.length > 0;
  // Gõ "@" mà không có ai phù hợp: báo lý do thay vì im lặng
  const mentionEmpty = composerFocused && Boolean(mention) && suggestions.length === 0;
  // Tên được tô màu khi hiển thị: người có thể nhắc, người đang xem, tác giả các bình luận, và "@all" (cả tên cũ
  // "@Tất cả" của bình luận đã gửi)
  const mentionNames = React.useMemo(
    () => [MENTION_ALL_NAME, ...MENTION_ALL_LEGACY_NAMES, ...participants.map((p) => p.name), viewer?.name ?? "", ...comments.map((c) => c.author.name)],
    [participants, viewer, comments]
  );

  /** Tên được nhắc tô màu chính; trong ô gõ chỉ đổi màu (đậm làm chữ rộng ra, lệch con trỏ), khi hiển thị thì đậm thêm. */
  const renderMentions = React.useCallback(
    (text: string, bold = false) =>
      splitMentions(text, mentionNames).map((part, i) =>
        part.mention ? (
          <span key={i} className={cn("text-primary", bold && "font-medium")}>{part.text}</span>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        )
      ),
    [mentionNames]
  );

  /** Nút "@": chèn "@" tại con trỏ (thêm khoảng trắng nếu dính chữ trước) để mở danh sách nhắc tên. */
  const startMention = () => {
    const el = textareaRef.current;
    const at = el?.selectionStart ?? draft.length;
    const needsSpace = at > 0 && !/\s/.test(draft[at - 1] ?? "");
    const insertion = needsSpace ? " @" : "@";
    setDraft(draft.slice(0, at) + insertion + draft.slice(at));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(at + insertion.length, at + insertion.length);
      setCaret(at + insertion.length);
    });
  };

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
        body: JSON.stringify({ body, mentionUserIds: resolveMentionIds(body, chosen, participants) }),
      });
      if (!res.ok) throw new Error(await readError(res, "Không gửi được bình luận"));
      const json = await res.json();
      setComments((prev) => [...prev, json.comment]);
      setDraft("");
      setChosen([]);
      // Bình luận đầu tiên khi đang để chế độ thu gọn: giữ mở để thấy bình luận vừa gửi, không gập lại ngay
      setCollapsed(false);
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
    const ok = await confirmAction({
      title: "Xóa bình luận?",
      description: "Nội dung bình luận sẽ bị gỡ, chỉ còn dòng \"Bình luận đã được xóa\".",
      destructive: true,
    });
    if (!ok) return;
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
    // Enter gửi như Notion; Shift+Enter xuống dòng; bỏ qua khi bộ gõ tiếng Việt đang ghép chữ
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  // Chưa tải xong thì chưa chiếm chỗ dưới tiêu đề; không có bình luận và không được viết thì ẩn hẳn
  if (status === "loading") return null;
  if (status === "ready" && comments.length === 0 && !canComment) return null;

  return (
    <section aria-labelledby={`task-comments-${taskId}`} data-notification-focus="comments" className={cn("space-y-2", className)}>
      {comments.length > 0 ? (
        <h2 id={`task-comments-${taskId}`}>
          <Pressable
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
            className="-ml-1 inline-flex h-6 items-center gap-1 rounded-md px-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground max-md:h-8"
          >
            <ChevronRight className={cn("size-3.5 transition-transform motion-reduce:transition-none", !collapsed && "rotate-90")} />
            Bình luận
            {collapsed && <span className="tabular-nums font-normal">{comments.filter((c) => !c.deleted).length}</span>}
          </Pressable>
        </h2>
      ) : (
        <h2 id={`task-comments-${taskId}`} className="sr-only">
          Bình luận
        </h2>
      )}

      {!listCollapsed && (
        <>

      {status === "error" && (
        // Lỗi tải là trạng thái tạm (thường do quá tải), báo nhẹ bằng chữ phụ thay vì chữ đỏ
        <p role="status" className="text-xs text-muted-foreground">
          Chưa tải được bình luận.{" "}
          <Pressable className="rounded-sm underline underline-offset-2 hover:text-foreground" onClick={() => { setStatus("loading"); setError(null); void load(); }}>
            Thử lại
          </Pressable>
        </p>
      )}

      {hiddenCount > 0 && (
        <Pressable onClick={() => setShowAll(true)} className="rounded-sm text-xs text-muted-foreground hover:text-foreground">
          Xem {hiddenCount} bình luận trước
        </Pressable>
      )}

      {visibleComments.length > 0 && (
        <ul className="max-w-3xl">
          {visibleComments.map((c, index) => (
            <li key={c.id} data-notification-focus={`comment:${c.id}`} className="group/comment">
              <div className="flex min-h-5 items-center gap-2">
                <UserAvatar name={c.author.name} avatarUrl={c.author.avatarUrl} size="sm" />
                <span className="truncate text-xs font-medium text-foreground">{c.author.name}</span>
                <time dateTime={c.createdAt} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatWhen(c.createdAt)}
                </time>
                {c.editedAt && !c.deleted && <span className="shrink-0 text-xs text-muted-foreground">đã sửa</span>}
                {!c.deleted && editingId !== c.id && (canComment || c.canEdit) && (
                  // Máy tính: thả cảm xúc, sửa, xóa chỉ hiện khi rê chuột/focus; điện thoại: một nút "⋯" mở bottom sheet
                  <>
                  <span className="-my-1 ml-auto md:hidden">
                    <CommentActionsSheet
                      canReact={canComment}
                      canEdit={c.canEdit}
                      onReact={(emoji) => void react(c.id, emoji, true)}
                      onEdit={() => { setEditingId(c.id); setEditDraft(c.body ?? ""); }}
                      onDelete={() => void remove(c.id)}
                    />
                  </span>
                  <span className="-my-0.5 ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/comment:opacity-100 group-hover/comment:opacity-100 has-[[data-popup-open]]:opacity-100 max-md:hidden">
                    {canComment && <ReactionPicker onPick={(emoji) => void react(c.id, emoji, true)} />}
                    {c.canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Sửa bình luận"
                          className="size-6 sm:size-6"
                          onClick={() => { setEditingId(c.id); setEditDraft(c.body ?? ""); }}
                        >
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-xs" aria-label="Xóa bình luận" className="size-6 sm:size-6" onClick={() => void remove(c.id)}>
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </span>
                  </>
                )}
              </div>

              {/* Nội dung thụt thẳng tên (avatar 20px + khe 8px); đường dọc giữa avatar nối sang bình luận sau */}
              <div className={cn("ml-2.5 pb-2.5 pl-[17px]", index < visibleComments.length - 1 ? "border-l border-border" : "border-l border-transparent")}>
                {c.deleted ? (
                  <p className="text-compact italic text-muted-foreground">Bình luận đã được xóa.</p>
                ) : editingId === c.id ? (
                  // Sửa tại chỗ, nhẹ như ô viết: nền xám nhạt, không viền xanh; Enter lưu, Shift+Enter xuống dòng, Esc hủy
                  <div className="-mx-2 rounded-md bg-secondary px-2 py-1.5">
                    <Textarea
                      compact
                      autoResize
                      autoFocus
                      rows={1}
                      value={editDraft}
                      renderHighlight={renderMentions}
                      maxLength={2000}
                      countOnlyNearLimit
                      aria-label="Sửa bình luận"
                      onChange={(e) => setEditDraft(e.target.value)}
                      onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingId(null);
                        } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          // Không đổi gì thì chỉ đóng, không gửi lên và không gắn nhãn "đã sửa"
                          if (editDraft.trim() === (c.body ?? "").trim()) setEditingId(null);
                          else if (editDraft.trim()) void saveEdit(c.id);
                        }
                      }}
                      className="min-h-5 rounded-none bg-transparent px-0 py-0 leading-relaxed hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none sm:min-h-5"
                    />
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="mr-auto text-xs text-muted-foreground">Enter để lưu · Esc để hủy</span>
                      <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>
                        Hủy
                      </Button>
                      <Button size="xs" onClick={() => void saveEdit(c.id)} disabled={!editDraft.trim() || editDraft.trim() === (c.body ?? "").trim()}>
                        Lưu
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-compact leading-relaxed text-foreground">
                    {renderMentions(c.body ?? "", true)}
                  </p>
                )}

                {!c.deleted && editingId !== c.id && (c.reactions?.length ?? 0) > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.reactions!.map((r) => {
                      const who = joinReactionNames(reactionNamesLabel(r, viewer?.name ?? "Bạn"));
                      return (
                        <Tooltip key={r.emoji}>
                          <TooltipTrigger asChild>
                            <Pressable
                              aria-pressed={r.reacted}
                              aria-label={`${r.emoji} ${r.count}: ${who}`}
                              disabled={!canComment}
                              onClick={() => void react(c.id, r.emoji, !r.reacted)}
                              className={cn(
                                REACTION_PILL_CLASS,
                                "disabled:cursor-default",
                                // Đã thả: nền xanh rất nhạt, số màu chính; chưa thả: nền xám nhạt, số màu phụ
                                r.reacted ? "bg-primary/10 text-primary enabled:hover:bg-primary/15" : "text-muted-foreground enabled:hover:bg-accent"
                              )}
                            >
                              <span className="text-xs leading-none">{r.emoji}</span>
                              {r.count}
                            </Pressable>
                          </TooltipTrigger>
                          {/* Ô emoji ở trên, dưới là "A, B và N người khác đã thả …"; nhiều người thì xuống dòng thay vì kéo dài một hàng */}
                          <TooltipContent side="top" sideOffset={4} className="flex max-w-64 flex-col items-center gap-1.5 whitespace-normal px-3 py-2 text-center">
                            <span aria-hidden className="flex size-7 items-center justify-center rounded-md bg-background text-compact leading-none">{r.emoji}</span>
                            <span className="break-words leading-snug">
                              {who} <span className="font-normal opacity-70">đã thả</span> {r.emoji}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {canComment && <ReactionPicker pill onPick={(emoji) => void react(c.id, emoji, true)} />}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {status === "ready" && error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {status === "ready" && canComment && (
        // Giới hạn bề ngang như cột đọc của Notion để nút gửi nằm gần chỗ gõ, không trôi ra mép phải
        <div className="relative flex max-w-3xl items-center gap-2">
          <UserAvatar name={viewer?.name} avatarUrl={viewer?.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <Textarea
              ref={textareaRef}
              compact
              autoResize
              rows={1}
              value={draft}
              renderHighlight={renderMentions}
              maxLength={2000}
              countOnlyNearLimit
              placeholder="Thêm bình luận…"
              aria-label="Viết bình luận"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              aria-controls={listOpen ? `task-mention-${taskId}` : undefined}
              onChange={(e) => { setDraft(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); }}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
              onFocus={(e) => { setComposerFocused(true); revealAboveKeyboard(e.currentTarget); }}
              onBlur={() => setComposerFocused(false)}
              onKeyDown={onKeyDown}
              // Ô viết không khung như Notion: không nền, không viền focus, không bo góc (bo 12px trên ô cao 20px cắt con trỏ thành hình "(").
              // Điện thoại: ô nhập buộc 16px để iOS không tự phóng trang (globals.css), nên thu nhỏ hiển thị về 13px
              // bằng scale 0.8125 và nới bề ngang tương ứng, để chữ cùng cỡ với bình luận đã gửi.
              className="min-h-5 rounded-none bg-transparent px-0 py-0 leading-5 hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none sm:min-h-5 max-sm:w-[calc(100%/0.8125)] max-sm:origin-left max-sm:scale-[0.8125]"
            />
          </div>
          <Button variant="ghost" size="icon-xs" aria-label="Nhắc tên" title="Nhắc tên (@)" onClick={startMention} className="touch-target-expand-44 size-6 shrink-0 text-muted-foreground sm:size-6 [&_svg]:size-3.5">
            <AtSign />
          </Button>
          {/* Nút gửi tròn nhỏ luôn hiện (xám khi trống, màu chính khi có chữ) để hàng không nhảy */}
          <Button
            size="icon-xs"
            variant={draft.trim() ? "default" : "secondary"}
            aria-label="Gửi bình luận"
            onClick={() => void send()}
            disabled={!draft.trim() || sending}
            // Nhìn 24px như desktop; vùng chạm trên điện thoại nới ra 44px bằng touch-target-expand-44
            className="touch-target-expand-44 size-6 shrink-0 rounded-full sm:size-6 [&_svg]:size-3.5"
          >
            <ArrowUp />
          </Button>
          {listOpen && (
            <ul
              id={`task-mention-${taskId}`}
              role="listbox"
              aria-label="Nhắc tên"
              className={cn(MENU_POPUP_CLASS, "absolute left-7 top-full mt-1 w-64", MENTION_ABOVE_ON_PHONE, "max-md:max-h-48 max-md:overflow-y-auto")}
            >
              {suggestions.map((s, i) => {
                const everyone = s.id === MENTION_ALL_ID;
                if (everyone) {
                  return (
                    <React.Fragment key={s.id}>
                      {i > 0 && <li role="presentation" aria-hidden className="mx-1.5 my-1 h-px bg-border" />}
                      <li role="option" aria-selected={i === highlight}>
                        <Pressable
                          tabIndex={-1}
                          onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                          onMouseEnter={() => setHighlight(i)}
                          title={`Nhắc cả ${participants.length} người trong nhiệm vụ và cùng đơn vị`}
                          className={cn(
                            "flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-compact text-foreground",
                            i === highlight && "bg-accent"
                          )}
                        >
                          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Users className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{MENTION_ALL_NAME}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{participants.length} người</span>
                        </Pressable>
                      </li>
                    </React.Fragment>
                  );
                }
                // Tiêu đề nhóm khi đổi từ người trong nhiệm vụ sang người cùng đơn vị (danh sách đã xếp theo nhóm; mục
                // "all" ở cuối không thuộc nhóm nào)
                const groupOf = (c: MentionCandidate) => (c.inTask === false ? "Cùng đơn vị" : "Trong nhiệm vụ");
                const group = groupOf(s);
                const prev = suggestions[i - 1];
                const prevGroup = prev && prev.id !== MENTION_ALL_ID ? groupOf(prev) : null;
                return (
                  <React.Fragment key={s.id}>
                    {group !== prevGroup && (
                      <li role="presentation" className="px-2 pb-0.5 pt-1.5 text-xs text-muted-foreground first:pt-0.5">
                        {group}
                      </li>
                    )}
                    <li role="option" aria-selected={i === highlight}>
                      <Pressable
                        tabIndex={-1}
                        onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                        onMouseEnter={() => setHighlight(i)}
                        title={s.inTask === false ? `${s.name}: chưa tham gia, nhắc tên sẽ thêm làm người theo dõi` : s.name}
                        className={cn(
                          "flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-compact text-foreground",
                          i === highlight && "bg-accent"
                        )}
                      >
                        <UserAvatar name={s.name} avatarUrl={s.avatarUrl} size="md" />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      </Pressable>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          )}
          {mentionEmpty && (
            <p role="status" className={cn(MENU_POPUP_CLASS, "absolute left-7 top-full mt-1 w-60 px-2 py-1.5 text-muted-foreground", MENTION_ABOVE_ON_PHONE)}>
              {participants.length === 0
                ? "Chưa có ai để nhắc. Nhắc được người trong nhiệm vụ và người cùng đơn vị."
                : "Không có người phù hợp trong nhiệm vụ hoặc đơn vị."}
            </p>
          )}
        </div>
      )}
        </>
      )}
    </section>
  );
}
