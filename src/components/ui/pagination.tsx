import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Số trang kề hai bên trang hiện tại. */
  siblings?: number;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

/** Trả về dãy số trang kèm dấu "…" khi có đoạn bị rút gọn. */
export function getPaginationRange(
  page: number,
  pageCount: number,
  siblings = 1,
): (number | "gap")[] {
  const total = siblings * 2 + 5;
  if (pageCount <= total) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const left = Math.max(page - siblings, 2);
  const right = Math.min(page + siblings, pageCount - 1);
  const out: (number | "gap")[] = [1];
  if (left > 2) out.push("gap");
  for (let i = left; i <= right; i++) out.push(i);
  if (right < pageCount - 1) out.push("gap");
  out.push(pageCount);
  return out;
}

const cell =
  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xs tabular-nums outline-none transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none sm:size-8";

/** Điều hướng giữa các trang kết quả. Trang hiện tại có `aria-current="page"`. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblings = 1,
  disabled,
  "aria-label": ariaLabel = "Phân trang",
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(1, page), pageCount);
  const go = (p: number) => () => onPageChange(p);
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul className="flex items-center gap-1">
        <li>
          <button
            type="button"
            aria-label="Trang trước"
            disabled={disabled || current === 1}
            onClick={go(current - 1)}
            className={cn(cell, "text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            <ChevronLeft className="size-4" />
          </button>
        </li>
        {getPaginationRange(current, pageCount, siblings).map((item, i) =>
          item === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                aria-label={`Trang ${item}`}
                aria-current={item === current ? "page" : undefined}
                disabled={disabled}
                onClick={go(item)}
                className={cn(
                  cell,
                  item === current
                    ? "bg-selected font-semibold text-foreground"
                    : "text-foreground hover:bg-accent",
                )}
              >
                {item}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            aria-label="Trang sau"
            disabled={disabled || current === pageCount}
            onClick={go(current + 1)}
            className={cn(cell, "text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            <ChevronRight className="size-4" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
