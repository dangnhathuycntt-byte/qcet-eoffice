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

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

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

  // Smooth mount/unmount state for fluid enter & exit animations
  const [isMounted, setIsMounted] = React.useState(isOpen);
  const [isAnimating, setIsAnimating] = React.useState(false);

  // Position calculator with viewport clamping and flip detection
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;

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

    // Clamp inside viewport horizontally
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
  }, [triggerRef, align, offset, collisionPadding]);

  // Handle open/close with graceful enter & exit transitions
  React.useEffect(() => {
    let animTimer: ReturnType<typeof setTimeout> | undefined;
    let frameId: number | undefined;

    if (isOpen) {
      setIsMounted(true);
      // Double rAF ensures the layout is painted and coordinates applied before triggering transition
      frameId = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      animTimer = setTimeout(() => {
        setIsMounted(false);
        setCoords(null);
      }, 140); // Matches exit duration
    }

    return () => {
      if (animTimer) clearTimeout(animTimer);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isOpen]);

  // Measure and position synchronously before paint
  useIsomorphicLayoutEffect(() => {
    if (isMounted) {
      updatePosition();
    }
  }, [isMounted, updatePosition]);

  // Keep position updated on scroll and resize
  React.useEffect(() => {
    if (!isMounted) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isMounted, updatePosition]);

  // Click outside & Escape handling
  React.useEffect(() => {
    if (!isMounted) return;

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
  }, [isMounted, triggerRef, onClose]);

  if (!isMounted && !isOpen) return null;

  const placement = coords?.placement ?? "bottom";
  const isReady = coords !== null;

  const content = (
    <div
      ref={popoverRef}
      role={role}
      aria-label={ariaLabel}
      data-floating-portal="true"
      style={{
        position: "fixed",
        top: coords ? `${coords.top}px` : "0px",
        left: coords ? `${coords.left}px` : "0px",
        maxHeight: coords ? `${coords.maxHeight}px` : undefined,
        zIndex: 9999,
        minWidth: minWidth ?? undefined,
        maxWidth: maxWidth ?? undefined,
        transformOrigin: placement === "top" ? "bottom center" : "top center",
        visibility: isReady || typeof document === "undefined" ? "visible" : "hidden",
        opacity: isAnimating ? 1 : 0,
        transform: isAnimating
          ? "scale(1) translateY(0)"
          : placement === "top"
          ? "scale(0.96) translateY(4px)"
          : "scale(0.96) translateY(-4px)",
        transition:
          "opacity 140ms cubic-bezier(0.16, 1, 0.3, 1), transform 140ms cubic-bezier(0.16, 1, 0.3, 1)",
        willChange: "transform, opacity",
      }}
      className={cn(
        "rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-2xl overflow-y-auto",
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
