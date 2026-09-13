/**
 * Canonical academic-period labels (C19 — Content & Terminology Contract).
 *
 * Authority: docs/ux/QCET_UI_VOCABULARY.md §G.3 (FROZEN v1).
 *
 * This module is a thin presentation layer over the single canonical academic-period
 * engine in `src/lib/academic-calendar.ts` (QCET rule 40-data-integrity #4 / 22-calendar
 * #1). Period math is never duplicated here — only its labels are emitted, so there is
 * exactly one implementation of the operational-month cycle.
 */

import {
  getAcademicMonthInfo,
  getAcademicMonthPeriod,
  getAcademicYear,
  getCurrentAcademicPeriod,
  type AcademicMonthPeriod,
} from "@/lib/academic-calendar";
import { DATE_FALLBACK, toIctDateTimeParts } from "./date";

type DateLike = string | Date | number;
type DateInput = string | Date;

/** True for the operational month numbers the canonical engine resolves (1..12). */
function isValidOperationalMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

/**
 * Resolves a date input to the value the canonical engine accepts, or `null` when it is
 * missing, malformed, or out-of-range. Validation is delegated to the canonical ICT
 * parser (one input-validation implementation), so an unparsable or calendar-impossible
 * value never reaches the engine's hardcoded default period. Epoch-number inputs are
 * normalized to a `Date` so the engine — which reads numbers as month numbers — resolves
 * the calendar day instead.
 */
function resolveDateInput(input: DateLike): Date | string | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return toIctDateTimeParts(input) ? input : null;
}

/**
 * Resolves the operational-month period for a month number (validated 1..12) or a
 * calendar date via the canonical engine. Returns `null` when the input cannot be
 * resolved, so callers emit the family fallback instead of a fabricated period.
 *
 * An explicit `academicYear` is authoritative over the year derived from the date.
 */
function resolveMonthPeriod(
  input: DateInput | number,
  academicYear?: string
): AcademicMonthPeriod | null {
  if (typeof input === "number") {
    return isValidOperationalMonth(input)
      ? getAcademicMonthPeriod(input, academicYear)
      : null;
  }
  const resolved = resolveDateInput(input);
  if (resolved === null) return null;
  const info = getAcademicMonthInfo(resolved);
  return academicYear === undefined
    ? info
    : getAcademicMonthPeriod(info.monthNumber, academicYear);
}

function normalizeAcademicYearSpacing(academicYear: string): string {
  const trimmed = academicYear.trim();
  return trimmed.includes(" - ") ? trimmed : trimmed.replace(/-+/g, " - ");
}

function semesterRoman(semester: 1 | 2): string {
  return semester === 1 ? "I" : "II";
}

/** Operational month label — `Tháng {N}` (vocabulary §G.3), `—` for unresolved input. */
export function formatAcademicMonthLabel(input: number | DateLike): string {
  const period = resolveMonthPeriod(input);
  return period ? period.label : DATE_FALLBACK;
}

/**
 * Full operational-month label — `Tháng {N} / {YYYY} ({span})` (vocabulary §G.3),
 * e.g. `Tháng 9 / 2026 (25/08 - 24/09)`. `—` for unresolved input.
 *
 * When `academicYear` is supplied it is authoritative for both month-number and date
 * inputs; otherwise the year is derived from the input.
 */
export function formatAcademicMonthFullLabel(
  input: number | DateLike,
  academicYear?: string
): string {
  const period = resolveMonthPeriod(input, academicYear);
  return period ? period.fullLabel : DATE_FALLBACK;
}

/**
 * Operational-month date span — `dd/MM - dd/MM` (vocabulary §G.3),
 * e.g. `25/08 - 24/09`. `—` for unresolved input.
 *
 * When `academicYear` is supplied it is authoritative for both month-number and date
 * inputs; otherwise the year is derived from the input.
 */
export function formatAcademicMonthSpan(
  input: number | DateLike,
  academicYear?: string
): string {
  const period = resolveMonthPeriod(input, academicYear);
  return period ? period.shortDateSpan : DATE_FALLBACK;
}

/** Semester label — `Học kỳ I` / `Học kỳ II` (vocabulary §G.3). */
export function formatSemesterLabel(semester: 1 | 2): string {
  return `Học kỳ ${semesterRoman(semester)}`;
}

/**
 * Full semester label — `Học kỳ {I|II} ({YYYY} - {YYYY})` (vocabulary §G.3),
 * e.g. `Học kỳ I (2026 - 2027)`.
 */
export function formatSemesterFullLabel(semester: 1 | 2, academicYear: string): string {
  return `Học kỳ ${semesterRoman(semester)} (${normalizeAcademicYearSpacing(academicYear)})`;
}

/**
 * Academic year label — `YYYY-YYYY` (vocabulary §G.3), e.g. `2026-2027`.
 * `—` for unresolved input.
 */
export function formatAcademicYear(input: DateLike): string {
  const resolved = resolveDateInput(input);
  return resolved === null ? DATE_FALLBACK : getAcademicYear(resolved);
}

/**
 * Current academic-period label from the canonical engine —
 * `Học kỳ {I|II} ({YYYY} - {YYYY})`. Defaults to the system reference date; resolves to
 * `—` when an explicit reference date cannot be resolved.
 */
export function formatAcademicPeriodLabel(referenceDate?: DateLike): string {
  if (referenceDate === undefined) {
    return getCurrentAcademicPeriod().label;
  }
  const resolved = resolveDateInput(referenceDate);
  return resolved === null
    ? DATE_FALLBACK
    : getCurrentAcademicPeriod(resolved).label;
}
