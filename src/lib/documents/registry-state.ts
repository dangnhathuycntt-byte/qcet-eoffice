/**
 * Registry view state discrimination logic.
 *
 * Invariant: A failed fetch must never render as "no documents" (empty state).
 */

export type RegistryStateKind = "loading" | "error" | "empty" | "data";

export interface RegistryStateInput {
  isLoading: boolean;
  hasError: boolean;
  itemCount: number;
}

export function getRegistryStateKind(input: RegistryStateInput): RegistryStateKind {
  if (input.isLoading) return "loading";
  if (input.hasError) return "error";
  if (input.itemCount === 0) return "empty";
  return "data";
}
