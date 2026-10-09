/**
 * Chỉ mục văn bản PDF cho tìm kiếm. Tách khỏi việc dựng trang: tìm kiếm chạy trên toàn bộ trang
 * kể cả trang chưa được dựng; trang chỉ được cuộn tới và dựng khi người dùng chọn một kết quả.
 */

export interface TextHit {
  /** 1-based. */
  page: number;
  /** Chỉ số đoạn chữ trong trang (cùng thứ tự `getTextContent().items`). */
  item: number;
  /** Thứ tự xuất hiện trong cùng một đoạn chữ. */
  nth: number;
}

export const MIN_QUERY_LENGTH = 2;

export const normalizeSearchText = (text: string) => text.normalize("NFC").toLowerCase();

export const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Từ khóa hợp lệ để tìm (đã chuẩn hóa), hoặc chuỗi rỗng khi quá ngắn. */
export function toSearchQuery(raw: string): string {
  const query = normalizeSearchText(raw.trim());
  return query.length >= MIN_QUERY_LENGTH ? query : "";
}

/** Mọi kết quả trong một trang, theo thứ tự đọc. `items` là chuỗi của từng đoạn chữ. */
export function findHitsInPage(page: number, items: string[], query: string): TextHit[] {
  if (!query) return [];
  const hits: TextHit[] = [];
  items.forEach((raw, item) => {
    const text = normalizeSearchText(raw);
    for (let from = text.indexOf(query), nth = 0; from !== -1; from = text.indexOf(query, from + query.length), nth++) {
      hits.push({ page, item, nth });
    }
  });
  return hits;
}

/** Mọi kết quả trong cả tài liệu (`pages[i]` là các đoạn chữ của trang i+1; `undefined` = chưa lập chỉ mục). */
export function findHits(pages: Array<string[] | undefined>, query: string): TextHit[] {
  if (!query) return [];
  return pages.flatMap((items, index) => (items ? findHitsInPage(index + 1, items, query) : []));
}

/** HTML của một đoạn chữ với các kết quả được bọc `<mark>`; `activeNth` là kết quả đang chọn trong đoạn (hoặc null). */
export function highlightItemHtml(str: string, query: string, activeNth: number | null): string {
  const text = normalizeSearchText(str);
  if (!query || !text.includes(query)) return escapeHtml(str);
  let html = "";
  let last = 0;
  for (let from = text.indexOf(query), nth = 0; from !== -1; from = text.indexOf(query, from + query.length), nth++) {
    const current = activeNth === nth;
    html += escapeHtml(str.slice(last, from));
    html += `<mark data-active="${current ? "1" : "0"}" style="background:${current ? "rgba(249,115,22,.55)" : "rgba(250,204,21,.45)"};color:transparent;border-radius:2px">${escapeHtml(str.slice(from, from + query.length))}</mark>`;
    last = from + query.length;
  }
  return html + escapeHtml(str.slice(last));
}
