/**
 * Hình học trang PDF cho trình xem dựng theo cửa sổ (virtualization).
 * Thuần tính toán, không đụng DOM: mỗi trang có kích thước riêng (dọc/ngang/khổ lạ/xoay),
 * chưa biết kích thước thì dùng kích thước dự phòng (trang đã biết đầu tiên).
 */

export interface PageSize {
  width: number;
  height: number;
}

export const PAGE_GAP = 12;
export const DEFAULT_PAGE_RATIO = 842 / 595;

/** Kích thước hiển thị của từng trang khi thu về độ rộng `displayWidth`. */
export function layoutPageHeights(sizes: Array<PageSize | undefined>, displayWidth: number, fallback?: PageSize): number[] {
  return sizes.map((size) => {
    const source = size ?? fallback;
    const ratio = source && source.width > 0 ? source.height / source.width : DEFAULT_PAGE_RATIO;
    return Math.max(1, Math.round(displayWidth * ratio));
  });
}

export interface PageOffsets {
  tops: number[];
  total: number;
}

export function buildPageOffsets(heights: number[], gap = PAGE_GAP): PageOffsets {
  const tops: number[] = [];
  let cursor = 0;
  for (const height of heights) {
    tops.push(cursor);
    cursor += height + gap;
  }
  return { tops, total: Math.max(0, cursor - (heights.length ? gap : 0)) };
}

export interface PageWindow {
  /** Chỉ số 0-based, bao gồm hai đầu; -1 khi không có trang. */
  first: number;
  last: number;
}

/** Trang giao với [scrollTop, scrollTop + viewportHeight], nở thêm `overscan` trang mỗi phía. */
export function computeRenderWindow(
  offsets: PageOffsets,
  heights: number[],
  scrollTop: number,
  viewportHeight: number,
  overscan = 2,
): PageWindow {
  const count = heights.length;
  if (count === 0) return { first: -1, last: -1 };
  const top = scrollTop;
  const bottom = scrollTop + Math.max(0, viewportHeight);
  let first = count - 1;
  let last = 0;
  for (let i = 0; i < count; i++) {
    const pageTop = offsets.tops[i];
    const pageBottom = pageTop + heights[i];
    if (pageBottom >= top && pageTop <= bottom) {
      if (i < first) first = i;
      if (i > last) last = i;
    }
  }
  if (first > last) {
    // Khung nằm ngoài mọi trang (cuộn quá cuối/đầu): lấy trang gần nhất
    const nearest = scrollTop <= 0 ? 0 : count - 1;
    first = last = nearest;
  }
  return { first: Math.max(0, first - overscan), last: Math.min(count - 1, last + overscan) };
}

/** Trang (1-based) chiếm nhiều diện tích nhất trong khung nhìn; hòa thì lấy trang đứng trước. */
export function currentPageAt(offsets: PageOffsets, heights: number[], scrollTop: number, viewportHeight: number): number {
  const count = heights.length;
  if (count === 0) return 0;
  const top = scrollTop;
  const bottom = scrollTop + Math.max(1, viewportHeight);
  let best = 0;
  let bestVisible = -1;
  for (let i = 0; i < count; i++) {
    const pageTop = offsets.tops[i];
    const visible = Math.min(bottom, pageTop + heights[i]) - Math.max(top, pageTop);
    if (visible > bestVisible) {
      bestVisible = visible;
      best = i;
    }
    if (pageTop > bottom) break;
  }
  return best + 1;
}

export function clampPage(page: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  if (!Number.isFinite(page)) return 1;
  return Math.min(pageCount, Math.max(1, Math.round(page)));
}

/** Offset (so với đầu vùng PDF) cần cuộn tới để đưa trang `page` (1-based) lên đầu khung, cộng `ratio` phần trang. */
export function scrollOffsetForPage(offsets: PageOffsets, heights: number[], page: number, ratio = 0): number {
  const index = clampPage(page, heights.length) - 1;
  if (index < 0) return 0;
  return Math.round(offsets.tops[index] + heights[index] * Math.min(1, Math.max(0, ratio)));
}

/** Phần trang (0..1) mà đỉnh khung nhìn đang nằm trong trang `page`. */
export function pageRatioAt(offsets: PageOffsets, heights: number[], page: number, scrollTop: number): number {
  const index = clampPage(page, heights.length) - 1;
  if (index < 0 || heights[index] <= 0) return 0;
  return Math.min(1, Math.max(0, (scrollTop - offsets.tops[index]) / heights[index]));
}
