import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatLedgerCellDate,
  formatLedgerDate,
  getLedgerDueNote,
  getLedgerUrgencyTag,
  getLedgerStepLabel,
  todayInVietnam,
} from "../src/lib/documents/document-ledger-format";

describe("document-ledger-format", () => {
  it("todayInVietnam dùng múi giờ Asia/Ho_Chi_Minh", () => {
    // 20:00 UTC ngày 29/09 = 03:00 ngày 30/09 giờ Việt Nam
    assert.equal(todayInVietnam(new Date("2026-09-29T20:00:00Z")), "2026-09-30");
  });

  it("formatLedgerDate đổi YYYY-MM-DD sang DD/MM/YYYY", () => {
    assert.equal(formatLedgerDate("2026-09-25"), "25/09/2026");
    assert.equal(formatLedgerDate("2026-09-25T00:00:00.000Z"), "25/09/2026");
    assert.equal(formatLedgerDate(""), "");
  });

  it("formatLedgerCellDate luôn có năm, chỉ rút gọn khi đang lọc đúng năm đó (SPEC §17.4)", () => {
    assert.equal(formatLedgerCellDate("2026-10-09"), "09/10/2026");
    assert.equal(formatLedgerCellDate("2026-10-09", 2026), "09/10");
    assert.equal(formatLedgerCellDate("2025-12-31", 2026), "31/12/2025");
    assert.equal(formatLedgerCellDate(null, 2026), "");
  });

  it("getLedgerDueNote tính còn/trễ hạn và bỏ qua văn bản đã xong", () => {
    const today = "2026-09-29";
    assert.deepEqual(getLedgerDueNote("2026-09-30", false, today), { text: "Còn 1 ngày", tone: "warning" });
    assert.deepEqual(getLedgerDueNote("2026-10-15", false, today), { text: "Còn 16 ngày", tone: "muted" });
    assert.deepEqual(getLedgerDueNote("2026-09-29", false, today), { text: "Hôm nay", tone: "warning" });
    assert.deepEqual(getLedgerDueNote("2026-09-26", false, today), { text: "Trễ hạn 3 ngày", tone: "danger" });
    assert.equal(getLedgerDueNote("2026-09-26", true, today), null);
    assert.equal(getLedgerDueNote(undefined, false, today), null);
  });

  it("urgency tag chỉ hiện cho văn bản khẩn", () => {
    assert.equal(getLedgerUrgencyTag("normal"), null);
    assert.equal(getLedgerUrgencyTag("HOA_TOC")?.label, "HỎA TỐC");
    assert.equal(getLedgerUrgencyTag("urgent")?.tone, "warning");
  });

  it("step label ưu tiên trạng thái workflow theo bản đồ hệ thống", () => {
    assert.equal(getLedgerStepLabel("DANG_XU_LY", "PRESENTED", "inbox").label, "Chờ bút phê");
    assert.equal(getLedgerStepLabel("DANG_XU_LY", "RESOLVED", "VAN_BAN_DEN").label, "Hoàn thành");
    assert.equal(getLedgerStepLabel("DANG_XU_LY", "AUTHORIZED_SIGN", "outbox").label, "Chờ ký");
    assert.equal(getLedgerStepLabel("DANG_XU_LY", "ISSUED", "VAN_BAN_DI").label, "Đã phát hành");
    assert.equal(getLedgerStepLabel("DANG_XU_LY", "UNKNOWN", "inbox").label, "Đang xử lý");
  });

  it("step label", () => {
    assert.equal(getLedgerStepLabel("CHO_PHAN_CONG").label, "Chờ bút phê");
    assert.equal(getLedgerStepLabel("delegated").label, "Đã giao đơn vị");
  });
});
