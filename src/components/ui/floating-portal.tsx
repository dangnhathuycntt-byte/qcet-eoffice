"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface FloatingPortalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "auto";
  offset?: number;
  collisionPadding?: number;
  minWidth?: number | string;
  maxWidth?: number | string;
  role?: string;
  ariaLabel?: string;
}

export function FloatingPortal({
  isOpen,
  onClose,
  triggerRef,
  children,
  className,
  align = "auto",
  offset = 4,
  collisionPadding = 12,
  minWidth,
  maxWidth,
  role = "dialog",
  ariaLabel,
}: FloatingPortalProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{
    top: number;
    left: number;
    maxHeight: number;
    placement: "top" | "bottom";
  } | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current || !isOpen) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const popoverEl = popoverRef.current;
    const popoverWidth = popoverEl ? popoverEl.offsetWidth : 240;
    const popoverHeight = popoverEl ? popoverEl.offsetHeight : 280;

    // Trục Y: Flip detection
    const spaceBelow = viewportHeight - triggerRect.bottom - offset - collisionPadding;
    const spaceAbove = triggerRect.top - offset - collisionPadding;

    let placement: "top" | "bottom" = "bottom";
    let top = triggerRect.bottom + offset;
    let maxHeight = Math.max(120, spaceBelow);

    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      placement = "top";
      top = Math.max(collisionPadding, triggerRect.top - popoverHeight - offset);
      maxHeight = Math.max(120, spaceAbove);
    }

    // Trục X: Shift detection
    let left = triggerRect.left;
    if (align === "right") {
      left = triggerRect.right - popoverWidth;
    } else if (align === "auto") {
      if (triggerRect.left + popoverWidth > viewportWidth - collisionPadding) {
        left = triggerRect.right - popoverWidth;
      }
    }

    // Clamp inside viewport
    if (left + popoverWidth > viewportWidth - collisionPadding) {
      left = viewportWidth - collisionPadding - popoverWidth;
    }
    if (left < collisionPadding) {
      left = collisionPadding;
    }

    setCoords({
      top,
      left,
      maxHeight: Math.min(maxHeight, viewportHeight - collisionPadding * 2),
      placement,
    });
  }, [triggerRef, isOpen, align, offset, collisionPadding]);

  // Cập nhật vị trí khi mở & khi resize/scroll
  React.useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Click outside & Escape handling
  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, triggerRef, onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={popoverRef}
      role={role}
      aria-label={ariaLabel}
      data-floating-portal="true"
      style={{
        position: "fixed",
        top: coords ? `${coords.top}px` : "-9999px",
        left: coords ? `${coords.left}px` : "-9999px",
        maxHeight: coords ? `${coords.maxHeight}px` : undefined,
        zIndex: 9999,
        minWidth: minWidth ?? undefined,
        maxWidth: maxWidth ?? undefined,
      }}
      className={cn(
        "rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-y-auto",
        coords?.placement === "top"
          ? "animate-in fade-in-0 slide-in-from-bottom-1 duration-100"
          : "animate-in fade-in-0 slide-in-from-top-1 duration-100",
        className
      )}
    >
      {children}
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
}

export default FloatingPortal;
