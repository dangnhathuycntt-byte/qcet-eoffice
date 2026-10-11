import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { triggerHaptic, isHapticSupported, isHapticsEnabled } from "@/lib/haptics";
import { isSchoolTask } from "@/types/dashboard";

describe("Bundle Leak Prevention & Haptics Suite", () => {
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
});
