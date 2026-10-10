"use client";

import * as React from "react";
import { Menubar as BaseMenubar } from "@base-ui/react/menubar";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MenuItemData } from "./cascading-menu";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface MenubarSection {
  id: string;
  label: string;
  items: MenuItemData[];
}

export interface MenubarProps {
  sections: MenubarSection[];
  className?: string;
}

function renderMenuItems(items: MenuItemData[]) {
  return items.map((item, index) => {
    if (item.separator) {
      return (
        <BaseMenu.Separator
          key={`sep-${item.id || index}`}
          className="my-1 h-px bg-border/60"
        />
      );
    }

    if (item.items && item.items.length > 0) {
      return (
        <BaseMenu.SubmenuRoot key={item.id || `sub-${index}`}>
          <BaseMenu.SubmenuTrigger
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
          </BaseMenu.SubmenuTrigger>
          <BaseMenu.Portal>
            <BaseMenu.Positioner
              side="right"
              align="start"
              sideOffset={4}
              alignOffset={-4}
              collisionPadding={12}
              className="z-50 outline-none"
            >
              <BaseMenu.Popup
                className={cn(
                  "z-50 min-w-[12rem] origin-[var(--transform-origin)] rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-popover-foreground shadow-menu outline-none",
                  "transition-opacity duration-100 ease-out motion-reduce:transition-none",
                  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
                )}
              >
                {renderMenuItems(item.items)}
              </BaseMenu.Popup>
            </BaseMenu.Positioner>
          </BaseMenu.Portal>
        </BaseMenu.SubmenuRoot>
      );
    }

    return (
      <BaseMenu.Item
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
          {item.icon ? (
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
      </BaseMenu.Item>
    );
  });
}

/**
 * Thanh menu ngang (Menubar) chuẩn ứng dụng nghiệp vụ / văn bản.
 * Hỗ trợ phím mũi tên `←/→` chuyển đổi giữa các menu, tự động mở khi rê chuột qua menu liền kề.
 */
export function Menubar({ sections, className }: MenubarProps) {
  return (
    <BaseMenubar className={cn("inline-flex items-center gap-0.5 rounded-lg p-0.5", className)}>
      {sections.map((section) => (
        <BaseMenu.Root key={section.id}>
          <BaseMenu.Trigger
            className={cn(
              "inline-flex h-8 cursor-pointer items-center rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none",
              `transition-colors duration-100 hover:bg-accent hover:text-foreground ${focusRingClass}`,
              "data-[popup-open]:bg-accent data-[popup-open]:text-foreground motion-reduce:transition-none",
            )}
          >
            {section.label}
          </BaseMenu.Trigger>
          <BaseMenu.Portal>
            <BaseMenu.Positioner
              side="bottom"
              align="start"
              sideOffset={4}
              collisionPadding={12}
              className="z-50 outline-none"
            >
              <BaseMenu.Popup
                className={cn(
                  "z-50 min-w-[12rem] origin-[var(--transform-origin)] rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-popover-foreground shadow-menu outline-none",
                  "transition-opacity duration-100 ease-out motion-reduce:transition-none",
                  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
                )}
              >
                {renderMenuItems(section.items)}
              </BaseMenu.Popup>
            </BaseMenu.Positioner>
          </BaseMenu.Portal>
        </BaseMenu.Root>
      ))}
    </BaseMenubar>
  );
}
