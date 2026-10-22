/** Hình chữ nhật tối thiểu (top/left/right/bottom) đủ để hợp các dòng chữ. */
export interface RectLike {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Khung theo dạng `getBoundingClientRect()` mà Floating UI đọc. */
export type ClientRect = RectLike & { x: number; y: number };

/** Hợp các khung dòng chữ, bỏ khung rỗng (dòng trống, điểm ngắt khối); `null` khi không còn khung nào. */
export function unionRects(rects: Iterable<RectLike>): ClientRect | null {
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  for (const r of rects) {
    if (r.width <= 0 || r.height <= 0) continue;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (top === Infinity) return null;
  return { x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top };
}

/**
 * Khung của phần chữ đang chọn. `range.getBoundingClientRect()` của vùng chọn qua nhiều khối tính cả khung các khối
 * (đoạn, mục danh sách) rộng hết editor, nên thanh định dạng neo theo nó bị đẩy lệch xa chữ. Ở đây chỉ hợp khung của
 * các đoạn chữ thật sự nằm trong vùng chọn.
 */
export function selectionTextRect(range: Range): ClientRect | null {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) return unionRects(Array.from(range.getClientRects()));

  const rects: RectLike[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!range.intersectsNode(node) || !node.textContent) continue;
    const part = document.createRange();
    part.selectNodeContents(node);
    if (node === range.startContainer) part.setStart(node, range.startOffset);
    if (node === range.endContainer) part.setEnd(node, range.endOffset);
    rects.push(...Array.from(part.getClientRects()));
  }
  return unionRects(rects);
}
