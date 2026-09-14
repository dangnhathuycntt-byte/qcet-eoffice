import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getWeekDays } from "../src/lib/calendar/calendar-week";

describe("Calendar week view date calculations", () => {
  test("đảm bảo Thứ Hai là ngày 1 và Chủ Nhật là ngày 7", () => {
    // 2026-09-14 is a Monday
    const week = getWeekDays("2026-09-14");

    assert.strictEqual(week.length, 7);
    assert.strictEqual(week[0].dayOfWeek, 1);
    assert.strictEqual(week[0].label, "T2");
    assert.strictEqual(week[0].date, "2026-09-14");

    assert.strictEqual(week[6].dayOfWeek, 7);
    assert.strictEqual(week[6].label, "CN");
    assert.strictEqual(week[6].date, "2026-09-20");
  });

  test("tham chiếu ngày giữa tuần hoặc Chủ Nhật tính đúng Thứ Hai đầu tuần", () => {
    // 2026-09-16 is a Wednesday (T4)
    const weekFromWednesday = getWeekDays("2026-09-16");
    assert.strictEqual(weekFromWednesday[0].date, "2026-09-14");
    assert.strictEqual(weekFromWednesday[2].date, "2026-09-16");
    assert.strictEqual(weekFromWednesday[2].dayOfWeek, 3);
    assert.strictEqual(weekFromWednesday[2].label, "T4");

    // 2026-09-20 is a Sunday (CN)
    const weekFromSunday = getWeekDays("2026-09-20");
    assert.strictEqual(weekFromSunday[0].date, "2026-09-14");
    assert.strictEqual(weekFromSunday[6].date, "2026-09-20");
    assert.strictEqual(weekFromSunday[6].dayOfWeek, 7);
  });

  test("an toàn qua ranh giới giao thoa tháng (month crossover)", () => {
    // 2026-09-01 is a Tuesday (T3). Monday of that week is 2026-08-31
    const week = getWeekDays("2026-09-01");

    assert.strictEqual(week[0].date, "2026-08-31");
    assert.strictEqual(week[0].dayOfWeek, 1);
    assert.strictEqual(week[0].label, "T2");

    assert.strictEqual(week[1].date, "2026-09-01");
    assert.strictEqual(week[1].dayOfWeek, 2);
    assert.strictEqual(week[1].label, "T3");

    assert.strictEqual(week[6].date, "2026-09-06");
    assert.strictEqual(week[6].dayOfWeek, 7);
  });

  test("an toàn khi truyền ISO string có múi giờ, không bị lệch lùi ngày", () => {
    // 2026-09-14T00:00:00.000Z or local string
    const week = getWeekDays("2026-09-14T23:59:59+07:00");
    assert.strictEqual(week[0].date, "2026-09-14");
    assert.strictEqual(week[6].date, "2026-09-20");
  });

  test("hỗ trợ tùy chọn showWeekends: false chỉ trả về 5 ngày làm việc (T2 -> T6)", () => {
    const workWeek = getWeekDays("2026-09-16", { showWeekends: false });
    assert.strictEqual(workWeek.length, 5);
    assert.strictEqual(workWeek[0].label, "T2");
    assert.strictEqual(workWeek[4].label, "T6");
    assert.strictEqual(workWeek[4].dayOfWeek, 5);
  });

  test("đánh dấu cờ isToday chính xác cho ngày hiện tại", () => {
    const week = getWeekDays("2026-09-14", { today: "2026-09-16" });
    const wednesday = week.find((d) => d.date === "2026-09-16");
    const monday = week.find((d) => d.date === "2026-09-14");

    assert.strictEqual(wednesday?.isToday, true);
    assert.strictEqual(monday?.isToday, false);
  });

  test("ranh giới Chủ Nhật với showWeekends=false vẫn neo đúng tuần T2-T6", () => {
    // 2026-09-20 is a Sunday: the workweek still belongs to Mon 2026-09-14.
    const workWeek = getWeekDays("2026-09-20", { showWeekends: false });
    assert.strictEqual(workWeek.length, 5);
    assert.strictEqual(workWeek[0].date, "2026-09-14");
    assert.strictEqual(workWeek[0].dayOfWeek, 1);
    assert.strictEqual(workWeek[4].date, "2026-09-18");
    assert.strictEqual(workWeek[4].dayOfWeek, 5);

    // The full 7-day view from the same Sunday starts on the same Monday.
    const fullWeek = getWeekDays("2026-09-20");
    assert.strictEqual(fullWeek[0].date, "2026-09-14");
    assert.strictEqual(fullWeek[6].date, "2026-09-20");
  });

  test("ẩn cuối tuần vẫn giữ tuần chứa giao thoa tháng (tháng 8 sang 9)", () => {
    // 2026-08-30 is a Sunday at the Aug/Sep crossover.
    const workWeek = getWeekDays("2026-08-30", { showWeekends: false });
    assert.strictEqual(workWeek.length, 5);
    assert.strictEqual(workWeek[0].date, "2026-08-24");
    assert.strictEqual(workWeek[4].date, "2026-08-28");

    const fullWeek = getWeekDays("2026-08-30");
    assert.strictEqual(fullWeek[0].date, "2026-08-24");
    assert.strictEqual(fullWeek[6].date, "2026-08-30");
  });

  test("chuỗi ICT ISO với offset +07:00 không lệch ngày khi ẩn cuối tuần", () => {
    const workWeek = getWeekDays("2026-09-16T07:30:00+07:00", { showWeekends: false });
    assert.strictEqual(workWeek.length, 5);
    assert.strictEqual(workWeek[0].date, "2026-09-14");
    assert.strictEqual(workWeek[4].date, "2026-09-18");

    // Timestamps near local midnight still resolve to the calendar date.
    const week = getWeekDays("2026-09-14T00:00:00+07:00");
    assert.strictEqual(week[0].date, "2026-09-14");
    assert.strictEqual(week[6].date, "2026-09-20");
  });
});
