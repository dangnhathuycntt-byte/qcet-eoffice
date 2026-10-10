import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildIncomingQuotes,
  formatShortDateTime,
  getIncomingActions,
} from "../src/lib/documents/incoming-workflow";
import type { DocumentItem } from "../src/types/document";

const keys = (status: string, role: string) => getIncomingActions(status, role).map((a) => a.key);

describe("incoming workflow actions", () => {
  it("mỗi bước chỉ hiện thao tác của đúng vai trò", () => {
    assert.deepEqual(keys("REGISTERED", "VAN_THU"), ["present"]);
    assert.deepEqual(keys("PRESENTED", "BAN_GIAM_HIEU"), ["direct"]);
    assert.deepEqual(keys("DIRECTED", "TRUONG_PHONG"), ["assign-unit"]);
    assert.deepEqual(keys("UNIT_ASSIGNED_PERSON", "CHUYEN_VIEN"), ["resolve"]);
    assert.deepEqual(keys("RESOLVED", "VAN_THU"), ["file"]);
  });

  it("sai vai trò hoặc sai bước thì không có thao tác nào", () => {
    assert.deepEqual(keys("REGISTERED", "CHUYEN_VIEN"), []);
    assert.deepEqual(keys("PRESENTED", "VAN_THU"), []);
    assert.deepEqual(keys("FILED", "VAN_THU"), []);
    assert.deepEqual(getIncomingActions("REGISTERED", undefined), []);
  });

  it("V-01: trưởng đơn vị trả lại ở bước đã giao đơn vị; Văn thư chuyển lại ở bước DIRECTED", () => {
    assert.deepEqual(keys("ASSIGNED_TO_LEAD_UNIT", "TRUONG_PHONG"), ["assign-unit", "return"]);
    assert.deepEqual(keys("UNIT_ASSIGNED_PERSON", "TRUONG_PHONG"), ["return"]);
    assert.deepEqual(keys("DIRECTED", "VAN_THU"), ["reroute"]);
    const ret = getIncomingActions("ASSIGNED_TO_LEAD_UNIT", "TRUONG_PHONG")[1];
    assert.equal(ret.input, "reason");
    assert.equal(getIncomingActions("ASSIGNED_TO_LEAD_UNIT", "TRUONG_PHONG")[0].input, "person", "phân công cần chọn người xử lý");
    assert.equal(ret.destructive, true);
    assert.equal(getIncomingActions("DIRECTED", "VAN_THU")[0].input, "unit");
    // Sai vai trò hoặc sai bước thì không có.
    assert.deepEqual(keys("ASSIGNED_TO_LEAD_UNIT", "CHUYEN_VIEN"), []);
    assert.deepEqual(keys("IN_PROGRESS", "TRUONG_PHONG"), []);
    assert.deepEqual(keys("REGISTERED", "TRUONG_PHONG"), []);
  });

  it("BGH duyệt/từ chối nội dung ở bước đã bút phê hoặc đã phân công; từ chối là thao tác phá hủy", () => {
    const directed = getIncomingActions("DIRECTED", "BAN_GIAM_HIEU");
    assert.deepEqual(directed.map((a) => a.key), ["approve-content", "reject-content"]);
    assert.equal(directed.find((a) => a.key === "reject-content")?.destructive, true);
    assert.equal(directed.find((a) => a.key === "approve-content")?.destructive, undefined);
    assert.deepEqual(keys("REGISTERED", "BAN_GIAM_HIEU"), []);
  });
});

const baseItem = {
  id: "doc-1",
  type: "VAN_BAN_DEN",
  registrationNumber: 8,
  registeredDate: "2026-10-09T01:00:00.000Z",
  leadUnitName: "Phòng Đào tạo",
  directives: [],
  incomingWorkflow: {
    status: "UNIT_ASSIGNED_PERSON",
    createdAt: "2026-10-09T01:00:00.000Z",
    presentedAt: "2026-10-09T02:00:00.000Z",
    directedAt: "2026-10-09T03:00:00.000Z",
    leadershipInstruction: "Giao phòng Đào tạo xử lý",
    leader: { name: "Hiệu trưởng" },
    leadUnit: { name: "Phòng Đào tạo" },
    unitAssignments: [{ createdAt: "2026-10-09T04:00:00.000Z" }],
    resolvedAt: null,
    filedAt: null,
  },
} as unknown as DocumentItem;

describe("incoming workflow quotes", () => {
  it("không có bút phê theo lãnh đạo thì dùng nội dung bút phê tổng", () => {
    const quotes = buildIncomingQuotes(baseItem);
    assert.deepEqual(quotes.map((q) => q.text), ["Giao phòng Đào tạo xử lý"]);
    assert.equal(quotes[0].who, "Hiệu trưởng");
  });

  it("có bút phê theo lãnh đạo thì ưu tiên danh sách đó", () => {
    const item = {
      ...baseItem,
      directives: [{ id: "d1", instruction: "Xử lý gấp", leaderName: "Phó hiệu trưởng" }],
    } as unknown as DocumentItem;
    assert.deepEqual(buildIncomingQuotes(item).map((q) => [q.who, q.text]), [["Phó hiệu trưởng", "Xử lý gấp"]]);
  });

  it("định dạng ngày giờ theo múi giờ Việt Nam, chuỗi rỗng khi không hợp lệ", () => {
    assert.equal(formatShortDateTime("2026-10-09T02:00:00.000Z"), "09/10 09:00");
    assert.equal(formatShortDateTime("không phải ngày"), "");
    assert.equal(formatShortDateTime(null), "");
  });
});
