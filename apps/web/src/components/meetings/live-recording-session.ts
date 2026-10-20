import {
  MEETING_RECORDING_MAX_DURATION_SEC,
  MEETING_RECORDING_MAX_PARTS,
  type MeetingRecordingSummary,
} from "@qcet/contracts/meeting-recordings";
import { completeRecording, createRecording, putRecordingPart } from "@/components/meetings/recording-client";

/** Mỗi phút một phần: 4 giờ ghi âm là 240 phần, dưới giới hạn 400 phần. */
const TIMESLICE_MS = 60_000;
/** Opus 32 kbps đủ rõ tiếng nói và giữ dung lượng nhỏ (1 giờ ≈ 14 MB). */
const AUDIO_BITS_PER_SECOND = 32_000;

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export interface LiveRecordingCallbacks {
  /** Số phần đã gửi xong (để hiện "đã gửi N phần"). */
  onUploaded?: (uploadedParts: number) => void;
  /** Một phần gửi không được sau nhiều lần thử; phần được giữ lại trong bộ nhớ, `retryFailed` gửi lại. */
  onUploadError?: (message: string) => void;
}

/**
 * Một phiên ghi âm trực tiếp: MediaRecorder cắt mỗi phút một phần, gửi lần lượt lên máy chủ trong lúc đang ghi nên đóng
 * máy giữa chừng vẫn không mất cả buổi. Không phụ thuộc React: rời trang vẫn dừng, gửi nốt và hoàn tất được.
 */
export class LiveRecordingSession {
  private chunkIndex = 0;
  private uploadedParts = 0;
  private startedAt = 0;
  /** Thời lượng chốt lúc bấm dừng; gửi lại sau lỗi mạng vẫn báo đúng số này. */
  private finalDurationSec: number | null = null;
  private queue: Promise<void> = Promise.resolve();
  private failed: Array<{ index: number; blob: Blob }> = [];
  private wakeLock: { release: () => Promise<void> } | null = null;

  private constructor(
    private readonly meetingId: string,
    readonly recordingId: string,
    private readonly stream: MediaStream,
    private readonly recorder: MediaRecorder,
    private readonly callbacks: LiveRecordingCallbacks
  ) {}

  /** Xin quyền micro, mở bản ghi trên máy chủ rồi bắt đầu ghi. Từ chối micro hoặc máy chủ từ chối thì ném lỗi và không để lại gì. */
  static async start(meetingId: string, callbacks: LiveRecordingCallbacks = {}): Promise<LiveRecordingSession> {
    const mimeType = pickRecorderMimeType();
    if (!mimeType) throw new Error("Trình duyệt này không ghi âm được. Thầy/Cô dùng Chrome, Edge hoặc Firefox, hoặc tải tệp ghi âm lên.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      throw new Error("Chưa dùng được micro. Thầy/Cô cho phép trình duyệt truy cập micro rồi thử lại.");
    }
    let recording: MeetingRecordingSummary;
    try {
      recording = await createRecording(meetingId, { source: "live", mimeType });
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
    const session = new LiveRecordingSession(meetingId, recording.id, stream, recorder, callbacks);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) session.enqueue(event.data);
    };
    recorder.start(TIMESLICE_MS);
    session.startedAt = performance.now();
    await session.holdScreenAwake();
    return session;
  }

  get elapsedSec(): number {
    return Math.max(0, (performance.now() - this.startedAt) / 1000);
  }

  get hasFailedParts(): boolean {
    return this.failed.length > 0;
  }

  /** Giữ màn hình sáng để máy không ngủ giữa buổi họp (trình duyệt không hỗ trợ thì bỏ qua). */
  private async holdScreenAwake() {
    try {
      this.wakeLock = (await (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
    } catch {
      this.wakeLock = null;
    }
  }

  private enqueue(blob: Blob) {
    const index = this.chunkIndex++;
    if (index >= MEETING_RECORDING_MAX_PARTS) return;
    this.queue = this.queue.then(() => this.send(index, blob));
  }

  private async send(index: number, blob: Blob) {
    try {
      await putRecordingPart(this.meetingId, this.recordingId, index, blob);
      this.uploadedParts += 1;
      this.callbacks.onUploaded?.(this.uploadedParts);
    } catch (error) {
      this.failed.push({ index, blob });
      this.callbacks.onUploadError?.(error instanceof Error ? error.message : "Không gửi được phần âm thanh.");
    }
  }

  /** Gửi lại các phần đã thất bại (sau khi có mạng lại). */
  async retryFailed(): Promise<void> {
    const pending = this.failed.splice(0);
    for (const part of pending) this.queue = this.queue.then(() => this.send(part.index, part.blob));
    await this.queue;
  }

  /**
   * Dừng ghi, gửi nốt phần cuối rồi hoàn tất. Còn phần chưa gửi được thì ném lỗi để người dùng gửi lại (bản ghi vẫn mở).
   * Trả về bản ghi đã được xếp hàng chép lời.
   */
  async stop(): Promise<MeetingRecordingSummary> {
    const durationSec = Math.min(MEETING_RECORDING_MAX_DURATION_SEC, Math.max(1, Math.round(this.elapsedSec)));
    this.finalDurationSec = durationSec;
    if (this.recorder.state !== "inactive") {
      // `stop()` phát một dataavailable cuối rồi mới phát `stop`: đợi để phần cuối đã vào hàng gửi
      await new Promise<void>((resolve) => {
        this.recorder.addEventListener("stop", () => resolve(), { once: true });
        this.recorder.stop();
      });
    }
    this.stream.getTracks().forEach((track) => track.stop());
    await this.wakeLock?.release().catch(() => undefined);
    await this.queue;
    if (this.failed.length > 0) throw new Error("Còn phần âm thanh chưa gửi được. Kiểm tra mạng rồi bấm gửi lại.");
    return completeRecording(this.meetingId, this.recordingId, { partCount: this.chunkIndex, durationSec });
  }

  /** Hoàn tất lại sau khi `stop()` báo còn phần lỗi và `retryFailed()` đã gửi xong. */
  async finishAfterRetry(): Promise<MeetingRecordingSummary> {
    await this.retryFailed();
    if (this.failed.length > 0) throw new Error("Còn phần âm thanh chưa gửi được. Kiểm tra mạng rồi bấm gửi lại.");
    return completeRecording(this.meetingId, this.recordingId, { partCount: this.chunkIndex, durationSec: this.finalDurationSec ?? 1 });
  }
}
