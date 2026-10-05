"use client";

import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItemData {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  separator?: boolean;
  onClick?: () => void;
  /** Danh sách mục con hiển thị ở dropdown ngang cấp tiếp theo. */
  items?: MenuItemData[];
  checked?: boolean;
}

export interface CascadingMenuProps {
  trigger: React.ReactNode;
  items: MenuItemData[];
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
  popupClassName?: string;
  modal?: boolean;
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

    // Nếu mục có danh sách con: render Submenu ngang
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

    // Mục thường hoặc mục chọn checkbox
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
      </BaseMenu.Item>
    );
  });
}

/**
 * Menu thả xuống hỗ trợ menu con phân cấp ngang (Cascading Submenu / Sub dropdown ngang).
 * Dùng phím `→` để mở menu con, `←` để đóng và quay lại menu cha.
 */
export function CascadingMenu({
  trigger,
  items,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  popupClassName,
  modal = true,
}: CascadingMenuProps) {
  return (
    <BaseMenu.Root modal={modal}>
      <BaseMenu.Trigger
        render={React.isValidElement(trigger) ? trigger : <span>{trigger}</span>}
      />
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={12}
          className="z-50 outline-none"
        >
          <BaseMenu.Popup
            className={cn(
              "z-50 min-w-[12rem] origin-[var(--transform-origin)] rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-popover-foreground shadow-menu outline-none",
              "transition-opacity duration-100 ease-out motion-reduce:transition-none",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              popupClassName,
            )}
          >
            {renderMenuItems(items)}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
