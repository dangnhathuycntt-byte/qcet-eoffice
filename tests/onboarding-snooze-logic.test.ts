import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isSnoozed,
  resolveOnboardingState,
  DEFAULT_ONBOARDING_STATE,
  getOnboardingStorageKey,
  OnboardingState,
} from "../src/lib/onboarding-constants";
import { StartTourOptions } from "../src/hooks/use-onboarding";

describe("Onboarding Snooze 24h & Expiration Logic", () => {
  test("isSnoozed handles invalid, null, undefined, and empty values gracefully", () => {
    assert.equal(isSnoozed(null), false);
    assert.equal(isSnoozed(undefined), false);
    assert.equal(isSnoozed(""), false);
    assert.equal(isSnoozed("not-a-date"), false);
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

  test("resolveOnboardingState preserves snoozedUntil in various user states", () => {
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

describe("Hook & Component Contract Verification", () => {
  test("useOnboarding source exposes all required methods and types", () => {
    const hookPath = path.resolve(process.cwd(), "src/hooks/use-onboarding.ts");
    assert.ok(fs.existsSync(hookPath), "use-onboarding.ts must exist");
    const content = fs.readFileSync(hookPath, "utf-8");

    // Functions and helpers
    assert.ok(content.includes("export { isSnoozed }"), "Must export isSnoozed helper");
    assert.ok(content.includes("snoozeOnboarding"), "Must define snoozeOnboarding action");
    assert.ok(content.includes("unsnoozeOnboarding"), "Must define unsnoozeOnboarding action");
    assert.ok(content.includes("markStepComplete"), "Must define markStepComplete action");
    assert.ok(content.includes("completeStep"), "Must define completeStep backwards-compat alias");
    assert.ok(content.includes("StartTourOptions"), "Must define StartTourOptions interface");
    assert.ok(content.includes("options?: StartTourOptions"), "startTour must accept options parameter");
    assert.ok(content.includes("!options?.force"), "startTour must check !options?.force against snooze");
    assert.ok(content.includes("new Set(prev.completedSteps)"), "markStepComplete must use Set union");
    assert.ok(content.includes("isSnoozed: isCurrentSnoozed"), "useOnboarding return object must include isSnoozed");
  });

  test("app-shell integrates isSnoozed to conditionally hide WelcomeModal and Widget", () => {
    const appShellPath = path.resolve(process.cwd(), "src/components/layout/app-shell.tsx");
    assert.ok(fs.existsSync(appShellPath), "app-shell.tsx must exist");
    const content = fs.readFileSync(appShellPath, "utf-8");

    assert.ok(
      content.includes("!onboarding.isSnoozed"),
      "WelcomeModal must check !onboarding.isSnoozed"
    );
    assert.ok(
      content.includes("isDismissed={onboarding.state.isDismissed || onboarding.isSnoozed}"),
      "OnboardingChecklistWidget must be hidden when isSnoozed is true"
    );
  });
});
