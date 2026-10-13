/**
 * Emoji thả vào bình luận nhiệm vụ: bộ cố định để server kiểm được đầu vào và giao diện chọn nhanh một hàng.
 * Thứ tự ở đây cũng là thứ tự hiển thị các emoji đã thả.
 */
// design-lint-ignore no-emoji: đây là dữ liệu emoji người dùng thả vào bình luận, không phải icon giao diện
export const COMMENT_REACTION_EMOJIS =["👍", "❤️", "😄", "🎉", "👀", "✅"] as const;

export type CommentReactionEmoji = (typeof COMMENT_REACTION_EMOJIS)[number];

export function isCommentReactionEmoji(value: unknown): value is CommentReactionEmoji {
  return typeof value === "string" && (COMMENT_REACTION_EMOJIS as readonly string[]).includes(value);
}

export interface CommentReactionSummary {
  emoji: CommentReactionEmoji;
  count: number;
  /** Người đang xem đã thả emoji này. */
  reacted: boolean;
  /** Tên người đã thả, theo thứ tự thả (hiện khi rê chuột). */
  names: string[];
}

/** Gộp các lượt thả thành từng emoji kèm số đếm; bỏ emoji ngoài bộ cố định. */
export function summarizeCommentReactions(
  rows: Array<{ emoji: string; userId: string; userName: string; createdAt: Date | string }>,
  viewerId: string
): CommentReactionSummary[] {
  const sorted = [...rows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return COMMENT_REACTION_EMOJIS.flatMap((emoji) => {
    const hits = sorted.filter((row) => row.emoji === emoji);
    if (hits.length === 0) return [];
    return [{ emoji, count: hits.length, reacted: hits.some((row) => row.userId === viewerId), names: hits.map((row) => row.userName) }];
  });
}
