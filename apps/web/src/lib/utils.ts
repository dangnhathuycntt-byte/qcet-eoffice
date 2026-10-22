import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Cỡ chữ tùy biến trong theme (`--text-compact`, `--text-micro`, `--text-hero`, `--text-docs*`): khai báo để tailwind-merge
// không coi `text-compact` là màu chữ rồi xóa mất khi gặp `text-foreground`. Tương tự `border-hairline` (độ dày viền,
// `@utility` ở globals.css) không được coi là màu viền rồi bị `border-border` xóa.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ["compact", "micro", "hero", "docs", "docs-title", "docs-display"] },
    classGroups: { "border-w": [{ border: ["hairline"] }] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { getInitials } from "./format-helpers";
