import { z } from 'zod';

/**
 * Ghi chú cá nhân: riêng tư theo chủ nhân. Có thể gắn với một cuộc họp hoặc nhiệm vụ để xem lại cạnh nội dung đó;
 * gắn không cấp thêm quyền xem đối tượng.
 */
export const PERSONAL_NOTE_ENTITY_TYPES = ['meeting', 'task'] as const;
export const PersonalNoteEntityTypeSchema = z.enum(PERSONAL_NOTE_ENTITY_TYPES);
export type PersonalNoteEntityType = z.infer<typeof PersonalNoteEntityTypeSchema>;

/**
 * Màu nền thẻ ghi chú (người dùng yêu cầu 23/10/2026, theo Google Keep): khóa theo tên màu, màu thật là token `--note-*` ở
 * `globals.css`. Null là màu mặc định (nền trắng của thẻ).
 */
export const PERSONAL_NOTE_COLORS = ['coral', 'peach', 'sand', 'mint', 'sage', 'fog', 'storm', 'dusk', 'blossom', 'clay', 'chalk'] as const;
export const PersonalNoteColorSchema = z.enum(PERSONAL_NOTE_COLORS);
export type PersonalNoteColor = z.infer<typeof PersonalNoteColorSchema>;

export const PERSONAL_NOTE_TITLE_MAX = 200;
export const PERSONAL_NOTE_CONTENT_MAX = 50_000;
/** Mỗi người tối đa số ghi chú này (chống lạm dụng bộ nhớ). */
export const PERSONAL_NOTES_PER_USER_MAX = 2000;

/** Số ký tự tối đa của các dòng chữ trên thẻ ghi chú, xem `toNotePreviewLines`. */
export const PERSONAL_NOTE_PREVIEW_MAX = 600;

/** Ảnh hiện ở đầu thẻ ghi chú (đã tải lên máy chủ). */
export const NoteCardImageSchema = z.object({ url: z.string(), caption: z.string() });
export type NoteCardImage = z.infer<typeof NoteCardImageSchema>;

/** Một dòng chữ của thẻ ghi chú; `heading`: tiêu đề khối, thẻ in đậm. */
export const NotePreviewLineSchema = z.object({ text: z.string(), heading: z.boolean().optional() });
export type NotePreviewLine = z.infer<typeof NotePreviewLineSchema>;

/**
 * Dòng trong danh sách: chỉ trích đoạn đầu nội dung, nội dung đầy đủ lấy ở chi tiết. `excerpt` một dòng (khoảng trắng gộp,
 * 160 ký tự); `previewLines` và `images` cho thẻ kiểu Google Keep (ảnh ở đầu thẻ, tiêu đề khối in đậm).
 */
export const PersonalNoteSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  excerpt: z.string(),
  previewLines: z.array(NotePreviewLineSchema),
  images: z.array(NoteCardImageSchema),
  pinned: z.boolean(),
  color: PersonalNoteColorSchema.nullable(),
  entityType: PersonalNoteEntityTypeSchema.nullable(),
  entityId: z.string().nullable(),
  updatedAt: z.string(),
});
export type PersonalNoteSummary = z.infer<typeof PersonalNoteSummarySchema>;

export const PersonalNoteSchema = PersonalNoteSummarySchema.omit({ excerpt: true, previewLines: true, images: true }).extend({
  content: z.string(),
  createdAt: z.string(),
});
export type PersonalNote = z.infer<typeof PersonalNoteSchema>;

export const ListPersonalNotesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  entityType: PersonalNoteEntityTypeSchema.optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListPersonalNotesQuery = z.infer<typeof ListPersonalNotesQuerySchema>;

const entityPair = <T extends { entityType?: unknown; entityId?: unknown }>(value: T) =>
  (value.entityType === undefined || value.entityType === null) === (value.entityId === undefined || value.entityId === null);

export const CreatePersonalNoteSchema = z
  .object({
    title: z.string().max(PERSONAL_NOTE_TITLE_MAX).default(''),
    content: z.string().max(PERSONAL_NOTE_CONTENT_MAX).default(''),
    pinned: z.boolean().default(false),
    color: PersonalNoteColorSchema.nullish(),
    entityType: PersonalNoteEntityTypeSchema.nullish(),
    entityId: z.string().trim().min(1).max(64).nullish(),
  })
  .strict()
  .refine(entityPair, { message: 'Gắn đối tượng cần đủ cả loại và mã.', path: ['entityId'] });
export type CreatePersonalNoteInput = z.infer<typeof CreatePersonalNoteSchema>;

/** Sửa: chỉ các trường gửi lên mới đổi; `entityType` và `entityId` cùng `null` để gỡ liên kết. */
export const UpdatePersonalNoteSchema = z
  .object({
    title: z.string().max(PERSONAL_NOTE_TITLE_MAX).optional(),
    content: z.string().max(PERSONAL_NOTE_CONTENT_MAX).optional(),
    pinned: z.boolean().optional(),
    /** `null` đưa về màu mặc định. */
    color: PersonalNoteColorSchema.nullish(),
    entityType: PersonalNoteEntityTypeSchema.nullish(),
    entityId: z.string().trim().min(1).max(64).nullish(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Không có gì để cập nhật.' })
  .refine(entityPair, { message: 'Gắn đối tượng cần đủ cả loại và mã.', path: ['entityId'] });
export type UpdatePersonalNoteInput = z.infer<typeof UpdatePersonalNoteSchema>;
