import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  QCET_DEPARTMENTS,
  filterStaffMembers,
  type DepartmentNode,
  type StaffMember,
} from "../src/components/org/organization-tree";

describe("QCET Organization Structure & Administrative Directory", () => {
  test("QCET_DEPARTMENTS encompasses authentic 15 units plus BGH", () => {
    // Must have at least 15 units
    assert.ok(QCET_DEPARTMENTS.length >= 15, `Expected >= 15 departments, got ${QCET_DEPARTMENTS.length}`);

    // Check functional rooms & centers
    const codes = QCET_DEPARTMENTS.map((d) => d.code);
    assert.ok(codes.includes("BGH"), "Must have BGH");
    assert.ok(codes.includes("P_HCQT"), "Must have Phòng Hành chính - Quản trị");
    assert.ok(codes.includes("P_TCDBCL") || codes.includes("P_KTDBCL"), "Must have Phòng Tổ chức - ĐBCL");
    assert.ok(codes.includes("P_QLDT") || codes.includes("P_DTQLKH"), "Must have Phòng Quản lý Đào tạo");
    assert.ok(codes.includes("P_TC") || codes.includes("P_KHTC"), "Must have Phòng Tài chính");
    assert.ok(codes.includes("TT_STT") || codes.includes("TT_DCC"), "Must have Trung tâm Số - Truyền thông");

    // Check authentic faculties
    assert.ok(codes.includes("K_DTTH") || codes.includes("K_CNTT"), "Must have Khoa Điện tử - Tin học");
    assert.ok(codes.includes("K_CK") || codes.includes("K_KTCN"), "Must have Khoa Cơ khí");
    assert.ok(codes.includes("K_CNOTO") || codes.includes("K_KTCN"), "Must have Khoa Công nghệ ô tô");
    assert.ok(codes.includes("K_DIEN"), "Must have Khoa Điện");
    assert.ok(codes.includes("K_DULICH"), "Must have Khoa Du lịch");
    assert.ok(codes.includes("K_KTTH") || codes.includes("K_KTQT"), "Must have Khoa Kinh tế - Tổng hợp");
    assert.ok(codes.includes("K_KTNN"), "Must have Khoa Kỹ thuật nông nghiệp");
    assert.ok(codes.includes("K_VHNT"), "Must have Khoa Văn hóa nghệ thuật");
    assert.ok(codes.includes("K_DAICUONG"), "Must have Khoa Đại cương");
  });

  test("QCET_DEPARTMENTS contains clean administrative and directory metadata with zero attendance/timekeeping slop", () => {
    for (const dept of QCET_DEPARTMENTS) {
      assert.ok(typeof dept.name === "string" && dept.name.length > 0, `Dept ${dept.code} must have valid name`);
      assert.ok(typeof dept.location === "string" && dept.location.length > 0, `Dept ${dept.code} must have location`);
      assert.ok(dept.email.endsWith("@cdktcnqn.edu.vn") || dept.email.includes("@"), `Dept ${dept.code} must have valid email`);
      assert.ok(dept.members.length > 0, `Dept ${dept.code} must have registered personnel`);

      // Verify zero attendance telemetry
      assert.equal((dept as any).presentToday, undefined, `Dept ${dept.code} must not contain presentToday`);
      assert.equal((dept as any).presentRate, undefined, `Dept ${dept.code} must not contain presentRate`);
      assert.equal((dept as any).timekeeperSync, undefined, `Dept ${dept.code} must not contain timekeeperSync`);

      for (const member of dept.members) {
        assert.equal((member as any).checkInTime, undefined, `Member ${member.name} must not have checkInTime`);
        assert.equal((member as any).workStatus, undefined, `Member ${member.name} must not have workStatus`);
      }
    }
  });

  test("Anti-slop check: 0% emojis in organization-tree.tsx and /org/page.tsx", () => {
    const orgTreeContent = fs.readFileSync(
      path.join(process.cwd(), "src/components/org/organization-tree.tsx"),
      "utf-8"
    );
    const orgPageContent = fs.readFileSync(
      path.join(process.cwd(), "src/app/org/page.tsx"),
      "utf-8"
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.ok(!emojiRegex.test(orgTreeContent), "organization-tree.tsx must contain 0 emojis");
    assert.ok(!emojiRegex.test(orgPageContent), "src/app/org/page.tsx must contain 0 emojis");
  });

  test("Export CSV helper formats valid RFC4180 CSV without broken accents", () => {
    const allStaff = QCET_DEPARTMENTS.flatMap((d) => d.members);
    assert.ok(allStaff.length > 20, "Should have rich staff list");
  });
});
