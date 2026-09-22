import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { QCET_ORG_UNITS } from "../src/lib/org/org-structure";

describe("QCET Organization Structure & Administrative Directory", () => {
  test("QCET_ORG_UNITS encompasses authentic 15 units plus BGH", () => {
    // Must have at least 15 units
    assert.ok(QCET_ORG_UNITS.length >= 15, `Expected >= 15 departments, got ${QCET_ORG_UNITS.length}`);

    // Check functional rooms & centers
    const codes = QCET_ORG_UNITS.map((d) => d.code);
    assert.ok(codes.includes("BGH"), "Must have BGH");
    assert.ok(codes.includes("P_HCQT"), "Must have Phòng Hành chính - Quản trị");
    assert.ok(codes.includes("P_TCDBCL") || codes.includes("P_KTDBCL"), "Must have Phòng Tổ chức - ĐBCL");
    assert.ok(codes.includes("P_QLDT") || codes.includes("P_DTQLKH"), "Must have Phòng Quản lý Đào tạo");
    assert.ok(codes.includes("P_TC") || codes.includes("P_KHTC"), "Must have Phòng Tài chính");
    assert.ok(codes.includes("TT_STT") || codes.includes("TT_DCC"), "Must have Trung tâm Số - Truyền thông");

    // Check authentic faculties
    assert.ok(codes.includes("K_CNTT"), "Must have Khoa Điện tử - Tin học");
    assert.ok(codes.includes("K_CK"), "Must have Khoa Cơ khí");
    assert.ok(codes.includes("K_CNOTO"), "Must have Khoa Công nghệ ô tô");
    assert.ok(codes.includes("K_DIEN"), "Must have Khoa Điện");
    assert.ok(codes.includes("K_DULICH"), "Must have Khoa Du lịch");
    assert.ok(codes.includes("K_KTQT"), "Must have Khoa Kinh tế - Tổng hợp");
    assert.ok(codes.includes("K_KTNN"), "Must have Khoa Kỹ thuật nông nghiệp");
    assert.ok(codes.includes("K_VHNT"), "Must have Khoa Văn hóa nghệ thuật");
    assert.ok(codes.includes("K_DAICUONG"), "Must have Khoa Đại cương");
  });

  test("QCET_ORG_UNITS contains clean administrative and directory metadata", () => {
    for (const unit of QCET_ORG_UNITS) {
      assert.ok(typeof unit.name === "string" && unit.name.length > 0, `Unit ${unit.code} must have valid name`);
      assert.ok(typeof unit.location === "string" && unit.location.length > 0, `Unit ${unit.code} must have location`);
      assert.ok(unit.email.endsWith("@cdktcnqn.edu.vn") || unit.email.includes("@"), `Unit ${unit.code} must have valid email`);

      // Verify zero attendance telemetry
      assert.equal((unit as any).presentToday, undefined, `Unit ${unit.code} must not contain presentToday`);
      assert.equal((unit as any).presentRate, undefined, `Unit ${unit.code} must not contain presentRate`);
      assert.equal((unit as any).timekeeperSync, undefined, `Unit ${unit.code} must not contain timekeeperSync`);
    }
  });
});
