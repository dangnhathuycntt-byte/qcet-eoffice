/**
 * Platform helper for keyboard shortcuts (Plan v2 §8)
 * Maps modifier keys across macOS and Windows/Linux.
 */

export function isMac(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return /macintosh|mac os x/i.test(navigator.userAgent);
}

export function getPlatformModifierKey(): "⌘" | "Ctrl" {
  return isMac() ? "⌘" : "Ctrl";
}
