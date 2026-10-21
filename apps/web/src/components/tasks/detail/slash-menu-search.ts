import { foldVietnamese } from "@qcet/shared/lib/search/vietnamese-search";

/** Một mục của menu "/": lọc theo tên, từ khóa (gồm tên tiếng Anh như Notion/Linear), phím tắt markdown và mô tả */
export interface SlashSearchable {
  title: string;
  description: string;
  keywords?: readonly string[];
  shortcut?: string;
}

function scoreOption(option: SlashSearchable, q: string): number {
  const title = foldVietnamese(option.title);
  if (title.startsWith(q)) return 100;
  if (option.shortcut && option.shortcut === q) return 90;
  if (title.split(/\s+/).some((word) => word.startsWith(q))) return 80;
  const keywords = (option.keywords ?? []).map((keyword) => foldVietnamese(keyword));
  if (keywords.some((keyword) => keyword === q)) return 75;
  if (keywords.some((keyword) => keyword.startsWith(q))) return 70;
  if (title.includes(q)) return 50;
  if (keywords.some((keyword) => keyword.includes(q))) return 40;
  if (foldVietnamese(option.description).includes(q)) return 20;
  return 0;
}

/**
 * Lọc và xếp mục menu "/" theo câu gõ (không dấu, không phân biệt hoa thường): tên bắt đầu bằng câu gõ đứng trước, rồi chữ
 * đầu một từ trong tên, từ khóa, phần giữa tên, cuối cùng là mô tả; bằng điểm thì giữ thứ tự gốc. Câu rỗng trả nguyên danh sách.
 */
export function rankSlashOptions<T extends SlashSearchable>(options: readonly T[], query: string): T[] {
  const q = foldVietnamese(query.trim());
  if (!q) return [...options];
  return options
    .map((option, index) => ({ option, index, score: scoreOption(option, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.option);
}
