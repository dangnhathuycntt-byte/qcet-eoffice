/**
 * Canonical relative-date labels (C19 — Content & Terminology Contract).
 *
 * Authority: docs/ux/QCET_UI_VOCABULARY.md §G.2 (FROZEN v1).
 *
 * Bounded rule: the near-term relative window is 0..3 days ahead; from 4 days out the
 * label renders the absolute `dd/MM/yyyy` date instead of a count. Past-due labels are
 * always counts. Reference dates are never hardcoded — the caller may pass an explicit
 * reference, otherwise the canonical system reference date is used.
 */

import { getSystemReferenceDate } from "@/lib/academic-calendar";
import { DATE_FALLBACK, formatDisplayDate, toIctDateTimeParts } from "./date";

/**
 * Highest diff (in days) still rendered as a relative count.
 * `diffDays >= RELATIVE_NEAR_TERM_MAX_DAYS + 1` renders an absolute date instead.
 */
export const RELATIVE_NEAR_TERM_MAX_DAYS = 3;

/**
 * Whole-day difference between `target` and `reference` in ICT calendar days.
 * Positive = target is in the future; negative = target is past due.
 * Returns `null` when either input is missing/unparsable.
 */
export function daysUntil(
  target: Date | string | number | null | undefined,
  reference: Date | string | number = getSystemReferenceDate()
): number | null {
  const t = toIctDateTimeParts(target);
  const r = toIctDateTimeParts(reference);
  if (!t || !r) return null;
  const targetDay = Date.UTC(t.year, t.month - 1, t.day);
  const referenceDay = Date.UTC(r.year, r.month - 1, r.day);
  return Math.round((targetDay - referenceDay) / 86_400_000);
}

/**
 * Canonical relative-date label (vocabulary §G.2):
 *
 * ```text
 * diffDays == 0    -> "Hôm nay"
 * diffDays == 1    -> "Ngày mai"
 * diffDays in 2..3 -> "Còn {diffDays} ngày"
 * diffDays >= 4    -> "dd/MM/yyyy"
 * diffDays == -1   -> "Quá hạn 1 ngày"
 * diffDays <= -2   -> "Quá hạn {abs(diffDays)} ngày"
 * ```
 *
 * These are temporal predicates, never lifecycle statuses.
 */
export function formatRelativeDate(
  target: Date | string | number | null | undefined,
  reference: Date | string | number = getSystemReferenceDate(),
  fallback: string = DATE_FALLBACK
): string {
  const diff = daysUntil(target, reference);
  if (diff === null) return fallback;

  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  if (diff >= 2 && diff <= RELATIVE_NEAR_TERM_MAX_DAYS) return `Còn ${diff} ngày`;
  if (diff > RELATIVE_NEAR_TERM_MAX_DAYS) return formatDisplayDate(target, fallback);
  if (diff === -1) return "Quá hạn 1 ngày";
  return `Quá hạn ${Math.abs(diff)} ngày`;
}
