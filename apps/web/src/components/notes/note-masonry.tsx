"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Cột thẻ 240px cách 16px như Google Keep; không đủ chỗ cho hai cột (điện thoại) thì hai cột co giãn cách 8px. */
const COLUMN_WIDTH = 240;
const GAP = 16;
const NARROW_GAP = 8;

function shortestColumn(heights: number[]): number {
  let index = 0;
  for (let i = 1; i < heights.length; i++) if (heights[i] < heights[index]) index = i;
  return index;
}

/**
 * Lưới thẻ so le kiểu Google Keep: mỗi thẻ vào cột đang thấp nhất, theo đúng thứ tự `items` nên thứ tự DOM (và phím Tab)
 * vẫn là thứ tự mới nhất. Không dùng CSS `columns-*`: cách đó xếp từ trên xuống từng cột, thẻ mới đẩy thẻ cũ xuống dưới thay
 * vì sang phải. Đo chiều cao ngay trước lần vẽ đầu (không nháy chỗ chưa xếp), sau đó theo dõi bằng ResizeObserver.
 */
export function NoteMasonry<T extends { id: string }>({
  items,
  label,
  heading,
  renderItem,
}: {
  items: T[];
  label: string;
  /** Nhãn nhóm ("Đã ghim", "Khác"), thẳng mép trái của lưới đã căn giữa. */
  heading?: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef(new Map<string, HTMLLIElement>());
  const [width, setWidth] = React.useState(0);
  const [heights, setHeights] = React.useState<Record<string, number>>({});
  const [animate, setAnimate] = React.useState(false);

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
  }, [items, width, measure]);

  // Bật chuyển động vị trí sau lần xếp đầu, để lúc mở trang các thẻ không bay từ góc vào
  React.useEffect(() => {
    if (width > 0 && !animate) setAnimate(true);
  }, [width, animate]);

  const fitted = Math.floor((width + GAP) / (COLUMN_WIDTH + GAP));
  const narrow = fitted < 2;
  const columns = narrow ? 2 : fitted;
  const gap = narrow ? NARROW_GAP : GAP;
  const columnWidth = narrow ? Math.max(0, (width - gap) / 2) : COLUMN_WIDTH;
  const offsetX = (width - (columns * columnWidth + (columns - 1) * gap)) / 2;
  const columnHeights = new Array<number>(columns).fill(0);
  const positions = items.map((item) => {
    const column = shortestColumn(columnHeights);
    const y = columnHeights[column];
    columnHeights[column] += (heights[item.id] ?? 0) + gap;
    return { x: offsetX + column * (columnWidth + gap), y };
  });
  const height = Math.max(0, ...columnHeights) - (items.length > 0 ? gap : 0);

  return (
    <div ref={containerRef} className={cn(width === 0 && "invisible")}>
      {heading && (
        <p className="flex h-7 select-none items-center text-xs text-muted-foreground" style={{ paddingLeft: Math.max(0, offsetX) }}>
          {heading}
        </p>
      )}
      <ul aria-label={label} className="relative" style={{ height }}>
        {items.map((item, index) => (
          <li
            key={item.id}
            ref={(el) => {
              if (el) itemRefs.current.set(item.id, el);
              else itemRefs.current.delete(item.id);
            }}
            className={cn("absolute left-0 top-0", animate && "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out")}
            style={{ width: columnWidth, transform: `translate(${positions[index].x}px, ${positions[index].y}px)` }}
          >
            {renderItem(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}
