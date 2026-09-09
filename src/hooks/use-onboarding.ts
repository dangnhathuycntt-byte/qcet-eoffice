"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import {
  calculateOnboardingProgress,
  getRoleTourSteps,
  getRoleChecklist,
  TourStepConfig,
  ChecklistTaskConfig,
  OnboardingState,
  DEFAULT_ONBOARDING_STATE,
  getOnboardingStorageKey,
  LEGACY_ONBOARDING_STORAGE_KEY,
  resolveOnboardingState,
  isSnoozed,
} from "@/lib/onboarding-constants";

export type { OnboardingState };
export { isSnoozed };

export interface StartTourOptions {
  force?: boolean;
}

export function useOnboarding() {
  const { user } = useAuth();
  const [isMounted, setIsMounted] = React.useState(false);
  const [state, setState] = React.useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [isTourActive, setIsTourActive] = React.useState(false);
  const [currentTourIndex, setCurrentTourIndex] = React.useState(0);
  const [isChecklistExpanded, setIsChecklistExpanded] = React.useState(false);

  const userRef = React.useRef(user);
  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Khởi tạo từ user-scoped localStorage và user metadata
  React.useEffect(() => {
    setIsMounted(true);
    if (typeof window === "undefined") return;

    // Dọn dẹp key cũ không phân tách theo user để chống rò rỉ trạng thái giữa các tài khoản
    try {
      localStorage.removeItem(LEGACY_ONBOARDING_STORAGE_KEY);
    } catch {
      // ignore
    }

    try {
      const storageKey = getOnboardingStorageKey(user?.id);
      const stored = localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      const resolved = resolveOnboardingState(user, parsed);

      // Nếu server ghi nhận chưa onboarding hoặc vừa bị xoá onboarding (onboardedAt: null & onboardingData: null), dọn sạch cache client
      if (user?.id && !user.onboardedAt && !user.onboardingData && stored) {
        localStorage.removeItem(storageKey);
      }

      setState(resolved);
    } catch {
      setState(DEFAULT_ONBOARDING_STATE);
    }
  }, [user]);

  // Hàm lưu trạng thái đồng thời vào localStorage và đồng bộ ngầm lên server
  const persistAndSync = React.useCallback(
    (merged: OnboardingState) => {
      const currentUserId = userRef.current?.id;
      const storageKey = getOnboardingStorageKey(currentUserId);

      try {
        localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch {
        // ignore
      }

      // Đồng bộ ngầm lên server nếu có người dùng đăng nhập
      if (currentUserId) {
        fetch("/api/users/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        }).catch(() => {});
      }
    },
    []
  );

  // Đồng bộ qua API và LocalStorage theo user-scoped key
  const syncState = React.useCallback(
    (nextState: Partial<OnboardingState>) => {
      setState((prev) => {
        const merged = { ...prev, ...nextState };
        persistAndSync(merged);
        return merged;
      });
    },
    [persistAndSync]
  );

  const markStepComplete = React.useCallback(
    (stepId: string) => {
      setState((prev) => {
        const currentSet = new Set(prev.completedSteps);
        if (currentSet.has(stepId)) return prev;
        currentSet.add(stepId);
        const nextSteps = Array.from(currentSet);
        const merged = { ...prev, completedSteps: nextSteps };
        persistAndSync(merged);
        return merged;
      });
    },
    [persistAndSync]
  );

  const completeStep = markStepComplete;

  const snoozeOnboarding = React.useCallback(
    async (hours = 24) => {
      const snoozeIso = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      setIsTourActive(false);
      setIsChecklistExpanded(false);
      syncState({ snoozedUntil: snoozeIso });
    },
    [syncState]
  );

  const unsnoozeOnboarding = React.useCallback(
    async () => {
      syncState({ snoozedUntil: null });
    },
    [syncState]
  );

  const startTour = React.useCallback(
    (options?: StartTourOptions) => {
      const currentlySnoozed = isSnoozed(state.snoozedUntil);
      if (currentlySnoozed && !options?.force) {
        return;
      }
      setCurrentTourIndex(0);
      setIsTourActive(true);
      syncState({ hasSeenWelcome: true });
    },
    [state.snoozedUntil, syncState]
  );

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
    syncState({ isDismissed: false, hasCompletedTour: false, snoozedUntil: null });
    startTour({ force: true });
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

  const isCurrentSnoozed = React.useMemo(() => {
    return isSnoozed(state.snoozedUntil);
  }, [state.snoozedUntil]);

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
    isSnoozed: isCurrentSnoozed,
    startTour,
    endTour,
    completeStep,
    markStepComplete,
    dismissOnboarding,
    snoozeOnboarding,
    unsnoozeOnboarding,
    restartOnboarding,
  };
}
export type { TourStepConfig, ChecklistTaskConfig };
