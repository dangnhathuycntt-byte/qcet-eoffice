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
      assert.ok(typeof member.activeTaskCount === "number", "Staff should have activeTaskCount");

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

describe("OrganizationTree Anti-Slop & UI Quality Standards", () => {
  const orgTreePath = path.resolve(
    __dirname,
    "../src/components/org/organization-tree.tsx"
  );
  const orgPagePath = path.resolve(__dirname, "../src/app/org/page.tsx");

  test("zero decorative emojis in organization tree and org page source code", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

    const orgTreeContent = fs.readFileSync(orgTreePath, "utf-8");
    const orgTreeMatches = [...orgTreeContent.matchAll(emojiRegex)];
    assert.strictEqual(
      orgTreeMatches.length,
      0,
      `Found emojis in organization-tree.tsx: ${orgTreeMatches.map((m) => m[0]).join(", ")}`
    );

    const orgPageContent = fs.readFileSync(orgPagePath, "utf-8");
    const orgPageMatches = [...orgPageContent.matchAll(emojiRegex)];
    assert.strictEqual(
      orgPageMatches.length,
      0,
      `Found emojis in org/page.tsx: ${orgPageMatches.map((m) => m[0]).join(", ")}`
    );
  });

  test("implements thin tree connector guide lines with border-border/60", () => {
    const content = fs.readFileSync(orgTreePath, "utf-8");
    assert.ok(
      content.includes("border-l border-border/60"),
      "Must implement thin hierarchy tree connector with border-l border-border/60"
    );
  });

  test("uses Lucide Building2, Briefcase, and GraduationCap with strokeWidth={1.5}", () => {
    const content = fs.readFileSync(orgTreePath, "utf-8");
    assert.ok(content.includes("Building2"), "Must use Building2 for BGH/organization");
    assert.ok(content.includes("Briefcase"), "Must use Briefcase for functional rooms/units");
    assert.ok(content.includes("GraduationCap"), "Must use GraduationCap for faculties");
    assert.ok(
      content.includes("strokeWidth={1.5}"),
      "Must standardize Lucide icons with strokeWidth={1.5}"
    );
  });

  test("staff cards format staff names with font-medium and tabular-nums", () => {
    const content = fs.readFileSync(orgTreePath, "utf-8");
    assert.ok(
      content.includes("font-medium text-foreground") ||
        content.includes("font-medium text-foreground truncate"),
      "Staff card must use font-medium for member name instead of heavy text"
    );
    assert.ok(
      content.includes("tabular-nums"),
      "Must use tabular-nums for phone numbers and counts"
    );
  });

  test("provides 1-click Giao việc quick action button with UserCheck or Send icon", () => {
    const content = fs.readFileSync(orgTreePath, "utf-8");
    assert.ok(
      content.includes("qcet:open-create-task"),
      "Must dispatch qcet:open-create-task event for 1-click task delegation"
    );
    assert.ok(
      content.includes("UserCheck") || content.includes("Send"),
      "Must use UserCheck or Send icon for quick task assignment"
    );
    assert.ok(
      content.includes("Giao việc"),
      "Must have Giao việc button text"
    );
  });
});
