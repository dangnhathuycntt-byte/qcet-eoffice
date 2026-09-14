import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  QCET_DEPARTMENTS,
  filterStaffMembers,
  type DepartmentNode,
  type StaffMember,
} from "../src/components/org/organization-tree";

describe("OrganizationTree Helpers", () => {
  test("QCET_DEPARTMENTS contains BGH, Functional Rooms, Faculties, and Centers", () => {
    assert.ok(QCET_DEPARTMENTS.length >= 4);
    const bgh = QCET_DEPARTMENTS.find((d) => d.code === "BGH");
    assert.ok(bgh);
    assert.ok(bgh!.members.length > 0);

    // Verify groups/categories
    const categories = new Set(QCET_DEPARTMENTS.map((d) => d.category));
    assert.ok(categories.has("BGH"));
    assert.ok(categories.has("PHONG_CHUC_NANG"));
    assert.ok(categories.has("KHOA_CHUYEN_MON"));
    assert.ok(categories.has("TRUNG_TAM"));
  });

  test("QCET_DEPARTMENTS includes all authentic QCET units", () => {
    const codes = QCET_DEPARTMENTS.map((d) => d.code);
    // Functional rooms
    assert.ok(codes.includes("P_QLDT") || codes.includes("P_DTQLKH"), "Phòng Quản lý Đào tạo should exist");
    assert.ok(codes.includes("P_HCQT"), "Phòng Hành chính - Quản trị should exist");
    assert.ok(codes.includes("P_TC") || codes.includes("P_KHTC"), "Phòng Tài chính should exist");
    assert.ok(codes.includes("P_TCDBCL") || codes.includes("P_KTDBCL"), "Phòng Tổ chức - ĐBCL should exist");
    assert.ok(codes.includes("P_TSHTQT") || codes.includes("P_CTHSSV"), "Phòng Tuyển sinh - HTQT should exist");

    // Faculties
    assert.ok(codes.includes("K_CNTT"), "Khoa Điện tử - Tin học / CNTT should exist");
    assert.ok(codes.includes("K_KTQT"), "Khoa Kinh tế - Tổng hợp should exist");
    assert.ok(codes.includes("K_CNOTO") || codes.includes("K_KTCN"), "Khoa Công nghệ Ô tô should exist");

    // Centers
    assert.ok(codes.includes("TT_STT") || codes.includes("TT_DCC"), "Trung tâm Số - Truyền thông should exist");
    assert.ok(codes.includes("TT_NNTH"), "Trung tâm Ngoại ngữ - Tin học should exist");
  });

  test("QCET_DEPARTMENTS includes all key personnel from earlier tasks", () => {
    const allStaff: StaffMember[] = QCET_DEPARTMENTS.flatMap((d) => d.members);
    const staffNames = allStaff.map((s) => s.name);

    assert.ok(staffNames.includes("Trần Hùng"), "Trần Hùng should exist");
    assert.ok(staffNames.includes("Nguyễn Ngọc Vinh"), "Nguyễn Ngọc Vinh should exist");
    assert.ok(staffNames.includes("Mai Đinh Thị Xuân"), "Mai Đinh Thị Xuân should exist");
    assert.ok(staffNames.includes("Lê Hoàng Nam"), "Lê Hoàng Nam should exist");
    assert.ok(staffNames.includes("Phạm Thị Thu"), "Phạm Thị Thu should exist");
    assert.ok(staffNames.includes("Đặng Văn Hậu"), "Đặng Văn Hậu should exist");
    assert.ok(staffNames.includes("Võ Minh Trí"), "Võ Minh Trí should exist");
  });

  test("filterStaffMembers searches by name, email, and department", () => {
    // Search by full name
    const resultsName = filterStaffMembers(QCET_DEPARTMENTS, "Trần Hùng");
    assert.ok(resultsName.length >= 1);
    assert.equal(resultsName[0].name, "Trần Hùng");

    // Search case-insensitive and partial
    const resultsPartial = filterStaffMembers(QCET_DEPARTMENTS, "ngọc vinh");
    assert.ok(resultsPartial.length >= 1);
    assert.equal(resultsPartial[0].name, "Nguyễn Ngọc Vinh");

    // Search by email
    const resultsEmail = filterStaffMembers(QCET_DEPARTMENTS, "@qcet.edu.vn");
    assert.ok(resultsEmail.length >= 7);

    // Search by department name
    const resultsDept = filterStaffMembers(QCET_DEPARTMENTS, "Công nghệ thông tin");
    assert.ok(resultsDept.length >= 1);

    // Empty query returns all staff
    const allStaff = QCET_DEPARTMENTS.flatMap((d) => d.members);
    const resultsEmpty = filterStaffMembers(QCET_DEPARTMENTS, "");
    assert.equal(resultsEmpty.length, allStaff.length);
  });

  test("Each StaffMember has required directory properties and clean academic title prefixes", () => {
    const allStaff = QCET_DEPARTMENTS.flatMap((d) => d.members);
    for (const member of allStaff) {
      assert.ok(member.id, "Staff should have id");
      assert.ok(member.name, "Staff should have name");
      assert.ok(member.role, "Staff should have role");
      assert.ok(member.email, "Staff should have email");
      assert.ok(member.departmentName, "Staff should have departmentName");
      assert.ok(member.avatar, "Staff should have avatar");
      // T61: the directory carries no fabricated per-person task counts — only
      // counts the payload actually holds may be asserted here.

      // Verify academic titles if present are authentic QCET standards without emojis
      if (member.titlePrefix) {
        assert.match(
          member.titlePrefix,
          /^(TS\.|ThS\.|KS\.|CN\.|GVC\.)$/,
          `Title prefix ${member.titlePrefix} must follow official academic abbreviations`
        );
      }
    }
  });
});
