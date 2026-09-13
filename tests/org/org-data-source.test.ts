import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  QCET_DEPARTMENTS,
  filterStaffMembers,
} from "../../src/components/org/organization-tree";

const ORG_PAGE = "../../src/app/org/page.tsx";
const ORG_TREE = "../../src/components/org/organization-tree.tsx";
const ORG_MOBILE = "../../src/components/org/mobile-org-drilldown.tsx";

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf-8");

// ============================================================================
// T57 — Org data-source audit
// ============================================================================
// There is no client-facing organizational-units API; OrganizationalUnitService
// over Prisma OrganizationalUnit + UnitClosurePath is gated behind `org.manage`
// and is server-only. The directory dataset therefore lives in exactly one
// in-surface source — QCET_DEPARTMENTS — consumed by the page and rendered by
// OrganizationTree. These tests pin that single-source contract and prove the
// page fabricates no metric.

describe("Org data source audit (T57)", () => {
  test("page consumes the single in-surface dataset and re-declares none", () => {
    const src = readSource(ORG_PAGE);

    assert.ok(
      src.includes('from "@/components/org/organization-tree"'),
      "page must import the org surface module"
    );
    assert.ok(
      src.includes("QCET_DEPARTMENTS"),
      "page must consume QCET_DEPARTMENTS"
    );
    assert.equal(
      /(?:const|let|var)\s+QCET_DEPARTMENTS\b/.test(src),
      false,
      "page must not define a parallel org dataset"
    );
    assert.equal(
      /QCET_DEPARTMENTS\s*[:=]\s*\[/.test(src),
      false,
      "page must not re-declare the org dataset literal"
    );
    assert.ok(
      src.includes("OrganizationalUnitService"),
      "page must document why the server registry is not the browser data source"
    );
  });

  test("displayed counts derive from QCET_DEPARTMENTS, never a fabricated metric", () => {
    const src = readSource(ORG_PAGE);

    assert.ok(
      src.includes("QCET_DEPARTMENTS.length"),
      "unit count must derive from QCET_DEPARTMENTS.length"
    );
    assert.ok(
      /QCET_DEPARTMENTS\.reduce/.test(src),
      "personnel count must derive from the dataset"
    );
    assert.equal(
      src.includes("100%"),
      false,
      "no fabricated coverage metric may survive on the org surface (T61)"
    );
  });
});

// ============================================================================
// T56 / T60 / C7 — Primary surface + secondary-action discipline
// ============================================================================

describe("Org primary surface & secondary-action discipline (T56/T60/C7)", () => {
  test("directory/tree is the default view and the duplicate tree view is gone", () => {
    const src = readSource(ORG_TREE);

    assert.ok(
      /useState<"directory" \| "bento">\(\s*"directory"/.test(src),
      "OrganizationTree must default to the directory view"
    );
    assert.equal(
      src.includes('"directory" | "bento" | "tree"'),
      false,
      "the duplicated 'tree' tab rendering identical content must be removed"
    );
    assert.equal(
      src.includes('setActiveTab("tree")'),
      false,
      "no control may switch to the removed duplicate tree view"
    );
  });

  test("timeout-only fake refresh is removed from the whole org surface", () => {
    for (const file of [ORG_PAGE, ORG_TREE, ORG_MOBILE]) {
      const src = readSource(file);
      assert.equal(
        src.includes("setTimeout"),
        false,
        `${file} must not fake a server reload with a timeout`
      );
      assert.equal(
        src.includes("Làm mới"),
        false,
        `${file} must not expose a fake refresh control`
      );
    }
  });

  test("secondary controls (print/export) live in exactly one place", () => {
    const page = readSource(ORG_PAGE);
    const tree = readSource(ORG_TREE);

    // The tree owns the single secondary action group.
    assert.ok(tree.includes("exportDirectoryToCSV"), "tree must own CSV export");
    assert.ok(tree.includes("window.print"), "tree must own printing");

    // The page must not duplicate those controls.
    assert.equal(page.includes("window.print"), false, "page must not duplicate print");
    assert.equal(
      page.includes("exportDirectoryToCSV"),
      false,
      "page must not duplicate CSV export"
    );
    assert.equal(
      /Xuất\s*Excel/i.test(page),
      false,
      "page must not duplicate the Excel/CSV action"
    );
    assert.equal(page.includes("Printer"), false, "page must not import the print icon");
  });

  test("no hard-coded unit counts remain in the tree", () => {
    const src = readSource(ORG_TREE);

    for (const stale of [
      "(6 đơn vị)",
      "(9 đơn vị)",
      "(2 đơn vị)",
      "Cơ cấu 17 Đơn vị",
    ]) {
      assert.equal(src.includes(stale), false, `stale hard-coded label remains: ${stale}`);
    }
    assert.ok(
      src.includes("Cơ cấu {QCET_DEPARTMENTS.length} đơn vị QCET"),
      "the unit-count label must be derived from QCET_DEPARTMENTS.length"
    );
  });
});

// ============================================================================
// T59 — Logical-context preservation
// ============================================================================

describe("Org logical-context preservation (T59)", () => {
  test("desktop tree persists expand/search/view context", () => {
    const src = readSource(ORG_TREE);
    assert.ok(src.includes("sessionStorage"), "tree must persist logical context");
    assert.ok(src.includes("ORG_TREE_STATE_KEY"), "tree must use the persisted key");
    assert.ok(
      src.includes("expandedCategories"),
      "tree must persist expanded-category state"
    );
  });

  test("mobile drill-down persists its drill position", () => {
    const src = readSource(ORG_MOBILE);
    assert.ok(src.includes("sessionStorage"), "mobile drill-down must persist its position");
    assert.ok(
      src.includes("MOBILE_ORG_STATE_KEY"),
      "mobile drill-down must use the persisted key"
    );
  });
});

// ============================================================================
// T58 — Search-first lookup (person / unit / role / contact)
// ============================================================================

describe("Org search-first lookup (T58)", () => {
  test("search resolves person, role, unit and contact fields", () => {
    // Person
    const byPerson = filterStaffMembers(QCET_DEPARTMENTS, "Nguyễn Ngọc Vinh");
    assert.ok(byPerson.length >= 1, "must find a person by name");

    // Role
    const byRole = filterStaffMembers(QCET_DEPARTMENTS, "Trưởng khoa");
    assert.ok(byRole.length >= 1, "must find personnel by role");
    assert.ok(
      byRole.every((m) => m.role.toLowerCase().includes("trưởng khoa")),
      "role search must only return matching roles"
    );

    // Unit
    const byUnit = filterStaffMembers(QCET_DEPARTMENTS, "Khoa Điện");
    assert.ok(byUnit.length >= 1, "must surface a unit's personnel by unit name");
    assert.ok(
      byUnit.every((m) => m.departmentName.toLowerCase().includes("khoa điện")),
      "unit search must only return personnel of the matching unit"
    );

    // Contact — phone
    const byPhone = filterStaffMembers(QCET_DEPARTMENTS, "0908");
    assert.ok(byPhone.length >= 1, "must find personnel by phone digits");

    // Contact — email domain returns the full deduped roster
    const allStaff = QCET_DEPARTMENTS.flatMap((d) => d.members);
    const byDomain = filterStaffMembers(QCET_DEPARTMENTS, "@cdktcnqn.edu.vn");
    assert.equal(byDomain.length, allStaff.length, "domain search must find the whole roster");
  });
});
