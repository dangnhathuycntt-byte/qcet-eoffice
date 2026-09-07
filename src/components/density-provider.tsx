"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type DisplayDensity = "comfortable" | "compact";

export interface DisplayDensityContextValue {
  density: DisplayDensity;
  setDensity: (density: DisplayDensity) => void;
  toggleDensity: () => void;
}

const STORAGE_KEY = "qcet-display-density";

const DisplayDensityContext = createContext<DisplayDensityContextValue>({
  density: "comfortable",
  setDensity: () => {},
  toggleDensity: () => {},
});

export function useDisplayDensity() {
  return useContext(DisplayDensityContext);
}

export function DisplayDensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<DisplayDensity>("comfortable");

  // Sync state on mount from DOM attribute (set by anti-FOUC head script) or localStorage
  useEffect(() => {
    const fromAttr = document.documentElement.getAttribute("data-density") as DisplayDensity | null;
    const fromStorage = localStorage.getItem(STORAGE_KEY) as DisplayDensity | null;
    const initial: DisplayDensity = fromAttr === "compact" || fromStorage === "compact" ? "compact" : "comfortable";

    setDensityState(initial);
    document.documentElement.setAttribute("data-density", initial);
  }, []);

  // Listen to cross-tab storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const nextDensity: DisplayDensity = e.newValue === "compact" ? "compact" : "comfortable";
        setDensityState(nextDensity);
        document.documentElement.setAttribute("data-density", nextDensity);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setDensity = useCallback((newDensity: DisplayDensity) => {
    setDensityState(newDensity);
    try {
      localStorage.setItem(STORAGE_KEY, newDensity);
      document.documentElement.setAttribute("data-density", newDensity);
      window.dispatchEvent(new CustomEvent("qcet:density-change", { detail: { density: newDensity } }));
    } catch {
      // Ignore private browsing storage errors
    }
  }, []);

  const toggleDensity = useCallback(() => {
    setDensityState((prev) => {
      const next: DisplayDensity = prev === "comfortable" ? "compact" : "comfortable";
      try {
        localStorage.setItem(STORAGE_KEY, next);
        document.documentElement.setAttribute("data-density", next);
        window.dispatchEvent(new CustomEvent("qcet:density-change", { detail: { density: next } }));
      } catch {
        // Ignore private browsing storage errors
      }
      return next;
    });
  }, []);

  return (
    <DisplayDensityContext.Provider value={{ density, setDensity, toggleDensity }}>
      {children}
    </DisplayDensityContext.Provider>
  );
}
