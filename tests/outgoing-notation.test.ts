import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OUTGOING_TYPE_ABBREVIATIONS,
  abbreviateUnitName,
  deriveOutgoingNotation,
  isValidOutgoingNotation,
} from "@qcet/shared/domain/documents/outgoing-notation";

describe("Ký hiệu văn bản đi theo loại (NĐ 30/2020 Điều 8, Phụ lục III)", () => {
  it("văn bản có tên loại: viết tắt loại + viết tắt cơ quan", () => {
    assert.equal(deriveOutgoingNotation({ category: "Quyết định" }), "QĐ-CĐKTCNQN");
    assert.equal(deriveOutgoingNotation({ category: "Tờ trình" }), "TTr-CĐKTCNQN");
    assert.equal(deriveOutgoingNotation({ category: "Kế hoạch" }), "KH-CĐKTCNQN");
    assert.equal(deriveOutgoingNotation({ category: "Báo cáo tuần" }), "BC-CĐKTCNQN");
    assert.equal(deriveOutgoingNotation({ category: "Quy định" }), "QyĐ-CĐKTCNQN");
  });

  it("loại có tên loại bỏ qua đơn vị soạn", () => {
    assert.equal(
      deriveOutgoingNotation({ category: "Thông báo", unit: { name: "Phòng Quản lý Đào tạo", shortName: "Phòng QLĐT" } }),
      "TB-CĐKTCNQN"
    );
  });

  it("công văn: viết tắt cơ quan + viết tắt đơn vị soạn thảo (ví dụ NĐ 30: 234/SYT-VP)", () => {
    const unit = { name: "Phòng Quản lý Đào tạo", shortName: "Phòng QLĐT" };
    assert.equal(deriveOutgoingNotation({ category: "Công văn", unit }), "CĐKTCNQN-QLĐT");
    assert.equal(deriveOutgoingNotation({ unit }), "CĐKTCNQN-QLĐT", "chưa chọn hình thức thì là công văn");
  });

  it("loại ngoài Phụ lục III không tự đặt chữ viết tắt: dùng dạng công văn", () => {
    const unit = { name: "Khoa Công nghệ thông tin", shortName: "Khoa CNTT" };
    for (const category of ["Kết luận", "Nghị định", "Thông tư", "Phiếu trình", "Hợp đồng lao động", "Khác"]) {
      assert.equal(OUTGOING_TYPE_ABBREVIATIONS[category], undefined, category);
      assert.equal(deriveOutgoingNotation({ category, unit }), "CĐKTCNQN-CNTT", category);
    }
  });

  it("đơn vị cấp trường hoặc không rõ đơn vị: chỉ có viết tắt cơ quan", () => {
    assert.equal(deriveOutgoingNotation({ category: "Công văn", unit: { name: "Trường CĐ", isSchoolLevel: true } }), "CĐKTCNQN");
    assert.equal(deriveOutgoingNotation({ category: "Công văn" }), "CĐKTCNQN");
  });

  it("viết tắt đơn vị: shortName đã là chữ viết tắt thì giữ, bỏ & và -", () => {
    assert.equal(abbreviateUnitName("Phòng Quản lý Đào tạo", "Phòng QLĐT"), "QLĐT");
    assert.equal(abbreviateUnitName("Phòng Tài chính - Kế toán", "Phòng TCKT"), "TCKT");
    assert.equal(abbreviateUnitName("Phòng Tổ chức Hành chính - Quản trị", "Phòng TCHC-QT"), "TCHCQT");
    assert.equal(abbreviateUnitName("Phòng Khảo thí & Đảm bảo chất lượng", "Phòng KT&ĐBCL"), "KTĐBCL");
    assert.equal(abbreviateUnitName("Khoa Công nghệ thông tin", "Khoa CNTT"), "CNTT");
  });

  it("viết tắt đơn vị: shortName là tên thì lấy chữ cái đầu, giữ từ đã viết hoa, bỏ từ nối", () => {
    assert.equal(abbreviateUnitName("Khoa Cơ khí", "Khoa Cơ khí"), "CK");
    assert.equal(abbreviateUnitName("Khoa Điện - Điện tử", "Khoa Điện - Điện tử"), "ĐĐT");
    assert.equal(abbreviateUnitName("Khoa Khoa học cơ bản", "Khoa Khoa học cơ bản"), "KHCB");
    assert.equal(abbreviateUnitName("Trung tâm Ngoại ngữ - Tin học", "Trung tâm Ngoại ngữ - Tin học"), "NNTH");
    assert.equal(abbreviateUnitName("Trung tâm Tuyển sinh & Hợp tác việc làm", "Trung tâm Tuyển sinh & HTVL"), "TSHTVL");
    assert.equal(abbreviateUnitName("Trung tâm Số và Truyền thông", "TT Số & Truyền thông"), "STT");
  });

  it("viết tắt đơn vị: không có shortName thì lấy từ tên", () => {
    assert.equal(abbreviateUnitName("Phòng Quản lý Đào tạo"), "QLĐT");
    assert.equal(abbreviateUnitName("Phòng Tài chính - Kế toán", null), "TCKT");
  });
});

describe("Ký hiệu nhập tay (máy chủ và hộp Cấp số dùng chung)", () => {
  it("nhận chữ có dấu, số, dấu chấm và gạch ngang", () => {
    for (const ok of ["QĐ-CĐKTCNQN", "CĐKTCNQN-QLĐT", "TTr.2026", "BC", "128"]) {
      assert.equal(isValidOutgoingNotation(ok), true, ok);
    }
  });

  it("từ chối khoảng trắng, dấu gạch chéo, rỗng, ký tự đầu là dấu và quá dài", () => {
    for (const bad of ["abc xyz", "QĐ/CĐKTCNQN", "", "-QĐ", ".QĐ", "QĐ_CĐ", "a".repeat(101)]) {
      assert.equal(isValidOutgoingNotation(bad), false, JSON.stringify(bad));
    }
    assert.equal(isValidOutgoingNotation("a".repeat(100)), true);
  });
});
