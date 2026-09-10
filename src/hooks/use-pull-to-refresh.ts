import * as React from "react";

export interface UsePullToRefreshOptions {
  onRefresh?: () => Promise<void> | void;
  threshold?: number;
  dampingFactor?: number;
  disabled?: boolean;
}

export interface UsePullToRefreshResult {
  isRefreshing: boolean;
  pullDistance: number;
  progress: number;
  containerProps: {
    style: React.CSSProperties;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  reset: () => void;
}

/**
 * usePullToRefresh hook with `overscroll-behavior-y: contain` & rubber-band damping.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 64,
  dampingFactor = 0.45,
  disabled = false,
}: UsePullToRefreshOptions = {}): UsePullToRefreshResult {
  const [pullDistance, setPullDistance] = React.useState<number>(0);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  const startY = React.useRef<number | null>(null);
  const isAtTop = React.useRef<boolean>(false);

  const onTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing || e.touches.length !== 1) return;
      const target = e.currentTarget;
      // Only engage if container or window is scrolled to top
      const scrollTop = target.scrollTop ?? window.scrollY;
      if (scrollTop <= 0) {
        isAtTop.current = true;
        startY.current = e.touches[0].clientY;
      } else {
        isAtTop.current = false;
        startY.current = null;
      }
    },
    [disabled, isRefreshing]
  );

  const onTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (!isAtTop.current || startY.current === null || e.touches.length !== 1) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY.current;

      if (deltaY > 0) {
        // Rubber-band damping formula
        const damped = Math.min(threshold * 1.5, deltaY * dampingFactor);
        setPullDistance(damped);
      } else {
        setPullDistance(0);
      }
    },
    [dampingFactor, threshold]
  );

  const reset = React.useCallback(() => {
    setPullDistance(0);
    setIsRefreshing(false);
    startY.current = null;
    isAtTop.current = false;
  }, []);

  const onTouchEnd = React.useCallback(async () => {
    if (pullDistance >= threshold && onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await Promise.resolve(onRefresh());
      } finally {
        reset();
      }
    } else {
      reset();
    }
  }, [pullDistance, threshold, onRefresh, isRefreshing, reset]);

  const progress = Math.min(1, pullDistance / threshold);

  return {
    isRefreshing,
    pullDistance,
    progress,
    containerProps: {
      style: {
        overscrollBehaviorY: "contain",
      },
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    reset,
  };
}
