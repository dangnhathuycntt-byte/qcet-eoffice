import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatWeekday } from "@qcet/shared/lib/format/date";

describe("formatWeekday", () => {
  it("tính thứ theo ngày giờ Việt Nam, không theo ngày UTC", () => {
    assert.equal(formatWeekday("2026-10-20"), "Thứ Ba");
    // 18:00 UTC ngày 20/10 là 01:00 ngày 21/10 ở Việt Nam
    assert.equal(formatWeekday("2026-10-20T18:00:00.000Z"), "Thứ Tư");
    assert.equal(formatWeekday("2026-10-25T09:00:00+07:00"), "Chủ nhật");
  });

  it("đầu vào thiếu hoặc sai trả chữ thay thế", () => {
    assert.equal(formatWeekday(null), "-");
    assert.equal(formatWeekday("không phải ngày", ""), "");
  });
});
