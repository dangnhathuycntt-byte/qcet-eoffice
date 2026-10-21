"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Cột thẻ 240px cách 16px như Google Keep; không đủ chỗ cho hai cột (điện thoại) thì hai cột co giãn cách 8px. */
const COLUMN_WIDTH = 240;
const GAP = 16;
const NARROW_GAP = 8;
/** Nhãn nhóm 28px, các nhóm cách nhau 32px. */
const HEADING_HEIGHT = 28;
const SECTION_GAP = 32;
const MOVE_DURATION = 250;
const MOVE_EASING = "cubic-bezier(0.2, 0, 0, 1)";

function shortestColumn(heights: number[]): number {
  let index = 0;
  for (let i = 1; i < heights.length; i++) if (heights[i] < heights[index]) index = i;
  return index;
}

export interface NoteMasonrySection<T> {
  key: string;
  /** Nhãn nhóm hiện trên lưới ("Đã ghim", "Khác"), thẳng mép trái của lưới đã căn giữa. */
  heading?: string;
  items: T[];
}

type Point = { x: number; y: number };

/**
 * Lưới thẻ so le kiểu Google Keep: mỗi thẻ vào cột đang thấp nhất, theo đúng thứ tự trong nhóm nên thứ tự DOM (và phím Tab)
 * vẫn là thứ tự hiện trên màn hình. Không dùng CSS `columns-*`: cách đó xếp từ trên xuống từng cột, thẻ mới đẩy thẻ cũ xuống
 * dưới thay vì sang phải. Đo chiều cao ngay trước lần vẽ đầu (không nháy chỗ chưa xếp), sau đó theo dõi bằng ResizeObserver.
 *
 * Các nhóm nằm chung một khung: ghim/bỏ ghim thì thẻ trượt sang nhóm kia thay vì biến mất rồi hiện lại (người dùng báo "khi
 * ghim chưa mượt" 21/10/2026). Chuyển động dùng FLIP bằng Web Animations: React đổi thứ tự phần tử trong DOM làm hủy CSS
 * transition của phần tử bị chuyển chỗ, còn animation tạo bằng `element.animate()` thì không.
 */
export function NoteMasonry<T extends { id: string }>({
  sections,
  label,
  renderItem,
}: {
  sections: NoteMasonrySection<T>[];
  label: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef(new Map<string, HTMLElement>());
  const moveRefs = React.useRef(new Map<string, HTMLElement>());
  const lastPoints = React.useRef(new Map<string, Point>());
  const lastWidth = React.useRef(0);
  const [width, setWidth] = React.useState(0);
  const [heights, setHeights] = React.useState<Record<string, number>>({});

  const measure = React.useCallback(() => {
    setHeights((prev) => {
      let next = prev;
      itemRefs.current.forEach((el, id) => {
        if (prev[id] !== el.offsetHeight) {
          if (next === prev) next = { ...prev };
          next[id] = el.offsetHeight;
        }
      });
      return next;
    });
  }, []);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Đo lại khi đổi danh sách hoặc bề rộng cột; nội dung thẻ đổi sau đó (sửa ghi chú, phông tải xong) thì ResizeObserver báo
  React.useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    itemRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections, width, measure]);

  const fitted = Math.floor((width + GAP) / (COLUMN_WIDTH + GAP));
  const narrow = fitted < 2;
  const columns = narrow ? 2 : fitted;
  const gap = narrow ? NARROW_GAP : GAP;
  const columnWidth = narrow ? Math.max(0, (width - gap) / 2) : COLUMN_WIDTH;
  const offsetX = (width - (columns * columnWidth + (columns - 1) * gap)) / 2;

  const headings: Array<{ key: string; text: string; y: number }> = [];
  const placed: Array<{ item: T; x: number; y: number }> = [];
  let top = 0;
  for (const section of sections) {
    if (section.items.length === 0) continue;
    if (section.heading) {
      headings.push({ key: section.key, text: section.heading, y: top });
      top += HEADING_HEIGHT;
    }
    const columnHeights = new Array<number>(columns).fill(top);
    for (const item of section.items) {
      const column = shortestColumn(columnHeights);
      placed.push({ item, x: offsetX + column * (columnWidth + gap), y: columnHeights[column] });
      columnHeights[column] += (heights[item.id] ?? 0) + gap;
    }
    top = Math.max(...columnHeights) - gap + SECTION_GAP;
  }
  const height = Math.max(0, top - SECTION_GAP);

  // FLIP: phần tử đổi chỗ thì chạy từ chỗ đang thấy tới chỗ mới. Không chạy ở lần xếp đầu (thẻ bay từ góc vào), khi đổi bề
  // rộng (kéo cửa sổ thì bám theo ngay) và khi người dùng tắt chuyển động.
  React.useLayoutEffect(() => {
    const animate =
      lastWidth.current === width && width > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastWidth.current = width;
    const points = new Map<string, Point>();
    const targets = [
      ...headings.map((heading) => ({ key: `heading:${heading.key}`, x: 0, y: heading.y })),
      ...placed.map(({ item, x, y }) => ({ key: item.id, x, y })),
    ];
    for (const { key, x, y } of targets) {
      points.set(key, { x, y });
      const el = moveRefs.current.get(key);
      const last = lastPoints.current.get(key);
      if (!el || !last || !animate || (last.x === x && last.y === y)) continue;
      let from = last;
      const running = el.getAnimations();
      if (running.length > 0) {
        // Đang chạy dở (bấm ghim liên tiếp): bắt đầu từ vị trí đang hiện, không giật về chỗ cũ
        const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        from = { x: matrix.m41, y: matrix.m42 };
        running.forEach((animation) => animation.cancel());
      }
      el.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${x}px, ${y}px)` }], {
        duration: MOVE_DURATION,
        easing: MOVE_EASING,
      });
    }
    lastPoints.current = points;
  });

  const setMoveRef = (key: string) => (el: HTMLElement | null) => {
    if (el) moveRefs.current.set(key, el);
    else moveRefs.current.delete(key);
  };

  return (
    <div ref={containerRef} className={cn("relative", width === 0 && "invisible")} style={{ height }}>
      {/* Nhãn nhóm chỉ để nhìn: một danh sách chung (thẻ đã ghim có nút "Bỏ ghim" cho trình đọc màn hình) */}
      {headings.map((heading) => (
        <p
          key={heading.key}
          ref={setMoveRef(`heading:${heading.key}`)}
          aria-hidden
          className="absolute left-0 top-0 flex h-7 select-none items-center text-xs text-muted-foreground"
          style={{ paddingLeft: Math.max(0, offsetX), transform: `translate(0px, ${heading.y}px)` }}
        >
          <span className="motion-safe:animate-[fade-in_200ms_ease-out]">{heading.text}</span>
        </p>
      ))}
      <ul aria-label={label} className="absolute inset-0">
        {placed.map(({ item, x, y }) => (
          <li
            key={item.id}
            ref={(el) => {
              setMoveRef(item.id)(el);
              if (el) itemRefs.current.set(item.id, el);
              else itemRefs.current.delete(item.id);
            }}
            className="absolute left-0 top-0"
            style={{ width: columnWidth, transform: `translate(${x}px, ${y}px)` }}
          >
            {renderItem(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}
