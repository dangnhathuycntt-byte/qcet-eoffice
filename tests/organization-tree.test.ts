import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterStaffMembers,
  buildDepartmentNodes,
  type DepartmentNode,
  type StaffMember,
} from "../src/components/org/organization-tree";
import { QCET_ORG_UNITS } from "../src/lib/org/org-structure";

describe("OrganizationTree Helpers", () => {
  test("QCET_ORG_UNITS contains BGH, Functional Rooms, Faculties, and Centers", () => {
    assert.ok(QCET_ORG_UNITS.length >= 4);
    const bgh = QCET_ORG_UNITS.find((d) => d.code === "BGH");
    assert.ok(bgh);

    // Verify groups/categories
    const categories = new Set(QCET_ORG_UNITS.map((d) => d.category));
    assert.ok(categories.has("BGH"));
    assert.ok(categories.has("PHONG_CHUC_NANG"));
    assert.ok(categories.has("KHOA_CHUYEN_MON"));
    assert.ok(categories.has("TRUNG_TAM"));
  });

  test("QCET_ORG_UNITS includes all authentic QCET units", () => {
    const codes = QCET_ORG_UNITS.map((d) => d.code);
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

  test("Each OrgUnitConfig has required directory metadata", () => {
    for (const unit of QCET_ORG_UNITS) {
      assert.ok(unit.id, "Unit should have id");
      assert.ok(unit.code, "Unit should have code");
      assert.ok(unit.name, "Unit should have name");
      assert.ok(unit.category, "Unit should have category");
      assert.ok(unit.categoryLabel, "Unit should have categoryLabel");
      assert.ok(unit.description, "Unit should have description");
      assert.ok(unit.location, "Unit should have location");
      assert.ok(unit.phone, "Unit should have phone");
      assert.ok(unit.email, "Unit should have email");
      assert.ok(
        unit.email.endsWith("@cdktcnqn.edu.vn"),
        `Email ${unit.email} must be @cdktcnqn.edu.vn domain`,
      );
    }
  });

  test("buildDepartmentNodes merges config with empty API data gracefully", () => {
    const nodes = buildDepartmentNodes(QCET_ORG_UNITS, []);
    assert.equal(nodes.length, QCET_ORG_UNITS.length);
    for (const node of nodes) {
      assert.ok(node.id);
      assert.ok(node.code);
      assert.ok(node.name);
      assert.ok(Array.isArray(node.members));
      assert.equal(typeof node.leaderName, "string");
      assert.equal(typeof node.leaderRole, "string");
    }
  });

  test("filterStaffMembers with empty departments returns empty", () => {
    const nodes = buildDepartmentNodes(QCET_ORG_UNITS, []);
    // No API data → no members
    const results = filterStaffMembers(nodes, "");
    // All members are empty since no API data
    assert.equal(results.length, 0);
  });
});
