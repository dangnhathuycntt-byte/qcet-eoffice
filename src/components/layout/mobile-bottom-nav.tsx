"use client";

/**
 * Compatibility alias — the canonical mobile bottom navigation is owned by
 * `src/components/navigation/mobile-bottom-nav.tsx` (the component `AppShell`
 * actually mounts). This module intentionally holds no implementation of its
 * own; it re-exports the canonical component so any legacy import path
 * resolves to the single source of truth. Do not add logic here.
 */
export {
  MobileBottomNav,
  MobileBottomNav as MobileBottomBar,
  type MobileBottomNavProps,
} from "@/components/navigation/mobile-bottom-nav";
export { default } from "@/components/navigation/mobile-bottom-nav";
