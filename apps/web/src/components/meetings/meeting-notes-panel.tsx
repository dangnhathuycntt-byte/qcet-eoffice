"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { PersonalNoteSummary } from "@qcet/contracts/personal-notes";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-layer";
import { createNote, fetchNotes } from "@/components/notes/notes-client";

/**
 * Ghi chú riêng của người xem gắn với cuộc họp này (chỉ mình họ thấy, kể cả người tổ chức hay lãnh đạo không đọc được).
 * Tạo mới thì mở thẳng trình soạn ở trang Ghi chú cá nhân.
 */
export function MeetingNotesPanel({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const { notifyError } = useFeedback();
  const [notes, setNotes] = React.useState<PersonalNoteSummary[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    fetchNotes({ entityType: "meeting", entityId: meetingId }, controller.signal)
      .then((result) => {
        setNotes(result.notes);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [meetingId]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const note = await createNote({ entityType: "meeting", entityId: meetingId });
      router.push(`/notes?id=${encodeURIComponent(note.id)}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Không tạo được ghi chú.");
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      {status === "loading" ? (
        <p className="text-xs text-muted-foreground">Đang tải…</p>
      ) : status === "error" ? (
        <p className="text-xs text-muted-foreground">Chưa tải được ghi chú.</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có ghi chú. Ghi chú chỉ mình bạn xem được.</p>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {notes.map((note) => (
            <li key={note.id}>
              <Link
                href={`/notes?id=${encodeURIComponent(note.id)}`}
                className="block rounded-md px-2 py-1 transition-colors hover:bg-accent/60"
              >
                <span className="block truncate text-compact font-medium text-foreground">{note.title || "Ghi chú không tên"}</span>
                <span className="block truncate text-xs text-muted-foreground">{note.excerpt || "Chưa có nội dung"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button size="pill" variant="toolbar" loading={isCreating} onClick={() => void handleCreate()}>
        <Plus />
        Ghi chú mới
      </Button>
    </div>
  );
}
