export type HapticType =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  selection: 8,
  light: 12,
  medium: 22,
  heavy: 45,
  success: [15, 45, 30],
  warning: [25, 50, 25],
  error: [40, 50, 40, 50, 60],
};

const HAPTIC_STORAGE_KEY = "qcet_haptics_enabled";

export function isHapticSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "vibrate" in navigator &&
    typeof navigator.vibrate === "function"
  );
}

export function isHapticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    const stored = localStorage.getItem(HAPTIC_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HAPTIC_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage failures
  }
}

export function triggerHaptic(type: HapticType = "light"): boolean {
  if (!isHapticSupported() || !isHapticsEnabled()) {
    return false;
  }
  try {
    const pattern = HAPTIC_PATTERNS[type];
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
