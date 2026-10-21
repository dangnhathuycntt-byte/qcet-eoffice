"use client";

import * as React from "react";
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

const SAVE_LABEL: Record<NoteSaveState, string> = {
  idle: "",
  dirty: "Chưa lưu",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  error: "Chưa lưu được",
  gone: "Ghi chú đã bị xóa",
};

/** Đường dẫn tới đối tượng ghi chú gắn vào (cuộc họp, nhiệm vụ). */
export function noteEntityHref(note: Pick<PersonalNote, "entityType" | "entityId">): { href: string; label: string } | null {
  if (!note.entityType || !note.entityId) return null;
  const id = encodeURIComponent(note.entityId);
  return note.entityType === "meeting"
    ? { href: `/meetings/${id}`, label: "Cuộc họp" }
    : { href: `/tasks/${id}`, label: "Nhiệm vụ" };
}

type DraftPatch = { title?: string; content?: string };

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
  /** Ô nội dung, để hộp sửa đặt tiêu điểm vào khi mở. */
  contentRef?: React.RefObject<HTMLTextAreaElement | null>;
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
  contentRef: externalContentRef,
}: NoteEditorProps) {
  const [title, setTitle] = React.useState(note?.title ?? "");
  const [content, setContent] = React.useState(note?.content ?? "");
  const [pinned, setPinned] = React.useState(note?.pinned ?? false);
  const [pinError, setPinError] = React.useState(false);
  const [editedAt, setEditedAt] = React.useState(note?.updatedAt ?? null);
  const internalContentRef = React.useRef<HTMLTextAreaElement>(null);
  const contentRef = externalContentRef ?? internalContentRef;
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
    } else if (event.key === "Escape" && variant === "capture") {
      event.preventDefault();
      onClose();
    }
  };

  const contentField = (
    <Textarea
      ref={contentRef}
      variant="bare"
      autoResize
      compact
      countOnlyNearLimit
      rows={1}
      value={content}
      maxLength={PERSONAL_NOTE_CONTENT_MAX}
      disabled={gone}
      placeholder="Ghi chú…"
      aria-label={collapsed ? "Viết ghi chú mới" : "Nội dung ghi chú"}
      onFocus={collapsed ? onExpand : undefined}
      onChange={(event) => {
        setContent(event.target.value);
        schedule({ content: event.target.value });
      }}
      className={cn("leading-6", collapsed ? "py-2.5" : "py-0", variant === "dialog" && "min-h-12")}
    />
  );

  // Thu gọn chỉ còn ô nội dung (như ô "Ghi chú…" của Keep). Cùng một cây với lúc mở (tiêu đề, thanh dưới chỉ ẩn/hiện) để ô
  // nội dung không bị gắn lại và mất tiêu điểm khi mở ra.
  return (
    <div data-slot="note-editor" className="flex min-h-0 flex-1 flex-col" onKeyDown={collapsed ? undefined : handleKeyDown}>
      <div
        className={cn(
          "flex flex-col gap-2 px-4",
          !collapsed && "pt-3",
          variant === "dialog" && "thin-scrollbar min-h-0 flex-1 overflow-y-auto pt-4 sm:px-5"
        )}
      >
        {!collapsed && (
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
                contentRef.current?.focus();
              }
            }}
            className="py-0 text-base font-semibold leading-snug tracking-tight text-foreground sm:text-base"
          />
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
        <footer className="flex h-11 shrink-0 items-center gap-1 px-2.5">
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
          <span
            role="status"
            aria-live="polite"
            className={cn("ml-auto text-xs", state === "error" || gone ? "text-destructive" : "text-muted-foreground")}
          >
            {pinError ? "Chưa ghim được" : SAVE_LABEL[state]}
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
      )}
    </div>
  );
}
