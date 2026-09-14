import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { QCET_DEPARTMENT_GROUPS, getDepartmentByCode } from "@/lib/departments";
import { triggerHaptic, isHapticSupported, isHapticsEnabled, setHapticsEnabled } from "@/lib/haptics";
import { isSchoolTask } from "@/types/dashboard";

describe("Bundle Leak Prevention & Haptics Suite", () => {
  test("QCET_DEPARTMENT_GROUPS contains valid school and unit departments", () => {
    assert.ok(Array.isArray(QCET_DEPARTMENT_GROUPS));
    assert.ok(QCET_DEPARTMENT_GROUPS.length >= 6);
    const bgh = QCET_DEPARTMENT_GROUPS.find((g) => g.id === "bgh");
    assert.ok(bgh);
    assert.strictEqual(bgh.name, "Ban Giám hiệu");
  });

  test("getDepartmentByCode resolves department personnel metadata (case-insensitive)", () => {
    const deptUpper = getDepartmentByCode("CNTT");
    assert.ok(deptUpper);
    assert.ok(deptUpper.code === "K_CNTT" || deptUpper.code === "CNTT");
    assert.ok(deptUpper.personnel.length > 0);

    const deptLower = getDepartmentByCode("cntt");
    assert.ok(deptLower);
    assert.ok(deptLower.code === "K_CNTT" || deptLower.code === "CNTT");
  });

  test("isSchoolTask correctly identifies school vs unit task objects", () => {
    const mockSchoolTask = {
      id: "st-1",
      taskCode: "DA-2026-01",
      title: "Ke hoach chien luoc",
      subTasks: [],
    };
    const mockUnitTask = {
      id: "ut-1",
      title: "Hop khoa dinh ky",
      unitCode: "CNTT",
    };
    assert.strictEqual(isSchoolTask(mockSchoolTask), true);
    assert.strictEqual(isSchoolTask(mockUnitTask), false);
    assert.strictEqual(isSchoolTask(null), false);
    assert.strictEqual(isSchoolTask(undefined), false);
  });

  test("Haptics trigger runs safely in Node/SSR environment without throwing", () => {
    assert.strictEqual(isHapticSupported(), false);
    assert.strictEqual(isHapticsEnabled(), false);
    setHapticsEnabled(true);
    const result = triggerHaptic("light");
    assert.strictEqual(result, false);
  });
});
