import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { QCET_DEPARTMENT_GROUPS, getDepartmentByCode } from "@/lib/departments";
import { triggerHaptic, isHapticSupported, isHapticsEnabled, setHapticsEnabled } from "@/lib/haptics";
import { isSchoolTask } from "@/types/dashboard";
import type { DepartmentPersonnel, DepartmentPersonnelGroup } from "@/types/dashboard";

describe("PWA Foundation, Departments & Haptics Suite", () => {
  test("QCET_DEPARTMENT_GROUPS contains valid school and unit departments", () => {
    assert.ok(Array.isArray(QCET_DEPARTMENT_GROUPS));
    assert.ok(QCET_DEPARTMENT_GROUPS.length >= 6);
    const bgh = QCET_DEPARTMENT_GROUPS.find((g) => g.id === "bgh");
    assert.ok(bgh);
    assert.strictEqual(bgh.name, "Ban Giám hiệu");
  });

  test("getDepartmentByCode resolves department personnel metadata case-insensitively", () => {
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

  test("Department types are properly accessible from @/types/dashboard", () => {
    const sampleGroup: DepartmentPersonnelGroup = QCET_DEPARTMENT_GROUPS[0];
    assert.ok(sampleGroup);
    const samplePerson: DepartmentPersonnel = sampleGroup.personnel[0];
    assert.ok(samplePerson);
    assert.ok(typeof samplePerson.name === "string");
  });

  test("user-profile-modal does not import create-task-modal (bundle leak fix)", () => {
    const userProfileModalPath = path.resolve(__dirname, "../src/components/auth/user-profile-modal.tsx");
    const content = fs.readFileSync(userProfileModalPath, "utf-8");
    assert.strictEqual(
      content.includes("@/components/dashboard/create-task-modal"),
      false,
      "user-profile-modal.tsx should not import from create-task-modal.tsx"
    );
  });

  test("next.config.ts configures optimizePackageImports for bundle size reduction", async () => {
    const nextConfigPath = path.resolve(__dirname, "../next.config.ts");
    const content = fs.readFileSync(nextConfigPath, "utf-8");
    assert.ok(content.includes("optimizePackageImports"), "next.config.ts should include optimizePackageImports");
    assert.ok(content.includes("lucide-react"), "optimizePackageImports should include lucide-react");
  });
});
