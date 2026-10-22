import {
  MEETING_RECORDING_MAX_BYTES,
  MEETING_RECORDING_MAX_DURATION_SEC,
  normalizeRecordingMimeType,
  type MeetingRecordingDetail,
  type MeetingRecordingMimeType,
  type MeetingRecordingSource,
  type MeetingRecordingSummary,
} from "@qcet/contracts/meeting-recordings";

// Gọi API ghi âm cuộc họp (/api/meetings/{id}/recordings) từ trình duyệt và gửi âm thanh theo từng phần.

export class RecordingRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "RecordingRequestError";
  }
}

/** Mỗi phần của tệp tải lên: dưới giới hạn 8 MB của máy chủ và 12 MB của lớp trung gian. */
export const UPLOAD_PART_BYTES = 6 * 1024 * 1024;
const PART_RETRIES = 4;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, credentials: "include" });
  } catch (error) {
    // Hủy chủ động (rời trang, đổi cuộc họp, React dựng lại hiệu ứng) không phải mất mạng: giữ nguyên để nơi gọi bỏ qua
    if ((error as Error)?.name === "AbortError") throw error;
    throw new RecordingRequestError("Mất kết nối. Kiểm tra mạng rồi thử lại.", 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const raw = json?.detail ?? json?.message ?? json?.error;
    throw new RecordingRequestError((typeof raw === "string" ? raw : raw?.message) || `Lỗi ${res.status}`, res.status);
  }
  return json as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const base = (meetingId: string) => `/api/meetings/${encodeURIComponent(meetingId)}/recordings`;

export const listRecordings = (meetingId: string, signal?: AbortSignal) =>
  request<{ recordings: MeetingRecordingSummary[] }>(base(meetingId), { signal });
export const getRecording = (meetingId: string, id: string, signal?: AbortSignal) =>
  request<MeetingRecordingDetail>(`${base(meetingId)}/${encodeURIComponent(id)}`, { signal });
export const createRecording = (meetingId: string, input: { source: MeetingRecordingSource; mimeType: string; byteSize?: number; fileName?: string }) =>
  request<MeetingRecordingSummary>(base(meetingId), jsonInit("POST", input));
export const completeRecording = (meetingId: string, id: string, input: { partCount: number; durationSec: number }) =>
  request<MeetingRecordingSummary>(`${base(meetingId)}/${encodeURIComponent(id)}/complete`, jsonInit("POST", input));
/** "Tạo biên bản": người dùng đã đọc lời nhắc cạnh nút (đã báo người dự họp, âm thanh gửi tới dịch vụ AI) và bấm. */
export const processRecording = (meetingId: string, id: string) =>
  request<MeetingRecordingSummary>(`${base(meetingId)}/${encodeURIComponent(id)}/process`, jsonInit("POST", { consent: true }));
export const retryRecording = (meetingId: string, id: string) =>
  request<MeetingRecordingSummary>(`${base(meetingId)}/${encodeURIComponent(id)}/retry`, { method: "POST" });
export const deleteRecording = (meetingId: string, id: string) =>
  request<{ id: string }>(`${base(meetingId)}/${encodeURIComponent(id)}`, { method: "DELETE" });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gửi một phần; lỗi mạng hoặc 5xx thì thử lại (1, 2, 4, 8 giây), lỗi 4xx dừng ngay vì thử lại không đổi kết quả. */
export async function putRecordingPart(meetingId: string, id: string, index: number, part: Blob): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= PART_RETRIES; attempt += 1) {
    try {
      await request(`${base(meetingId)}/${encodeURIComponent(id)}/parts/${index}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: part,
      });
      return;
    } catch (error) {
      lastError = error;
      const status = error instanceof RecordingRequestError ? error.status : 0;
      if (status >= 400 && status < 500) throw error;
      if (attempt < PART_RETRIES) await wait(1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

const EXTENSION_MIME: Record<string, MeetingRecordingMimeType> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

/** Định dạng của tệp người dùng chọn: theo mime trình duyệt, không có thì theo đuôi tệp; không hỗ trợ thì null. */
export function detectFileMimeType(file: File): MeetingRecordingMimeType | null {
  const fromType = file.type ? normalizeRecordingMimeType(file.type) : null;
  if (fromType) return fromType;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[extension] ?? null;
}

/**
 * Thời lượng tệp để chia đoạn chép lời. Đọc từ trình duyệt; không đọc được (webm ghi trực tiếp báo Infinity) thì ước theo
 * dung lượng với tốc độ thấp (4000 byte/giây). Ước dư chỉ tốn vài lần gọi "HẾT", ước thiếu thì mất nội dung.
 */
export function estimateDurationSec(file: File): Promise<number> {
  const clamp = (seconds: number) => Math.min(MEETING_RECORDING_MAX_DURATION_SEC, Math.max(1, Math.ceil(seconds)));
  const fallback = clamp(file.size / 4000);
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const finish = (seconds: number) => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      resolve(seconds);
    };
    const timer = window.setTimeout(() => finish(fallback), 5000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish(Number.isFinite(audio.duration) && audio.duration > 0 ? clamp(audio.duration) : fallback);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(fallback);
    };
    audio.src = url;
  });
}

export interface UploadFileProgress {
  uploadedBytes: number;
  totalBytes: number;
}

/**
 * Tải một tệp có sẵn: mở bản ghi, gửi từng phần 6 MB, hoàn tất (UPLOADED, chờ "Tạo biên bản"). `onCreated` báo bản ghi vừa mở
 * để giao diện hiện ngay hàng đang tải. Lỗi giữa chừng để lại bản UPLOADING (máy chủ tự dọn sau 24 giờ).
 */
export async function uploadAudioFile(
  meetingId: string,
  file: File,
  mimeType: MeetingRecordingMimeType,
  durationSec: number,
  onProgress: (progress: UploadFileProgress) => void,
  onCreated?: (recording: MeetingRecordingSummary) => void
): Promise<MeetingRecordingSummary> {
  if (file.size > MEETING_RECORDING_MAX_BYTES) throw new RecordingRequestError(`Tệp quá lớn (tối đa ${MEETING_RECORDING_MAX_BYTES / 1024 / 1024} MB).`, 413);
  const created = await createRecording(meetingId, { source: "file", mimeType, byteSize: file.size, fileName: file.name });
  onCreated?.({ ...created, durationSec });
  const partCount = Math.max(1, Math.ceil(file.size / UPLOAD_PART_BYTES));
  onProgress({ uploadedBytes: 0, totalBytes: file.size });
  for (let index = 0; index < partCount; index += 1) {
    await putRecordingPart(meetingId, created.id, index, file.slice(index * UPLOAD_PART_BYTES, (index + 1) * UPLOAD_PART_BYTES));
    onProgress({ uploadedBytes: Math.min(file.size, (index + 1) * UPLOAD_PART_BYTES), totalBytes: file.size });
  }
  return completeRecording(meetingId, created.id, { partCount, durationSec });
}
