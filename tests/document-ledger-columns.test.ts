import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildColumnTemplate,
  buildCompactColumnTemplate,
  DEFAULT_LEDGER_COLUMNS,
  type LedgerColumnVisibility,
} from "../src/components/documents/registry/document-ledger";

const ALL_OFF: LedgerColumnVisibility = {
  urgency: false,
  issuingAuthority: false,
  leadUnit: false,
  dueDate: false,
  issuedDate: false,
  status: false,
};

describe("document-ledger column template", () => {
  it("mặc định ở màn hình rộng có đủ 8 ô: chọn, văn bản, khẩn, cơ quan, chủ trì, hạn, ngày ban hành, trạng thái", () => {
    const tracks = buildColumnTemplate(DEFAULT_LEDGER_COLUMNS, true).split(" ");
    assert.equal(tracks.length, 8);
    assert.equal(tracks[0], "24px");
    assert.equal(tracks[1], "minmax(0,1fr)");
  });

  it("màn hình hẹp bỏ hai cột chỉ hiện từ xl, nên số track khớp số ô hiển thị", () => {
    const narrow = buildColumnTemplate(DEFAULT_LEDGER_COLUMNS, false).split(" ");
    assert.equal(narrow.length, 6);
    assert.ok(!narrow.includes("160px"), "cơ quan và chủ trì không được có trong mẫu hẹp");
  });

  it("cột người dùng tắt bị bỏ khỏi mẫu, giữ đúng thứ tự cột còn lại", () => {
    const visible = { ...DEFAULT_LEDGER_COLUMNS, issuingAuthority: false, status: false };
    const wide = buildColumnTemplate(visible, true).split(" ");
    assert.deepEqual(wide, ["24px", "minmax(0,1fr)", "80px", "160px", "96px", "96px"]);
  });

  it("chỉ còn ô chọn và văn bản khi tắt mọi cột tùy chọn", () => {
    assert.equal(buildColumnTemplate(ALL_OFF, true), "24px minmax(0,1fr)");
    assert.equal(buildColumnTemplate(ALL_OFF, false), "24px minmax(0,1fr)");
  });

  it("cột chỉ-xl bật lên không làm lệch mẫu hẹp", () => {
    const onlyWide = { ...ALL_OFF, leadUnit: true };
    assert.equal(buildColumnTemplate(onlyWide, false), "24px minmax(0,1fr)");
    assert.equal(buildColumnTemplate(onlyWide, true), "24px minmax(0,1fr) 160px");
  });

  it("bảng hẹp (Quick View mở) chỉ giữ chọn, văn bản, hạn xử lý và trạng thái", () => {
    assert.deepEqual(buildCompactColumnTemplate(DEFAULT_LEDGER_COLUMNS).split(" "), ["24px", "minmax(0,1fr)", "96px", "120px"]);
    assert.equal(buildCompactColumnTemplate({ ...DEFAULT_LEDGER_COLUMNS, dueDate: false, status: false }), "24px minmax(0,1fr)");
  });

  it("ở mức hẹp văn bản luôn còn ≥ 160px khi bảng rộng đúng LIST_MIN (480px)", () => {
    const fixed = buildCompactColumnTemplate(DEFAULT_LEDGER_COLUMNS)
      .split(" ")
      .filter((track) => track.endsWith("px"))
      .reduce((sum, track) => sum + parseInt(track, 10), 0);
    const gaps = 3 * 16;
    const padding = 12 + 16;
    assert.ok(480 - fixed - gaps - padding >= 160);
  });
});
