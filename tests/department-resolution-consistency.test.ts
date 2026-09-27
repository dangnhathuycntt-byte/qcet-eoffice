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

  test("resolveDepartmentId handles object arguments safely without deptCodeOrName.trim errors", () => {
    // 1. Department DTO object shapes
    assert.strictEqual(
      resolveDepartmentId({ id: "dept-k-cntt", code: "K_CNTT", name: "Khoa Công nghệ thông tin" }),
      "CNTT"
    );
    assert.strictEqual(
      resolveDepartmentId({ code: "P_DTQLKH" }),
      "DAO_TAO"
    );
    assert.strictEqual(
      resolveDepartmentId({ name: "Khoa Kinh tế - Quản trị" }),
      "KINH_TE"
    );
    assert.strictEqual(
      resolveDepartmentId({ departmentCode: "P_KHTC" }),
      "TAI_CHINH"
    );
    assert.strictEqual(
      resolveDepartmentId({ leadDepartmentCode: "K_KTCN" }),
      "KY_THUAT"
    );

    // 2. Non-string, null, undefined, empty object edge cases
    assert.strictEqual(resolveDepartmentId(null), null);
    assert.strictEqual(resolveDepartmentId(undefined), null);
    assert.strictEqual(resolveDepartmentId({} as any), null);
    assert.strictEqual(resolveDepartmentId(123 as any), null);
    assert.strictEqual(resolveDepartmentId(true as any), null);

    // 3. Person object resolution
    assert.strictEqual(
      resolveDepartmentId(undefined, { name: "TS. Nguyễn Ngọc Vinh" }),
      "CNTT"
    );
    assert.strictEqual(
      resolveDepartmentId(undefined, { userName: "Đỗ Quang Trung" }),
      "DAO_TAO"
    );
    assert.strictEqual(
      resolveDepartmentId(undefined, 456 as any),
      null
    );
  });
});
