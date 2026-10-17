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

/** Số tên tối đa hiện trong chú thích; người còn lại gộp thành "và N người khác". */
export const REACTION_NAMES_SHOWN = 6;

export interface ReactionNamesLabel {
  /** Tên hiện từng cái (đã đổi người xem thành "Bạn", đứng đầu). */
  shown: string[];
  /** Số người không hiện tên. */
  rest: number;
}

/**
 * Danh sách người đã thả cho chú thích: "Bạn" đứng đầu, còn lại theo thứ tự thả, quá `limit` thì gộp phần dư.
 * Chỉ để hiển thị; số lượng thật vẫn là `count` của tóm tắt.
 */
export function reactionNamesLabel(
  summary: Pick<CommentReactionSummary, "names" | "reacted">,
  viewerName: string,
  limit: number = REACTION_NAMES_SHOWN
): ReactionNamesLabel {
  const others = [...summary.names];
  const viewerAt = summary.reacted ? others.indexOf(viewerName) : -1;
  if (viewerAt >= 0) others.splice(viewerAt, 1);
  const all = viewerAt >= 0 ? ["Bạn", ...others] : others;
  // Chừa chỗ cho dòng "và N người khác": không rút gọn khi chỉ dư đúng một người (nói thẳng tên cho gọn).
  if (all.length <= limit + 1) return { shown: all, rest: 0 };
  return { shown: all.slice(0, limit), rest: all.length - limit };
}

/** "A", "A và B", "A, B và C", "A, B, C, D, E, F và 3 người khác". */
export function joinReactionNames({ shown, rest }: ReactionNamesLabel): string {
  const tail = rest > 0 ? `${rest} người khác` : null;
  const parts = tail ? [...shown, tail] : shown;
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} và ${parts[parts.length - 1]}`;
}
