/**
 * Phần logic của trang Cuộc họp (21/10/2026): khoảng giờ của bộ lọc thời gian theo ngày Việt Nam, thao tác được phép trên một
 * hàng theo `availableActions` và trạng thái, tùy chọn hiển thị đọc lại từ trình duyệt, bảng xuất Excel.
 */
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MEETING_DISPLAY,
  canCancelMeeting,
  meetingCsvRows,
  meetingTimeRange,
  readMeetingDisplay,
  statusOptionsFor,
  writeMeetingDisplay,
  type MeetingRow,
} from "@/components/meetings/meeting-list-model";
import { toCsv } from "@/lib/csv";

const row = (patch: Partial<MeetingRow> = {}): MeetingRow => ({
  id: "m1",
  title: "Họp giao ban",
  status: "INVITED",
  startTime: "2026-10-22T01:00:00.000Z",
  endTime: "2026-10-22T02:30:00.000Z",
  location: "Phòng A2",
  organizer: { id: "u1", name: "Người tổ chức" },
  unit: { name: "Phòng Đào tạo" },
  _count: { participants: 6, resolutions: 0 },
  availableActions: ["meeting.read", "meeting.update"],
  ...patch,
});

describe("Bộ lọc thời gian cuộc họp", () => {
  test("hôm nay: từ 0 giờ tới hết ngày theo giờ Việt Nam (UTC+7)", () => {
    assert.deepEqual(meetingTimeRange("today", "2026-10-21"), {
      from: "2026-10-20T17:00:00.000Z",
      to: "2026-10-21T16:59:59.999Z",
    });
  });

  test("tuần này: thứ Hai tới hết Chủ nhật, kể cả khi hôm nay là Chủ nhật", () => {
    // 21/10/2026 là thứ Tư
    assert.deepEqual(meetingTimeRange("week", "2026-10-21"), {
      from: "2026-10-18T17:00:00.000Z",
      to: "2026-10-25T16:59:59.999Z",
    });
    // 25/10/2026 là Chủ nhật: vẫn thuộc tuần bắt đầu 19/10
    assert.equal(meetingTimeRange("week", "2026-10-25").from, "2026-10-18T17:00:00.000Z");
  });

  test("tháng này và tháng trước, qua ranh giới năm", () => {
    assert.deepEqual(meetingTimeRange("month", "2026-12-15"), {
      from: "2026-11-30T17:00:00.000Z",
      to: "2026-12-31T16:59:59.999Z",
    });
    assert.deepEqual(meetingTimeRange("last-month", "2027-01-05"), {
      from: "2026-11-30T17:00:00.000Z",
      to: "2026-12-31T16:59:59.999Z",
    });
  });

  test("trạng thái chọn được theo tab: tab chia theo thời gian nên có mọi trạng thái trừ Đã hủy (chỉ ở Tất cả)", () => {
    const notCancelled = ["DRAFT_AGENDA", "INVITED", "HELD", "MINUTES_DRAFT", "MINUTES_CONFIRMED"];
    assert.deepEqual(statusOptionsFor("upcoming"), notCancelled);
    assert.deepEqual(statusOptionsFor("done"), notCancelled);
    assert.equal(statusOptionsFor("all").length, 6);
  });
});

describe("Thao tác trên một hàng", () => {
  test("hủy họp: chỉ khi chưa họp và máy chủ cho meeting.update", () => {
    assert.equal(canCancelMeeting(row()), true);
    assert.equal(canCancelMeeting(row({ status: "DRAFT_AGENDA" })), true);
    assert.equal(canCancelMeeting(row({ status: "HELD" })), false, "đã họp thì giữ để còn biên bản");
    assert.equal(canCancelMeeting(row({ status: "CANCELLED" })), false);
    assert.equal(canCancelMeeting(row({ availableActions: ["meeting.read"] })), false, "người dự họp không hủy được");
  });

  test("xuất Excel: một dòng mỗi cuộc họp, chặn công thức ở đầu ô", () => {
    const csv = toCsv(meetingCsvRows([row({ title: "=HYPERLINK(1)", location: null })]));
    const [header, line] = csv.split("\r\n");
    assert.equal(header, '"Cuộc họp","Ngày","Giờ","Địa điểm","Người tạo","Đơn vị","Thành phần","Trạng thái"');
    assert.ok(line.startsWith(`"'=HYPERLINK(1)","22/10/2026","08:00 – 09:30","","Người tổ chức","Phòng Đào tạo","6","Đã mời"`), line);
  });
});

describe("Tùy chọn hiển thị lưu ở trình duyệt", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    };
  });

  test("chưa lưu hoặc dữ liệu hỏng thì dùng mặc định", () => {
    assert.deepEqual(readMeetingDisplay(), DEFAULT_MEETING_DISPLAY);
    store.set("qcet.meetings.display.v1", "{hỏng");
    assert.deepEqual(readMeetingDisplay(), DEFAULT_MEETING_DISPLAY);
  });

  test("giá trị lạ bị bỏ, giá trị hợp lệ giữ lại; về mặc định thì xóa khỏi bộ nhớ", () => {
    store.set(
      "qcet.meetings.display.v1",
      JSON.stringify({ columns: { status: false, organizer: "x" }, sort: { field: "organizerId", order: "asc" } })
    );
    const prefs = readMeetingDisplay();
    assert.equal(prefs.columns.status, false);
    assert.equal(prefs.columns.organizer, true);
    assert.equal(prefs.sort, null, "cột sắp xếp máy chủ không nhận thì bỏ");

    writeMeetingDisplay({ ...DEFAULT_MEETING_DISPLAY, sort: { field: "title", order: "asc" } });
    assert.deepEqual(readMeetingDisplay().sort, { field: "title", order: "asc" });
    writeMeetingDisplay(DEFAULT_MEETING_DISPLAY);
    assert.equal(store.has("qcet.meetings.display.v1"), false);
  });
});
