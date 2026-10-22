"use client";

import React, { useEffect, useMemo, useSyncExternalStore } from "react";

export type DisplayDensity = "comfortable" | "compact";

export interface DisplayDensityContextValue {
  density: DisplayDensity;
  setDensity: (density: DisplayDensity) => void;
  toggleDensity: () => void;
}

const STORAGE_KEY = "qcet-display-density";

// Mật độ nằm ở `data-density` của <html> (script chống FOUC trong layout đặt từ localStorage trước khi vẽ). Đọc qua
// useSyncExternalStore thay cho state của provider: lần hydrate dùng giá trị server, chỉ component đọc mật độ vẽ lại.
// State/context đổi ở provider ngay lúc mount làm khung trang đang stream bị bỏ HTML server và vẽ lại cả trang.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readDensity(): DisplayDensity {
  return document.documentElement.getAttribute("data-density") === "compact" ? "compact" : "comfortable";
}

function serverDensity(): DisplayDensity {
  return "comfortable";
}

function applyDensity(next: DisplayDensity, persist: boolean) {
  document.documentElement.setAttribute("data-density", next);
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent("qcet:density-change", { detail: { density: next } }));
    } catch {
      // Ignore private browsing storage errors
    }
  }
  listeners.forEach((listener) => listener());
}

function setDensity(density: DisplayDensity) {
  applyDensity(density, true);
}

function toggleDensity() {
  applyDensity(readDensity() === "comfortable" ? "compact" : "comfortable", true);
}

export function useDisplayDensity(): DisplayDensityContextValue {
  const density = useSyncExternalStore(subscribe, readDensity, serverDensity);
  return useMemo(() => ({ density, setDensity, toggleDensity }), [density]);
}

export function DisplayDensityProvider({ children }: { children: React.ReactNode }) {
  // Listen to cross-tab storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        applyDensity(e.newValue === "compact" ? "compact" : "comfortable", false);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Global keyboard shortcut: Shift + D to toggle density
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.shiftKey && (e.key === "D" || e.key === "d") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleDensity();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return <>{children}</>;
}
