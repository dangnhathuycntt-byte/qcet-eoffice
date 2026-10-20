"use client";

import * as React from "react";
import { AudioLines, Check, Mic, Play, RotateCcw, Square, Trash2, Upload } from "lucide-react";
import {
  MEETING_RECORDING_MAX_BYTES,
  type MeetingRecordingDetail,
  type MeetingRecordingSummary,
} from "@qcet/contracts/meeting-recordings";
import { formatClock } from "@qcet/shared/domain/meetings/recording-transcript";
import { AgentIcon } from "@/components/icons/agent-icon";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { useFeedback } from "@/components/ui/feedback-layer";
import { SectionCard } from "@/components/meetings/section-card";
import { RecordingResult } from "@/components/meetings/recording-result";
import { RecordingWaveform } from "@/components/meetings/recording-waveform";
import {
  RecordingRequestError,
  deleteRecording,
  detectFileMimeType,
  estimateDurationSec,
  getRecording,
  listRecordings,
  processRecording,
  retryRecording,
  uploadAudioFile,
} from "@/components/meetings/recording-client";
import { LiveRecordingSession, pickRecorderMimeType } from "@/components/meetings/live-recording-session";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;
/** Ghi trực tiếp: mỗi 100 ms một cột sóng (trôi 50px mỗi giây như Ghi âm của iOS). */
const LIVE_SAMPLE_MS = 100;
const LIVE_MAX_BARS = 400;
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const when = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
const megabytes = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

type Phase = "idle" | "starting" | "recording" | "finishing" | "uploading";

const formatSize = (bytes: number) => `${megabytes.format(bytes / 1024 / 1024)} MB`;
const sourceLabel = (recording: MeetingRecordingSummary) => (recording.source === "live" ? "Ghi trực tiếp" : "Tệp tải lên");

function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

/** Sóng âm khi đang ghi: đọc độ lớn micro của phiên mỗi 100 ms (chỉ khung này vẽ lại, không cả bảng). */
function LiveMeter({ session }: { session: React.RefObject<LiveRecordingSession | null> }) {
  const [levels, setLevels] = React.useState<number[]>([]);
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      const level = session.current?.level();
      if (level === null || level === undefined) return;
      setLevels((current) => [...current.slice(-(LIVE_MAX_BARS - 1)), level]);
    }, LIVE_SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [session]);
  return <RecordingWaveform peaks={levels} live label="Sóng âm đang ghi" />;
}

type StepState = "done" | "active" | "pending";

function Step({ state, children, trailing }: { state: StepState; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5 text-xs">
      {state === "done" ? (
        <Check className="size-3.5 shrink-0 text-muted-foreground" />
      ) : state === "active" ? (
        <AgentIcon filled className="size-3.5 text-foreground motion-safe:animate-pulse" />
      ) : (
        <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-1 rounded-full bg-muted-foreground/40" />
        </span>
      )}
      <span className={cn("min-w-0 truncate", state === "active" ? "animate-text-shimmer" : state === "done" ? "text-muted-foreground" : "text-muted-foreground/60")}>
        {children}
      </span>
      {trailing ? <span className="shrink-0 text-muted-foreground tabular-nums">{trailing}</span> : null}
    </li>
  );
}

/** Đang soạn: các bước như nhật ký làm việc của Agent (đã tải lên → đang nghe/chép → soạn biên bản), chữ đang làm có ánh chạy. */
function ProcessingSteps({ recording, now }: { recording: MeetingRecordingSummary; now: number }) {
  const minutes = minutesSince(recording.submittedAt ?? recording.createdAt, now);
  const elapsed = minutes > 0 ? `${minutes} phút` : undefined;
  const chunked = recording.progress && recording.progress.done > 0;
  return (
    <div className="space-y-1.5" aria-live="polite">
      <ol className="space-y-1">
        <Step state="done">Đã tải lên {formatSize(recording.byteSize)}</Step>
        {recording.status === "QUEUED" ? (
          <Step state="active">Đang chờ tới lượt…</Step>
        ) : chunked ? (
          <>
            <Step state="active" trailing={elapsed}>
              Đang chép lời {recording.progress!.done}/{recording.progress!.total} đoạn…
            </Step>
            <Step state="pending">Soạn biên bản, quyết định và việc được giao</Step>
          </>
        ) : (
          <Step state="active" trailing={elapsed}>
            Đang nghe {recording.durationSec ? formatClock(recording.durationSec) : "bản ghi"} và soạn biên bản…
          </Step>
        )}
      </ol>
      <p className="text-xs text-muted-foreground">Có thể rời trang; biên bản đề xuất sẽ hiện ở đây khi xong.</p>
    </div>
  );
}

export interface MeetingRecordingPanelProps {
  meetingId: string;
  /** Có thì kết quả có nút "Dùng làm biên bản nháp" (cuộc họp đã ở trạng thái soạn được biên bản). */
  onUseAsMinutes?: (text: string) => void;
  /** Lý do chưa điền thẳng vào biên bản được, hiện cạnh nút Sao chép. */
  minutesHint?: string;
}

/**
 * Ghi âm hoặc tải tệp ghi âm cuộc họp, rồi bấm "Tạo biên bản" để Agent (Gemini) nghe và soạn biên bản đề xuất. Mỗi bản ghi
 * hiện sóng âm máy chủ đã đo; tải lên chưa gửi tới dịch vụ AI, bấm "Tạo biên bản" mới gửi (lời nhắc cạnh nút: bấm là xác nhận
 * đã báo người dự họp, như "Start transcribing" của Notion). Chỉ chủ tọa, thư ký, người tổ chức dùng được (máy chủ kiểm quyền;
 * nhận 403/404 thì khung tự ẩn). Âm thanh bị xóa khi soạn xong.
 */
export function MeetingRecordingPanel({ meetingId, onUseAsMinutes, minutesHint }: MeetingRecordingPanelProps) {
  const { notifyError } = useFeedback();
  const [access, setAccess] = React.useState<"loading" | "ok" | "denied" | "error">("loading");
  const [recordings, setRecordings] = React.useState<MeetingRecordingSummary[]>([]);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [uploadedParts, setUploadedParts] = React.useState(0);
  // Tệp đang tải lên từ chính trình duyệt này: mã bản ghi và số byte đã gửi (vạch đỏ trên sóng âm)
  const [upload, setUpload] = React.useState<{ id: string; uploaded: number; total: number } | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [needsResend, setNeedsResend] = React.useState(false);
  // Lỗi khi bắt đầu ghi trực tiếp (micro bị chặn, không có micro…): câu lỗi kèm "Thử lại"
  const [startFailed, setStartFailed] = React.useState(false);
  const [submitting, setSubmitting] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Record<string, MeetingRecordingDetail>>({});
  const [deleting, setDeleting] = React.useState<MeetingRecordingSummary | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
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

  // Thăm dò khi đang soạn, hoặc khi bản vừa tải lên còn chờ máy chủ đo sóng âm
  const needsPolling = recordings.some(
    (r) => r.status === "QUEUED" || r.status === "PROCESSING" || (r.status === "UPLOADED" && r.waveform === null)
  );
  React.useEffect(() => {
    if (!needsPolling) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [needsPolling, refresh]);

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
    setStartFailed(false);
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
      setStartFailed(true);
      setPhase("idle");
    }
  }

  async function finishLive(resend = false) {
    const session = sessionRef.current;
    if (!session) return;
    setPhase("finishing");
    try {
      if (resend) await session.finishAfterRetry();
      else await session.stop();
      sessionRef.current = null;
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
    if (!file || phase !== "idle") return;
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
    setStartFailed(false);
    setPhase("uploading");
    try {
      const durationSec = await estimateDurationSec(file);
      await uploadAudioFile(
        meetingId,
        file,
        mimeType,
        durationSec,
        (progress) => setUpload((current) => (current ? { ...current, uploaded: progress.uploadedBytes } : current)),
        (created) => {
          // Hiện ngay hàng đang tải (kèm thời lượng đọc được) thay vì đợi tải xong
          setRecordings((current) => [{ ...created, byteSize: file.size }, ...current.filter((r) => r.id !== created.id)]);
          setUpload({ id: created.id, uploaded: 0, total: file.size });
        }
      );
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Không tải được tệp lên.");
    } finally {
      if (mountedRef.current) {
        setPhase("idle");
        setUpload(null);
        await refresh();
      }
    }
  }

  async function handleProcess(recording: MeetingRecordingSummary) {
    setSubmitting(recording.id);
    try {
      await processRecording(meetingId, recording.id);
      watchIdRef.current = recording.id;
      setNow(Date.now());
      await refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Chưa gửi đi soạn biên bản được.");
    } finally {
      if (mountedRef.current) setSubmitting(null);
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
  const live = phase === "recording" || phase === "finishing";
  const pickFile = () => fileInputRef.current?.click();

  const startButtons = (size: "sm" | "xs") => (
    <>
      {canRecordLive && (
        <Button size={size} variant={size === "sm" ? "default" : "ghost"} disabled={busy} loading={phase === "starting"} onClick={() => void startLive()}>
          <Mic />
          {size === "sm" ? "Bắt đầu ghi âm" : "Ghi âm"}
        </Button>
      )}
      <Button size={size} variant={size === "sm" ? "toolbar" : "ghost"} disabled={busy} onClick={pickFile}>
        <Upload />
        {size === "sm" ? "Tải tệp ghi âm" : "Tải tệp"}
      </Button>
    </>
  );

  function footer(recording: MeetingRecordingSummary) {
    switch (recording.status) {
      case "UPLOADING": {
        if (upload?.id === recording.id) {
          const percent = Math.round((upload.uploaded / Math.max(1, upload.total)) * 100);
          return (
            <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
              Đang tải lên {percent}% · {formatSize(upload.uploaded)}/{formatSize(upload.total)} · giữ tab này mở tới khi xong
            </p>
          );
        }
        return minutesSince(recording.createdAt, now) >= 10 ? (
          <p className="text-xs text-warning">Chưa tải lên xong. Thầy/Cô xóa bản này rồi tải lên lại.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Đang tải lên…</p>
        );
      }
      case "UPLOADED":
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Button variant="toolbar" size="pill" loading={submitting === recording.id} onClick={() => void handleProcess(recording)}>
              <AgentIcon filled data-icon="inline-start" />
              Tạo biên bản
            </Button>
            <p className="min-w-0 flex-1 basis-60 text-xs text-muted-foreground">
              Bấm là xác nhận đã báo người dự họp. Âm thanh gửi tới Gemini, soạn xong thì xóa khỏi máy chủ.
            </p>
          </div>
        );
      case "QUEUED":
      case "PROCESSING":
        return <ProcessingSteps recording={recording} now={now} />;
      case "READY": {
        const expanded = expandedId === recording.id;
        const detail = details[recording.id];
        const tookMinutes =
          recording.submittedAt && recording.processedAt
            ? Math.max(1, Math.round((new Date(recording.processedAt).getTime() - new Date(recording.submittedAt).getTime()) / 60_000))
            : null;
        return (
          <div className="flex flex-col gap-1.5">
            <Pressable
              aria-expanded={expanded}
              onClick={() => void openRecording(recording.id)}
              className="-ml-1 inline-flex w-fit items-center gap-1 rounded-sm px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Check className="size-3.5" />
              {tookMinutes ? `Đã soạn biên bản đề xuất trong ${tookMinutes} phút` : "Đã soạn biên bản đề xuất"}
              <Play className={cn("size-2 fill-current transition-transform duration-150 motion-reduce:transition-none", expanded && "rotate-90")} />
            </Pressable>
            {expanded &&
              (detail ? (
                <RecordingResult detail={detail} onUseAsMinutes={onUseAsMinutes} minutesHint={minutesHint} />
              ) : (
                <p className="text-xs text-muted-foreground">Đang tải kết quả…</p>
              ))}
          </div>
        );
      }
      case "FAILED":
        return (
          <div className="flex items-start gap-2">
            <p role="alert" className="min-w-0 flex-1 text-xs text-destructive">
              {recording.error ?? "Chưa soạn được biên bản."}
            </p>
            {recording.durationSec !== null && (
              <Button variant="ghost" size="xs" onClick={() => void handleRetry(recording)}>
                <RotateCcw />
                Thử lại
              </Button>
            )}
          </div>
        );
    }
  }

  function waveformFor(recording: MeetingRecordingSummary) {
    const name = `Sóng âm ${sourceLabel(recording).toLowerCase()}`;
    if (recording.status === "UPLOADING") {
      const head = upload?.id === recording.id ? upload.uploaded / Math.max(1, upload.total) : null;
      return <RecordingWaveform peaks={null} head={head} label={head === null ? name : `${name}, đang tải lên ${Math.round(head * 100)}%`} />;
    }
    const scanning = recording.status === "QUEUED" || recording.status === "PROCESSING";
    // Bản đã soạn xong hay lỗi mà không có sóng âm (ghi trước khi có tính năng này, máy chủ không đo được): âm thanh đã xóa
    // hoặc sẽ không đo nữa, bỏ hẳn hàng sóng thay vì để một đường chấm trống
    if (!recording.waveform?.length && (recording.status === "READY" || recording.status === "FAILED")) return null;
    return (
      <RecordingWaveform
        peaks={recording.waveform}
        tone={recording.status === "UPLOADED" ? "strong" : "muted"}
        scanning={scanning}
        label={scanning ? `${name}, Agent đang nghe` : name}
      />
    );
  }

  return (
    <SectionCard
      title="Ghi âm cuộc họp"
      count={recordings.length || undefined}
      action={recordings.length > 0 && !live ? <div className="flex items-center gap-0.5">{startButtons("xs")}</div> : undefined}
    >
      <div
        className="relative space-y-3"
        onDragOver={(event) => {
          if (busy || !event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          if (busy) return;
          event.preventDefault();
          setDragging(false);
          void handleFile(event.dataTransfer.files[0]);
        }}
      >
        {access === "error" && (
          <InlineAlert variant="error" actionLabel="Thử lại" onAction={() => void refresh()}>
            Chưa tải được danh sách bản ghi âm.
          </InlineAlert>
        )}

        {live ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse" />
              <span className="text-compact font-medium text-foreground tabular-nums">
                {phase === "finishing" ? "Đang gửi nốt…" : `Đang ghi ${formatClock(elapsed)}`}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">Đã gửi {uploadedParts} phần</span>
              <Button size="sm" variant="destructive" className="ml-auto" loading={phase === "finishing"} onClick={() => void finishLive()}>
                <Square />
                Dừng ghi
              </Button>
            </div>
            <LiveMeter session={sessionRef} />
            <p className="text-xs text-muted-foreground">Đừng đóng tab hoặc tắt màn hình. Âm thanh được gửi dần lên máy chủ mỗi phút.</p>
          </div>
        ) : recordings.length === 0 ? (
          // Ô kéo thả gọn trong thẻ (như mục trống của Linear), icon Agent cho biết phần này do AI làm
          <div
            className={cn(
              "flex flex-col gap-2.5 rounded-lg border border-dashed px-3 py-2.5 sm:flex-row sm:items-center",
              dragging ? "border-primary/60" : "border-muted-foreground/30"
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <AgentIcon filled className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-compact font-medium text-foreground">Biên bản từ ghi âm</p>
                <p className="text-xs text-muted-foreground">
                  {canRecordLive
                    ? "Ghi âm buổi họp hoặc kéo thả tệp vào đây, Agent nghe và soạn biên bản nháp. Nhớ báo người dự họp trước khi ghi."
                    : "Kéo thả hoặc chọn tệp ghi âm, Agent nghe và soạn biên bản nháp. Trình duyệt này không ghi âm trực tiếp được."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5 pl-9.5 sm:pl-0">{startButtons("sm")}</div>
          </div>
        ) : null}

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

        {problem && (
          <InlineAlert
            variant="error"
            className="items-start [&>svg]:mt-0.5"
            actionLabel={needsResend ? "Gửi lại" : startFailed ? "Thử lại" : undefined}
            onAction={needsResend ? () => void finishLive(true) : startFailed ? () => void startLive() : undefined}
          >
            {problem}
          </InlineAlert>
        )}

        {recordings.length > 0 && (
          <ul className={cn("divide-y divide-border/40", live && "border-t border-border/40")}>
            {recordings.map((recording) => (
              <li key={recording.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {recording.source === "live" ? <Mic className="size-4" /> : <AudioLines className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-compact font-medium text-foreground">
                      {sourceLabel(recording)} · {when.format(new Date(recording.createdAt))}
                    </p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      {[
                        recording.durationSec ? formatClock(recording.durationSec) : null,
                        recording.byteSize > 0 ? formatSize(recording.byteSize) : null,
                        recording.createdByName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {upload?.id !== recording.id && (
                    <Button variant="ghost" size="icon-xs" aria-label="Xóa bản ghi" title="Xóa bản ghi" onClick={() => setDeleting(recording)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
                {waveformFor(recording)}
                {footer(recording)}
              </li>
            ))}
          </ul>
        )}

        {dragging && (
          <div className="pointer-events-none absolute -inset-1.5 flex items-center justify-center rounded-lg border border-dashed border-primary/60 bg-background/90 text-compact font-medium text-foreground">
            Thả tệp ghi âm vào đây
          </div>
        )}
      </div>

      <DestructiveConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => !isDeleting && setDeleting(null)}
        onConfirm={confirmDelete}
        isConfirming={isDeleting}
        title="Xóa bản ghi âm?"
        entityLabel="Bản ghi"
        entityName={deleting ? `${sourceLabel(deleting)} · ${when.format(new Date(deleting.createdAt))}` : undefined}
        description="Âm thanh, sóng âm và biên bản đề xuất của bản ghi này sẽ mất."
      />
    </SectionCard>
  );
}
