/**
 * Canonical date/time formatting utilities (C19 — Content & Terminology Contract).
 *
 * Authority: docs/ux/QCET_UI_VOCABULARY.md §G (FROZEN v1).
 * This module is pure presentation. It carries no authorization, lifecycle, or
 * dataset-filter semantics — it only emits the date/time strings the vocabulary
 * freezes.
 *
 * Timezone: Indochina Time (`Asia/Ho_Chi_Minh`, UTC+7) is the sole timezone for all
 * outputs. Calendar parts derived from a `Date` are always resolved through
 * `Intl.DateTimeFormat` in ICT — a UTC ISO string is never sliced to derive an ICT day
 * (QCET rule 22-calendar #3).
 */

import { parseDateParts } from "@/lib/academic-calendar";

/** Sole timezone for QCET date/time rendering (UTC+7). */
export const ICT_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Fallback emitted for missing/invalid input. */
export const DATE_FALLBACK = "—";

export interface IctDateTimeParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  /**
   * True only when the input carried an explicit time-of-day (a `Date`, an epoch number,
   * or a datetime string). Date-only inputs resolve their calendar parts with a nominal
   * midnight (`hour`/`minute` = 0) but set `hasTime` false, so time-only renderers can
   * fall back instead of emitting a misleading `00:00`.
   */
  hasTime: boolean;
}

const ICT_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: ICT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NAIVE_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const OFFSET_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

function partsFromDate(date: Date): IctDateTimeParts | null {
  if (isNaN(date.getTime())) return null;
  const parts = ICT_PARTS_FORMATTER.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
    parts.find((p) => p.type === type)?.value;
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  if (!year || !month || !day) return null;
  const hour = pick("hour");
  const minute = pick("minute");
  return {
    year: parseInt(year, 10),
    month: parseInt(month, 10),
    day: parseInt(day, 10),
    hour: hour ? parseInt(hour, 10) : 0,
    minute: minute ? parseInt(minute, 10) : 0,
    hasTime: true,
  };
}

/**
 * Reject the out-of-range components the shape-only regexes above can accept.
 *
 * `DATE_ONLY_RE` / `NAIVE_DATETIME_RE` only assert digit width, so `2026-13-40`,
 * `2026-09-00`, or `2026-02-30` would otherwise render a plausible-looking but invalid
 * date (or time). Beyond plain numeric bounds, a UTC round-trip rejects
 * calendar-impossible day/month combinations (e.g. day 31 in a 30-day month, day 30 in
 * February) so callers emit the fallback instead of a fabricated date.
 */
function isRealDateTimeParts(p: IctDateTimeParts): boolean {
  if (p.month < 1 || p.month > 12) return false;
  if (p.day < 1 || p.day > 31) return false;
  if (p.hour < 0 || p.hour > 23) return false;
  if (p.minute < 0 || p.minute > 59) return false;
  const normalized = new Date(
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  );
  return (
    normalized.getUTCFullYear() === p.year &&
    normalized.getUTCMonth() === p.month - 1 &&
    normalized.getUTCDate() === p.day &&
    normalized.getUTCHours() === p.hour &&
    normalized.getUTCMinutes() === p.minute
  );
}

/**
 * Resolve any accepted date input to ICT calendar parts.
 *
 * - `Date` / epoch number -> converted to ICT via `Intl`.
 * - Offset/UTC ISO string (`...Z`, `...+07:00`) -> parsed, then converted to ICT.
 * - Naive datetime (`YYYY-MM-DDTHH:mm`) -> treated as ICT wall time (no shifting).
 * - Date-only (`YYYY-MM-DD`) -> treated as ICT midnight (`hasTime` = false).
 *
 * Returns `null` for missing, malformed, or out-of-range input.
 */
export function toIctDateTimeParts(
  input: Date | string | number | null | undefined
): IctDateTimeParts | null {
  if (input === null || input === undefined || input === "") return null;
  if (input instanceof Date) return partsFromDate(input);
  if (typeof input === "number") {
    return Number.isFinite(input) ? partsFromDate(new Date(input)) : null;
  }

  const str = input.trim();
  if (!str) return null;

  const naive = str.match(NAIVE_DATETIME_RE);
  if (naive) {
    const parts: IctDateTimeParts = {
      year: parseInt(naive[1], 10),
      month: parseInt(naive[2], 10),
      day: parseInt(naive[3], 10),
      hour: parseInt(naive[4], 10),
      minute: parseInt(naive[5], 10),
      hasTime: true,
    };
    return isRealDateTimeParts(parts) ? parts : null;
  }

  const dateOnly = str.match(DATE_ONLY_RE);
  if (dateOnly) {
    const parts: IctDateTimeParts = {
      year: parseInt(dateOnly[1], 10),
      month: parseInt(dateOnly[2], 10),
      day: parseInt(dateOnly[3], 10),
      hour: 0,
      minute: 0,
      hasTime: false,
    };
    return isRealDateTimeParts(parts) ? parts : null;
  }

  if (OFFSET_DATETIME_RE.test(str)) {
    return partsFromDate(new Date(str));
  }

  // Fall back to the canonical parser for any other ISO-ish string. Its unanchored
  // prefix match can yield out-of-range components (e.g. `2026-13-40Z`), so the result
  // must clear the same range guard as the anchored branches above.
  const fromCanonical = parseDateParts(str);
  if (fromCanonical) {
    const parts: IctDateTimeParts = {
      ...fromCanonical,
      hour: 0,
      minute: 0,
      hasTime: false,
    };
    return isRealDateTimeParts(parts) ? parts : null;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  const parts = partsFromDate(parsed);
  if (!parts) return null;
  // A string reaching this branch may or may not carry a time; keep the flag honest.
  return { ...parts, hasTime: /\d{1,2}:\d{2}/.test(str) };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Machine/transport/URL date — ISO `YYYY-MM-DD` (vocabulary §G.1). */
export function formatIsoDate(
  input: Date | string | number | null | undefined,
  fallback: string = DATE_FALLBACK
): string {
  const p = toIctDateTimeParts(input);
  if (!p) return fallback;
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Display full date — `dd/MM/yyyy` (vocabulary §G.1). */
export function formatDisplayDate(
  input: Date | string | number | null | undefined,
  fallback: string = DATE_FALLBACK
): string {
  const p = toIctDateTimeParts(input);
  if (!p) return fallback;
  return `${pad2(p.day)}/${pad2(p.month)}/${p.year}`;
}

/**
 * Display compact date — `dd/MM` (vocabulary §G.1).
 * Use only inside a labeled period span whose label already carries the year;
 * a standalone date must use `formatDisplayDate`.
 */
export function formatCompactDate(
  input: Date | string | number | null | undefined,
  fallback: string = DATE_FALLBACK
): string {
  const p = toIctDateTimeParts(input);
  if (!p) return fallback;
  return `${pad2(p.day)}/${pad2(p.month)}`;
}

/** Display date span — `dd/MM - dd/MM` (vocabulary §G.1 / §G.3). */
export function formatDateSpan(
  start: Date | string | number | null | undefined,
  end: Date | string | number | null | undefined,
  fallback: string = DATE_FALLBACK
): string {
  const s = toIctDateTimeParts(start);
  const e = toIctDateTimeParts(end);
  if (!s || !e) return fallback;
  return `${pad2(s.day)}/${pad2(s.month)} - ${pad2(e.day)}/${pad2(e.month)}`;
}

/**
 * Display time — 24-hour `HH:mm` (vocabulary §G.1).
 * Requires a time-bearing input; a date-only value yields the fallback rather than a
 * misleading midnight `00:00`.
 */
export function formatTime(
  input: Date | string | number | null | undefined,
  fallback: string = DATE_FALLBACK
): string {
  const p = toIctDateTimeParts(input);
  if (!p || !p.hasTime) return fallback;
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Display date + time — `dd/MM/yyyy HH:mm` (vocabulary §G.1).
 * Requires a time-bearing input; a date-only value yields the fallback rather than a
 * misleading midnight `00:00`.
 */
export function formatDateTime(
  input: Date | string | number | null | undefined,
  fallback: string = DATE_FALLBACK
): string {
  const p = toIctDateTimeParts(input);
  if (!p || !p.hasTime) return fallback;
  return `${pad2(p.day)}/${pad2(p.month)}/${p.year} ${pad2(p.hour)}:${pad2(p.minute)}`;
}
