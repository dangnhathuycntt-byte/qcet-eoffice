"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import {
  calculateOnboardingProgress,
  getRoleTourSteps,
  getRoleChecklist,
  TourStepConfig,
  ChecklistTaskConfig,
} from "@/lib/onboarding-constants";

const LOCAL_STORAGE_KEY = "qcet_onboarding_state";

export interface OnboardingState {
  hasSeenWelcome: boolean;
  hasCompletedTour: boolean;
  completedSteps: string[];
  isDismissed: boolean;
  snoozedUntil: string | null;
}

const DEFAULT_STATE: OnboardingState = {
  hasSeenWelcome: false,
  hasCompletedTour: false,
  completedSteps: ["step-profile"],
  isDismissed: false,
  snoozedUntil: null,
};

export function useOnboarding() {
  const { user } = useAuth();
  const [isMounted, setIsMounted] = React.useState(false);
  const [state, setState] = React.useState<OnboardingState>(DEFAULT_STATE);
  const [isTourActive, setIsTourActive] = React.useState(false);
  const [currentTourIndex, setCurrentTourIndex] = React.useState(0);
  const [isChecklistExpanded, setIsChecklistExpanded] = React.useState(false);

  // Khởi tạo từ localStorage và user metadata
  React.useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      const initialSteps =
        user?.onboardingData?.completedSteps ||
        parsed?.completedSteps ||
        ["step-profile"];

      setState({
        hasSeenWelcome:
          user?.onboardingData?.hasSeenWelcome ??
          parsed?.hasSeenWelcome ??
          false,
        hasCompletedTour:
          user?.onboardingData?.hasCompletedTour ??
          parsed?.hasCompletedTour ??
          false,
        completedSteps: Array.from(new Set([...initialSteps, "step-profile"])),
        isDismissed:
          user?.onboardingData?.isDismissed ?? parsed?.isDismissed ?? false,
        snoozedUntil:
          user?.onboardingData?.snoozedUntil ?? parsed?.snoozedUntil ?? null,
      });
    } catch {
      // Ignore parsing errors
    }
  }, [user]);

  // Đồng bộ qua API và LocalStorage
  const syncState = React.useCallback(
    async (nextState: Partial<OnboardingState>) => {
      setState((prev) => {
        const merged = { ...prev, ...nextState };
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }

        // Đồng bộ ngầm lên server
        fetch("/api/users/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        }).catch(() => {});

        return merged;
      });
    },
    []
  );

  const completeStep = React.useCallback(
    (stepId: string) => {
      setState((prev) => {
        if (prev.completedSteps.includes(stepId)) return prev;
        const nextSteps = [...prev.completedSteps, stepId];
        syncState({ completedSteps: nextSteps });
        return { ...prev, completedSteps: nextSteps };
      });
    },
    [syncState]
  );

  const startTour = React.useCallback(() => {
    setCurrentTourIndex(0);
    setIsTourActive(true);
    syncState({ hasSeenWelcome: true });
  }, [syncState]);

  const endTour = React.useCallback(() => {
    setIsTourActive(false);
    syncState({ hasCompletedTour: true });
  }, [syncState]);

  const dismissOnboarding = React.useCallback(() => {
    setIsTourActive(false);
    setIsChecklistExpanded(false);
    syncState({ isDismissed: true });
  }, [syncState]);

  const restartOnboarding = React.useCallback(() => {
    syncState({ isDismissed: false, hasCompletedTour: false });
    startTour();
  }, [syncState, startTour]);

  const tourSteps = React.useMemo(() => {
    return getRoleTourSteps(user?.role || "STAFF", user?.dbRole);
  }, [user?.role, user?.dbRole]);

  const checklistTasks = React.useMemo(() => {
    return getRoleChecklist(user?.role || "STAFF", user?.dbRole);
  }, [user?.role, user?.dbRole]);

  const progress = React.useMemo(() => {
    return calculateOnboardingProgress(state.completedSteps);
  }, [state.completedSteps]);

  // Tìm tác vụ chưa hoàn thành đầu tiên để gắn nhãn "Do This Next"
  const nextIncompleteTask = React.useMemo(() => {
    return checklistTasks.find((t) => !state.completedSteps.includes(t.id));
  }, [checklistTasks, state.completedSteps]);

  return {
    isMounted,
    state,
    isTourActive,
    currentTourIndex,
    setCurrentTourIndex,
    isChecklistExpanded,
    setIsChecklistExpanded,
    tourSteps,
    checklistTasks,
    progress,
    nextIncompleteTask,
    startTour,
    endTour,
    completeStep,
    dismissOnboarding,
    restartOnboarding,
  };
}
export type { TourStepConfig, ChecklistTaskConfig };
