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
