"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import type { PersonalNote, PersonalNoteSummary } from "@qcet/contracts/personal-notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { useFeedback } from "@/components/ui/feedback-layer";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";
import { NoteEditor } from "@/components/notes/note-editor";
import {
  NotesRequestError,
  deleteNote,
  fetchNote,
  fetchNotes,
  toNoteSummary,
} from "@/components/notes/notes-client";
import { IconSidebarCalendar, IconSidebarTasks } from "@/components/layout/sidebar-rounded-icons";
import { formatTime } from "@qcet/shared/lib/format/date";
import { formatRecencyTime, groupByRecency, type RecencyGroup } from "@qcet/shared/lib/format/recency";
import { cn } from "@/lib/utils";

/** Từ bề rộng này hiện hai khung (danh sách + soạn); hẹp hơn thì một khung như Hộp thư. */
const WIDE_MIN_WIDTH = 720;
const SEARCH_DEBOUNCE_MS = 250;
/** Ghi chú gắn với cuộc họp/nhiệm vụ: icon nhỏ cuối tiêu đề, cùng icon với mục đó ở sidebar. */
const NOTE_ENTITY = {
  meeting: { Icon: IconSidebarCalendar, label: "Gắn với cuộc họp" },
  task: { Icon: IconSidebarTasks, label: "Gắn với nhiệm vụ" },
} as const;
/** Đích điều hướng tới bản nháp ghi chú mới (`?new=1`). */
const NEW_NOTE = "__new__";
/** Địa chỉ không chọn ghi chú nào. */
const NO_NOTE = "";

type LoadedNote = { id: string; state: "loading" | "ready" | "missing" | "error"; note?: PersonalNote };
/**
 * Ghi chú đang soạn từ nút "+": chưa có `note` là chưa lưu gì; `key` giữ nguyên trình soạn cả lúc ghi chú vừa được tạo (đổi
 * `?new=1` thành `?id=`), để con trỏ không nhảy. `target` là địa chỉ của bản nháp; `from` là địa chỉ đang rời đi, để trong lúc
 * URL chưa đổi kịp vẫn hiện bản nháp thay vì nháy về ghi chú cũ.
 */
type Composing = { key: string; note: PersonalNote | null; target: string; from: string | null };

let composeSeq = 0;

function sortNotes(notes: PersonalNoteSummary[]): PersonalNoteSummary[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

function excerptOf(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function NotesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { notifyError } = useFeedback();
  const selectedId = searchParams.get("id");
  /** `?new=1`: đang soạn ghi chú mới chưa lưu (có trong URL để nút quay lại của điện thoại về danh sách). */
  const isNewRoute = !selectedId && searchParams.get("new") === "1";

  const [notes, setNotes] = React.useState<PersonalNoteSummary[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [isWide, setIsWide] = React.useState(true);
  const [loaded, setLoaded] = React.useState<LoadedNote | null>(null);
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [composing, setComposing] = React.useState<Composing | null>(null);
  const [deleting, setDeleting] = React.useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const pushedRef = React.useRef(false);
  /** Bản mới nhất của từng ghi chú đã mở (kèm chữ đang soạn) để mở lại không phải chờ hay lệch với phần chưa lưu. */
  const cacheRef = React.useRef(new Map<string, PersonalNote>());

  const navigate = React.useCallback(
    (id: string | null, mode: "push" | "replace" = "replace") => {
      const href = id === NEW_NOTE ? `${pathname}?new=1` : id ? `${pathname}?id=${encodeURIComponent(id)}` : pathname;
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router]
  );

  // Danh sách: tải lại khi đổi từ khóa; từ khóa gõ xong 250ms mới gửi
  React.useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const loadList = React.useCallback(async (q: string, signal?: AbortSignal) => {
    try {
      const result = await fetchNotes({ q: q || undefined }, signal);
      setNotes(sortNotes(result.notes));
      setHasMore(result.hasMore);
      setStatus("ready");
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void loadList(query, controller.signal);
    return () => controller.abort();
  }, [query, loadList]);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setIsWide(entry.contentRect.width >= WIDE_MIN_WIDTH));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ghi chú đang chọn: lấy từ bản nhớ tạm nếu đã mở, không thì tải
  React.useEffect(() => {
    if (!selectedId) return;
    const cached = cacheRef.current.get(selectedId);
    if (cached) {
      setLoaded({ id: selectedId, state: "ready", note: cached });
      return;
    }
    const controller = new AbortController();
    setLoaded({ id: selectedId, state: "loading" });
    fetchNote(selectedId, controller.signal)
      .then((note) => {
        cacheRef.current.set(note.id, note);
        setLoaded({ id: note.id, state: "ready", note });
      })
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        setLoaded({ id: selectedId, state: error instanceof NotesRequestError && error.status === 404 ? "missing" : "error" });
      });
    return () => controller.abort();
  }, [selectedId, loadAttempt]);

  const current: LoadedNote | null = selectedId ? (loaded?.id === selectedId ? loaded : { id: selectedId, state: "loading" }) : null;

  const patchSummary = React.useCallback((id: string, patch: Partial<PersonalNoteSummary>) => {
    setNotes((prev) => sortNotes(prev.map((item) => (item.id === id ? { ...item, ...patch } : item))));
  }, []);

  const handleDraft = React.useCallback(
    (id: string, patch: { title?: string; content?: string }) => {
      const cached = cacheRef.current.get(id);
      if (cached) cacheRef.current.set(id, { ...cached, ...patch });
      patchSummary(id, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.content !== undefined ? { excerpt: excerptOf(patch.content) } : {}),
        updatedAt: new Date().toISOString(),
      });
    },
    [patchSummary]
  );

  // Chỉ lấy phần máy chủ quyết định (giờ cập nhật, ghim); chữ đang soạn có thể đã đi trước bản trả về
  const handleSaved = React.useCallback(
    (saved: PersonalNote) => {
      const cached = cacheRef.current.get(saved.id);
      if (cached) cacheRef.current.set(saved.id, { ...cached, pinned: saved.pinned, updatedAt: saved.updatedAt });
      patchSummary(saved.id, { pinned: saved.pinned, updatedAt: saved.updatedAt });
    },
    [patchSummary]
  );

  const routeKey = selectedId ?? (isNewRoute ? NEW_NOTE : NO_NOTE);
  const composingRef = React.useRef(composing);
  composingRef.current = composing;
  // Trình soạn của bản nháp chỉ hiện khi URL trỏ tới nó (hoặc đang rời địa chỉ cũ để tới nó)
  const composingShown = composing !== null && (routeKey === composing.target || routeKey === composing.from);
  React.useEffect(() => {
    if (composing) {
      if (!composingShown) setComposing(null);
      else if (composing.from !== null && routeKey === composing.target) setComposing({ ...composing, from: null });
    } else if (routeKey === NEW_NOTE) {
      setComposing({ key: `new-${++composeSeq}`, note: null, target: NEW_NOTE, from: null });
    }
  }, [composing, composingShown, routeKey]);

  // "+" chỉ mở trình soạn trống, chưa gọi API: gõ chữ đầu tiên mới tạo ghi chú, nên không còn ghi chú trống bị bỏ lại
  const handleCreate = () => {
    setQueryInput("");
    setQuery("");
    setSearchOpen(false);
    if (composing && !composing.note && composingShown) {
      document.querySelector<HTMLInputElement>('[data-slot="note-editor"] input')?.focus();
      return;
    }
    setComposing({ key: `new-${++composeSeq}`, note: null, target: NEW_NOTE, from: routeKey });
    const push = routeKey === NO_NOTE && !isWide;
    if (push) pushedRef.current = true;
    navigate(NEW_NOTE, push ? "push" : "replace");
  };

  const handleCreated = React.useCallback(
    (key: string, note: PersonalNote) => {
      cacheRef.current.set(note.id, note);
      setNotes((prev) => sortNotes([toNoteSummary(note), ...prev.filter((item) => item.id !== note.id)]));
      // Còn đang soạn bản đó thì gắn mã vào URL (thay `?new=1`); đã rời đi thì chỉ thêm vào danh sách
      if (composingRef.current?.key !== key) return;
      setComposing({ key, note, target: note.id, from: NEW_NOTE });
      navigate(note.id);
    },
    [navigate]
  );

  const openNote = (id: string) => {
    if (id === selectedId) return;
    if (!selectedId && !isWide) pushedRef.current = true;
    navigate(id, !selectedId && !isWide ? "push" : "replace");
  };

  const closeDetail = () => {
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
    } else {
      navigate(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteNote(deleting.id);
    } catch (error) {
      // 404: đã xóa ở nơi khác, coi như xong
      if (!(error instanceof NotesRequestError && error.status === 404)) {
        notifyError(error instanceof Error ? error.message : "Không xóa được ghi chú.");
        setIsDeleting(false);
        return;
      }
    }
    cacheRef.current.delete(deleting.id);
    const index = notes.findIndex((item) => item.id === deleting.id);
    const neighbour = notes[index + 1] ?? notes[index - 1];
    setNotes((prev) => prev.filter((item) => item.id !== deleting.id));
    if (selectedId === deleting.id) {
      pushedRef.current = false;
      navigate(isWide && neighbour ? neighbour.id : null);
    }
    setDeleting(null);
    setIsDeleting(false);
  };

  const showList = isWide || (!selectedId && !isNewRoute);
  const showDetail = isWide || Boolean(selectedId) || isNewRoute;
  const now = new Date();
  const hasQuery = query.length > 0;
  const pinnedNotes = notes.filter((item) => item.pinned);
  const listGroups: RecencyGroup<PersonalNoteSummary>[] = [
    ...(pinnedNotes.length > 0 ? [{ key: "pinned", label: "Đã ghim", items: pinnedNotes }] : []),
    ...groupByRecency(
      notes.filter((item) => !item.pinned),
      (item) => item.updatedAt,
      now
    ),
  ];

  const listEmpty =
    status === "error" ? (
      <EmptyState
        density="compact"
        glyph="load-error"
        title="Không tải được ghi chú"
        description="Kiểm tra kết nối rồi thử lại."
        action={
          <Button size="pill" onClick={() => void loadList(query)}>
            Thử lại
          </Button>
        }
      />
    ) : hasQuery ? (
      <EmptyState density="compact" glyph="no-results" title="Không có ghi chú phù hợp" description="Thử từ khóa khác." />
    ) : (
      <EmptyState
        density="compact"
        glyph="dossier"
        title="Chưa có ghi chú"
        description="Ghi lại ý riêng cho cuộc họp, công việc. Chỉ mình bạn xem được."
        action={
          <Button size="pill" onClick={handleCreate}>
            <Plus />
            Ghi chú mới
          </Button>
        }
      />
    );

  return (
    <div ref={rootRef} data-slot="notes-workspace" className="flex min-h-0 flex-1 overflow-hidden">
      {showList && (
        <aside
          data-slot="notes-list-pane"
          className={cn("flex min-h-0 flex-col", isWide ? "w-[320px] shrink-0 border-r border-border/60" : "w-full", "max-md:bg-card")}
        >
          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border/60 px-4 max-md:h-[calc(44px+env(safe-area-inset-top,0px))] max-md:pt-[env(safe-area-inset-top,0px)]">
            <MobileMenuButton className="-ml-1.5 mr-1 md:hidden" />
            {searchOpen ? (
              <>
                <Search aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  variant="menu"
                  type="text"
                  value={queryInput}
                  maxLength={100}
                  autoFocus
                  onChange={(event) => setQueryInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (queryInput) setQueryInput("");
                    else setSearchOpen(false);
                  }}
                  placeholder="Tìm trong ghi chú"
                  aria-label="Tìm kiếm ghi chú"
                  className="h-7 min-w-0 flex-1 px-1.5 text-compact sm:h-7 sm:text-compact"
                />
              </>
            ) : (
              <h1 className="truncate text-compact font-medium text-foreground">Ghi chú cá nhân</h1>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {searchOpen ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Đóng tìm kiếm"
                  title="Đóng tìm kiếm (Esc)"
                  onClick={() => {
                    setQueryInput("");
                    setSearchOpen(false);
                  }}
                >
                  <X />
                </Button>
              ) : (
                <Button variant="ghost" size="icon-xs" aria-label="Tìm kiếm ghi chú" title="Tìm kiếm" onClick={() => setSearchOpen(true)}>
                  <Search />
                </Button>
              )}
              <Button variant="ghost" size="icon-xs" aria-label="Ghi chú mới" title="Ghi chú mới" onClick={handleCreate}>
                <Plus />
              </Button>
            </div>
          </div>

          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
            {status === "loading" ? (
              <div aria-hidden className="space-y-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex h-12 animate-pulse flex-col justify-center gap-1.5 px-3">
                    <div className="h-3 w-1/2 rounded bg-muted" />
                    <div className="h-2.5 w-3/4 rounded bg-muted/60" />
                  </div>
                ))}
              </div>
            ) : notes.length === 0 ? (
              // Rộng và chưa chọn: trạng thái trống đã ở khung phải, không lặp tranh ở hai khung
              isWide && !selectedId ? null : listEmpty
            ) : (
              <>
                {/* Chia theo thời gian như Apple Notes: ghi chú ghim lên đầu, rồi Hôm nay, Hôm qua, 7 ngày qua, từng tháng. Giờ
                    nằm đầu dòng phụ như Apple Notes thay cho cột "17 giờ" lặp lại ở mọi hàng. */}
                <div data-slot="notes-list" aria-label="Danh sách ghi chú" role="group">
                  {listGroups.map((group) => (
                    <div key={group.key}>
                      <p className="flex h-7 select-none items-center px-3 text-xs text-muted-foreground">{group.label}</p>
                      <ul aria-label={group.label} className="space-y-0.5">
                        {group.items.map((item) => (
                          <li key={item.id}>
                            <NoteRow
                              item={item}
                              timeOnly={group.key === "today" || group.key === "yesterday"}
                              selected={item.id === selectedId}
                              now={now}
                              onOpen={() => openNote(item.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {hasMore && (
                  <p className="px-3 pt-2 text-xs text-muted-foreground">Chỉ hiện các ghi chú mới nhất. Dùng ô tìm để tìm ghi chú cũ hơn.</p>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      {showDetail && (
        <section data-slot="notes-detail-pane" className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
          {composing && composingShown ? (
            <NoteEditor
              key={composing.key}
              note={composing.note}
              onBack={isWide ? undefined : closeDetail}
              onSaved={handleSaved}
              onCreated={(note) => handleCreated(composing.key, note)}
              onDraft={(patch) => composing.note && handleDraft(composing.note.id, patch)}
              onDelete={(id) => setDeleting({ id, title: cacheRef.current.get(id)?.title || "Ghi chú không tên" })}
            />
          ) : !current ? (
            status === "loading" ? null : status === "ready" && notes.length === 0 && !hasQuery ? (
              <EmptyState
                density="compact"
                className="flex-1 justify-center pb-16"
                glyph="dossier"
                title="Chưa có ghi chú"
                description="Ghi lại ý riêng cho cuộc họp, công việc. Chỉ mình bạn xem được."
                action={
                  <Button size="pill" onClick={handleCreate}>
                    <Plus />
                    Ghi chú mới
                  </Button>
                }
              />
            ) : (
              <EmptyState density="compact" className="flex-1 justify-center pb-16" glyph="inbox-select" title="Chọn một ghi chú để xem" />
            )
          ) : current.state === "ready" && current.note ? (
            <NoteEditor
              key={current.note.id}
              note={current.note}
              onBack={isWide ? undefined : closeDetail}
              onSaved={handleSaved}
              onCreated={() => undefined}
              onDraft={(patch) => handleDraft(current.note!.id, patch)}
              onDelete={(id) => setDeleting({ id, title: cacheRef.current.get(id)?.title || "Ghi chú không tên" })}
            />
          ) : current.state === "loading" ? (
            <div aria-hidden className="flex flex-1 items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {!isWide && (
                <header className="flex h-11 shrink-0 items-center border-b border-border/60 px-4 max-md:h-[calc(44px+env(safe-area-inset-top,0px))] max-md:pt-[env(safe-area-inset-top,0px)]">
                  <Button variant="ghost" size="icon-xs" onClick={closeDetail} aria-label="Quay lại danh sách ghi chú">
                    <X />
                  </Button>
                </header>
              )}
              <EmptyState
                density="compact"
                className="flex-1 justify-center pb-16"
                glyph={current.state === "missing" ? "no-results" : "load-error"}
                title={current.state === "missing" ? "Ghi chú không còn" : "Không mở được ghi chú"}
                description={current.state === "missing" ? "Ghi chú đã bị xóa hoặc không phải của bạn." : "Kiểm tra kết nối rồi thử lại."}
                action={
                  current.state === "error" ? (
                    <Button size="pill" onClick={() => setLoadAttempt((n) => n + 1)}>
                      Thử lại
                    </Button>
                  ) : undefined
                }
              />
            </>
          )}
        </section>
      )}

      <DestructiveConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => !isDeleting && setDeleting(null)}
        onConfirm={confirmDelete}
        isConfirming={isDeleting}
        title="Xóa ghi chú?"
        entityLabel="Ghi chú"
        entityName={deleting?.title}
        description="Nội dung ghi chú sẽ mất hẳn."
      />
    </div>
  );
}

/**
 * Một hàng 48px như Apple Notes: tiêu đề (chưa đặt thì đoạn đầu nội dung) cắt cuối kèm tooltip khi bị cắt, icon nhỏ nếu gắn
 * với cuộc họp/nhiệm vụ; dòng phụ là giờ rồi đoạn đầu nội dung. Nhóm Hôm nay/Hôm qua đã nói ngày nên chỉ hiện giờ.
 */
function NoteRow({
  item,
  timeOnly,
  selected,
  now,
  onOpen,
}: {
  item: PersonalNoteSummary;
  timeOnly: boolean;
  selected: boolean;
  now: Date;
  onOpen: () => void;
}) {
  const titleRef = React.useRef<HTMLSpanElement>(null);
  const [titleCut, setTitleCut] = React.useState(false);
  const title = item.title.trim();
  const rowTitle = title || item.excerpt || "Ghi chú trống";
  const preview = title ? item.excerpt || "Chưa có nội dung" : "";
  const time = formatRecencyTime(item.updatedAt, now);
  const entity = item.entityType ? NOTE_ENTITY[item.entityType] : null;
  return (
    <Pressable
      onClick={onOpen}
      onPointerEnter={() => {
        const el = titleRef.current;
        if (el) setTitleCut(el.scrollWidth > el.clientWidth);
      }}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex h-12 w-full flex-col justify-center gap-0.5 rounded-lg px-3 text-left transition-colors focus-visible:ring-inset",
        selected ? "bg-selected" : "hover:bg-accent/60"
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              ref={titleRef}
              className={cn("min-w-0 flex-1 truncate text-compact", title || item.excerpt ? "font-medium text-foreground" : "text-muted-foreground")}
            >
              {rowTitle}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" hidden={!titleCut}>
            {rowTitle}
          </TooltipContent>
        </Tooltip>
        {entity && (
          <span title={entity.label} className="flex shrink-0 text-muted-foreground">
            <entity.Icon size={12} className="size-3" />
            <span className="sr-only">{entity.label}</span>
          </span>
        )}
      </span>
      <span className="flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0 tabular-nums" title={time.full}>
          {timeOnly ? formatTime(item.updatedAt) : time.short}
        </span>
        {preview && <span className="min-w-0 truncate">{preview}</span>}
      </span>
    </Pressable>
  );
}
