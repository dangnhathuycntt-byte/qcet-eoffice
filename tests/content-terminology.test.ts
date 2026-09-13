import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ICT_TIME_ZONE,
  toIctDateTimeParts,
  formatIsoDate,
  formatDisplayDate,
  formatCompactDate,
  formatDateSpan,
  formatTime,
  formatDateTime,
  formatRelativeDate,
  daysUntil,
  RELATIVE_NEAR_TERM_MAX_DAYS,
  formatAcademicMonthLabel,
  formatAcademicMonthFullLabel,
  formatAcademicMonthSpan,
  formatSemesterLabel,
  formatSemesterFullLabel,
  formatAcademicYear,
  formatAcademicPeriodLabel,
} from "../src/lib/format";
import { getSystemReferenceDate } from "../src/lib/academic-calendar";

const VOCAB = fs.readFileSync(
  path.join(process.cwd(), "docs/ux/QCET_UI_VOCABULARY.md"),
  "utf8"
);

function collectLedgerEntries(prefix: "Approved" | "Rejected"): Set<string> {
  const re = new RegExp(`^\\s*${prefix}:\\s+([^()\\n]+)`, "gm");
  const found = new Set<string>();
  for (const match of VOCAB.matchAll(re)) {
    const term = match[1].trim();
    if (term) found.add(term);
  }
  return found;
}

describe("C19 — UI vocabulary contract (docs/ux/QCET_UI_VOCABULARY.md)", () => {
  it("declares itself frozen v1", () => {
    assert.match(VOCAB, /status:\s*FROZEN/i);
    assert.match(VOCAB, /version:\s*1\b/);
  });

  it("freezes approved terms for core entities and lifecycle/attention states", () => {
    const approved = collectLedgerEntries("Approved");
    const entities = [
      "Nhiệm vụ",
      "Nhiệm vụ cha",
      "Nhiệm vụ con",
      "Giao việc",
      "Tạo việc cá nhân",
    ];
    const states = [
      "Chưa bắt đầu",
      "Đang thực hiện",
      "Cần chỉnh sửa",
      "Chờ phê duyệt",
      "Chờ BGH duyệt",
      "Hoàn thành",
      "Quá hạn",
      "Đã hủy",
      "Cần tôi xử lý",
      "Chờ tôi duyệt",
      "Sắp đến hạn",
      "Bị chặn",
    ];
    for (const term of [...entities, ...states]) {
      assert.ok(VOCAB.includes(term), `vocabulary must contain approved term: ${term}`);
    }
    // Approved action outcomes must appear in the §H ledger as approved.
    for (const term of ["Giao việc", "Thêm việc con", "Chờ phê duyệt", "Chờ tôi duyệt"]) {
      assert.ok(approved.has(term), `"${term}" must be an Approved ledger entry`);
    }
  });

  it("consolidates forbidden drift to a single approved outcome per group", () => {
    const approved = collectLedgerEntries("Approved");
    const rejected = collectLedgerEntries("Rejected");

    // H.1 work creation / delegation
    assert.ok(approved.has("Giao việc"));
    for (const drift of ["Tạo việc", "Tạo nhiệm vụ", "Phân công"]) {
      assert.ok(rejected.has(drift), `"${drift}" must be Rejected`);
    }
    // H.2 subtask creation
    assert.ok(approved.has("Thêm việc con"));
    for (const drift of ["Phân rã", "Phân rã ngay", "Giao nhanh"]) {
      assert.ok(rejected.has(drift), `"${drift}" must be Rejected`);
    }
    // H.3 approval terminology — status vs attention must stay distinct
    assert.ok(approved.has("Chờ phê duyệt"));
    assert.ok(approved.has("Chờ tôi duyệt"));
    assert.ok(rejected.has("Chờ duyệt"), "bare 'Chờ duyệt' must be Rejected drift");
    assert.ok(rejected.has("Cần duyệt"));
    // H.4 / H.5 / H.6
    assert.ok(approved.has("Đang thực hiện"));
    assert.ok(rejected.has("Đang làm"));
    assert.ok(approved.has("Xóa bộ lọc"));
    assert.ok(rejected.has("Xóa lọc"));
    assert.ok(approved.has("Chưa bắt đầu"));
    assert.ok(rejected.has("Mới"));

    // Sanity: an approved outcome must never also be listed as rejected.
    for (const term of ["Chờ phê duyệt", "Chờ tôi duyệt", "Giao việc", "Thêm việc con"]) {
      assert.ok(!rejected.has(term), `approved term "${term}" must not be rejected`);
    }
  });

  it("bans generic affirmation labels where a specific outcome exists", () => {
    const section = VOCAB.slice(VOCAB.indexOf("Banned generic labels"));
    const fenceStart = section.indexOf("```text");
    const fenceEnd = section.indexOf("```", fenceStart + 7);
    assert.ok(fenceStart >= 0 && fenceEnd > fenceStart, "banned-labels block must exist");
    const banned = section.slice(fenceStart, fenceEnd);
    for (const label of ["Xác nhận", "Tiếp tục", "Thực hiện", "OK", "Đồng ý"]) {
      assert.ok(banned.includes(label), `"${label}" must be listed as a banned generic label`);
    }
  });

  it("freezes the bounded relative-date rule and ICT timezone authority", () => {
    assert.ok(VOCAB.includes("2..3"), "vocabulary must bound the near-term window to 2..3 days");
    assert.ok(VOCAB.includes("Quá hạn {abs(diffDays)} ngày"));
    assert.match(VOCAB, /Asia\/Ho_Chi_Minh/);
    assert.equal(ICT_TIME_ZONE, "Asia/Ho_Chi_Minh");
    assert.equal(RELATIVE_NEAR_TERM_MAX_DAYS, 3);
  });
});

describe("C19 — date/time formatting utilities (src/lib/format)", () => {
  it("emits the frozen ISO, display, compact and span date formats (vocabulary §G.1)", () => {
    assert.equal(formatIsoDate("2026-09-25"), "2026-09-25");
    assert.equal(formatDisplayDate("2026-09-25"), "25/09/2026");
    assert.equal(formatCompactDate("2026-09-25"), "25/09");
    assert.equal(formatDateSpan("2026-08-25", "2026-09-24"), "25/08 - 24/09");
  });

  it("resolves a Date to ICT calendar parts (UTC+7) rather than UTC slicing", () => {
    // 17:30 UTC is 00:30 ICT on the next day.
    const instant = new Date("2026-09-24T17:30:00Z");
    assert.equal(formatIsoDate(instant), "2026-09-25");
    assert.equal(formatDisplayDate(instant), "25/09/2026");
  });

  it("emits 24-hour time and date+time (vocabulary §G.1)", () => {
    // 01:30 UTC is 08:30 ICT.
    assert.equal(formatTime(new Date("2026-09-25T01:30:00Z")), "08:30");
    assert.equal(formatDateTime(new Date("2026-09-25T01:30:00Z")), "25/09/2026 08:30");
    assert.equal(formatDateTime("2026-09-25T08:30"), "25/09/2026 08:30");
    assert.equal(formatTime("2026-09-25T08:30"), "08:30");
  });

  it("emits the fallback for missing or invalid input", () => {
    assert.equal(formatDisplayDate(null), "—");
    assert.equal(formatDisplayDate("not-a-date"), "—");
    assert.equal(formatDateTime(undefined), "—");
    assert.equal(formatDateSpan("2026-08-25", null), "—");
  });

  it("rejects out-of-range components instead of rendering a fabricated date", () => {
    // Shape-valid but calendar-impossible values must fall back rather than render.
    assert.equal(toIctDateTimeParts("2026-13-40"), null);
    assert.equal(toIctDateTimeParts("2026-09-00"), null);
    assert.equal(formatDisplayDate("2026-13-40"), "—");
    assert.equal(formatIsoDate("2026-09-00"), "—");
    assert.equal(formatDisplayDate("2026-02-30"), "—");
    assert.equal(formatCompactDate("2026-13-40"), "—");
    assert.equal(formatRelativeDate("2026-13-40", "2026-09-09"), "—");
    // Naive datetime with out-of-range time components fails the same way.
    assert.equal(formatDateTime("2026-09-25T25:99"), "—");
    assert.equal(formatTime("2026-09-25T24:00"), "—");
    // A valid value of the same shape still parses (no over-rejection).
    assert.notEqual(toIctDateTimeParts("2026-09-25"), null);
    assert.equal(formatDisplayDate("2026-09-25"), "25/09/2026");
  });

  it("falls back when a date-only value is passed to a time renderer (no misleading 00:00)", () => {
    // A DB date-only value (e.g. dueDate 'YYYY-MM-DD') carries no time-of-day.
    assert.equal(formatTime("2026-09-25"), "—");
    assert.equal(formatDateTime("2026-09-25"), "—");
    // A genuine ICT-midnight instant does carry a time-of-day and still renders 00:00.
    const midnightIct = new Date("2026-09-24T17:00:00Z"); // 00:00 ICT on 25/09
    assert.equal(formatTime(midnightIct), "00:00");
    assert.equal(formatDateTime(midnightIct), "25/09/2026 00:00");
    // Date-only helpers remain unaffected by the time-bearing distinction.
    assert.equal(formatIsoDate("2026-09-25"), "2026-09-25");
    assert.equal(formatDisplayDate("2026-09-25"), "25/09/2026");
  });

  it("applies the bounded relative-date rule against an explicit reference (vocabulary §G.2)", () => {
    const ref = "2026-09-09";
    assert.equal(formatRelativeDate("2026-09-09", ref), "Hôm nay");
    assert.equal(formatRelativeDate("2026-09-10", ref), "Ngày mai");
    assert.equal(formatRelativeDate("2026-09-11", ref), "Còn 2 ngày");
    assert.equal(formatRelativeDate("2026-09-12", ref), "Còn 3 ngày");
    // Bounded: from 4 days out the absolute dd/MM/yyyy date is shown, not a count.
    assert.equal(formatRelativeDate("2026-09-13", ref), "13/09/2026");
    assert.equal(formatRelativeDate("2026-10-09", ref), "09/10/2026");
    // Past due.
    assert.equal(formatRelativeDate("2026-09-08", ref), "Quá hạn 1 ngày");
    assert.equal(formatRelativeDate("2026-09-07", ref), "Quá hạn 2 ngày");
  });

  it("defaults the relative reference to the canonical system reference date", () => {
    const sysRef = getSystemReferenceDate();
    assert.equal(formatRelativeDate(sysRef), "Hôm nay");
    assert.equal(daysUntil(sysRef), 0);
    assert.equal(formatRelativeDate(null), "—");
  });
});

describe("C19 — academic-period labels (vocabulary §G.3)", () => {
  it("emits operational month labels and spans from the canonical engine", () => {
    assert.equal(formatAcademicMonthLabel(9), "Tháng 9");
    assert.equal(formatAcademicMonthFullLabel(9, "2026-2027"), "Tháng 9 / 2026 (25/08 - 24/09)");
    assert.equal(formatAcademicMonthSpan(9, "2026-2027"), "25/08 - 24/09");
  });

  it("emits semester labels in both short and full forms", () => {
    assert.equal(formatSemesterLabel(1), "Học kỳ I");
    assert.equal(formatSemesterLabel(2), "Học kỳ II");
    assert.equal(formatSemesterFullLabel(1, "2026-2027"), "Học kỳ I (2026 - 2027)");
    assert.equal(formatSemesterFullLabel(2, "2026-2027"), "Học kỳ II (2026 - 2027)");
  });

  it("emits the academic year label with the 25/08 cut-off", () => {
    assert.equal(formatAcademicYear("2026-09-09"), "2026-2027");
    assert.equal(formatAcademicYear("2026-08-24"), "2025-2026");
  });

  it("derives the current academic period label from the canonical engine", () => {
    assert.equal(formatAcademicPeriodLabel("2026-09-09"), "Học kỳ I (2026 - 2027)");
    assert.equal(formatAcademicPeriodLabel("2027-02-01"), "Học kỳ II (2026 - 2027)");
  });
});
