"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { PersonalNote, PersonalNoteSummary } from "@qcet/contracts/personal-notes";
import { toNoteExcerpt, toNotePreview } from "@qcet/shared/domain/notes/note-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StandardDialog } from "@/components/ui/dialog";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { useFeedback } from "@/components/ui/feedback-layer";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";
import { NoteCard } from "@/components/notes/note-card";
import { NoteEditor, preloadNoteBodyEditor } from "@/components/notes/note-editor";
import { NoteMasonry } from "@/components/notes/note-masonry";
import {
  NotesRequestError,
  deleteNote,
  fetchNote,
  fetchNotes,
  toNoteSummary,
  updateNote,
} from "@/components/notes/notes-client";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;
/** Thẻ chờ tải cao thấp khác nhau như lưới thật. */
const SKELETON_ITEMS = [96, 148, 72, 120, 168, 88, 112, 136].map((height, index) => ({ id: `skeleton-${index}`, height }));

type LoadedNote = { id: string; state: "loading" | "ready" | "missing" | "error"; note?: PersonalNote };

function sortNotes(notes: PersonalNoteSummary[]): PersonalNoteSummary[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Trang Ghi chú cá nhân theo bố cục Google Keep (người dùng gửi ảnh Keep 21/10/2026): ô "Ghi chú…" ghi nhanh ở giữa đầu trang,
 * dưới là lưới thẻ so le (Đã ghim, Khác), bấm thẻ mở hộp sửa. Hộp sửa gắn với `?id=` (mở bằng push nên nút Back đóng hộp).
 */
export function NotesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { notifyError } = useFeedback();
  const selectedId = searchParams.get("id");

  const [notes, setNotes] = React.useState<PersonalNoteSummary[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [loaded, setLoaded] = React.useState<LoadedNote | null>(null);
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [deleting, setDeleting] = React.useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  // Ô ghi nhanh: mỗi lượt mở một trình soạn mới (`captureKey`); ghi chú tạo trong lượt đó chỉ hiện thành thẻ khi đóng ô
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [captureKey, setCaptureKey] = React.useState(0);
  const [captureNoteId, setCaptureNoteId] = React.useState<string | null>(null);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const pointerInsideCaptureRef = React.useRef(false);
  const focusInsideCaptureRef = React.useRef(false);
  const pushedRef = React.useRef(false);
  /** Bản mới nhất của từng ghi chú đã mở (kèm chữ đang soạn) để mở lại không phải chờ hay lệch với phần chưa lưu. */
  const cacheRef = React.useRef(new Map<string, PersonalNote>());

  const navigate = React.useCallback(
    (id: string | null, mode: "push" | "replace" = "replace") => {
      const href = id ? `${pathname}?id=${encodeURIComponent(id)}` : pathname;
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

  // Ghi chú đang mở: lấy từ bản nhớ tạm nếu đã mở, không thì tải (thẻ chỉ có đoạn đầu, không sửa trên đoạn đầu được)
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
  // Lúc hộp đang đóng dần vẫn giữ nội dung cũ, không nháy trống
  const shownRef = React.useRef<LoadedNote | null>(null);
  if (current) shownRef.current = current;
  const shown = current ?? shownRef.current;

  // Editor nội dung tách chunk riêng: tải lúc rảnh để ô ghi nhanh và hộp sửa hiện editor ngay
  React.useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") {
      preloadNoteBodyEditor();
      return;
    }
    const id = window.requestIdleCallback(preloadNoteBodyEditor);
    return () => window.cancelIdleCallback(id);
  }, []);

  const patchSummary = React.useCallback((id: string, patch: Partial<PersonalNoteSummary>) => {
    setNotes((prev) => sortNotes(prev.map((item) => (item.id === id ? { ...item, ...patch } : item))));
  }, []);

  // Mỗi lần gõ: thẻ phía sau hộp sửa và bản nhớ tạm theo kịp chữ đang soạn
  const handleDraft = React.useCallback(
    (id: string | null, patch: { title?: string; content?: string }) => {
      if (!id) return;
      const cached = cacheRef.current.get(id);
      if (cached) cacheRef.current.set(id, { ...cached, ...patch });
      patchSummary(id, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.content !== undefined ? { excerpt: toNoteExcerpt(patch.content), preview: toNotePreview(patch.content) } : {}),
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

  // Lượt ô ghi nhanh đang mở; lần tạo về muộn (sau khi đã đóng ô) không được ẩn thẻ ở lượt mở sau
  const captureStateRef = React.useRef({ open: captureOpen, key: captureKey });
  captureStateRef.current = { open: captureOpen, key: captureKey };
  const handleCaptureCreated = React.useCallback((note: PersonalNote, key: number) => {
    cacheRef.current.set(note.id, note);
    setNotes((prev) => sortNotes([toNoteSummary(note), ...prev.filter((item) => item.id !== note.id)]));
    if (captureStateRef.current.open && captureStateRef.current.key === key) setCaptureNoteId(note.id);
  }, []);

  // Đóng ô ghi nhanh: trình soạn gỡ ra thì lưu nốt; chưa gõ gì thì không còn gì
  const closeCapture = React.useCallback(() => {
    if (!captureStateRef.current.open) return;
    setCaptureOpen(false);
    setCaptureNoteId(null);
    setCaptureKey((key) => key + 1);
  }, []);

  // Bấm ra ngoài ô ghi nhanh thì đóng như Keep, chữ đã gõ thành thẻ luôn (hộp xác nhận xóa, toast không tính là ngoài). Menu
  // "/", thanh định dạng của editor nằm ở portal ngoài ô nhưng vẫn trong cây React của ô, nên "bên trong" được đánh dấu bằng
  // sự kiện React của ô (đi qua portal) chứ không dùng `contains` trên DOM; xét sau khi sự kiện chạy hết. Trình nghe gắn ở
  // `window` để chạy trước React (Next gắn trình nghe của React ở `document`), không xóa mất dấu "bên trong" vừa đặt.
  React.useEffect(() => {
    if (!captureOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      pointerInsideCaptureRef.current = false;
      const target = event.target as Element | null;
      window.setTimeout(() => {
        if (pointerInsideCaptureRef.current || !target) return;
        if (target.closest('[role="dialog"], [role="alertdialog"], [data-sonner-toaster]')) return;
        closeCapture();
      }, 0);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [captureOpen, closeCapture]);

  // Tiêu điểm rời ô (Tab ra ngoài) cũng đóng. Không có phần tử nhận tiêu điểm mới (bấm chỗ trống, rời cửa sổ), hoặc tiêu
  // điểm về khung bao ngoài ô (Chrome cho khung cuộn nhận tiêu điểm khi bấm vào lề trống trong ô) thì để trình nghe bấm chuột
  // ở trên lo.
  const captureFocusHandlers = {
    onFocus: () => {
      focusInsideCaptureRef.current = true;
    },
    onBlur: (event: React.FocusEvent) => {
      focusInsideCaptureRef.current = false;
      const next = event.relatedTarget;
      if (!next || next.contains(event.currentTarget)) return;
      window.setTimeout(() => {
        if (!focusInsideCaptureRef.current) closeCapture();
      }, 0);
    },
  };

  const openNote = (id: string) => {
    pushedRef.current = true;
    navigate(id, "push");
  };

  const closeNote = React.useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
    } else {
      navigate(null);
    }
  }, [navigate, router]);

  const togglePin = async (item: PersonalNoteSummary) => {
    const next = !item.pinned;
    patchSummary(item.id, { pinned: next });
    try {
      handleSaved(await updateNote(item.id, { pinned: next }));
    } catch (error) {
      patchSummary(item.id, { pinned: item.pinned });
      notifyError(error instanceof Error ? error.message : "Không ghim được ghi chú.");
    }
  };

  const askDelete = (id: string) => {
    const summary = notes.find((item) => item.id === id);
    const title = cacheRef.current.get(id)?.title || summary?.title || summary?.excerpt || "Ghi chú trống";
    setDeleting({ id, title });
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
    setNotes((prev) => prev.filter((item) => item.id !== deleting.id));
    if (selectedId === deleting.id) closeNote();
    if (captureNoteId === deleting.id) closeCapture();
    setDeleting(null);
    setIsDeleting(false);
  };

  const hasQuery = query.length > 0;
  const { pinnedNotes, otherNotes } = React.useMemo(() => {
    const visible = captureOpen && captureNoteId ? notes.filter((item) => item.id !== captureNoteId) : notes;
    return { pinnedNotes: visible.filter((item) => item.pinned), otherNotes: visible.filter((item) => !item.pinned) };
  }, [notes, captureOpen, captureNoteId]);
  const isEmpty = pinnedNotes.length === 0 && otherNotes.length === 0;

  const deleteConfirm = (
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
  );

  const renderCard = (item: PersonalNoteSummary) => (
    <NoteCard item={item} onOpen={() => openNote(item.id)} onTogglePin={() => void togglePin(item)} onDelete={() => askDelete(item.id)} />
  );

  return (
    <div data-slot="notes-workspace" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-border/60 px-4 max-md:h-[calc(44px+env(safe-area-inset-top,0px))] max-md:pt-[env(safe-area-inset-top,0px)]">
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
        </div>
      </header>

      <div data-slot="notes-board" className="thin-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="empty-fill px-4 pb-16 pt-6 sm:px-6">
          {/* Đang tìm thì ẩn ô ghi nhanh, chỉ còn kết quả (như Keep) */}
          {!hasQuery && (
            <div
              data-slot="note-capture"
              onPointerDownCapture={() => {
                pointerInsideCaptureRef.current = true;
              }}
              {...(captureOpen ? captureFocusHandlers : {})}
              className={cn(
                "mx-auto w-full max-w-[600px] rounded-lg border border-border bg-card transition-shadow",
                captureOpen ? "shadow-md" : "shadow-sm"
              )}
            >
              <NoteEditor
                key={captureKey}
                variant="capture"
                note={null}
                collapsed={!captureOpen}
                onExpand={() => setCaptureOpen(true)}
                onClose={closeCapture}
                onSaved={handleSaved}
                onCreated={(note) => handleCaptureCreated(note, captureKey)}
                onDraft={handleDraft}
                onDelete={askDelete}
              />
            </div>
          )}

          <div className={cn("empty-fill", !hasQuery && "mt-8")}>
            {status === "loading" ? (
              <div aria-hidden>
                <NoteMasonry
                  items={SKELETON_ITEMS}
                  label="Đang tải ghi chú"
                  renderItem={(item) => (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <Skeleton className="w-full rounded" style={{ height: item.height - 34 }} />
                    </div>
                  )}
                />
              </div>
            ) : status === "error" ? (
              <EmptyState
                role="alert"
                density="page"
                glyph="load-error"
                title="Không tải được ghi chú"
                description="Kiểm tra kết nối rồi thử lại."
                action={
                  <Button size="pill" onClick={() => void loadList(query)}>
                    Thử lại
                  </Button>
                }
              />
            ) : isEmpty ? (
              hasQuery ? (
                <EmptyState role="status" density="page" glyph="no-results" title="Không có ghi chú phù hợp" description="Thử từ khóa khác." />
              ) : (
                <EmptyState
                  role="status"
                  density="page"
                  glyph="dossier"
                  title="Ghi chú bạn thêm sẽ hiện ở đây"
                  description="Ghi lại ý riêng cho cuộc họp, công việc. Chỉ mình bạn xem được."
                />
              )
            ) : (
              <div className="flex flex-col gap-8">
                {pinnedNotes.length > 0 && <NoteMasonry items={pinnedNotes} label="Đã ghim" heading="Đã ghim" renderItem={renderCard} />}
                {otherNotes.length > 0 && (
                  <NoteMasonry
                    items={otherNotes}
                    label={pinnedNotes.length > 0 ? "Khác" : "Ghi chú"}
                    heading={pinnedNotes.length > 0 ? "Khác" : undefined}
                    renderItem={renderCard}
                  />
                )}
                {hasMore && (
                  <p className="text-center text-xs text-muted-foreground">Chỉ hiện các ghi chú mới nhất. Dùng ô tìm để tìm ghi chú cũ hơn.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hộp sửa: Esc, bấm ra ngoài, "Đóng" hay Ctrl/Cmd+Enter đều đóng. */}
      <StandardDialog
        open={Boolean(selectedId)}
        onOpenChange={(open, details) => {
          if (open) return;
          // Menu "/", thanh định dạng của editor nằm ở portal ngoài hộp: chỉ nhấn vào nền mờ mới là nhấn ra ngoài
          const target = details?.event?.target;
          if (details?.reason === "outside-press" && !(target instanceof Element && target.closest('[data-slot="dialog-backdrop"]'))) return;
          closeNote();
        }}
        title="Sửa ghi chú"
        showHeader={false}
        size="md"
        // Editor tự lấy tiêu điểm khi gắn (con trỏ cuối nội dung); hộp chuyển tiêu điểm vào khung trước thì con trỏ về đầu
        initialFocus={false}
        className="overflow-hidden p-0 sm:p-0"
      >
        {shown?.state === "ready" && shown.note ? (
          <div data-slot="note-dialog-body" className="flex min-h-0 flex-1 flex-col">
            <NoteEditor
              key={shown.note.id}
              variant="dialog"
              note={shown.note}
              onClose={closeNote}
              onSaved={handleSaved}
              onCreated={() => undefined}
              onDraft={handleDraft}
              onDelete={askDelete}
            />
          </div>
        ) : shown?.state === "missing" || shown?.state === "error" ? (
          <EmptyState
            density="compact"
            className="py-10"
            glyph={shown.state === "missing" ? "no-results" : "load-error"}
            title={shown.state === "missing" ? "Ghi chú không còn" : "Không mở được ghi chú"}
            description={shown.state === "missing" ? "Ghi chú đã bị xóa hoặc không phải của bạn." : "Kiểm tra kết nối rồi thử lại."}
            action={
              shown.state === "error" ? (
                <Button size="pill" onClick={() => setLoadAttempt((n) => n + 1)}>
                  Thử lại
                </Button>
              ) : (
                <Button size="pill" variant="outline" onClick={closeNote}>
                  Đóng
                </Button>
              )
            }
          />
        ) : (
          <div aria-hidden className="flex h-40 items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {/* Lồng trong hộp sửa để Base UI coi là hộp con: hộp mở ở gốc trang bị lớp phủ của hộp sửa chặn, không bấm được */}
        {selectedId && deleteConfirm}
      </StandardDialog>

      {/* Xóa từ thẻ: hộp xác nhận ở trang; xóa từ hộp sửa: lồng trong hộp sửa (xem dưới) */}
      {!selectedId && deleteConfirm}
    </div>
  );
}
