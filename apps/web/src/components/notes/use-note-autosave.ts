"use client";

import * as React from "react";
import type { PersonalNote } from "@qcet/contracts/personal-notes";
import { NotesRequestError, createNote, updateNote } from "@/components/notes/notes-client";

export type NoteSaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "gone";

const AUTOSAVE_DELAY_MS = 800;

interface Draft {
  title: string;
  content: string;
}

interface AutosaveCallbacks {
  onSaved: (note: PersonalNote) => void;
  /** Ghi chú mới (chưa có mã) vừa được tạo ở lần lưu đầu. */
  onCreated: (note: PersonalNote) => void;
}

function sendOnLeave(noteId: string | null, patch: Partial<Draft>): Promise<Response> {
  // keepalive để lần lưu cuối vẫn đi khi người dùng rời trang
  return fetch(noteId ? `/api/notes/${encodeURIComponent(noteId)}` : "/api/notes", {
    method: noteId ? "PATCH" : "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/**
 * Tự lưu ghi chú đang mở: gom thay đổi trong 800ms rồi gửi một lần; thay đổi tới trong lúc đang lưu được gửi nối tiếp.
 * Ghi chú mới chưa có mã (`initialNoteId` null): lần lưu đầu tạo ghi chú rồi mới sửa tiếp, nên bấm "+" mà không gõ gì thì
 * không để lại ghi chú trống (như Apple Notes). Trình soạn được `key` theo từng ghi chú nên mỗi lần gắn chỉ lo một ghi chú;
 * gỡ ra (đổi ghi chú, đóng trang) thì lưu nốt phần chưa gửi. 404 nghĩa là ghi chú đã bị xóa ở nơi khác: dừng lưu, báo `gone`.
 */
export function useNoteAutosave(initialNoteId: string | null, callbacks: AutosaveCallbacks) {
  const [state, setState] = React.useState<NoteSaveState>("idle");
  const [noteId, setNoteId] = React.useState(initialNoteId);
  const pendingRef = React.useRef<Partial<Draft> | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const inFlightRef = React.useRef(false);
  const goneRef = React.useRef(false);
  const noteIdRef = React.useRef(initialNoteId);
  const callbacksRef = React.useRef(callbacks);
  callbacksRef.current = callbacks;

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
    setState("saving");
    let ok = false;
    try {
      const id = noteIdRef.current;
      if (id === null) {
        const created = await createNote(patch);
        noteIdRef.current = created.id;
        setNoteId(created.id);
        callbacksRef.current.onCreated(created);
      } else {
        callbacksRef.current.onSaved(await updateNote(id, patch));
      }
      ok = true;
      setState(pendingRef.current ? "dirty" : "saved");
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
      // Chỉ gửi nối khi lần này lưu được: lỗi mạng mà gửi lại ngay thì thành vòng lặp liên tục
      if (ok && pendingRef.current && !goneRef.current) void flush();
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

  // Gỡ trình soạn (đổi ghi chú, rời trang): lưu nốt phần chưa gửi. Đang gửi dở thì để lần gửi đó gửi nối, không tạo trùng.
  React.useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const patch = pendingRef.current;
      if (!patch || goneRef.current || inFlightRef.current) return;
      pendingRef.current = null;
      const id = noteIdRef.current;
      void sendOnLeave(id, patch)
        .then(async (res) => {
          if (id === null && res.ok) callbacksRef.current.onCreated((await res.json()) as PersonalNote);
        })
        .catch(() => undefined);
    },
    []
  );

  // Đóng tab khi còn thay đổi chưa gửi: cảnh báo của trình duyệt
  React.useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (pendingRef.current || inFlightRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return { state, noteId, schedule, retry: flush };
}
