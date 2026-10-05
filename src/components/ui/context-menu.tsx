"use client";

import * as React from "react";
import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MenuItemData } from "./cascading-menu";

export interface ContextMenuProps {
  children: React.ReactNode;
  items: MenuItemData[];
  className?: string;
  popupClassName?: string;
}

function renderContextMenuItems(items: MenuItemData[]) {
  return items.map((item, index) => {
    if (item.separator) {
      return (
        <BaseContextMenu.Separator
          key={`sep-${item.id || index}`}
          className="my-1 h-px bg-border/60"
        />
      );
    }

    if (item.items && item.items.length > 0) {
      return (
        <BaseContextMenu.SubmenuRoot key={item.id || `sub-${index}`}>
          <BaseContextMenu.SubmenuTrigger
            disabled={item.disabled}
            className={cn(
              "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none select-none",
              "transition-colors duration-[var(--motion-duration-micro)] motion-reduce:transition-none",
              "data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {item.icon ? (
                <span className="shrink-0 text-muted-foreground [&_svg]:size-4">
                  {item.icon}
                </span>
              ) : null}
              <span className="truncate">{item.label}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </BaseContextMenu.SubmenuTrigger>
          <BaseContextMenu.Portal>
            <BaseContextMenu.Positioner
              side="right"
              align="start"
              sideOffset={4}
              alignOffset={-4}
              collisionPadding={12}
              className="z-30 outline-none"
            >
              <BaseContextMenu.Popup
                className={cn(
                  "z-30 min-w-[12rem] origin-[var(--transform-origin)] rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-popover-foreground shadow-menu outline-none",
                  "transition-opacity duration-100 ease-out motion-reduce:transition-none",
                  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
                )}
              >
                {renderContextMenuItems(item.items)}
              </BaseContextMenu.Popup>
            </BaseContextMenu.Positioner>
          </BaseContextMenu.Portal>
        </BaseContextMenu.SubmenuRoot>
      );
    }

    return (
      <BaseContextMenu.Item
        key={item.id || index}
        disabled={item.disabled}
        onClick={item.onClick}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none",
          "transition-colors duration-100 motion-reduce:transition-none",
          item.destructive
            ? "text-destructive data-[highlighted]:bg-danger-soft"
            : "text-foreground data-[highlighted]:bg-accent",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {item.checked !== undefined ? (
            <span className="flex size-4 shrink-0 items-center justify-center text-primary">
              {item.checked ? <Check className="size-3.5" /> : null}
            </span>
          ) : item.icon ? (
            <span className="shrink-0 text-muted-foreground [&_svg]:size-4">
              {item.icon}
            </span>
          ) : null}
          <span className="truncate font-normal">{item.label}</span>
        </span>
        {item.shortcut ? (
          <span className="ml-auto pl-2 font-mono text-xs text-muted-foreground">
            {item.shortcut}
          </span>
        ) : null}
      </BaseContextMenu.Item>
    );
  });
}

/**
 * Menu ngữ cảnh kích hoạt khi nhấn chuột phải hoặc chạm giữ lâu trên thiết bị di động.
 * Hỗ trợ submenu phân cấp ngang, phím tắt và mục xóa/nguy hiểm.
 */
export function ContextMenu({
  children,
  items,
  className,
  popupClassName,
}: ContextMenuProps) {
  return (
    <BaseContextMenu.Root>
      <BaseContextMenu.Trigger className={cn("select-none", className)}>
        {children}
      </BaseContextMenu.Trigger>
      <BaseContextMenu.Portal>
        <BaseContextMenu.Positioner
          sideOffset={2}
          collisionPadding={12}
          className="z-30 outline-none"
        >
          <BaseContextMenu.Popup
            className={cn(
              "z-30 min-w-[13rem] origin-[var(--transform-origin)] rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-popover-foreground shadow-menu outline-none",
              "transition-opacity duration-100 ease-out motion-reduce:transition-none",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              popupClassName,
            )}
          >
            {renderContextMenuItems(items)}
          </BaseContextMenu.Popup>
        </BaseContextMenu.Positioner>
      </BaseContextMenu.Portal>
    </BaseContextMenu.Root>
  );
}
