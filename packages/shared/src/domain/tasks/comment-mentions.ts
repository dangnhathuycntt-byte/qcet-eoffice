/**
 * Nhắc tên trong bình luận (T-03). Hàm thuần dùng cho ô soạn bình luận.
 *
 * Người dùng gõ "@" rồi chọn từ danh sách người tham gia; ô soạn chèn "@Tên " vào
 * nội dung và nhớ mã người dùng. Khi gửi, chỉ giữ những người mà "@Tên" còn trong
 * nội dung, để xóa chữ thì không còn nhắc.
 */

import { foldVietnamese } from "@qcet/shared/lib/search/vietnamese-search";

export interface MentionCandidate {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** false: người cùng đơn vị chưa có vai trò; nhắc tên sẽ thêm họ làm người theo dõi. */
  inTask?: boolean;
}

/** Từ đang gõ sau "@" ngay trước con trỏ, hoặc null nếu không ở trong một lần nhắc. */
export function findMentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const upto = text.slice(0, caret);
  const match = /(^|\s)@([^\s@]{0,40})$/u.exec(upto);
  if (!match) return null;
  return { query: match[2], start: upto.length - match[2].length - 1 };
}

export function filterMentionCandidates(candidates: MentionCandidate[], query: string, limit = 6): MentionCandidate[] {
  const q = foldVietnamese(query);
  return candidates.filter((c) => foldVietnamese(c.name).includes(q)).slice(0, limit);
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

/**
 * "@all" (người dùng yêu cầu 21/10/2026 "thêm cái tag everyone", như @everyone; cùng ngày đổi tên "Tất cả" → "Mọi người"
 * → "all": "cứ để all đi không cần mọi người"): một lần nhắc mọi người trong danh sách nhắc được (người trong nhiệm vụ và
 * người cùng đơn vị).
 * Chỉ có khi danh sách từ 2 tới `MENTION_ALL_MAX` người, bằng trần số người được nhắc của máy chủ, để không lỡ tay nhắc cả
 * trăm người của một khối lớn.
 */
export const MENTION_ALL_NAME = "all";
/** Tên cũ của token: bình luận đã gửi với "@Tất cả", "@Mọi người" vẫn được tô như một lần nhắc khi hiển thị. */
export const MENTION_ALL_LEGACY_NAMES = ["Tất cả", "Mọi người"];
export const MENTION_ALL_ID = "__all__";
export const MENTION_ALL_MAX = 30;
const MENTION_ALL_KEYWORDS = ["moi nguoi", "moinguoi", "everyone", "all", "tat ca", "tatca"];

/** Có hiện mục "all" cho từ đang gõ sau "@" không (gõ "moi", "every", "all", "tat"… hoặc chưa gõ gì). */
export function offersMentionAll(candidates: MentionCandidate[], query: string): boolean {
  if (candidates.length < 2 || candidates.length > MENTION_ALL_MAX) return false;
  const q = foldVietnamese(query);
  return MENTION_ALL_KEYWORDS.some((keyword) => keyword.startsWith(q));
}

/** Mã người dùng còn được nhắc trong nội dung cuối cùng; còn "@all" thì nhắc cả `everyone`. */
export function resolveMentionIds(text: string, chosen: MentionCandidate[], everyone: MentionCandidate[] = []): string[] {
  const ids = new Set<string>();
  for (const candidate of chosen) {
    if (candidate.id !== MENTION_ALL_ID && text.includes(`@${candidate.name}`)) ids.add(candidate.id);
  }
  if (chosen.some((candidate) => candidate.id === MENTION_ALL_ID) && splitMentions(text, [MENTION_ALL_NAME]).some((part) => part.mention)) {
    for (const person of everyone.slice(0, MENTION_ALL_MAX)) ids.add(person.id);
  }
  return [...ids].slice(0, MENTION_ALL_MAX);
}

/**
 * Tách nội dung bình luận thành đoạn thường và đoạn "@Tên" (chỉ những tên đã biết) để tô màu khi hiển thị.
 * Tên dài khớp trước ("@Nguyễn Văn An" không bị cắt thành "@Nguyễn Văn").
 */
export function splitMentions(text: string, names: string[]): Array<{ text: string; mention: boolean }> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (unique.length === 0 || !text.includes("@")) return [{ text, mention: false }];
  const escaped = unique.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(^|\\s)(@(?:${escaped.join("|")}))(?=$|[\\s.,;:!?)])`, "gu");
  const parts: Array<{ text: string; mention: boolean }> = [];
  let last = 0;
  for (const match of text.matchAll(re)) {
    const start = (match.index ?? 0) + match[1].length;
    if (start > last) parts.push({ text: text.slice(last, start), mention: false });
    parts.push({ text: match[2], mention: true });
    last = start + match[2].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false });
  return parts;
}
