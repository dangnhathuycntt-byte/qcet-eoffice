import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { resolveDepartmentId, QCET_DEPARTMENT_DEFINITIONS } from "../src/lib/executive-matrix-aggregator";
import { QCET_ORG_UNITS } from "../src/lib/org/org-structure";

describe("QCET Department Resolution & Consistency Suite", () => {
  test("resolveDepartmentId maps both canonical and legacy kebab-case department IDs for CNTT", () => {
    assert.strictEqual(resolveDepartmentId("K_CNTT"), "CNTT");
    assert.strictEqual(resolveDepartmentId("khoa-cntt"), "CNTT");
    assert.strictEqual(resolveDepartmentId("dept-k-cntt"), "CNTT");
    assert.strictEqual(resolveDepartmentId("Khoa Công nghệ thông tin"), "CNTT");
  });

  test("resolveDepartmentId maps legacy and canonical codes for Dao Tao", () => {
    assert.strictEqual(resolveDepartmentId("P_QLDT"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId("phong-dao-tao"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId("dept-p-qldt"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId("P_DTQLKH"), "DAO_TAO");
  });

  test("QCET_ORG_UNITS defines 17 total units (1 BGH + 16 subordinate units)", () => {
    const bgh = QCET_ORG_UNITS.filter((d) => d.code === "BGH" || d.category === "BGH");
    const subordinateUnits = QCET_ORG_UNITS.filter((d) => d.code !== "BGH" && d.category !== "BGH");
    assert.strictEqual(bgh.length, 1, "Must have exactly 1 BGH unit");
    assert.strictEqual(subordinateUnits.length, 16, "Must have exactly 16 subordinate operational units");
  });
});
