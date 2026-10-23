import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readApiErrorMessage } from "../src/lib/documents/api-error";

const json = (body: unknown, status = 403) => new Response(JSON.stringify(body), { status });

describe("Lý do lỗi của thao tác văn bản đi", () => {
  it("ưu tiên `detail` của RFC 9457, rồi `message`, rồi chuỗi dự phòng", async () => {
    assert.equal(await readApiErrorMessage(json({ detail: "Chỉ người được trình duyệt mới duyệt.", message: "x" }), "f"), "Chỉ người được trình duyệt mới duyệt.");
    assert.equal(await readApiErrorMessage(json({ message: "Lỗi cũ" }), "f"), "Lỗi cũ");
    assert.equal(await readApiErrorMessage(json({ detail: "  " }), "Thao tác thất bại (403)"), "Thao tác thất bại (403)");
    assert.equal(await readApiErrorMessage(new Response("không phải JSON", { status: 500 }), "Thao tác thất bại (500)"), "Thao tác thất bại (500)");
  });
});

describe("OutgoingActionPanel hiện nút theo server, không theo trạng thái", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/components/documents/outgoing-action-panel.tsx"), "utf8");

  it("nút lấy từ `step.actions` do server tính cho người xem, không từ bảng theo trạng thái", () => {
    assert.match(source, /step\?\.actions/);
    assert.doesNotMatch(source, /STATUS_ACTIONS/);
    assert.doesNotMatch(source, /currentUserId/);
  });

  it("người chưa đến lượt thấy dòng 'Đang chờ …' thay vì nút", () => {
    assert.match(source, /Đang chờ/);
    assert.match(source, /step\?\.waiting/);
  });

  it("lỗi đọc qua hàm chung, không tự đọc `data.message`", () => {
    assert.match(source, /readApiErrorMessage\(/);
    assert.doesNotMatch(source, /data\.message/);
  });

  it("trình duyệt mở hộp chọn người duyệt riêng, không dùng hộp xác nhận trần; có nút Rút lại", () => {
    assert.match(source, /OutgoingSubmitDialog/);
    assert.match(source, /"withdraw-content-review"/);
    const dialog = fs.readFileSync(path.join(__dirname, "../src/components/documents/outgoing-submit-dialog.tsx"), "utf8");
    assert.match(dialog, /<DialogForm/);
    assert.match(dialog, /type="submit"/);
    assert.match(dialog, /initialFocus/);
    assert.match(dialog, /contentReviewerId/);
  });
});
