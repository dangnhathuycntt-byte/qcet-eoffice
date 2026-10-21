"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, Pin, PinOff, Trash2 } from "lucide-react";
import type { PersonalNote } from "@qcet/contracts/personal-notes";
import {
  PERSONAL_NOTE_CONTENT_MAX,
  PERSONAL_NOTE_TITLE_MAX,
} from "@qcet/contracts/personal-notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatRecencyTime } from "@qcet/shared/lib/format/recency";
import { updateNote } from "@/components/notes/notes-client";
import { useNoteAutosave, type NoteSaveState } from "@/components/notes/use-note-autosave";

/** Tự lưu nên không báo "Đang lưu…/Đã lưu" (người dùng bỏ 21/10/2026); chỉ báo khi lưu hỏng. */
const SAVE_PROBLEM: Partial<Record<NoteSaveState, string>> = {
  error: "Chưa lưu được",
  gone: "Ghi chú đã bị xóa",
};

// Nội dung soạn bằng editor khối như mô tả nhiệm vụ (menu "/", thanh định dạng khi bôi đen, dán ảnh). Editor nặng nên tách
// chunk; trang Ghi chú tải trước lúc rảnh (`preloadNoteBodyEditor`).
const loadBodyEditor = () => import("@/components/tasks/detail/task-block-editor");
const BodyEditor = dynamic(() => loadBodyEditor().then((m) => m.TaskBlockEditor), {
  ssr: false,
  loading: () => <p className="text-sm leading-relaxed text-muted-foreground">Ghi chú…</p>,
});

export function preloadNoteBodyEditor() {
  void loadBodyEditor();
}

/** Đường dẫn tới đối tượng ghi chú gắn vào (cuộc họp, nhiệm vụ). */
export function noteEntityHref(note: Pick<PersonalNote, "entityType" | "entityId">): { href: string; label: string } | null {
  if (!note.entityType || !note.entityId) return null;
  const id = encodeURIComponent(note.entityId);
  return note.entityType === "meeting"
    ? { href: `/meetings/${id}`, label: "Cuộc họp" }
    : { href: `/tasks/${id}`, label: "Nhiệm vụ" };
}

type DraftPatch = { title?: string; content?: string };

/**
 * Ô ghi nhanh mở ra có chuyển động (người dùng gửi ảnh ô thu gọn và lúc mở, yêu cầu thêm hiệu ứng 21/10/2026): đệm và khoảng
 * cách chuyển mượt, tiêu đề và thanh dưới mở dần từ cao 0 (`Reveal`). Chỉ chạy khi mở; đóng lại vẫn thu ngay như Keep.
 */
const EXPAND_TRANSITION =
  "transition-[gap,padding] duration-[var(--motion-duration-normal)] ease-[var(--motion-ease-enter)] motion-reduce:transition-none";

/** Hiện dần từ cao 0 khi vừa gắn vào (`@starting-style`): lưới 0fr → 1fr kèm mờ → rõ. */
function Reveal({ animate, children }: { animate: boolean; children: React.ReactNode }) {
  if (!animate) return <>{children}</>;
  return (
    <div className="grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-[var(--motion-duration-normal)] ease-[var(--motion-ease-enter)] starting:grid-rows-[0fr] starting:opacity-0 motion-reduce:transition-none">
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

export interface NoteEditorProps {
  /** null: ghi chú mới chưa lưu; gõ chữ đầu tiên mới tạo (xem `useNoteAutosave`). */
  note: PersonalNote | null;
  /** `capture`: ô ghi nhanh đầu trang; `dialog`: hộp sửa khi bấm một thẻ. */
  variant: "capture" | "dialog";
  /** Ô ghi nhanh đang thu gọn: chỉ một dòng "Ghi chú…", tiêu điểm vào thì `onExpand`. */
  collapsed?: boolean;
  onExpand?: () => void;
  /** "Đóng", Ctrl/Cmd+Enter (như Google Keep); ô ghi nhanh thêm Esc (hộp sửa thì Esc do hộp thoại lo). */
  onClose: () => void;
  onSaved: (note: PersonalNote) => void;
  onCreated: (note: PersonalNote) => void;
  /** Mỗi lần gõ: để thẻ và bản nhớ tạm theo kịp chữ đang soạn, không chờ lưu xong. Chưa tạo thì `noteId` null. */
  onDraft: (noteId: string | null, patch: DraftPatch) => void;
  onDelete: (noteId: string) => void;
}

/**
 * Soạn một ghi chú dạng thẻ như Google Keep: tiêu đề, nội dung, thanh dưới (ghim, xóa, trạng thái lưu, "Đóng"). Tự lưu sau khi
 * ngừng gõ. Component được `key` theo từng ghi chú (ô ghi nhanh: theo từng lượt mở) nên phần nháp không lẫn giữa hai ghi chú.
 */
export function NoteEditor({
  note,
  variant,
  collapsed = false,
  onExpand,
  onClose,
  onSaved,
  onCreated,
  onDraft,
  onDelete,
}: NoteEditorProps) {
  const [title, setTitle] = React.useState(note?.title ?? "");
  const [content, setContent] = React.useState(note?.content ?? "");
  const [pinned, setPinned] = React.useState(note?.pinned ?? false);
  const [pinError, setPinError] = React.useState(false);
  const [editedAt, setEditedAt] = React.useState(note?.updatedAt ?? null);
  const [tooLong, setTooLong] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const { state, noteId, schedule: scheduleSave, retry } = useNoteAutosave(note?.id ?? null, {
    onSaved: (saved) => {
      setEditedAt(saved.updatedAt);
      onSaved(saved);
    },
    onCreated: (created) => {
      setEditedAt(created.updatedAt);
      // Chữ gõ thêm trong lúc đang tạo chưa có trong bản máy chủ trả về: đưa chữ đang soạn lên để thẻ và bản nhớ tạm (mở lại
      // ghi chú) không lùi về lúc tạo
      onCreated({ ...created, title, content });
    },
  });
  const schedule = (patch: DraftPatch) => {
    onDraft(noteId, patch);
    scheduleSave(patch);
  };
  const entity = note ? noteEntityHref(note) : null;
  const gone = state === "gone";

  const togglePin = async () => {
    if (!noteId) return;
    const next = !pinned;
    setPinned(next);
    setPinError(false);
    try {
      onSaved(await updateNote(noteId, { pinned: next }));
    } catch {
      setPinned(!next);
      setPinError(true);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onClose();
    }
  };

  // Esc đóng như Keep. Bắt ở pha capture vì editor dùng Esc để chọn khối và chặn lan lên (hộp thoại không nhận được); ô tìm
  // của menu "/" là <input> riêng, Esc ở đó chỉ đóng menu. Tiêu đề trong hộp sửa thì để hộp thoại tự đóng.
  const handleKeyDownCapture = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT") return;
    if (variant === "dialog" && !target.isContentEditable) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  // Editor báo nội dung (khối QCET JSON) ngay sau mỗi thay đổi; quá giới hạn thì giữ trên màn hình, không gửi lên để khỏi
  // bị từ chối lặp lại
  const handleContent = (next: string) => {
    if (next.length > PERSONAL_NOTE_CONTENT_MAX) {
      setTooLong(true);
      return;
    }
    setTooLong(false);
    setContent(next);
    schedule({ content: next });
  };

  const focusBody = () => bodyRef.current?.querySelector<HTMLElement>("[data-slate-editor]")?.focus();

  // Ô ghi nhanh thu gọn cũng là editor (chỉ thiếu tiêu đề và thanh dưới): tiêu điểm vào thì mở ra, không phải đổi ô nhập. Lúc
  // thu gọn ẩn tay kéo khối (một dòng "Ghi chú…" rê chuột vào hiện tay kéo trông như lỗi)
  const contentField = (
    <div
      ref={bodyRef}
      data-slot="note-body"
      onFocus={collapsed ? onExpand : undefined}
      className={cn(
        "flex min-h-6 flex-col [&_[data-slate-editor]]:pb-0",
        collapsed && "py-2.5 [&_[data-slot=block-handle]]:invisible",
        variant === "capture" && !collapsed && EXPAND_TRANSITION,
        variant === "dialog" && "min-h-12"
      )}
    >
      <BodyEditor
        variant="compose"
        taskId={`note-${note?.id ?? "new"}`}
        initialDescription={note?.content ?? ""}
        onSaveContent={handleContent}
        canEdit={!gone}
        globalFileDrop={false}
        autoFocus={variant === "dialog"}
        ariaLabel={collapsed ? "Viết ghi chú mới" : "Nội dung ghi chú"}
        placeholder={collapsed ? "Ghi chú…" : "Ghi chú… Gõ / để chèn danh sách, tiêu đề, ảnh"}
      />
    </div>
  );

  // Thu gọn chỉ còn ô nội dung (như ô "Ghi chú…" của Keep). Cùng một cây với lúc mở (tiêu đề, thanh dưới chỉ ẩn/hiện) để ô
  // nội dung không bị gắn lại và mất tiêu điểm khi mở ra.
  return (
    <div
      data-slot="note-editor"
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={collapsed ? undefined : handleKeyDown}
      onKeyDownCapture={collapsed ? undefined : handleKeyDownCapture}
    >
      {/* Lề 24px trên máy tính: tay kéo khối của editor nằm trong lề này (điện thoại không có tay kéo) */}
      <div
        className={cn(
          "flex flex-col px-4 md:px-6",
          collapsed ? "gap-0" : "gap-2 pt-3",
          variant === "capture" && !collapsed && EXPAND_TRANSITION,
          variant === "dialog" && "thin-scrollbar min-h-0 flex-1 overflow-y-auto pt-4"
        )}
      >
        {!collapsed && (
          <Reveal animate={variant === "capture"}>
            <Textarea
              variant="bare"
              compact
              autoResize
              countOnlyNearLimit
              rows={1}
              value={title}
              maxLength={PERSONAL_NOTE_TITLE_MAX}
              disabled={gone}
              placeholder="Tiêu đề"
              aria-label="Tiêu đề ghi chú"
              onChange={(event) => {
                // Tiêu đề một đoạn: dán chữ nhiều dòng thì nối lại bằng dấu cách
                const next = event.target.value.replace(/\s*\r?\n\s*/g, " ");
                setTitle(next);
                schedule({ title: next });
              }}
              onKeyDown={(event) => {
                // Enter ở tiêu đề chuyển xuống nội dung (Ctrl/Cmd+Enter vẫn là "Đóng")
                if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  focusBody();
                }
              }}
              className="py-0 text-base font-semibold leading-snug tracking-tight text-foreground sm:text-base"
            />
          </Reveal>
        )}
        {contentField}
        {variant === "dialog" && (entity || editedAt) && (
          <p className="flex items-center gap-3 pb-1 text-xs text-muted-foreground">
            {entity && (
              <Link href={entity.href} className="inline-flex items-center gap-0.5 rounded-sm transition-colors hover:text-foreground hover:underline">
                {entity.label}
                <ArrowUpRight aria-hidden className="size-3" />
              </Link>
            )}
            {editedAt && (
              <span className="ml-auto" title={formatRecencyTime(editedAt, new Date()).full}>
                Đã sửa {formatRecencyTime(editedAt, new Date()).short}
              </span>
            )}
          </p>
        )}
      </div>
      {!collapsed && (
        <Reveal animate={variant === "capture"}>
          <footer className="flex h-11 shrink-0 items-center gap-1 px-2.5 md:px-4.5">
            {/* Chưa gõ gì thì chưa có ghi chú để ghim hay xóa */}
            {noteId && (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title={pinned ? "Bỏ ghim" : "Ghim"}
                  aria-label={pinned ? "Bỏ ghim ghi chú" : "Ghim ghi chú"}
                  aria-pressed={pinned}
                  disabled={gone}
                  onClick={() => void togglePin()}
                >
                  {pinned ? <PinOff /> : <Pin />}
                </Button>
                <Button variant="ghost" size="icon-xs" title="Xóa ghi chú" aria-label="Xóa ghi chú" onClick={() => onDelete(noteId)}>
                  <Trash2 />
                </Button>
              </>
            )}
            <span role="status" aria-live="polite" className="ml-auto text-xs text-destructive">
              {pinError ? "Chưa ghim được" : tooLong ? "Ghi chú quá dài, phần mới chưa lưu" : SAVE_PROBLEM[state]}
            </span>
            {state === "error" && (
              <Button variant="ghost" size="xs" onClick={() => void retry()}>
                Thử lại
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} title="Đóng (Ctrl+Enter)">
              Đóng
            </Button>
          </footer>
        </Reveal>
      )}
    </div>
  );
}
