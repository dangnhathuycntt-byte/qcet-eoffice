import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateEventLayout,
  getSemanticEventStyle,
  getWeekDays,
  type CalendarTimeEvent,
  ExecutiveCalendarWorkspace,
} from "@/components/calendar/executive-calendar-workspace";

describe("ExecutiveCalendarWorkspace Layout and Collision Detection Engine", () => {
  test("calculateEventLayout computes correct top and height percentages", () => {
    // Start of day: 07:00 (420 mins), End: 18:00 (1080 mins) -> 660 mins total
    const event: CalendarTimeEvent = {
      id: "evt-1",
      title: "Họp Giao ban Ban Giám hiệu",
      startTime: "08:00",
      endTime: "09:30",
      date: "2026-09-14",
      type: "meeting",
    };

    const layout = calculateEventLayout(event, 7, 18);
    // 08:00 is 60 mins from 07:00. 60 / 660 = ~9.09%
    assert.ok(Math.abs(layout.topPercent - 9.09) < 0.2);
    // Duration: 90 mins. 90 / 660 = ~13.64%
    assert.ok(Math.abs(layout.heightPercent - 13.64) < 0.2);
    assert.equal(layout.hasCollision, false);
    assert.equal(layout.widthPercent, 100);
    assert.equal(layout.leftPercent, 0);
  });

  test("calculateEventLayout handles simultaneous event collisions", () => {
    const eventA: CalendarTimeEvent = {
      id: "evt-a",
      title: "Tiếp đoàn chuyên gia ĐBCL",
      startTime: "09:00",
      endTime: "10:30",
      date: "2026-09-14",
      type: "meeting",
    };
    const eventB: CalendarTimeEvent = {
      id: "evt-b",
      title: "Họp Thẩm định DACUM Khoa CNTT",
      startTime: "09:30",
      endTime: "11:00",
      date: "2026-09-14",
      type: "meeting",
    };

    const [layoutA, layoutB] = [
      calculateEventLayout(eventA, 7, 18, [eventB]),
      calculateEventLayout(eventB, 7, 18, [eventA]),
    ];

    assert.equal(layoutA.hasCollision, true);
    assert.equal(layoutB.hasCollision, true);
    assert.equal(layoutA.widthPercent, 50);
    assert.equal(layoutB.widthPercent, 50);
    assert.equal(layoutA.leftPercent, 0);
    assert.equal(layoutB.leftPercent, 50);
  });

  test("calculateEventLayout handles 3-way collision with 33.33% column distribution", () => {
    const event1: CalendarTimeEvent = {
      id: "evt-1",
      title: "Họp BGH",
      startTime: "09:00",
      endTime: "10:30",
      date: "2026-09-14",
    };
    const event2: CalendarTimeEvent = {
      id: "evt-2",
      title: "Thẩm định chương trình",
      startTime: "09:15",
      endTime: "10:00",
      date: "2026-09-14",
    };
    const event3: CalendarTimeEvent = {
      id: "evt-3",
      title: "Làm việc với đối tác",
      startTime: "09:30",
      endTime: "11:00",
      date: "2026-09-14",
    };

    const layout1 = calculateEventLayout(event1, 7, 18, [event2, event3]);
    const layout2 = calculateEventLayout(event2, 7, 18, [event1, event3]);
    const layout3 = calculateEventLayout(event3, 7, 18, [event1, event2]);

    assert.equal(layout1.hasCollision, true);
    assert.equal(layout2.hasCollision, true);
    assert.equal(layout3.hasCollision, true);

    assert.ok(Math.abs(layout1.widthPercent - 33.33) < 0.1);
    assert.ok(Math.abs(layout2.widthPercent - 33.33) < 0.1);
    assert.ok(Math.abs(layout3.widthPercent - 33.33) < 0.1);

    assert.equal(layout1.leftPercent, 0);
    assert.ok(Math.abs(layout2.leftPercent - 33.33) < 0.1);
    assert.ok(Math.abs(layout3.leftPercent - 66.66) < 0.1);
  });

  test("getSemanticEventStyle returns design spec color tokens without dark variant", () => {
    const meetingStyle = getSemanticEventStyle("meeting");
    assert.ok(meetingStyle.includes("bg-blue-500/10"));
    assert.ok(meetingStyle.includes("text-blue-700"));
    assert.ok(!meetingStyle.includes("dark:"));

    const deliverableStyle = getSemanticEventStyle("deliverable");
    assert.ok(deliverableStyle.includes("bg-violet-500/10"));
    assert.ok(deliverableStyle.includes("text-violet-700"));

    const academicStyle = getSemanticEventStyle("academic");
    assert.ok(academicStyle.includes("bg-emerald-500/10"));
    assert.ok(academicStyle.includes("text-emerald-700"));

    const urgentStyle = getSemanticEventStyle("urgent");
    assert.ok(urgentStyle.includes("bg-rose-500/10"));
    assert.ok(urgentStyle.includes("text-rose-700"));

    const internalStyle = getSemanticEventStyle("internal");
    assert.ok(internalStyle.includes("bg-zinc-500/10"));
    assert.ok(internalStyle.includes("text-zinc-700"));
  });

  test("getWeekDays returns 7 days starting from Monday", () => {
    // 2026-09-14 is a Monday
    const days = getWeekDays(new Date("2026-09-16")); // Wednesday
    assert.equal(days.length, 7);
    assert.equal(days[0].dateString, "2026-09-14");
    assert.equal(days[0].dayOfWeekLabel, "T2");
    assert.equal(days[6].dateString, "2026-09-20");
    assert.equal(days[6].dayOfWeekLabel, "CN");
  });

  test("ExecutiveCalendarWorkspace is exported as a callable component function", () => {
    assert.equal(typeof ExecutiveCalendarWorkspace, "function");
  });
});
