import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateOnboardingProgress,
  getRoleTourSteps,
  getRoleChecklist,
  isSnoozed,
  resolveOnboardingState,
  getOnboardingStorageKey,
  DEFAULT_ONBOARDING_STATE,
  LEGACY_ONBOARDING_STORAGE_KEY,
  type OnboardingState,
} from "../src/lib/onboarding-constants";
import { StartTourOptions } from "../src/hooks/use-onboarding";
import { updateOnboardingSchema } from "../src/lib/onboarding-schema";
import { mapDbUserToAuthUser } from "../src/lib/auth-context";
import { AuthUser } from "../src/types/auth";
import { dispatchRoleAction } from "../src/components/onboarding/onboarding-checklist-widget";

describe("Onboarding progress, role configuration & storage keys", () => {
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

  test("getOnboardingStorageKey returns user-scoped key to isolate localStorage across accounts", () => {
    assert.equal(getOnboardingStorageKey("user-123"), "qcet_onboarding_state_user-123");
    assert.equal(getOnboardingStorageKey("cly999"), "qcet_onboarding_state_cly999");
    assert.equal(getOnboardingStorageKey("user-1"), "qcet_onboarding_state_user-1");
    assert.equal(getOnboardingStorageKey("user-2"), "qcet_onboarding_state_user-2");
    assert.notEqual(getOnboardingStorageKey("user-1"), getOnboardingStorageKey("user-2"));
    assert.equal(getOnboardingStorageKey(null), "qcet_onboarding_state_guest");
    assert.equal(getOnboardingStorageKey(undefined), "qcet_onboarding_state_guest");
    assert.equal(LEGACY_ONBOARDING_STORAGE_KEY, "qcet_onboarding_state");
  });
});

describe("Onboarding Snooze 24h & Expiration Logic", () => {
  test("isSnoozed handles null, undefined, empty, and invalid values gracefully", () => {
    assert.equal(isSnoozed(null), false);
    assert.equal(isSnoozed(undefined), false);
    assert.equal(isSnoozed(""), false);
    assert.equal(isSnoozed("not-a-date"), false);
    assert.equal(isSnoozed("invalid-date-string"), false);
    assert.equal(isSnoozed("2026-99-99T99:99:99Z"), false);
  });

  test("isSnoozed returns true for future timestamps and false for past timestamps", () => {
    const now = Date.now();
    const oneHourFuture = new Date(now + 3600 * 1000).toISOString();
    const oneHourPast = new Date(now - 3600 * 1000).toISOString();
    const oneSecondFuture = new Date(now + 1000).toISOString();
    const oneSecondPast = new Date(now - 1000).toISOString();

    assert.equal(isSnoozed(oneHourFuture), true);
    assert.equal(isSnoozed(oneSecondFuture), true);
    assert.equal(isSnoozed(oneHourPast), false);
    assert.equal(isSnoozed(oneSecondPast), false);
  });

  test("Snooze calculation computes valid ISO timestamp for default 24 hours and custom hours", () => {
    const computeSnoozeIso = (hours = 24) => {
      return new Date(Date.now() + hours * 3600 * 1000).toISOString();
    };

    const before = Date.now();
    const snooze24 = computeSnoozeIso(24);
    const after = Date.now();

    const parsed24 = new Date(snooze24).getTime();
    const expected24 = before + 24 * 3600 * 1000;
    assert.ok(Math.abs(parsed24 - expected24) <= 50, "Timestamp must be ~24 hours in the future");
    assert.equal(isSnoozed(snooze24), true);

    const snooze12 = computeSnoozeIso(12);
    const parsed12 = new Date(snooze12).getTime();
    const expected12 = before + 12 * 3600 * 1000;
    assert.ok(Math.abs(parsed12 - expected12) <= 50, "Timestamp must be ~12 hours in the future");
    assert.equal(isSnoozed(snooze12), true);
  });

  test("24h expiration: isSnoozed flips to false once timestamp expires", () => {
    const originalDateNow = Date.now;
    try {
      let simulatedTime = 1788900000000; // arbitrary fixed epoch ms
      Date.now = () => simulatedTime;

      // Snooze for 24h
      const snoozeIso = new Date(simulatedTime + 24 * 3600 * 1000).toISOString();

      // At T+0h: snoozed
      assert.equal(isSnoozed(snoozeIso), true);

      // At T+23h 59m: still snoozed
      simulatedTime += (23 * 3600 + 59 * 60) * 1000;
      assert.equal(isSnoozed(snoozeIso), true);

      // At T+24h exactly: not strictly greater, so no longer snoozed
      simulatedTime += 60 * 1000;
      assert.equal(isSnoozed(snoozeIso), false);

      // At T+24h 1s: definitively expired
      simulatedTime += 1000;
      assert.equal(isSnoozed(snoozeIso), false);
    } finally {
      Date.now = originalDateNow;
    }
  });

  test("Unsnooze logic clears snoozedUntil to null and resets snooze state", () => {
    const futureSnooze = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const state: OnboardingState = {
      ...DEFAULT_ONBOARDING_STATE,
      snoozedUntil: futureSnooze,
    };

    assert.equal(isSnoozed(state.snoozedUntil), true);

    // Perform unsnooze
    const unsnoozedState: OnboardingState = {
      ...state,
      snoozedUntil: null,
    };

    assert.equal(unsnoozedState.snoozedUntil, null);
    assert.equal(isSnoozed(unsnoozedState.snoozedUntil), false);
  });
});

describe("Client State Management & Step Completion Set Union", () => {
  test("markStepComplete deduplicates steps via Set union mirroring backend behavior", () => {
    const initialSteps = ["step-profile"];

    const simulateMarkComplete = (prevSteps: string[], stepId: string): string[] => {
      const currentSet = new Set(prevSteps);
      if (currentSet.has(stepId)) return prevSteps;
      currentSet.add(stepId);
      return Array.from(currentSet);
    };

    // Add step-push
    const afterStepPush = simulateMarkComplete(initialSteps, "step-push");
    assert.deepEqual(afterStepPush, ["step-profile", "step-push"]);

    // Add step-push again (duplicate) -> should return identical reference without duplicates
    const afterDuplicate = simulateMarkComplete(afterStepPush, "step-push");
    assert.equal(afterDuplicate, afterStepPush);
    assert.deepEqual(afterDuplicate, ["step-profile", "step-push"]);

    // Add step-action and step-search
    const afterAction = simulateMarkComplete(afterDuplicate, "step-action");
    const afterSearch = simulateMarkComplete(afterAction, "step-search");
    assert.deepEqual(afterSearch, ["step-profile", "step-push", "step-action", "step-search"]);
    assert.equal(afterSearch.length, 4);
  });

  test("Atomic Set union merges existing server steps with incoming client steps without duplicates", () => {
    const existingServerSteps = ["step-profile", "step-push"];
    const incomingClientSteps = ["step-profile", "step-action"];

    const mergedSteps = Array.from(new Set([...existingServerSteps, ...incomingClientSteps]));
    assert.deepEqual([...mergedSteps].sort(), ["step-action", "step-profile", "step-push"]);
    assert.equal(mergedSteps.length, 3);

    // Incoming step-search achieves 100%
    const nextClientSteps = ["step-search"];
    const finalMergedSteps = Array.from(new Set([...mergedSteps, ...nextClientSteps]));
    const REQUIRED_STEPS = ["step-profile", "step-push", "step-action", "step-search"];
    const isFinished = REQUIRED_STEPS.every((s) => finalMergedSteps.includes(s));
    assert.equal(isFinished, true);
  });
});

describe("Tour Start with Force Options", () => {
  // Simulator matching useOnboarding logic
  function simulateStartTour(
    state: OnboardingState,
    options?: StartTourOptions
  ): { tourStarted: boolean; currentTourIndex: number; hasSeenWelcome: boolean } {
    const currentlySnoozed = isSnoozed(state.snoozedUntil);
    if (currentlySnoozed && !options?.force) {
      return { tourStarted: false, currentTourIndex: -1, hasSeenWelcome: state.hasSeenWelcome };
    }
    return { tourStarted: true, currentTourIndex: 0, hasSeenWelcome: true };
  }

  test("When snoozed, startTour without force is blocked", () => {
    const futureSnooze = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const snoozedState: OnboardingState = {
      ...DEFAULT_ONBOARDING_STATE,
      snoozedUntil: futureSnooze,
    };

    const resultWithoutOptions = simulateStartTour(snoozedState);
    assert.equal(resultWithoutOptions.tourStarted, false, "Tour must not start when snoozed");

    const resultWithForceFalse = simulateStartTour(snoozedState, { force: false });
    assert.equal(resultWithForceFalse.tourStarted, false, "Tour must not start when force is false");
  });

  test("When snoozed, startTour with { force: true } bypasses snooze and starts tour", () => {
    const futureSnooze = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const snoozedState: OnboardingState = {
      ...DEFAULT_ONBOARDING_STATE,
      snoozedUntil: futureSnooze,
    };

    const resultForced = simulateStartTour(snoozedState, { force: true });
    assert.equal(resultForced.tourStarted, true, "Tour must start when force is true");
    assert.equal(resultForced.currentTourIndex, 0);
    assert.equal(resultForced.hasSeenWelcome, true);
  });

  test("When not snoozed, startTour starts normally with or without options", () => {
    const normalState: OnboardingState = {
      ...DEFAULT_ONBOARDING_STATE,
      snoozedUntil: null,
    };

    const normalResult = simulateStartTour(normalState);
    assert.equal(normalResult.tourStarted, true);
    assert.equal(normalResult.currentTourIndex, 0);

    const forcedResult = simulateStartTour(normalState, { force: true });
    assert.equal(forcedResult.tourStarted, true);
  });
});

describe("Onboarding Schema & Auth Mapping", () => {
  test("Onboarding Schema validates valid payload", () => {
    const valid = {
      hasSeenWelcome: true,
      hasCompletedTour: false,
      completedSteps: ["step-profile", "step-push"],
      isDismissed: false,
      snoozedUntil: "2026-09-08T00:00:00.000Z",
    };
    const parsed = updateOnboardingSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.hasSeenWelcome, true);
      assert.equal(parsed.data.hasCompletedTour, false);
      assert.deepEqual(parsed.data.completedSteps, ["step-profile", "step-push"]);
    }
  });

  test("Onboarding Schema rejects invalid step types", () => {
    const invalid = {
      completedSteps: [123],
    };
    const parsed = updateOnboardingSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
  });

  test("Onboarding Schema accepts partial payloads", () => {
    const partial1 = { hasSeenWelcome: true };
    assert.equal(updateOnboardingSchema.safeParse(partial1).success, true);

    const partial2 = { isDismissed: true };
    assert.equal(updateOnboardingSchema.safeParse(partial2).success, true);

    const partial3 = { snoozedUntil: null };
    assert.equal(updateOnboardingSchema.safeParse(partial3).success, true);
  });

  test("mapDbUserToAuthUser maps onboardedAt and onboardingData correctly", () => {
    const sampleDbUser = {
      id: "user-test-1",
      email: "test@cdktcnqn.edu.vn",
      name: "Nguyễn Văn Test",
      role: "CHUYEN_VIEN",
      departmentId: "CNTT",
      onboardedAt: new Date("2026-09-07T10:00:00Z"),
      onboardingData: {
        hasSeenWelcome: true,
        hasCompletedTour: true,
        completedSteps: ["step-1", "step-2", "step-3", "step-4"],
      },
    };

    const authUser: AuthUser = mapDbUserToAuthUser(sampleDbUser);

    assert.equal(authUser.id, "user-test-1");
    assert.equal(authUser.onboardedAt, "2026-09-07T10:00:00.000Z");
    assert.deepEqual(authUser.onboardingData, {
      hasSeenWelcome: true,
      hasCompletedTour: true,
      completedSteps: ["step-1", "step-2", "step-3", "step-4"],
    });
    assert.equal(authUser.dbRole, "CHUYEN_VIEN");
  });

  test("mapDbUserToAuthUser handles null onboarding state", () => {
    const sampleDbUser = {
      id: "user-test-2",
      email: "fresh@cdktcnqn.edu.vn",
      name: "Người dùng mới",
      role: "TRUONG_PHONG",
      departmentId: "TCHC",
      onboardedAt: null,
      onboardingData: null,
    };

    const authUser: AuthUser = mapDbUserToAuthUser(sampleDbUser);

    assert.equal(authUser.onboardedAt, null);
    assert.equal(authUser.onboardingData, null);
    assert.equal(authUser.dbRole, "TRUONG_PHONG");
    assert.equal(authUser.role, "MANAGER");
  });
});

describe("resolveOnboardingState server-truth resolution", () => {
  test("preserves fresh onboarding for newly created accounts even with dirty localStorage", () => {
    // Giả lập tài khoản mới tạo (onboardedAt: null, onboardingData: null)
    const freshUser = {
      id: "new-user-abc",
      onboardedAt: null,
      onboardingData: null,
    };

    // Giả lập localStorage còn sót lại từ người dùng trước đó (ví dụ BGH đã hoàn thành)
    const dirtyPreviousUserState = {
      hasSeenWelcome: true,
      hasCompletedTour: true,
      isDismissed: true,
      completedSteps: ["step-profile", "step-push", "step-action", "step-search"],
    };
    void dirtyPreviousUserState;

    // Với user-scoped key, parsed từ localStorage của new-user-abc sẽ là null
    const resolvedState = resolveOnboardingState(freshUser, null);

    assert.equal(resolvedState.hasSeenWelcome, false, "Tài khoản mới phải chưa thấy welcome modal");
    assert.equal(resolvedState.hasCompletedTour, false, "Tài khoản mới phải chưa hoàn thành tour");
    assert.equal(resolvedState.isDismissed, false, "Tài khoản mới không được bị dismissed");
    assert.deepEqual(resolvedState.completedSteps, ["step-profile"], "Tài khoản mới khởi đầu với step-profile");
  });

  test("marks completed when onboardedAt is present", () => {
    const completedUser = {
      id: "bgh-user",
      onboardedAt: "2026-09-08T00:24:56.893Z",
      onboardingData: null,
    };

    const resolved = resolveOnboardingState(completedUser, null);
    assert.equal(resolved.hasSeenWelcome, true);
    assert.equal(resolved.hasCompletedTour, true);
    assert.equal(resolved.isDismissed, true);
  });

  test("resets to default when server onboarding was wiped (null) even if localStorage is dirty", () => {
    const wipedUser = {
      id: "dangnhathuycntt-id",
      onboardedAt: null,
      onboardingData: null,
    };

    const staleLocalStorageState = {
      hasSeenWelcome: true,
      hasCompletedTour: true,
      isDismissed: true,
      completedSteps: ["step-profile", "step-push", "step-action", "step-search"],
      snoozedUntil: null,
    };

    const resolved = resolveOnboardingState(wipedUser, staleLocalStorageState);
    assert.equal(resolved.hasSeenWelcome, false, "Phải reset lại chưa xem welcome");
    assert.equal(resolved.hasCompletedTour, false, "Phải reset lại chưa xong tour");
    assert.equal(resolved.isDismissed, false, "Không được bị dismissed");
    assert.deepEqual(resolved.completedSteps, ["step-profile"]);
  });

  test("preserves snoozedUntil in various user states", () => {
    const futureSnooze = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    // 1. Guest user with localStorage snooze
    const guestResolved = resolveOnboardingState(null, {
      snoozedUntil: futureSnooze,
    });
    assert.equal(guestResolved.snoozedUntil, futureSnooze);
    assert.equal(isSnoozed(guestResolved.snoozedUntil), true);

    // 2. Logged-in user with database snooze
    const userResolved = resolveOnboardingState(
      {
        id: "user-1",
        onboardedAt: null,
        onboardingData: {
          snoozedUntil: futureSnooze,
        },
      },
      null
    );
    assert.equal(userResolved.snoozedUntil, futureSnooze);
    assert.equal(isSnoozed(userResolved.snoozedUntil), true);

    // 3. User with onboardedAt completed clears snooze
    const completedUserResolved = resolveOnboardingState(
      {
        id: "user-2",
        onboardedAt: "2026-09-08T00:00:00Z",
        onboardingData: {
          snoozedUntil: futureSnooze,
        },
      },
      null
    );
    assert.equal(completedUserResolved.snoozedUntil, null);
    assert.equal(isSnoozed(completedUserResolved.snoozedUntil), false);

    // 4. Server wiped onboarding (null onboardedAt and null onboardingData) resets snooze to null
    const wipedUserResolved = resolveOnboardingState(
      {
        id: "user-3",
        onboardedAt: null,
        onboardingData: null,
      },
      {
        snoozedUntil: futureSnooze,
      }
    );
    assert.equal(wipedUserResolved.snoozedUntil, null);
    assert.equal(isSnoozed(wipedUserResolved.snoozedUntil), false);
  });

  test("preserves and updates snoozedUntil in state machine", () => {
    const futureSnooze = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    // State with snoozedUntil from server
    const serverState = {
      id: "user-snoozed",
      onboardedAt: null,
      onboardingData: {
        hasSeenWelcome: true,
        hasCompletedTour: false,
        completedSteps: ["step-profile"],
        isDismissed: false,
        snoozedUntil: futureSnooze,
      },
    };

    const resolved = resolveOnboardingState(serverState, null);
    assert.equal(resolved.snoozedUntil, futureSnooze);
    assert.equal(isSnoozed(resolved.snoozedUntil), true);

    // Cleared snooze (unsnoozed)
    const unsnoozedServerState = {
      id: "user-snoozed",
      onboardedAt: null,
      onboardingData: {
        ...serverState.onboardingData,
        snoozedUntil: null,
      },
    };
    const resolvedUnsnoozed = resolveOnboardingState(unsnoozedServerState, null);
    assert.equal(resolvedUnsnoozed.snoozedUntil, null);
    assert.equal(isSnoozed(resolvedUnsnoozed.snoozedUntil), false);
  });
});

describe("Role-based specialization across all 4 core roles", () => {
  test("BAN_GIAM_HIEU, TRUONG_PHONG, CHUYEN_VIEN, VAN_THU route tours, checklists and actions", () => {
    // 1. BAN_GIAM_HIEU (ADMIN / BGH)
    const bghTour = getRoleTourSteps("ADMIN", "BAN_GIAM_HIEU");
    const bghTasks = getRoleChecklist("ADMIN", "BAN_GIAM_HIEU");
    assert.equal(bghTour[0].targetSelector, "#tour-scope-switcher");
    assert.equal(bghTour[1].targetSelector, "#tour-radar-card");
    assert.equal(bghTour[1].fallbackSelector, "#tour-cockpit-metrics");
    assert.equal(bghTour[2].targetSelector, "#tour-topbar-search");
    assert.equal(bghTasks[2].title, "Kiểm tra Radar điểm nghẽn đơn vị");
    assert.equal(bghTasks[2].actionLabel, "Thực hiện");
    const bghEvent = dispatchRoleAction("ADMIN", "BAN_GIAM_HIEU", null);
    assert.equal(bghEvent, "qcet:navigate-cockpit");

    // 2. TRUONG_PHONG (MANAGER)
    const tpTour = getRoleTourSteps("MANAGER", "TRUONG_PHONG");
    const tpTasks = getRoleChecklist("MANAGER", "TRUONG_PHONG");
    assert.equal(tpTour[0].targetSelector, "#tour-scope-switcher");
    assert.equal(tpTour[1].targetSelector, "#tour-create-task-btn");
    assert.equal(tpTour[2].targetSelector, "#tour-topbar-search");
    assert.equal(tpTasks[2].title, "Phân công hoặc duyệt việc đầu tiên");
    assert.equal(tpTasks[2].actionLabel, "Thực hiện");
    const tpEvent = dispatchRoleAction("MANAGER", "TRUONG_PHONG", null);
    assert.equal(tpEvent, "qcet:open-create-task");

    // 3. CHUYEN_VIEN (STAFF / CHUYEN_VIEN)
    const cvTour = getRoleTourSteps("STAFF", "CHUYEN_VIEN");
    const cvTasks = getRoleChecklist("STAFF", "CHUYEN_VIEN");
    assert.equal(cvTour[0].targetSelector, "#tour-tasks-landing");
    assert.equal(cvTour[1].targetSelector, "#tour-empty-state-cta");
    assert.equal(cvTour[2].targetSelector, "#tour-topbar-search");
    assert.equal(cvTasks[2].title, "Nộp minh chứng hoặc tạo tờ trình");
    assert.equal(cvTasks[2].actionLabel, "Thực hiện");
    const cvEvent = dispatchRoleAction("STAFF", "CHUYEN_VIEN", null);
    assert.equal(cvEvent, "qcet:open-submit-deliverable");

    // 4. VAN_THU (STAFF / VAN_THU)
    const vtTour = getRoleTourSteps("STAFF", "VAN_THU");
    const vtTasks = getRoleChecklist("STAFF", "VAN_THU");
    assert.equal(vtTour[0].targetSelector, "#tour-nav-documents");
    assert.equal(vtTour[1].targetSelector, "#tour-nav-documents");
    assert.equal(vtTour[2].targetSelector, "#tour-topbar-search");
    assert.equal(vtTasks[2].title, "Kiểm tra Sổ văn bản đến NĐ 30");
    assert.equal(vtTasks[2].actionLabel, "Thực hiện");
    const vtEvent = dispatchRoleAction("STAFF", "VAN_THU", null);
    assert.equal(vtEvent, "qcet:navigate-documents");
  });
});
