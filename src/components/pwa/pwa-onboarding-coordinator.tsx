"use client";

/**
 * PWA Onboarding Coordinator Component & Hook Re-exports
 * Acts as the centralized UI orchestration entry point.
 */

export { PWAInstallPrompt, type PWAInstallPromptProps } from "./pwa-install-prompt";
export { PushOnboardingSheet, type PushOnboardingSheetProps } from "./push-onboarding-sheet";
export {
  usePWAOnboardingCoordinator,
  PWAOnboardingCoordinator,
  pwaOnboardingCoordinator,
  getCoordinatorStorageKey,
  checkIsIOS,
  checkIsStandalone,
  checkIsIOSSafari,
  isSnoozed,
  type CoordinatorState,
  type JourneyStage,
  type OnboardingStage,
  type InterruptionType,
  type InstallGuidance,
  type EngagementSignals,
} from "@/lib/pwa/onboarding-coordinator";
