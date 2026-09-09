/**
 * QCET E-Office - PWA Onboarding Coordinator & Install UX Orchestration
 *
 * Implements a formal state machine governing user onboarding and PWA installation:
 * NEW_USER -> WELCOME_DONE -> ENGAGED -> INSTALL_ELIGIBLE -> INSTALLED -> PUSH_ELIGIBLE
 *
 * Invariants:
 * 1. Zero cold-load prompt spam: Never prompt install or push on initial load.
 * 2. User Isolation: Storage keys are strictly partitioned by userId.
 * 3. Server Truth & Standalone Detection: Detects display-mode: standalone & iOS standalone.
 * 4. Zero Emojis & Light-Only: Complies with QCET anti-slop guidelines.
 */

import * as React from "react";

export type JourneyStage =
  | "NEW_USER"
  | "WELCOME_DONE"
  | "ENGAGED"
  | "INSTALL_ELIGIBLE"
  | "INSTALLED"
  | "PUSH_ELIGIBLE";

export type OnboardingStage = JourneyStage;

export interface InstallGuidance {
  platform: "ios" | "android" | "desktop";
  steps: string[];
}

export interface EngagementSignals {
  actionCount: number;
  pageViews: number;
  stepsCompleted: string[];
  sessionDurationMs: number;
  lastActiveAt: number;
}

export interface CoordinatorPersistedState {
  stage: JourneyStage;
  engagement: EngagementSignals;
  installPromptDismissedAt: number | null;
  pushPromptDismissedAt: number | null;
  installedAt: number | null;
  updatedAt: number;
}

export interface CoordinatorState {
  stage: JourneyStage;
  engagement: EngagementSignals;
  actionsCount: number;
  isInstallable: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  isIOSSafari: boolean;
  canShowInstallPrompt: boolean;
  canShowPushPrompt: boolean;
  installSnoozed: boolean;
  pushSnoozed: boolean;
  installedAt: number | null;
  installGuidance: InstallGuidance | null;
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface CoordinatorConfig {
  minActionsForEngaged?: number;
  minPageViewsForEngaged?: number;
  minDurationMsForEngaged?: number;
  installSnoozeDays?: number;
  pushSnoozeDays?: number;
}

export const DEFAULT_CONFIG: Required<CoordinatorConfig> = {
  minActionsForEngaged: 2,
  minPageViewsForEngaged: 2,
  minDurationMsForEngaged: 15_000,
  installSnoozeDays: 7,
  pushSnoozeDays: 7,
};

export const DEFAULT_ENGAGEMENT: EngagementSignals = {
  actionCount: 0,
  pageViews: 1,
  stepsCompleted: [],
  sessionDurationMs: 0,
  lastActiveAt: Date.now(),
};

export const DEFAULT_PERSISTED_STATE: CoordinatorPersistedState = {
  stage: "NEW_USER",
  engagement: DEFAULT_ENGAGEMENT,
  installPromptDismissedAt: null,
  pushPromptDismissedAt: null,
  installedAt: null,
  updatedAt: Date.now(),
};

/**
 * Storage key generator scoped by userId for strict multi-user isolation
 */
export function getCoordinatorStorageKey(userId?: string | null): string {
  return userId ? `qcet_pwa_coordinator_${userId}` : "qcet_pwa_coordinator_guest";
}

/**
 * Checks whether the browser is running on an iOS device
 */
export function checkIsIOS(userAgent?: string, maxTouchPoints?: number): boolean {
  const ua =
    userAgent !== undefined
      ? userAgent
      : typeof navigator !== "undefined"
      ? navigator.userAgent
      : "";

  if (!ua) return false;

  const touchPoints =
    maxTouchPoints !== undefined
      ? maxTouchPoints
      : typeof navigator !== "undefined"
      ? navigator.maxTouchPoints || 0
      : 0;

  if (/iPad|iPhone|iPod/.test(ua)) return true;
  if (/Macintosh|MacIntel/.test(ua) && touchPoints > 1) return true;

  return false;
}

/**
 * Checks whether the browser is running in standalone mode (already installed PWA)
 */
export function checkIsStandalone(): boolean {
  if (typeof window === "undefined") return false;

  const isMatchMedia =
    window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;

  const isNavigatorStandalone = Boolean(
    (navigator as unknown as { standalone?: boolean })?.standalone
  );

  return isMatchMedia || isNavigatorStandalone;
}

/**
 * Checks whether the browser is iOS Safari in non-standalone (browser) mode
 */
export function checkIsIOSSafari(userAgent?: string, maxTouchPoints?: number): boolean {
  const isIos = checkIsIOS(userAgent, maxTouchPoints);
  if (!isIos) return false;

  if (typeof window !== "undefined" && (window as unknown as { MSStream?: unknown }).MSStream) {
    return false;
  }

  const isStandalone = checkIsStandalone();
  return !isStandalone;
}

/**
 * Helper to test if a cooldown/snooze timestamp is still active
 */
export function isSnoozed(timestamp: number | null | undefined, durationMs: number): boolean {
  if (!timestamp) return false;
  return Date.now() - timestamp < durationMs;
}

/**
 * Core PWA Onboarding Coordinator state machine
 */
export class PWAOnboardingCoordinator {
  private userId: string | null = null;
  private config: Required<CoordinatorConfig>;
  private stage: JourneyStage = "NEW_USER";
  private engagement: EngagementSignals = { ...DEFAULT_ENGAGEMENT };
  private installPromptDismissedAt: number | null = null;
  private pushPromptDismissedAt: number | null = null;
  private installedAt: number | null = null;

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstallable = false;
  private sessionStartTime: number = Date.now();
  private listeners: Set<(state: CoordinatorState) => void> = new Set();
  private isInitialized = false;

  constructor(config?: CoordinatorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initializes the coordinator with an optional user ID and hydrates storage
   */
  public init(userId?: string | null): void {
    this.userId = userId ?? null;
    this.sessionStartTime = Date.now();
    this.isInitialized = true;
    this.hydrateFromStorage();
    this.recalculateStage();
    this.setupWindowListeners();
    this.notify();
  }

  /**
   * Updates user identity and re-hydrates storage
   */
  public setUserId(userId?: string | null): void {
    if (this.userId === (userId ?? null) && this.isInitialized) return;
    this.userId = userId ?? null;
    this.sessionStartTime = Date.now();
    this.hydrateFromStorage();
    this.recalculateStage();
    this.notify();
  }

  /**
   * Returns current coordinator snapshot
   */
  public getState(): CoordinatorState {
    const isStandalone = checkIsStandalone();
    const isIos = checkIsIOS();
    const isIosSafari = checkIsIOSSafari();
    const installSnoozeMs = this.config.installSnoozeDays * 24 * 60 * 60 * 1000;
    const pushSnoozeMs = this.config.pushSnoozeDays * 24 * 60 * 60 * 1000;
    const installSnoozed = isSnoozed(this.installPromptDismissedAt, installSnoozeMs);
    const pushSnoozed = isSnoozed(this.pushPromptDismissedAt, pushSnoozeMs);

    const isInstallable = this.isInstallable || (isIosSafari && !isStandalone);
    const isInstalled = isStandalone || Boolean(this.installedAt);

    const canShowInstallPrompt =
      (this.stage === "INSTALL_ELIGIBLE" ||
        (isInstallable && this.stage === "ENGAGED")) &&
      !isInstalled &&
      !installSnoozed;

    const canShowPushPrompt =
      (this.stage === "PUSH_ELIGIBLE" || isInstalled) &&
      !pushSnoozed;

    const installGuidance: InstallGuidance | null =
      isIos && !isStandalone
        ? {
            platform: "ios",
            steps: [
              "Nhấn nút Chia sẻ (biểu tượng hộp có mũi tên lên) trên thanh công cụ Safari",
              "Cuộn xuống và chọn 'Thêm vào Màn hình chính' (Add to Home Screen)",
              "Nhấn 'Thêm' ở góc trên cùng bên phải để hoàn tất cài đặt ứng dụng",
            ],
          }
        : null;

    return {
      stage: this.stage,
      engagement: { ...this.engagement },
      actionsCount: this.engagement.actionCount,
      isInstallable,
      isInstalled,
      isStandalone,
      isIOS: isIos,
      isIOSSafari: isIosSafari,
      canShowInstallPrompt,
      canShowPushPrompt,
      installSnoozed,
      pushSnoozed,
      installedAt: this.installedAt,
      installGuidance,
    };
  }

  /**
   * Subscribes to state updates
   */
  public subscribe(listener: (state: CoordinatorState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Marks welcome modal/tour as completed or dismissed
   */
  public setWelcomeDone(): void {
    if (this.stage === "NEW_USER") {
      this.transitionTo("WELCOME_DONE");
    }
  }

  public completeWelcome(): void {
    this.setWelcomeDone();
  }

  public setState(partial: Partial<CoordinatorState>): void {
    if (partial.stage) this.stage = partial.stage;
    if (partial.installedAt !== undefined) this.installedAt = partial.installedAt;
    if (partial.actionsCount !== undefined) this.engagement.actionCount = partial.actionsCount;
    this.notify();
  }

  /**
   * Records a user engagement action (clicks, task changes, etc.)
   */
  public recordAction(_actionName?: string): void {
    this.engagement.actionCount += 1;
    this.engagement.lastActiveAt = Date.now();
    this.updateSessionDuration();
    this.checkEngagementTransition();
    this.persist();
  }

  /**
   * Records a page navigation
   */
  public recordPageView(_path?: string): void {
    this.engagement.pageViews += 1;
    this.engagement.lastActiveAt = Date.now();
    this.updateSessionDuration();
    this.checkEngagementTransition();
    this.persist();
  }

  /**
   * Records completion of an onboarding checklist step
   */
  public recordStepCompleted(stepId: string): void {
    if (!this.engagement.stepsCompleted.includes(stepId)) {
      this.engagement.stepsCompleted = [...this.engagement.stepsCompleted, stepId];
      this.engagement.lastActiveAt = Date.now();
      this.updateSessionDuration();
      this.checkEngagementTransition();
      this.persist();
    }
  }

  /**
   * Directly sets the stage (used for manual overrides or testing)
   */
  public transitionTo(nextStage: JourneyStage): void {
    if (this.stage === nextStage) return;
    this.stage = nextStage;
    this.persist();
    this.notify();
  }

  /**
   * Captures the Chromium `beforeinstallprompt` event
   */
  public handleBeforeInstallPrompt(event: BeforeInstallPromptEvent): void {
    event.preventDefault();
    this.deferredPrompt = event;
    this.isInstallable = true;

    // Only transition if user has already achieved engagement
    if (this.stage === "ENGAGED") {
      this.recalculateStage();
    }
    this.notify();
  }

  /**
   * Handles app installation completed event
   */
  public handleAppInstalled(): void {
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.installedAt = Date.now();
    this.transitionTo("INSTALLED");
    this.recalculateStage();
  }

  /**
   * Requests app installation
   * On Chromium: triggers native prompt
   * On iOS Safari: opens step-by-step guidance modal
   */
  public async promptInstall(): Promise<"accepted" | "dismissed" | "ios_guided" | "not_eligible" | null> {
    const isStandalone = checkIsStandalone();
    if (isStandalone) {
      return "not_eligible";
    }

    if (this.deferredPrompt) {
      try {
        await this.deferredPrompt.prompt();
        const choice = await this.deferredPrompt.userChoice;
        this.deferredPrompt = null;

        if (choice.outcome === "accepted") {
          this.handleAppInstalled();
          return "accepted";
        } else {
          this.snoozeInstall();
          return "dismissed";
        }
      } catch (err) {
        console.error("Install prompt error:", err);
        this.deferredPrompt = null;
        return null;
      }
    }

    if (checkIsIOSSafari()) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("qcet:open-install-modal", { detail: { platform: "ios" } })
        );
      }
      return "ios_guided";
    }

    return "not_eligible";
  }

  /**
   * Snoozes the install prompt for configured days
   */
  public snoozeInstall(days?: number): void {
    this.installPromptDismissedAt = Date.now();
    this.persist();

    // Snoozing install unblocks progressing to PUSH_ELIGIBLE
    if (this.stage === "INSTALL_ELIGIBLE") {
      this.transitionTo("PUSH_ELIGIBLE");
    } else {
      this.notify();
    }
  }

  /**
   * Snoozes the push notification prompt
   */
  public snoozePush(_days?: number): void {
    this.pushPromptDismissedAt = Date.now();
    this.persist();
    this.notify();
  }

  /**
   * Marks app as installed
   */
  public markInstalled(): void {
    this.installedAt = Date.now();
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.transitionTo("INSTALLED");
    this.recalculateStage();
  }

  /**
   * Clears state and resets to defaults
   */
  public reset(): void {
    this.stage = "NEW_USER";
    this.engagement = { ...DEFAULT_ENGAGEMENT, lastActiveAt: Date.now() };
    this.installPromptDismissedAt = null;
    this.pushPromptDismissedAt = null;
    this.installedAt = null;
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.sessionStartTime = Date.now();

    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(getCoordinatorStorageKey(this.userId));
      } catch {
        // ignore
      }
    }
    this.notify();
  }

  public getDeferredPrompt(): BeforeInstallPromptEvent | null {
    return this.deferredPrompt;
  }

  // --- Internal helpers ---

  private updateSessionDuration(): void {
    this.engagement.sessionDurationMs = Date.now() - this.sessionStartTime;
  }

  private isUserEngaged(): boolean {
    const duration = Date.now() - this.sessionStartTime;
    return (
      this.engagement.actionCount >= this.config.minActionsForEngaged ||
      this.engagement.pageViews >= this.config.minPageViewsForEngaged ||
      this.engagement.stepsCompleted.length >= 1 ||
      duration >= this.config.minDurationMsForEngaged
    );
  }

  private checkEngagementTransition(): void {
    if (this.stage === "NEW_USER" || this.stage === "WELCOME_DONE") {
      if (this.isUserEngaged()) {
        this.transitionTo("ENGAGED");
        this.recalculateStage();
      }
    }
  }

  private recalculateStage(): void {
    const isStandalone = checkIsStandalone();
    const isIosSafari = checkIsIOSSafari();
    const installSnoozeMs = this.config.installSnoozeDays * 24 * 60 * 60 * 1000;
    const isInstallSnoozed = isSnoozed(this.installPromptDismissedAt, installSnoozeMs);

    // If already standalone or installed, advance to INSTALLED -> PUSH_ELIGIBLE
    if (isStandalone || this.installedAt) {
      if (this.stage !== "NEW_USER" && this.stage !== "WELCOME_DONE") {
        if (this.stage !== "PUSH_ELIGIBLE") {
          this.stage = "PUSH_ELIGIBLE";
          this.persist();
        }
      }
      return;
    }

    // If currently ENGAGED, check install eligibility
    if (this.stage === "ENGAGED") {
      if (isInstallSnoozed) {
        // User already snoozed install: proceed directly to PUSH_ELIGIBLE
        this.stage = "PUSH_ELIGIBLE";
        this.persist();
        return;
      }

      if (this.isInstallable || isIosSafari || this.deferredPrompt) {
        this.stage = "INSTALL_ELIGIBLE";
        this.persist();
        return;
      }
    }

    if (this.stage === "INSTALLED") {
      this.stage = "PUSH_ELIGIBLE";
      this.persist();
    }
  }

  private hydrateFromStorage(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const key = getCoordinatorStorageKey(this.userId);
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<CoordinatorPersistedState>;
      if (parsed.stage) this.stage = parsed.stage;
      if (parsed.engagement) this.engagement = { ...DEFAULT_ENGAGEMENT, ...parsed.engagement };
      if (parsed.installPromptDismissedAt) this.installPromptDismissedAt = parsed.installPromptDismissedAt;
      if (parsed.pushPromptDismissedAt) this.pushPromptDismissedAt = parsed.pushPromptDismissedAt;
      if (parsed.installedAt) this.installedAt = parsed.installedAt;
    } catch {
      // Storage unavailable or JSON malformed
    }
  }

  private persist(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const key = getCoordinatorStorageKey(this.userId);
      const payload: CoordinatorPersistedState = {
        stage: this.stage,
        engagement: this.engagement,
        installPromptDismissedAt: this.installPromptDismissedAt,
        pushPromptDismissedAt: this.pushPromptDismissedAt,
        installedAt: this.installedAt,
        updatedAt: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Storage write error
    }
  }

  private setupWindowListeners(): void {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      this.handleBeforeInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      this.handleAppInstalled();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error("Coordinator listener error:", err);
      }
    });
  }
}

// Global coordinator singleton
export const pwaOnboardingCoordinator = new PWAOnboardingCoordinator();

/**
 * React hook to interact with the PWA onboarding coordinator state machine
 */
export function usePWAOnboardingCoordinator(userId?: string | null) {
  const [state, setState] = React.useState<CoordinatorState>(() =>
    pwaOnboardingCoordinator.getState()
  );

  React.useEffect(() => {
    pwaOnboardingCoordinator.init(userId);
    const unsubscribe = pwaOnboardingCoordinator.subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, [userId]);

  return {
    stage: state.stage,
    state,
    isInstallable: state.isInstallable,
    isInstalled: state.isInstalled,
    isStandalone: state.isStandalone,
    isIOS: state.isIOS,
    isIOSSafari: state.isIOSSafari,
    installSnoozed: state.installSnoozed,
    pushSnoozed: state.pushSnoozed,
    canShowWelcome: state.stage === "NEW_USER",
    canShowInstallPrompt: state.stage === "INSTALL_ELIGIBLE" && !state.installSnoozed,
    canShowPushPrompt: state.stage === "PUSH_ELIGIBLE" && !state.pushSnoozed,
    recordAction: React.useCallback(
      (actionName?: string) => pwaOnboardingCoordinator.recordAction(actionName),
      []
    ),
    recordPageView: React.useCallback(
      (path?: string) => pwaOnboardingCoordinator.recordPageView(path),
      []
    ),
    recordStepCompleted: React.useCallback(
      (stepId: string) => pwaOnboardingCoordinator.recordStepCompleted(stepId),
      []
    ),
    setWelcomeDone: React.useCallback(
      () => pwaOnboardingCoordinator.setWelcomeDone(),
      []
    ),
    completeWelcome: React.useCallback(
      () => pwaOnboardingCoordinator.completeWelcome(),
      []
    ),
    promptInstall: React.useCallback(
      () => pwaOnboardingCoordinator.promptInstall(),
      []
    ),
    snoozeInstall: React.useCallback(
      (days?: number) => pwaOnboardingCoordinator.snoozeInstall(days),
      []
    ),
    snoozePush: React.useCallback(
      (days?: number) => pwaOnboardingCoordinator.snoozePush(days),
      []
    ),
    markInstalled: React.useCallback(
      () => pwaOnboardingCoordinator.markInstalled(),
      []
    ),
    reset: React.useCallback(() => pwaOnboardingCoordinator.reset(), []),
  };
}

