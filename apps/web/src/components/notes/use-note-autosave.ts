"use client";

import * as React from "react";
import type { PersonalNote } from "@qcet/contracts/personal-notes";
import { NotesRequestError, updateNote } from "@/components/notes/notes-client";

export type NoteSaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "gone";

const AUTOSAVE_DELAY_MS = 800;

interface Draft {
  title: string;
  content: string;
}

/**
 * Tự lưu ghi chú đang mở: gom thay đổi trong 800ms rồi gửi một lần; thay đổi tới trong lúc đang lưu được gửi nối tiếp.
 * Mỗi ghi chú một bộ đệm riêng (theo `noteId`), đổi ghi chú hoặc đóng trang thì lưu nốt phần chưa gửi.
 * 404 nghĩa là ghi chú đã bị xóa ở nơi khác: dừng lưu và báo `gone`.
 */
export function useNoteAutosave(noteId: string, onSaved: (note: PersonalNote) => void) {
  const [state, setState] = React.useState<NoteSaveState>("idle");
  const pendingRef = React.useRef<Partial<Draft> | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const inFlightRef = React.useRef(false);
  const goneRef = React.useRef(false);
  const noteIdRef = React.useRef(noteId);
  const onSavedRef = React.useRef(onSaved);
  onSavedRef.current = onSaved;

  const flush = React.useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (inFlightRef.current || goneRef.current) return;
    const patch = pendingRef.current;
    if (!patch) return;
    pendingRef.current = null;
    inFlightRef.current = true;
    const savingId = noteIdRef.current;
    setState("saving");
    try {
      const saved = await updateNote(savingId, patch);
      if (noteIdRef.current === savingId) {
        onSavedRef.current(saved);
        setState(pendingRef.current ? "dirty" : "saved");
      }
    } catch (error) {
      if (error instanceof NotesRequestError && error.status === 404) {
        goneRef.current = true;
        setState("gone");
      } else {
        // Giữ lại phần chưa lưu được để lần gõ sau (hoặc nút thử lại) gửi cùng
        const queued = pendingRef.current as Partial<Draft> | null;
        pendingRef.current = { ...patch, ...queued };
        setState("error");
      }
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current && !goneRef.current && noteIdRef.current === savingId) void flush();
    }
  }, []);

  const schedule = React.useCallback(
    (patch: Partial<Draft>) => {
      if (goneRef.current) return;
      pendingRef.current = { ...pendingRef.current, ...patch };
      setState("dirty");
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush]
  );

  // Đổi sang ghi chú khác: lưu nốt ghi chú cũ bằng đúng mã cũ rồi đặt lại trạng thái
  React.useEffect(() => {
    noteIdRef.current = noteId;
    goneRef.current = false;
    setState("idle");
    return () => {
      if (pendingRef.current && !goneRef.current) {
        const patch = pendingRef.current;
        pendingRef.current = null;
        // keepalive để lần lưu cuối vẫn đi khi người dùng rời trang
        void fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
          method: "PATCH",
          credentials: "include",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).catch(() => undefined);
      }
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [noteId]);

  // Đóng tab khi còn thay đổi chưa gửi: cảnh báo của trình duyệt
  React.useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (pendingRef.current || inFlightRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return { state, schedule, retry: flush };
}
