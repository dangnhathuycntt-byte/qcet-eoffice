/**
 * Nhắc tên trong bình luận (T-03). Hàm thuần dùng cho ô soạn bình luận.
 *
 * Người dùng gõ "@" rồi chọn từ danh sách người tham gia; ô soạn chèn "@Tên " vào
 * nội dung và nhớ mã người dùng. Khi gửi, chỉ giữ những người mà "@Tên" còn trong
 * nội dung, để xóa chữ thì không còn nhắc.
 */

export interface MentionCandidate {
  id: string;
  name: string;
}

/** Từ đang gõ sau "@" ngay trước con trỏ, hoặc null nếu không ở trong một lần nhắc. */
export function findMentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const upto = text.slice(0, caret);
  const match = /(^|\s)@([^\s@]{0,40})$/u.exec(upto);
  if (!match) return null;
  return { query: match[2], start: upto.length - match[2].length - 1 };
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function filterMentionCandidates(candidates: MentionCandidate[], query: string, limit = 6): MentionCandidate[] {
  const q = fold(query);
  return candidates.filter((c) => fold(c.name).includes(q)).slice(0, limit);
}

/** Thay phần "@truy_vấn" đang gõ bằng "@Tên " và trả nội dung mới cùng vị trí con trỏ. */
export function insertMention(
  text: string,
  caret: number,
  start: number,
  candidate: MentionCandidate
): { text: string; caret: number } {
  const insertion = `@${candidate.name} `;
  const next = text.slice(0, start) + insertion + text.slice(caret);
  return { text: next, caret: start + insertion.length };
}

/** Mã người dùng còn được nhắc trong nội dung cuối cùng. */
export function resolveMentionIds(text: string, chosen: MentionCandidate[]): string[] {
  const ids = new Set<string>();
  for (const candidate of chosen) {
    if (text.includes(`@${candidate.name}`)) ids.add(candidate.id);
  }
  return [...ids];
}
