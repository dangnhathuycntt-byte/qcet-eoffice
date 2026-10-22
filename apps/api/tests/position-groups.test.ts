import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isDeputyUnitLeaderPosition,
  isExecutivePosition,
  isLecturerPosition,
  isUnitLeaderPosition,
} from "@qcet/shared/domain/organization/position-groups";
import * as engine from "@/server/authorization/authorization-engine";

// Nhóm chức vụ nay ở packages/shared để bộ chọn người dự họp của web dùng chung với phân quyền của máy chủ
describe("Nhóm chức vụ dùng chung (packages/shared) và phân quyền máy chủ", () => {
  it("authorization-engine dùng đúng các hàm của packages/shared, không giữ bản riêng", () => {
    assert.equal(engine.isExecutivePosition, isExecutivePosition);
    assert.equal(engine.isUnitLeaderPosition, isUnitLeaderPosition);
    assert.equal(engine.isDeputyUnitLeaderPosition, isDeputyUnitLeaderPosition);
  });

  it("mã chức vụ thật của danh bạ vào đúng nhóm, không phân biệt hoa thường, thiếu mã thì không thuộc nhóm nào", () => {
    for (const code of ["HIEU_TRUONG", "PHO_HIEU_TRUONG", "pho_hieu_truong"]) assert.equal(isExecutivePosition(code), true, code);
    for (const code of ["TRUONG_PHONG", "TRUONG_KHOA", "GIAM_DOC_TRUNG_TAM", "truong_phong"]) assert.equal(isUnitLeaderPosition(code), true, code);
    assert.equal(isDeputyUnitLeaderPosition("PHO_GIAM_DOC_TRUNG_TAM"), true);
    assert.equal(isLecturerPosition("GIANG_VIEN"), true);

    // Hiệu trưởng không phải trưởng đơn vị; phó không phải trưởng
    assert.equal(isUnitLeaderPosition("HIEU_TRUONG"), false);
    assert.equal(isUnitLeaderPosition("PHO_GIAM_DOC_TRUNG_TAM"), false);
    for (const code of ["CHUYEN_VIEN", "KE_TOAN", "VAN_THU", "", undefined]) {
      assert.equal(isExecutivePosition(code), false);
      assert.equal(isUnitLeaderPosition(code), false);
      assert.equal(isDeputyUnitLeaderPosition(code), false);
      assert.equal(isLecturerPosition(code), false);
    }
  });
});
