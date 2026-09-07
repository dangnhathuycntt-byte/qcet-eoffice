import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateOnboardingProgress,
  getRoleTourSteps,
  getRoleChecklist,
} from "../src/lib/onboarding-constants";

test("calculateOnboardingProgress calculates correct endowed progress percentage", () => {
  // Endowed initial state: 1 step completed out of 4 (25%)
  const progress1 = calculateOnboardingProgress(["step-profile"]);
  assert.equal(progress1.completedCount, 1);
  assert.equal(progress1.totalCount, 4);
  assert.equal(progress1.percentage, 25);
  assert.equal(progress1.isCompleted, false);

  // Default call with no args should guarantee step-profile (25%)
  const progressDefault = calculateOnboardingProgress();
  assert.equal(progressDefault.completedCount, 1);
  assert.equal(progressDefault.percentage, 25);

  // 2 steps completed (50%)
  const progress2 = calculateOnboardingProgress(["step-profile", "step-push"]);
  assert.equal(progress2.completedCount, 2);
  assert.equal(progress2.percentage, 50);

  // All 4 steps completed (100%)
  const progress4 = calculateOnboardingProgress([
    "step-profile",
    "step-push",
    "step-action",
    "step-search",
  ]);
  assert.equal(progress4.completedCount, 4);
  assert.equal(progress4.percentage, 100);
  assert.equal(progress4.isCompleted, true);
});

test("getRoleTourSteps returns 3 distinct steps for each role", () => {
  const bghSteps = getRoleTourSteps("ADMIN", "BAN_GIAM_HIEU");
  assert.equal(bghSteps.length, 3);
  assert.equal(bghSteps[0].targetSelector, "#tour-scope-switcher");

  const managerSteps = getRoleTourSteps("MANAGER", "TRUONG_PHONG");
  assert.equal(managerSteps.length, 3);
  assert.equal(managerSteps[0].targetSelector, "#tour-scope-switcher");

  const vtSteps = getRoleTourSteps("STAFF", "VAN_THU");
  assert.equal(vtSteps.length, 3);
  assert.equal(vtSteps[0].targetSelector, "#tour-nav-documents");

  const staffSteps = getRoleTourSteps("STAFF", "CHUYEN_VIEN");
  assert.equal(staffSteps.length, 3);
  assert.equal(staffSteps[0].targetSelector, "#tour-tasks-landing");
});

test("getRoleChecklist returns 4 tasks with tailored action title per role", () => {
  const bghChecklist = getRoleChecklist("ADMIN", "BAN_GIAM_HIEU");
  assert.equal(bghChecklist.length, 4);
  assert.equal(bghChecklist[0].id, "step-profile");
  assert.equal(bghChecklist[1].id, "step-push");
  assert.equal(bghChecklist[2].id, "step-action");
  assert.equal(bghChecklist[2].title, "Kiểm tra Radar điểm nghẽn đơn vị");
  assert.equal(bghChecklist[3].id, "step-search");

  const managerChecklist = getRoleChecklist("MANAGER", "TRUONG_PHONG");
  assert.equal(managerChecklist[2].title, "Phân công hoặc duyệt việc đầu tiên");

  const vtChecklist = getRoleChecklist("STAFF", "VAN_THU");
  assert.equal(vtChecklist[2].title, "Kiểm tra Sổ văn bản đến NĐ 30");

  const staffChecklist = getRoleChecklist("STAFF", "CHUYEN_VIEN");
  assert.equal(staffChecklist[2].title, "Nộp minh chứng hoặc tạo tờ trình");
});
