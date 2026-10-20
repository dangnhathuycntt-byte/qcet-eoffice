"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Mic, RotateCcw, Square, Trash2, Upload } from "lucide-react";
import {
  MEETING_RECORDING_MAX_BYTES,
  type MeetingRecordingDetail,
  type MeetingRecordingSummary,
} from "@qcet/contracts/meeting-recordings";
import { formatClock } from "@qcet/shared/domain/meetings/recording-transcript";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Progress } from "@/components/ui/progress";
import { useFeedback } from "@/components/ui/feedback-layer";
import { SectionCard } from "@/components/meetings/section-card";
import { RecordingResult } from "@/components/meetings/recording-result";
import {
  RecordingRequestError,
  deleteRecording,
  detectFileMimeType,
  estimateDurationSec,
  getRecording,
  listRecordings,
  retryRecording,
  uploadAudioFile,
} from "@/components/meetings/recording-client";
import { LiveRecordingSession, pickRecorderMimeType } from "@/components/meetings/live-recording-session";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;
const when = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

type Phase = "idle" | "starting" | "recording" | "finishing" | "uploading";

function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

function statusText(recording: MeetingRecordingSummary, now: number): string {
  switch (recording.status) {
    case "UPLOADING":
      return minutesSince(recording.createdAt, now) >= 10 ? "Chưa gửi xong" : "Đang tải lên";
    case "QUEUED":
      return "Đang chờ xử lý";
    case "PROCESSING": {
      const minutes = minutesSince(recording.createdAt, now);
      // Chưa chép xong đoạn nào: máy chủ đang nghe cả bản ghi để soạn biên bản (đường nhanh) hoặc đoạn đầu còn chạy, chưa có số đoạn để báo
      if (!recording.progress || recording.progress.done === 0) return `Đang nghe bản ghi · ${minutes} phút`;
      return `Đang chép lời · ${recording.progress.done}/${recording.progress.total} đoạn · ${minutes} phút`;
    }
    case "READY":
      return "Sẵn sàng";
    case "FAILED":
      return "Chưa xử lý được";
  }
}

export interface MeetingRecordingPanelProps {
  meetingId: string;
  /** Có thì kết quả có nút "Dùng làm biên bản nháp" (cuộc họp đã ở trạng thái soạn được biên bản). */
  onUseAsMinutes?: (text: string) => void;
  /** Lý do chưa điền thẳng vào biên bản được, hiện cạnh nút Sao chép. */
  minutesHint?: string;
}

/**
 * Ghi âm hoặc tải tệp ghi âm cuộc họp để AI chép lời và soạn biên bản đề xuất. Chỉ chủ tọa, thư ký, người tổ chức dùng
 * được (máy chủ kiểm quyền; nhận 403/404 thì khung tự ẩn). Âm thanh bị xóa khi xử lý xong.
 */
export function MeetingRecordingPanel({ meetingId, onUseAsMinutes, minutesHint }: MeetingRecordingPanelProps) {
  const { notifyError } = useFeedback();
  const [access, setAccess] = React.useState<"loading" | "ok" | "denied" | "error">("loading");
  const [recordings, setRecordings] = React.useState<MeetingRecordingSummary[]>([]);
  const [consent, setConsent] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [uploadedParts, setUploadedParts] = React.useState(0);
  const [fileProgress, setFileProgress] = React.useState<{ uploaded: number; total: number } | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [needsResend, setNeedsResend] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Record<string, MeetingRecordingDetail>>({});
  const [deleting, setDeleting] = React.useState<MeetingRecordingSummary | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  const sessionRef = React.useRef<LiveRecordingSession | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const watchIdRef = React.useRef<string | null>(null);
  const mountedRef = React.useRef(true);
  const canRecordLive = React.useMemo(() => (typeof window === "undefined" ? false : pickRecorderMimeType() !== null), []);

  const refresh = React.useCallback(
    async (signal?: AbortSignal) => {
      try {
        const { recordings: list } = await listRecordings(meetingId, signal);
        if (!mountedRef.current) return;
        setRecordings(list);
        setAccess("ok");
      } catch (error) {
        if ((error as Error).name === "AbortError" || !mountedRef.current) return;
        if (error instanceof RecordingRequestError && (error.status === 403 || error.status === 404)) setAccess("denied");
        else setAccess((current) => (current === "ok" ? current : "error"));
      }
    },
    [meetingId]
  );

  React.useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => {
      mountedRef.current = false;
      controller.abort();
      // Rời trang khi đang ghi: dừng và gửi nốt trong nền để không mất buổi ghi
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void session.stop().catch(() => undefined);
    };
  }, [refresh]);

  const hasActive = recordings.some((r) => r.status === "QUEUED" || r.status === "PROCESSING");
  React.useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [hasActive, refresh]);

  // Mở sẵn kết quả của bản vừa gửi khi nó xong
  React.useEffect(() => {
    const watchId = watchIdRef.current;
    if (!watchId) return;
    const watched = recordings.find((r) => r.id === watchId);
    if (watched?.status === "READY") {
      watchIdRef.current = null;
      void openRecording(watched.id, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordings]);

  React.useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => setElapsed(sessionRef.current?.elapsedSec ?? 0), 500);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Đóng tab khi đang ghi hoặc đang gửi: cảnh báo của trình duyệt
  React.useEffect(() => {
    if (phase === "idle") return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  async function openRecording(id: string, forceOpen = false) {
    setExpandedId((current) => (!forceOpen && current === id ? null : id));
    if (details[id]) return;
    try {
      const detail = await getRecording(meetingId, id);
      if (mountedRef.current) setDetails((current) => ({ ...current, [id]: detail }));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Không mở được kết quả.");
    }
  }

  async function startLive() {
    setProblem(null);
    setNeedsResend(false);
    setPhase("starting");
    try {
      sessionRef.current = await LiveRecordingSession.start(meetingId, {
        onUploaded: (count) => mountedRef.current && setUploadedParts(count),
        onUploadError: (message) => mountedRef.current && setProblem(message),
      });
      setElapsed(0);
      setUploadedParts(0);
      setPhase("recording");
    } catch (error) {
      sessionRef.current = null;
      setProblem(error instanceof Error ? error.message : "Không bắt đầu ghi âm được.");
      setPhase("idle");
    }
  }

  async function finishLive(resend = false) {
    const session = sessionRef.current;
    if (!session) return;
    setPhase("finishing");
    try {
      const recording = resend ? await session.finishAfterRetry() : await session.stop();
      sessionRef.current = null;
      watchIdRef.current = recording.id;
      setProblem(null);
      setNeedsResend(false);
      setPhase("idle");
      await refresh();
    } catch (error) {
      // Còn phần chưa gửi được: giữ phiên để gửi lại; lỗi khác (máy chủ từ chối) thì kết thúc phiên
      if (session.hasFailedParts) {
        setNeedsResend(true);
        setProblem(error instanceof Error ? error.message : "Còn phần âm thanh chưa gửi được.");
        setPhase("idle");
      } else {
        sessionRef.current = null;
        setProblem(error instanceof Error ? error.message : "Không hoàn tất được bản ghi.");
        setPhase("idle");
        await refresh();
      }
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const mimeType = detectFileMimeType(file);
    if (!mimeType) {
      setProblem("Định dạng chưa được hỗ trợ. Thầy/Cô chọn tệp webm, ogg, m4a/mp4, mp3 hoặc wav.");
      return;
    }
    if (file.size > MEETING_RECORDING_MAX_BYTES) {
      setProblem(`Tệp quá lớn (tối đa ${MEETING_RECORDING_MAX_BYTES / 1024 / 1024} MB).`);
      return;
    }
    setProblem(null);
    setPhase("uploading");
    setFileProgress({ uploaded: 0, total: file.size });
    try {
      const durationSec = await estimateDurationSec(file);
      const recording = await uploadAudioFile(meetingId, file, mimeType, durationSec, (progress) =>
        setFileProgress({ uploaded: progress.uploadedBytes, total: progress.totalBytes })
      );
      watchIdRef.current = recording.id;
      await refresh();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Không tải được tệp lên.");
      await refresh();
    } finally {
      if (mountedRef.current) {
        setPhase("idle");
        setFileProgress(null);
      }
    }
  }

  async function handleRetry(recording: MeetingRecordingSummary) {
    try {
      await retryRecording(meetingId, recording.id);
      watchIdRef.current = recording.id;
      await refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Không thử lại được.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteRecording(meetingId, deleting.id);
      setRecordings((current) => current.filter((r) => r.id !== deleting.id));
      setDetails((current) => {
        const { [deleting.id]: _removed, ...rest } = current;
        return rest;
      });
      if (expandedId === deleting.id) setExpandedId(null);
      setDeleting(null);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Không xóa được bản ghi.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (access === "loading" || access === "denied") return null;

  const busy = phase !== "idle";
  const canStart = consent && !busy;

  return (
    <SectionCard title="Ghi âm cuộc họp" icon={Mic}>
      <div className="space-y-3">
        {access === "error" && (
          <InlineAlert variant="error" actionLabel="Thử lại" onAction={() => void refresh()}>
            Chưa tải được danh sách bản ghi âm.
          </InlineAlert>
        )}

        {phase === "recording" || phase === "finishing" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-compact text-foreground">
              <span aria-hidden className="size-2 animate-pulse rounded-full bg-destructive" />
              <span className="font-medium tabular-nums">{phase === "finishing" ? "Đang gửi nốt…" : `Đang ghi ${formatClock(elapsed)}`}</span>
              <span className="text-xs text-muted-foreground">Đã gửi {uploadedParts} phần</span>
            </div>
            <p className="text-xs text-muted-foreground">Đừng đóng tab hoặc tắt màn hình khi đang ghi. Âm thanh được gửi dần lên máy chủ mỗi phút.</p>
            <Button size="sm" variant="destructive" loading={phase === "finishing"} onClick={() => void finishLive()}>
              <Square />
              Dừng và gửi
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
              <Checkbox checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={busy} className="mt-0.5" />
              <span>
                Tôi đã thông báo cho những người dự họp biết cuộc họp được ghi âm và đồng ý gửi âm thanh tới dịch vụ AI (Gemini) để chép lời.
                <span className="block text-muted-foreground">Âm thanh bị xóa sau khi xử lý xong. Kết quả là bản nháp, cần đọc lại trước khi dùng.</span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {canRecordLive && (
                <Button size="sm" disabled={!canStart} loading={phase === "starting"} onClick={() => void startLive()}>
                  <Mic />
                  Bắt đầu ghi âm
                </Button>
              )}
              <Button size="sm" variant="toolbar" disabled={!canStart} onClick={() => fileInputRef.current?.click()}>
                <Upload />
                Tải tệp ghi âm
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.opus"
                className="hidden"
                aria-label="Chọn tệp ghi âm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void handleFile(file);
                }}
              />
            </div>
            {!consent && <p className="text-xs text-muted-foreground">Tích xác nhận ở trên để bắt đầu.</p>}
            {!canRecordLive && <p className="text-xs text-muted-foreground">Trình duyệt này không ghi âm trực tiếp được; Thầy/Cô tải tệp ghi âm lên.</p>}
          </div>
        )}

        {phase === "uploading" && fileProgress && (
          <div className="space-y-1" aria-live="polite">
            <Progress value={fileProgress.uploaded} max={fileProgress.total} />
            <p className="text-xs text-muted-foreground">
              Đang tải lên {Math.round((fileProgress.uploaded / Math.max(1, fileProgress.total)) * 100)}% ({(fileProgress.total / 1024 / 1024).toFixed(1)} MB)
            </p>
          </div>
        )}

        {problem && (
          <InlineAlert variant="error" actionLabel={needsResend ? "Gửi lại" : undefined} onAction={needsResend ? () => void finishLive(true) : undefined}>
            {problem}
          </InlineAlert>
        )}

        {recordings.length > 0 && (
          <ul className="-mx-1 space-y-1 border-t border-border/30 pt-2">
            {recordings.map((recording) => {
              const detail = details[recording.id];
              const expanded = expandedId === recording.id;
              const ready = recording.status === "READY";
              return (
                <li key={recording.id} className="rounded-lg">
                  <div className="flex items-center gap-1 px-1">
                    <Pressable
                      disabled={!ready}
                      onClick={() => void openRecording(recording.id)}
                      aria-expanded={ready ? expanded : undefined}
                      className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left", ready && "hover:bg-accent/60")}
                    >
                      {recording.status === "READY" ? (
                        <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
                      ) : recording.status === "FAILED" ? (
                        <AlertCircle className="size-4 shrink-0 text-destructive" />
                      ) : (
                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-compact text-foreground">
                          {recording.source === "live" ? "Ghi trực tiếp" : "Tệp tải lên"} · {when.format(new Date(recording.createdAt))}
                        </span>
                        <span className={cn("block text-xs", recording.status === "FAILED" ? "text-destructive" : "truncate text-muted-foreground")}>
                          {statusText(recording, now)}
                          {recording.durationSec ? ` · ${formatClock(recording.durationSec)}` : ""}
                          {recording.status === "FAILED" && recording.error ? ` · ${recording.error}` : ""}
                        </span>
                      </span>
                      {ready && <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />}
                    </Pressable>
                    {recording.status === "FAILED" && recording.durationSec !== null && (
                      <Button variant="ghost" size="icon-xs" aria-label="Thử lại" title="Thử lại" onClick={() => void handleRetry(recording)}>
                        <RotateCcw />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-xs" aria-label="Xóa bản ghi" title="Xóa bản ghi" onClick={() => setDeleting(recording)}>
                      <Trash2 />
                    </Button>
                  </div>
                  {ready && expanded && (
                    <div className="px-2 pb-2">
                      {detail ? (
                        <RecordingResult detail={detail} onUseAsMinutes={onUseAsMinutes} minutesHint={minutesHint} />
                      ) : (
                        <p className="pt-2 text-xs text-muted-foreground">Đang tải kết quả…</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DestructiveConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => !isDeleting && setDeleting(null)}
        onConfirm={confirmDelete}
        isConfirming={isDeleting}
        title="Xóa bản ghi âm?"
        entityLabel="Bản ghi"
        entityName={deleting ? `${deleting.source === "live" ? "Ghi trực tiếp" : "Tệp tải lên"} · ${when.format(new Date(deleting.createdAt))}` : undefined}
        description="Bản chép lời và biên bản đề xuất của bản ghi này sẽ mất."
      />
    </SectionCard>
  );
}
