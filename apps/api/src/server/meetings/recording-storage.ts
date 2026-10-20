/**
 * Lưu âm thanh ghi âm cuộc họp ở thư mục riêng `UPLOADS_DIR/recordings/<id>/`, không qua FileObject: âm thanh chỉ để gửi
 * cho mô hình chép lời, không bao giờ trả lại cho trình duyệt (không có đường tải về) và bị xóa khi xử lý xong. Nhờ vậy
 * không phải mở danh sách phần mở rộng tệp cho `/api/upload` hay đường tải tệp chung.
 * `id` luôn là mã cuid do máy chủ sinh và đã đọc được từ CSDL trước khi dựng đường dẫn; vẫn kiểm định dạng để chặn lỗi gọi nhầm.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  MEETING_RECORDING_MAX_BYTES,
  MEETING_RECORDING_MAX_PARTS,
  MEETING_RECORDING_PART_MAX_BYTES,
  MEETING_RECORDING_WHOLE_FILE_MAX_BYTES,
  type MeetingRecordingMimeType,
} from "@qcet/contracts/meeting-recordings";
import { PayloadTooLargeError, ValidationError } from "@/server/api/errors";
import { ffmpegAvailable } from "@/server/meetings/recording-slicer";

const RECORDING_ID_PATTERN = /^[a-z0-9]{20,40}$/;
const PART_FILE_PATTERN = /^(\d{5})\.part$/;
const AUDIO_FILE = "audio.bin";

function recordingDir(recordingId: string): string {
  if (!RECORDING_ID_PATTERN.test(recordingId)) throw new ValidationError("Mã bản ghi âm không hợp lệ");
  return path.join(path.resolve(process.env.UPLOADS_DIR || "./uploads"), "recordings", recordingId);
}

const partFile = (recordingId: string, index: number) => path.join(recordingDir(recordingId), `${String(index).padStart(5, "0")}.part`);
export const recordingAudioPath = (recordingId: string) => path.join(recordingDir(recordingId), AUDIO_FILE);

/** Dung lượng tối đa của một bản ghi trên máy chủ này: có ffmpeg thì cắt từng đoạn nên nhận bản dài, không thì phải gửi cả tệp cho mô hình. */
export async function recordingByteLimit(): Promise<number> {
  return (await ffmpegAvailable()) ? MEETING_RECORDING_MAX_BYTES : MEETING_RECORDING_WHOLE_FILE_MAX_BYTES;
}

export function recordingTooLargeError(limit: number): PayloadTooLargeError {
  return new PayloadTooLargeError(`Bản ghi vượt ${Math.round(limit / 1024 / 1024)} MB. Thầy/Cô chia nhỏ hoặc nén tệp (ví dụ mp3 mono) rồi gửi lại.`);
}

/** Các phần đã nhận: [{ index, size }] theo thứ tự chỉ số. */
async function listParts(recordingId: string): Promise<Array<{ index: number; size: number }>> {
  let names: string[];
  try {
    names = await fs.readdir(recordingDir(recordingId));
  } catch {
    return [];
  }
  const parts = await Promise.all(
    names.map(async (name) => {
      const match = PART_FILE_PATTERN.exec(name);
      if (!match) return null;
      const stat = await fs.stat(path.join(recordingDir(recordingId), name));
      return { index: Number(match[1]), size: stat.size };
    })
  );
  return parts.filter((part): part is { index: number; size: number } => part !== null).sort((a, b) => a.index - b.index);
}

/**
 * Ghi một phần (ghi đè nếu gửi lại cùng chỉ số, để thử lại không làm hỏng). Chặn phần rỗng hoặc quá 8 MB và chặn khi
 * tổng các phần vượt giới hạn dung lượng một bản ghi.
 */
export async function writeRecordingPart(recordingId: string, index: number, bytes: Buffer): Promise<void> {
  if (!Number.isInteger(index) || index < 0 || index >= MEETING_RECORDING_MAX_PARTS) throw new ValidationError("Số thứ tự phần không hợp lệ");
  if (bytes.byteLength === 0) throw new ValidationError("Phần âm thanh rỗng");
  if (bytes.byteLength > MEETING_RECORDING_PART_MAX_BYTES) {
    throw new PayloadTooLargeError(`Mỗi phần tối đa ${MEETING_RECORDING_PART_MAX_BYTES / 1024 / 1024} MB`);
  }
  const others = (await listParts(recordingId)).filter((part) => part.index !== index);
  const total = others.reduce((sum, part) => sum + part.size, 0) + bytes.byteLength;
  const limit = await recordingByteLimit();
  if (total > limit) throw recordingTooLargeError(limit);
  await fs.mkdir(recordingDir(recordingId), { recursive: true, mode: 0o700 });
  const target = partFile(recordingId, index);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, bytes, { mode: 0o600 });
  await fs.rename(temporary, target);
}

/**
 * Ghép các phần 0..partCount-1 thành một tệp. Thiếu phần, có phần thừa hay tổng quá giới hạn thì báo lỗi và không ghép.
 * Xóa các phần sau khi ghép xong.
 */
export async function assembleRecording(recordingId: string, partCount: number): Promise<{ byteSize: number }> {
  const parts = await listParts(recordingId);
  const expected = Array.from({ length: partCount }, (_, index) => index);
  if (parts.length !== partCount || parts.some((part, position) => part.index !== expected[position])) {
    throw new ValidationError("Chưa nhận đủ các phần âm thanh, hãy thử gửi lại.");
  }
  const byteSize = parts.reduce((sum, part) => sum + part.size, 0);
  const limit = await recordingByteLimit();
  if (byteSize > limit) throw recordingTooLargeError(limit);
  const output = await fs.open(recordingAudioPath(recordingId), "w", 0o600);
  try {
    for (const part of parts) await output.write(await fs.readFile(partFile(recordingId, part.index)));
  } finally {
    await output.close();
  }
  await Promise.all(parts.map((part) => fs.rm(partFile(recordingId, part.index), { force: true })));
  return { byteSize };
}

/** Nhận dạng định dạng theo byte đầu tệp; không khớp định dạng nào thì null. Không tin mime trình duyệt gửi. */
export function detectRecordingMimeType(head: Buffer): MeetingRecordingMimeType | null {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => head[index] === byte);
  const ascii = (start: number, end: number) => head.toString("ascii", start, end);
  if (startsWith(0x1a, 0x45, 0xdf, 0xa3)) return "audio/webm";
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (ascii(4, 8) === "ftyp") return "audio/mp4";
  if (ascii(0, 3) === "ID3" || (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

export async function readRecordingHead(recordingId: string, length = 16): Promise<Buffer> {
  const handle = await fs.open(recordingAudioPath(recordingId), "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Đọc cả tệp ghép để gửi mô hình khi không cắt được bằng ffmpeg (tối đa MEETING_RECORDING_WHOLE_FILE_MAX_BYTES). */
export function readRecordingAudio(recordingId: string): Promise<Buffer> {
  return fs.readFile(recordingAudioPath(recordingId));
}

/** Xóa tệp âm thanh và các phần còn lại của bản ghi (idempotent). */
export async function removeRecordingFiles(recordingId: string): Promise<void> {
  await fs.rm(recordingDir(recordingId), { recursive: true, force: true });
}
