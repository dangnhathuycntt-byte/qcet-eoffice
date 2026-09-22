/**
 * Shared priority configuration for task creation forms.
 * Source of truth: extracted from create-task-modal.tsx (PRIORITY_CONFIG)
 * and create-task-modal.tsx (PRIORITY_OPTIONS).
 */

export const PRIORITY_OPTIONS = [
  { value: "URGENT", label: "Khẩn cấp", color: "text-rose-600" },
  { value: "HIGH",   label: "Cao",       color: "text-amber-600" },
  { value: "MEDIUM", label: "Bình thường", color: "text-muted-foreground" },
  { value: "LOW",    label: "Thấp",      color: "text-muted-foreground" },
] as const;

export type PriorityValue = (typeof PRIORITY_OPTIONS)[number]["value"];
