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

export function formatShortcutLabel(keys: string[]): string {
  const isApple = isMac();
  return keys
    .map((k) => {
      const lower = k.toLowerCase();
      if (lower === "meta" || lower === "cmd" || lower === "command") {
        return isApple ? "⌘" : "Ctrl";
      }
      if (lower === "ctrl" || lower === "control") {
        return isApple ? "⌃" : "Ctrl";
      }
      if (lower === "alt" || lower === "option") {
        return isApple ? "⌥" : "Alt";
      }
      if (lower === "shift") {
        return isApple ? "⇧" : "Shift";
      }
      return k.toUpperCase();
    })
    .join(isApple ? "" : "+");
}
