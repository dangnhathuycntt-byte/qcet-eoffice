/**
 * Cắt một đoạn âm thanh của bản ghi bằng ffmpeg (nếu máy chủ có) để mỗi lần gọi mô hình chỉ gửi đúng đoạn cần chép thay vì
 * cả tệp: bản ghi dài hàng giờ mới chép được, và mỗi lần gọi nhanh hơn nhiều. Đoạn ra là mp3 mono 16 kHz 32 kbps
 * (đủ cho lời nói, khoảng 1,4 MB cho 6 phút).
 *
 * `MEETING_AUDIO_FFMPEG`: không đặt thì dùng `ffmpeg` trong PATH; đặt đường dẫn để dùng bản khác; `none` để tắt (máy chủ quay về
 * gửi cả tệp, tối đa MEETING_RECORDING_WHOLE_FILE_MAX_BYTES). Chỉ coi là có khi ffmpeg chạy được và có bộ mã hóa libmp3lame.
 * Lỗi ffmpeg (tệp hỏng, định dạng lạ) đổi thành câu tiếng Việt cho người dùng; phần stderr chỉ ghi log, không đưa ra ngoài.
 */
import { spawn } from "node:child_process";
import { RECORDING_SLICE_WINDOW_SEC, RECORDING_WINDOW_SEC } from "@qcet/shared/domain/meetings/recording-transcript";
import { logger } from "@/server/observability/logger";

const PROBE_TIMEOUT_MS = 10_000;
const SLICE_TIMEOUT_MS = 180_000;
/** Đoạn 6 phút ở 32 kbps chỉ khoảng 1,4 MB; trần này chặn ffmpeg xuất dư (ví dụ cờ -t bị bỏ) làm đầy bộ nhớ. */
const SLICE_MAX_BYTES = 32 * 1024 * 1024;
/** Trần khi nén cả bản ghi để gửi một lần: 4 giờ ở 32 kbps khoảng 58 MB. */
export const WHOLE_AUDIO_MAX_BYTES = 64 * 1024 * 1024;
const STDERR_TAIL_BYTES = 2_000;
/** Đoạn mp3 ngắn hơn ngần này là đoạn không có âm thanh (vượt quá cuối tệp). */
export const EMPTY_SLICE_BYTES = 1_024;

export class AudioSliceError extends Error {
  constructor(message = "Không đọc được âm thanh của bản ghi (tệp hỏng hoặc định dạng không hỗ trợ). Thầy/Cô ghi hoặc tải lên lại.") {
    super(message);
    this.name = "AudioSliceError";
  }
}

/** Đường dẫn ffmpeg theo cấu hình; null khi bị tắt. */
function ffmpegBinary(): string | null {
  const configured = process.env.MEETING_AUDIO_FFMPEG?.trim();
  if (!configured) return "ffmpeg";
  return /^(none|off|false|0)$/i.test(configured) ? null : configured;
}

interface RunResult {
  stdout: Buffer;
  stderr: string;
  code: number | null;
}

function run(bin: string, args: string[], timeoutMs: number, maxBytes: number, signal?: AbortSignal): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      action();
    };
    const kill = (reason: Error) => {
      child.kill("SIGKILL");
      finish(() => reject(reason));
    };
    const onAbort = () => kill(new Error("Việc chép lời bị hủy."));
    const timer = setTimeout(() => kill(new AudioSliceError("Cắt âm thanh quá lâu nên đã dừng. Thầy/Cô thử lại.")), timeoutMs);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > maxBytes) return kill(new AudioSliceError());
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-STDERR_TAIL_BYTES);
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => finish(() => resolve({ stdout: Buffer.concat(chunks), stderr, code })));
  });
}

let probe: { bin: string | null; result: Promise<boolean> } | null = null;

/** Có ffmpeg dùng được để cắt không. Kết quả nhớ theo cấu hình hiện tại nên chỉ dò một lần mỗi tiến trình. */
export function ffmpegAvailable(): Promise<boolean> {
  const bin = ffmpegBinary();
  if (!bin) return Promise.resolve(false);
  if (probe?.bin === bin) return probe.result;
  const result = run(bin, ["-hide_banner", "-loglevel", "error", "-encoders"], PROBE_TIMEOUT_MS, 1024 * 1024)
    .then((out) => out.code === 0 && out.stdout.toString("utf8").includes("libmp3lame"))
    .catch(() => false);
  probe = { bin, result };
  return result;
}

/** Cỡ đoạn chép lời của máy chủ này: đoạn cắt riêng ngắn hơn đoạn gửi kèm cả tệp. Việc chép lời và số đoạn hiển thị phải cùng dùng cỡ này. */
export async function recordingWindowSec(): Promise<number> {
  return (await ffmpegAvailable()) ? RECORDING_SLICE_WINDOW_SEC : RECORDING_WINDOW_SEC;
}

/**
 * Cắt `durationSec` giây từ giây `startSec` của tệp (không có `durationSec` thì tới hết tệp) thành mp3. Đoạn rỗng (vượt cuối
 * tệp) trả Buffer ngắn hơn EMPTY_SLICE_BYTES.
 */
export async function sliceAudio(
  inputPath: string,
  startSec: number,
  durationSec: number | null,
  signal?: AbortSignal,
  maxBytes: number = SLICE_MAX_BYTES
): Promise<Buffer> {
  const bin = ffmpegBinary();
  if (!bin) throw new AudioSliceError("Máy chủ chưa bật ffmpeg để cắt âm thanh.");
  const args = [
    "-hide_banner", "-loglevel", "error", "-nostdin",
    "-ss", String(Math.max(0, Math.floor(startSec))),
    "-i", inputPath,
    ...(durationSec === null ? [] : ["-t", String(Math.max(1, Math.ceil(durationSec)))]),
    "-vn", "-map", "0:a:0?", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", "-f", "mp3", "pipe:1",
  ];
  let out: RunResult;
  try {
    out = await run(bin, args, SLICE_TIMEOUT_MS, maxBytes, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new AudioSliceError("Máy chủ không tìm thấy ffmpeg để cắt âm thanh.");
    throw error;
  }
  if (out.code !== 0) {
    logger.warn("meeting_recording.ffmpeg_error", { metadata: { code: out.code, stderr: out.stderr.slice(-400) } });
    throw new AudioSliceError();
  }
  return out.stdout;
}
