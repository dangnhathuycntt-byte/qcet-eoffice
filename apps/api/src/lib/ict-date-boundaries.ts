/**
 * Pure helper for normalizing date-only strings to ICT (UTC+7) boundaries.
 *
 * - Date-only `YYYY-MM-DD` → start-of-day or end-of-day in ICT
 * - Full ISO timestamps → preserved as-is
 *
 * Used by API routes that accept date range filters from query strings.
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalize a `from` date value to the start of day in ICT (UTC+7).
 *
 * - `"2026-01-15"` → `new Date("2026-01-15T00:00:00.000+07:00")`  (= 2026-01-14T17:00:00.000Z)
 * - `"2026-01-15T10:30:00Z"` → `"2026-01-15T10:30:00Z"` (unchanged)
 */
export function normalizeIctFrom(value: string): string | Date {
  if (DATE_ONLY_RE.test(value)) {
    return new Date(`${value}T00:00:00.000+07:00`);
  }
  return value;
}

/**
 * Normalize a `to` date value to the end of day in ICT (UTC+7).
 *
 * - `"2026-01-15"` → `new Date("2026-01-15T23:59:59.999+07:00")`  (= 2026-01-15T16:59:59.999Z)
 * - `"2026-01-15T23:59:59Z"` → `"2026-01-15T23:59:59Z"` (unchanged)
 */
export function normalizeIctTo(value: string): string | Date {
  if (DATE_ONLY_RE.test(value)) {
    return new Date(`${value}T23:59:59.999+07:00`);
  }
  return value;
}

/**
 * Check whether normalized `from` is after normalized `to`.
 * Returns `true` when the range is reversed (invalid).
 */
export function isReversedRange(from: string | Date, to: string | Date): boolean {
  const fromDate = from instanceof Date ? from : new Date(from);
  const toDate = to instanceof Date ? to : new Date(to);
  return fromDate > toDate;
}

/**
 * Normalize both bounds and validate ordering.
 * Returns `{ gte, lte }` for Prisma `where.createdAt`, or `{ error }` if reversed.
 */
export function normalizeIctDateRange(
  from?: string,
  to?: string,
): { gte?: string | Date; lte?: string | Date; error?: string } {
  const result: { gte?: string | Date; lte?: string | Date; error?: string } = {};

  if (from) {
    result.gte = normalizeIctFrom(from);
  }
  if (to) {
    result.lte = normalizeIctTo(to);
  }

  if (result.gte !== undefined && result.lte !== undefined) {
    if (isReversedRange(result.gte, result.lte)) {
      return { error: 'Ngày bắt đầu không được sau ngày kết thúc' };
    }
  }

  return result;
}
