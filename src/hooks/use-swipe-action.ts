import * as React from "react";

export interface UseSwipeActionOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  threshold?: number;
  slop?: number;
  enableHaptic?: boolean;
}

export interface UseSwipeActionResult {
  offset: number;
  isSwiping: boolean;
  direction: "left" | "right" | null;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  reset: () => void;
}

/**
 * useSwipeAction hook with 8px axis-locking slop & Haptic trigger
 * Typically used for mobile card quick-actions (e.g. swipe right to approve).
 */
export function useSwipeAction({
  onSwipeRight,
  onSwipeLeft,
  threshold = 72,
  slop = 8,
  enableHaptic = true,
}: UseSwipeActionOptions = {}): UseSwipeActionResult {
  const [offset, setOffset] = React.useState<number>(0);
  const [isSwiping, setIsSwiping] = React.useState<boolean>(false);
  const [direction, setDirection] = React.useState<"left" | "right" | null>(null);

  const startCoords = React.useRef<{ x: number; y: number } | null>(null);
  const axisLocked = React.useRef<"horizontal" | "vertical" | null>(null);
  const hapticTriggered = React.useRef<boolean>(false);

  const triggerHaptic = React.useCallback(() => {
    if (enableHaptic && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        // Ignore haptic errors if not supported or permitted
      }
    }
  }, [enableHaptic]);

  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    startCoords.current = { x: touch.clientX, y: touch.clientY };
    axisLocked.current = null;
    hapticTriggered.current = false;
    setIsSwiping(true);
  }, []);

  const onTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (!startCoords.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startCoords.current.x;
      const deltaY = touch.clientY - startCoords.current.y;

      // Axis locking with 8px slop
      if (axisLocked.current === null) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (absX >= slop || absY >= slop) {
          if (absX >= absY) {
            axisLocked.current = "horizontal";
          } else {
            axisLocked.current = "vertical";
          }
        }
      }

      if (axisLocked.current === "vertical") {
        return;
      }

      if (axisLocked.current === "horizontal") {
        setOffset(deltaX);
        const currentDir = deltaX > 0 ? "right" : deltaX < 0 ? "left" : null;
        setDirection(currentDir);

        if (Math.abs(deltaX) >= threshold && !hapticTriggered.current) {
          triggerHaptic();
          hapticTriggered.current = true;
        } else if (Math.abs(deltaX) < threshold) {
          hapticTriggered.current = false;
        }
      }
    },
    [slop, threshold, triggerHaptic]
  );

  const reset = React.useCallback(() => {
    setOffset(0);
    setIsSwiping(false);
    setDirection(null);
    startCoords.current = null;
    axisLocked.current = null;
    hapticTriggered.current = false;
  }, []);

  const onTouchEnd = React.useCallback(() => {
    if (axisLocked.current === "horizontal") {
      if (offset >= threshold && onSwipeRight) {
        onSwipeRight();
      } else if (offset <= -threshold && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    reset();
  }, [offset, threshold, onSwipeRight, onSwipeLeft, reset]);

  return {
    offset,
    isSwiping,
    direction,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    reset,
  };
}
