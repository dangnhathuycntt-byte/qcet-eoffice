import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Cỡ chữ tùy biến trong theme (`--text-compact`, `--text-hero`): khai báo để tailwind-merge
// không coi `text-compact` là màu chữ rồi xóa mất khi gặp `text-foreground`.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["compact", "hero"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { getInitials } from "./format-helpers";
