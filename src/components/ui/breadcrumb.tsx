import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  /** Bỏ trống ở mục cuối (trang hiện tại). */
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/** Đường dẫn phân cấp. Mục cuối là trang hiện tại: không phải liên kết, có `aria-current="page"`. */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Đường dẫn" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className="font-medium text-foreground">
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className={cn(
                    "rounded-md px-1 text-muted-foreground outline-none transition-colors duration-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 motion-reduce:transition-none",
                  )}
                >
                  {item.label}
                </a>
              )}
              {last ? null : <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
