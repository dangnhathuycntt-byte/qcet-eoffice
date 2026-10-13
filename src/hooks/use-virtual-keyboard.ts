"use client";

import * as React from "react";

export interface VirtualKeyboardState {
  isKeyboardOpen: boolean;
  keyboardHeight: number;
}

/**
 * Hook to track mobile virtual keyboard presence and height via Visual Viewport API.
 * Sets `--keyboard-height` CSS variable and provides focus scroll ergonomics.
 */
export function useVirtualKeyboard(): VirtualKeyboardState {
  const [state, setState] = React.useState<VirtualKeyboardState>({
    isKeyboardOpen: false,
    keyboardHeight: 0,
  });

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;

    const handleResize = () => {
      const windowHeight = window.innerHeight;
      const viewportHeight = viewport.height;
      const heightDiff = windowHeight - viewportHeight;

      // Most virtual keyboards are at least 150px in height
      const isOpen = heightDiff > 150;
      const kbHeight = isOpen ? heightDiff : 0;

      setState({
        isKeyboardOpen: isOpen,
        keyboardHeight: kbHeight,
      });

      if (isOpen) {
        document.documentElement.style.setProperty(
          "--keyboard-height",
          `${kbHeight}px`
        );
      } else {
        document.documentElement.style.removeProperty("--keyboard-height");
      }
    };

    viewport.addEventListener("resize", handleResize);
    viewport.addEventListener("scroll", handleResize);

    return () => {
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", handleResize);
      document.documentElement.style.removeProperty("--keyboard-height");
    };
  }, []);

  return state;
}

/**
 * Scroll helper to center an active form element when virtual keyboard opens
 */
export function scrollActiveInputIntoView(element?: HTMLElement | null) {
  const target = element || (document.activeElement as HTMLElement | null);
  if (!target || typeof target.scrollIntoView !== "function") return;

  setTimeout(() => {
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, 100);
}

function scrollParent(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/**
 * Ô nhập nằm trong vùng cuộn của khung cao cố định (100dvh): iOS mở bàn phím không tự cuộn vùng đó,
 * nên ô bị che. Chờ bàn phím mở xong (visualViewport hết đổi cỡ) rồi cuộn vùng chứa vừa đủ để ô nằm trên bàn phím.
 */
export function revealAboveKeyboard(element: HTMLElement | null, margin = 16) {
  const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
  if (!element || !viewport) return;

  let settle: ReturnType<typeof setTimeout>;
  const reveal = () => {
    viewport.removeEventListener("resize", onResize);
    const visibleBottom = viewport.offsetTop + viewport.height;
    const overflow = element.getBoundingClientRect().bottom + margin - visibleBottom;
    if (overflow <= 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollParent(element).scrollBy({ top: overflow, behavior: reduce ? "auto" : "smooth" });
  };
  const onResize = () => {
    clearTimeout(settle);
    settle = setTimeout(reveal, 120);
  };
  viewport.addEventListener("resize", onResize);
  // Bàn phím đã mở sẵn (chuyển từ ô khác) thì không có resize: vẫn kiểm sau một nhịp
  settle = setTimeout(reveal, 400);
}
