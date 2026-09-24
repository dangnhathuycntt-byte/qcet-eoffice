"use client";

import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

// Namespace re-export
export const Menu = BaseMenu;

// Individual primitives re-export
export const MenuRoot = BaseMenu.Root;
export const MenuTrigger = BaseMenu.Trigger;
export const MenuPortal = BaseMenu.Portal;
export const MenuPositioner = BaseMenu.Positioner;
export const MenuPopup = BaseMenu.Popup;
export const MenuItem = BaseMenu.Item;
export const MenuSeparator = BaseMenu.Separator;
export const MenuGroup = BaseMenu.Group;
export const MenuGroupLabel = BaseMenu.GroupLabel;
export const MenuBackdrop = BaseMenu.Backdrop;
export const MenuArrow = BaseMenu.Arrow;
export const MenuCheckboxItem = BaseMenu.CheckboxItem;
export const MenuRadioGroup = BaseMenu.RadioGroup;
export const MenuRadioItem = BaseMenu.RadioItem;
export const MenuSubmenuRoot = BaseMenu.SubmenuRoot;
export const MenuSubmenuTrigger = BaseMenu.SubmenuTrigger;

export interface MenuContentProps
  extends React.ComponentPropsWithoutRef<typeof BaseMenu.Popup> {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
  showBackdrop?: boolean;
  backdropClassName?: string;
  positionerClassName?: string;
  arrow?: boolean;
}

/**
 * Standard MenuContent built over `@base-ui/react/menu`.
 * Features automatic Portal, Positioner with collision avoidance, optional backdrop blur,
 * and smooth scale/fade animations conforming to QCET UI polish tokens.
 */
export const MenuContent = React.forwardRef<HTMLDivElement, MenuContentProps>(
  (
    {
      className,
      align = "start",
      side = "bottom",
      sideOffset = 4,
      alignOffset = 0,
      collisionPadding = 12,
      showBackdrop = false,
      backdropClassName,
      positionerClassName,
      arrow = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <BaseMenu.Portal>
        {showBackdrop && (
          <BaseMenu.Backdrop
            className={cn(
              "fixed inset-0 z-40 bg-black/15 backdrop-blur-xs transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
              backdropClassName
            )}
          />
        )}
        <BaseMenu.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          collisionPadding={collisionPadding}
          className={cn("z-50 outline-none", positionerClassName)}
        >
          <BaseMenu.Popup
            ref={ref}
            className={cn(
              "z-50 min-w-[12rem] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              "origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 ease-out",
              "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
              "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95",
              className
            )}
            {...props}
          >
            {children}
            {arrow && (
              <BaseMenu.Arrow className="fill-popover stroke-border stroke-1" />
            )}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    );
  }
);

MenuContent.displayName = "MenuContent";

export interface StandardMenuItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separator?: boolean;
}

export interface StandardMenuProps {
  trigger: React.ReactNode;
  items: StandardMenuItem[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
  showBackdrop?: boolean;
  backdropClassName?: string;
  positionerClassName?: string;
  popupClassName?: string;
  className?: string;
  arrow?: boolean;
  modal?: boolean;
}

/**
 * StandardMenu convenient component built over `@base-ui/react/menu`.
 * Provides accessible menu trigger, floating positioning, collision avoidance,
 * keyboard navigation, WAI-ARIA Menu role, and rich item rendering.
 */
export function StandardMenu({
  trigger,
  items,
  open,
  defaultOpen,
  onOpenChange,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  alignOffset = 0,
  collisionPadding = 12,
  showBackdrop = false,
  backdropClassName,
  positionerClassName,
  popupClassName,
  className,
  arrow = false,
  modal = true,
}: StandardMenuProps) {
  return (
    <BaseMenu.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      modal={modal}
    >
      <BaseMenu.Trigger
        render={React.isValidElement(trigger) ? trigger : <span>{trigger}</span>}
      />
      <BaseMenu.Portal>
        {showBackdrop && (
          <BaseMenu.Backdrop
            className={cn(
              "fixed inset-0 z-40 bg-black/15 backdrop-blur-xs transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
              backdropClassName
            )}
          />
        )}
        <BaseMenu.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          collisionPadding={collisionPadding}
          className={cn("z-50 outline-none", positionerClassName)}
        >
          <BaseMenu.Popup
            className={cn(
              "z-50 min-w-[12rem] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              "origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 ease-out",
              "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
              "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95",
              popupClassName,
              className
            )}
          >
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <React.Fragment key={item.id || index}>
                  {item.separator && index > 0 && (
                    <BaseMenu.Separator className="-mx-1 my-1 h-px bg-border" />
                  )}
                  <BaseMenu.Item
                    disabled={item.disabled}
                    onClick={item.onClick}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none transition-colors",
                      "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      "focus-visible:bg-accent focus-visible:text-accent-foreground",
                      item.destructive &&
                        "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive"
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="flex-1 truncate">{item.label}</span>
                  </BaseMenu.Item>
                </React.Fragment>
              );
            })}
            {arrow && (
              <BaseMenu.Arrow className="fill-popover stroke-border stroke-1" />
            )}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
