"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Pin, PinOff, Trash2 } from "lucide-react";
import type { PersonalNote } from "@qcet/contracts/personal-notes";
import {
  PERSONAL_NOTE_CONTENT_MAX,
  PERSONAL_NOTE_TITLE_MAX,
} from "@qcet/contracts/personal-notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  note: PersonalNote;
  /** Điện thoại: hiện nút quay lại danh sách. */
  onBack?: () => void;
  onSaved: (note: PersonalNote) => void;
  /** Mỗi lần gõ: để danh sách và bản nhớ tạm theo kịp chữ đang soạn, không chờ lưu xong. */
  onDraft: (patch: { title?: string; content?: string }) => void;
  onDelete: () => void;
}

/**
 * Soạn một ghi chú: tiêu đề + nội dung tự lưu sau khi ngừng gõ. Component được `key` theo mã ghi chú nên mỗi ghi chú
 * khởi tạo lại phần nháp, không lẫn chữ giữa hai ghi chú.
 */
export function NoteEditor({ note, onBack, onSaved, onDraft, onDelete }: NoteEditorProps) {
  const [title, setTitle] = React.useState(note.title);
  const [content, setContent] = React.useState(note.content);
  const [pinned, setPinned] = React.useState(note.pinned);
  const [pinError, setPinError] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const { state, schedule: scheduleSave, retry } = useNoteAutosave(note.id, onSaved);
  const schedule = (patch: { title?: string; content?: string }) => {
    onDraft(patch);
    scheduleSave(patch);
  };
  const entity = noteEntityHref(note);
  const gone = state === "gone";

  // Ghi chú mới tạo (trống) mở ra là gõ được ngay
  React.useEffect(() => {
    if (!note.title && !note.content) titleRef.current?.focus();
  }, [note.id, note.title, note.content]);

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    setPinError(false);
    try {
      onSaved(await updateNote(note.id, { pinned: next }));
    } catch {
      setPinned(!next);
      setPinError(true);
    }
  };

  return (
    <div data-slot="note-editor" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border/60 px-4 max-md:h-[calc(44px+env(safe-area-inset-top,0px))] max-md:pt-[env(safe-area-inset-top,0px)]">
        {onBack && (
          <Button variant="ghost" size="icon-xs" onClick={onBack} aria-label="Quay lại danh sách ghi chú">
            <ArrowLeft />
          </Button>
        )}
        {entity ? (
          <Link
            href={entity.href}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Gắn với {entity.label.toLowerCase()}
            <ArrowUpRight className="size-3.5" />
          </Link>
        ) : (
          <span className="truncate text-xs text-muted-foreground">Chỉ mình bạn xem được</span>
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
          <Button variant="ghost" size="icon-xs" title="Xóa ghi chú" aria-label="Xóa ghi chú" onClick={onDelete}>
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-5 sm:px-8">
          <Input
            ref={titleRef}
            variant="menu"
            value={title}
            maxLength={PERSONAL_NOTE_TITLE_MAX}
            disabled={gone}
            placeholder="Tiêu đề ghi chú"
            aria-label="Tiêu đề ghi chú"
            onChange={(event) => {
              setTitle(event.target.value);
              schedule({ title: event.target.value });
            }}
            onKeyDown={(event) => {
              // Enter ở tiêu đề chuyển xuống nội dung như trình soạn thảo ghi chú thông thường
              if (event.key === "Enter") {
                event.preventDefault();
                document.getElementById(`note-content-${note.id}`)?.focus();
              }
            }}
            className="h-9 px-0 text-lg font-semibold sm:h-9 sm:text-lg"
          />
          <Textarea
            id={`note-content-${note.id}`}
            autoResize
            compact
            countOnlyNearLimit
            value={content}
            maxLength={PERSONAL_NOTE_CONTENT_MAX}
            disabled={gone}
            placeholder="Viết ghi chú… (chỉ mình bạn xem được)"
            aria-label="Nội dung ghi chú"
            onChange={(event) => {
              setContent(event.target.value);
              schedule({ content: event.target.value });
            }}
            className="min-h-[50vh] bg-transparent px-0 py-1 leading-6 hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none sm:min-h-[50vh]"
          />
        </div>
      </div>
    </div>
  );
}
