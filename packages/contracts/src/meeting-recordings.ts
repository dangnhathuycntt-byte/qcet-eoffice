import { z } from 'zod';

/**
 * Ghi âm cuộc họp: gửi âm thanh theo từng phần, Gemini chép lời và soạn biên bản đề xuất. Kết quả chỉ là bản nháp để
 * người soạn biên bản đọc lại, không tự thành biên bản.
 */

/** Định dạng âm thanh nhận được; MediaRecorder của trình duyệt cho webm (Chrome, Firefox) hoặc mp4 (Safari). */
export const MEETING_RECORDING_MIME_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'] as const;
export type MeetingRecordingMimeType = (typeof MEETING_RECORDING_MIME_TYPES)[number];

/** Đổi mime trình duyệt gửi (kèm `;codecs=`, tên khác của m4a/wav) về một trong các định dạng nhận; không nhận thì null. */
export function normalizeRecordingMimeType(raw: string): MeetingRecordingMimeType | null {
  const base = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  const aliases: Record<string, MeetingRecordingMimeType> = {
    'audio/webm': 'audio/webm',
    'video/webm': 'audio/webm',
    'audio/ogg': 'audio/ogg',
    'audio/mp4': 'audio/mp4',
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a': 'audio/mp4',
    'audio/aac': 'audio/mp4',
    'audio/mpeg': 'audio/mpeg',
    'audio/mp3': 'audio/mpeg',
    'audio/wav': 'audio/wav',
    'audio/x-wav': 'audio/wav',
    'audio/wave': 'audio/wav',
  };
  return aliases[base] ?? null;
}

/**
 * Trần dung lượng một bản ghi khi máy chủ có ffmpeg: mỗi đoạn được cắt riêng nên bản dài vài giờ vẫn chép được (4 giờ m4a
 * ở 64 kbps khoảng 115 MB). Máy chủ không có ffmpeg gửi cả tệp cho mỗi đoạn nên chỉ nhận tới MEETING_RECORDING_WHOLE_FILE_MAX_BYTES.
 */
export const MEETING_RECORDING_MAX_BYTES = 128 * 1024 * 1024;
export const MEETING_RECORDING_WHOLE_FILE_MAX_BYTES = 48 * 1024 * 1024;
export const MEETING_RECORDING_PART_MAX_BYTES = 8 * 1024 * 1024;
/** Ghi trực tiếp gửi một phần mỗi phút nên 4 giờ là 240 phần. */
export const MEETING_RECORDING_MAX_PARTS = 400;
export const MEETING_RECORDING_MAX_DURATION_SEC = 4 * 60 * 60;
/** Mỗi cuộc họp tối đa số bản ghi này (kể cả đã lỗi), người dùng xóa bản cũ để ghi tiếp. */
export const MEETING_RECORDINGS_PER_MEETING_MAX = 10;

export const MeetingRecordingSourceSchema = z.enum(['live', 'file']);
export type MeetingRecordingSource = z.infer<typeof MeetingRecordingSourceSchema>;

export const CreateMeetingRecordingSchema = z
  .object({
    source: MeetingRecordingSourceSchema,
    mimeType: z
      .string()
      .max(120)
      .transform((value, ctx) => {
        const normalized = normalizeRecordingMimeType(value);
        if (!normalized) {
          ctx.addIssue({ code: 'custom', message: 'Định dạng âm thanh chưa được hỗ trợ (webm, ogg, mp4/m4a, mp3, wav).' });
          return z.NEVER;
        }
        return normalized;
      }),
    /** Dung lượng tệp khi chọn tệp có sẵn: quá giới hạn của máy chủ thì từ chối ngay, không bắt gửi cả tệp rồi mới báo. Ghi trực tiếp không biết trước. */
    byteSize: z.number().int().positive().max(MEETING_RECORDING_MAX_BYTES, { error: 'Tệp quá lớn.' }).optional(),
  })
  .strict();
export type CreateMeetingRecordingInput = z.infer<typeof CreateMeetingRecordingSchema>;

/** "Tạo biên bản" từ bản ghi đã tải lên: lúc này âm thanh mới được gửi tới dịch vụ AI nên bắt buộc xác nhận. */
export const ProcessMeetingRecordingSchema = z
  .object({
    /** Người bấm xác nhận đã báo cho người dự họp và đồng ý gửi âm thanh tới dịch vụ AI. */
    consent: z.literal(true, { error: 'Cần xác nhận đã thông báo cho người dự họp và đồng ý gửi âm thanh tới dịch vụ AI.' }),
  })
  .strict();
export type ProcessMeetingRecordingInput = z.infer<typeof ProcessMeetingRecordingSchema>;

export const CompleteMeetingRecordingSchema = z
  .object({
    partCount: z.number().int().min(1).max(MEETING_RECORDING_MAX_PARTS),
    /** Số giây ghi do trình duyệt đo (ghi trực tiếp không có thời lượng trong tệp); chỉ dùng để chia đoạn. */
    durationSec: z.number().int().min(1).max(MEETING_RECORDING_MAX_DURATION_SEC),
  })
  .strict();
export type CompleteMeetingRecordingInput = z.infer<typeof CompleteMeetingRecordingSchema>;

/** UPLOADED: đã tải xong, chờ người dùng bấm "Tạo biên bản" (chưa gửi âm thanh tới dịch vụ AI). */
export const MeetingRecordingStatusSchema = z.enum(['UPLOADING', 'UPLOADED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED']);
export type MeetingRecordingStatusValue = z.infer<typeof MeetingRecordingStatusSchema>;

export const MeetingRecordingActionItemSchema = z.object({
  task: z.string(),
  owner: z.string().nullable(),
  deadline: z.string().nullable(),
});
export type MeetingRecordingActionItem = z.infer<typeof MeetingRecordingActionItemSchema>;

export const MeetingRecordingSummarySchema = z.object({
  id: z.string(),
  source: MeetingRecordingSourceSchema,
  status: MeetingRecordingStatusSchema,
  createdAt: z.string(),
  createdByName: z.string().nullable(),
  durationSec: z.number().nullable(),
  byteSize: z.number(),
  /** Số đoạn đã chép trên tổng số đoạn; chỉ có khi đang xử lý. */
  progress: z.object({ done: z.number(), total: z.number() }).nullable(),
  error: z.string().nullable(),
  /** Lúc bấm "Tạo biên bản" (kèm xác nhận); null khi chưa gửi đi soạn. */
  submittedAt: z.string().nullable(),
  processedAt: z.string().nullable(),
  /** Sóng âm để vẽ (độ lớn 0–100 theo khoảng đều nhau); null khi máy chủ chưa tính xong, [] khi không tính được. */
  waveform: z.array(z.number()).nullable(),
});
export type MeetingRecordingSummary = z.infer<typeof MeetingRecordingSummarySchema>;

export const MeetingRecordingDetailSchema = MeetingRecordingSummarySchema.extend({
  transcript: z.string().nullable(),
  minutesDraft: z.string().nullable(),
  decisions: z.array(z.string()),
  actionItems: z.array(MeetingRecordingActionItemSchema),
  model: z.string().nullable(),
});
export type MeetingRecordingDetail = z.infer<typeof MeetingRecordingDetailSchema>;
