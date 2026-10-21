"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Lock, Pin, PinOff, Trash2 } from "lucide-react";
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

export interface NoteEditorProps {
  /** null: ghi chú mới chưa lưu; gõ chữ đầu tiên mới tạo (xem `useNoteAutosave`). */
  note: PersonalNote | null;
  /** Điện thoại: hiện nút quay lại danh sách. */
  onBack?: () => void;
  onSaved: (note: PersonalNote) => void;
  onCreated: (note: PersonalNote) => void;
  /** Mỗi lần gõ: để danh sách và bản nhớ tạm theo kịp chữ đang soạn, không chờ lưu xong. */
  onDraft: (patch: { title?: string; content?: string }) => void;
  onDelete: (noteId: string) => void;
}

/**
 * Soạn một ghi chú: tiêu đề + nội dung tự lưu sau khi ngừng gõ. Component được `key` theo từng ghi chú (ghi chú mới giữ
 * nguyên key cả lúc vừa được tạo, để con trỏ không nhảy) nên mỗi ghi chú khởi tạo lại phần nháp, không lẫn chữ.
 */
export function NoteEditor({ note, onBack, onSaved, onCreated, onDraft, onDelete }: NoteEditorProps) {
  const [title, setTitle] = React.useState(note?.title ?? "");
  const [content, setContent] = React.useState(note?.content ?? "");
  const [pinned, setPinned] = React.useState(note?.pinned ?? false);
  const [pinError, setPinError] = React.useState(false);
  const [editedAt, setEditedAt] = React.useState(note?.updatedAt ?? null);
  const titleRef = React.useRef<HTMLTextAreaElement>(null);
  const contentRef = React.useRef<HTMLTextAreaElement>(null);
  const { state, noteId, schedule: scheduleSave, retry } = useNoteAutosave(note?.id ?? null, {
    onSaved: (saved) => {
      setEditedAt(saved.updatedAt);
      onSaved(saved);
    },
    onCreated: (created) => {
      setEditedAt(created.updatedAt);
      onCreated(created);
    },
  });
  const schedule = (patch: { title?: string; content?: string }) => {
    onDraft(patch);
    scheduleSave(patch);
  };
  const entity = note ? noteEntityHref(note) : null;
  const gone = state === "gone";

  // Ghi chú trống (vừa bấm "+") mở ra là gõ được ngay
  React.useEffect(() => {
    if (!titleRef.current?.value && !contentRef.current?.value) titleRef.current?.focus();
  }, []);

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

  const focusContentEnd = () => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };

  return (
    <div data-slot="note-editor" className="flex min-h-0 flex-1 flex-col">
      {/* Thanh đầu chỉ còn thao tác; nơi gắn và giờ sửa nằm dưới tiêu đề như dòng thông tin của tài liệu */}
      <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border/60 px-4 max-md:h-[calc(44px+env(safe-area-inset-top,0px))] max-md:pt-[env(safe-area-inset-top,0px)]">
        {onBack && (
          <Button variant="ghost" size="icon-xs" onClick={onBack} aria-label="Quay lại danh sách ghi chú">
            <ArrowLeft />
          </Button>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span
            role="status"
            aria-live="polite"
            className={cn("mr-1 text-xs", state === "error" || gone ? "text-destructive" : "text-muted-foreground")}
          >
            {pinError ? "Chưa ghim được" : SAVE_LABEL[state]}
          </span>
          {state === "error" && (
            <Button variant="ghost" size="xs" onClick={() => void retry()}>
              Thử lại
            </Button>
          )}
          {/* Chưa gõ gì thì chưa có ghi chú để ghim hay xóa: rời đi là xong */}
          {noteId && (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                title={pinned ? "Bỏ ghim" : "Ghim lên đầu danh sách"}
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
        </div>
      </header>

      {/* Một mặt viết liền như Notion/Bear: tiêu đề, dòng thông tin, nội dung; lề trái như trang chi tiết nhiệm vụ, không đóng
          khung giữa (người dùng chê cột hẹp giữa trang rộng ở trang cuộc họp 21/10/2026). Bấm vào khoảng trống bên dưới là
          viết tiếp cuối nội dung. */}
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col px-4 pb-16 pt-6 sm:px-6 min-[90rem]:px-12">
          <Textarea
            ref={titleRef}
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
              // Enter ở tiêu đề chuyển xuống nội dung như trình soạn ghi chú thông thường
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                contentRef.current?.focus();
              }
            }}
            className="py-0 text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-xl"
          />
          {/* Không dùng dấu "·" ngăn cách: xuống dòng ở điện thoại thì dấu treo cuối dòng */}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Lock aria-hidden className="size-3" />
              Chỉ mình bạn xem được
            </span>
            {entity && (
              <Link href={entity.href} className="inline-flex items-center gap-0.5 rounded-sm transition-colors hover:text-foreground hover:underline">
                {entity.label}
                <ArrowUpRight aria-hidden className="size-3" />
              </Link>
            )}
            {editedAt && <span>Sửa lúc {formatRecencyTime(editedAt, new Date()).full}</span>}
          </p>
          <Textarea
            ref={contentRef}
            variant="bare"
            autoResize
            compact
            countOnlyNearLimit
            value={content}
            maxLength={PERSONAL_NOTE_CONTENT_MAX}
            disabled={gone}
            placeholder="Viết ghi chú…"
            aria-label="Nội dung ghi chú"
            onChange={(event) => {
              setContent(event.target.value);
              schedule({ content: event.target.value });
            }}
            className="mt-4 py-0 leading-6"
          />
          <div aria-hidden className="min-h-16 flex-1 cursor-text" onMouseDown={(event) => {
            event.preventDefault();
            focusContentEnd();
          }} />
        </div>
      </div>
    </div>
  );
}
