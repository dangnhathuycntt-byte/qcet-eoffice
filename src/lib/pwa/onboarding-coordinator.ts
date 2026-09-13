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

export type InterruptionType = "WELCOME" | "PWA_INSTALL" | "PUSH" | "TOUR";

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
  installSnoozeUntil?: number | null;
  pushSnoozeUntil?: number | null;
  installedAt: number | null;
  sessionCount: number;
  sessionInterruptionShown: boolean;
  activeInterruptionType: InterruptionType | null;
  lastSessionId?: string | null;
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
  canShowWelcome: boolean;
  canShowInstallPrompt: boolean;
  canShowPushPrompt: boolean;
  installSnoozed: boolean;
  pushSnoozed: boolean;
  installedAt: number | null;
  installGuidance: InstallGuidance | null;
  sessionCount: number;
  sessionInterruptionShown: boolean;
  activeInterruptionType: InterruptionType | null;
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
  sessionCount: 1,
  sessionInterruptionShown: false,
  activeInterruptionType: null,
  lastSessionId: null,
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
  private installSnoozeUntil: number | null = null;
  private pushSnoozeUntil: number | null = null;
  private installedAt: number | null = null;
  private sessionCount: number = 1;
  private sessionInterruptionShown: boolean = false;
  private activeInterruptionType: InterruptionType | null = null;
  private lastSessionId: string | null = null;

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstallable = false;
  private sessionStartTime: number = Date.now();
  private listeners: Set<(state: CoordinatorState) => void> = new Set();
  private isInitialized = false;
  private windowListenersAttached = false;

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
    this.detectOrStartSession();
    this.recalculateStage();
    this.setupWindowListeners();
    this.notify();
  }

  /**
   * Detects browser session boundaries to enforce single interruption per session
   */
  private detectOrStartSession(): void {
    if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
      return;
    }

    const sessionMarkerKey = `qcet_pwa_session_active_${this.userId || "guest"}`;
    let sessionMarker: string | null = null;
    try {
      sessionMarker = sessionStorage.getItem(sessionMarkerKey);
    } catch {
      // ignore sessionStorage access errors
    }

    if (!sessionMarker) {
      const newSessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      try {
        sessionStorage.setItem(sessionMarkerKey, newSessionId);
      } catch {
        // ignore
      }

      // If we previously had a different session recorded, advance session count and reset interruption gate
      if (this.lastSessionId && this.lastSessionId !== newSessionId) {
        this.sessionCount = (this.sessionCount || 1) + 1;
        this.sessionInterruptionShown = false;
        this.activeInterruptionType = null;
      }
      this.lastSessionId = newSessionId;
      this.persist();
    }
  }

  /**
   * Explicitly starts a new session (used in testing, re-login, or multi-session workflows)
   */
  public startNewSession(): void {
    this.sessionCount = (this.sessionCount || 1) + 1;
    this.sessionInterruptionShown = false;
    this.activeInterruptionType = null;
    const newSessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.lastSessionId = newSessionId;

    if (typeof sessionStorage !== "undefined") {
      try {
        const sessionMarkerKey = `qcet_pwa_session_active_${this.userId || "guest"}`;
        sessionStorage.setItem(sessionMarkerKey, newSessionId);
      } catch {
        // ignore
      }
    }

    this.recalculateStage();
    this.persist();
    this.notify();
  }

  /**
   * Records that a proactive interruption has been displayed in the current session.
   * Suppresses all other proactive interruptions for the remainder of this session.
   */
  public recordInterruptionShown(type: InterruptionType): void {
    if (this.sessionInterruptionShown && this.activeInterruptionType === type) {
      return;
    }
    this.sessionInterruptionShown = true;
    this.activeInterruptionType = type;
    this.persist();
    this.notify();
  }

  /**
   * Clears the currently active interruption type (e.g. upon dismissal or acceptance).
   * Maintains sessionInterruptionShown = true to prevent subsequent interruptions in the same session.
   */
  public clearActiveInterruption(): void {
    if (this.activeInterruptionType === null) {
      return;
    }
    this.activeInterruptionType = null;
    this.persist();
    this.notify();
  }

  /**
   * Resets the session interruption gate (allows another proactive modal if eligible)
   */
  public resetSessionGate(): void {
    this.sessionInterruptionShown = false;
    this.activeInterruptionType = null;
    this.persist();
    this.notify();
  }

  public hasSessionInterruptionShown(): boolean {
    return this.sessionInterruptionShown;
  }

  public getActiveInterruptionType(): InterruptionType | null {
    return this.activeInterruptionType;
  }

  public get canShowWelcome(): boolean {
    return this.getState().canShowWelcome;
  }

  public get canShowInstallPrompt(): boolean {
    return this.getState().canShowInstallPrompt;
  }

  public get canShowPushPrompt(): boolean {
    return this.getState().canShowPushPrompt;
  }

  public getSessionCount(): number {
    return this.sessionCount;
  }

  public setSessionCount(count: number): void {
    this.sessionCount = count;
    this.recalculateStage();
    this.persist();
    this.notify();
  }

  public setSessionInterruptionShown(shown: boolean, type: InterruptionType | null = null): void {
    this.sessionInterruptionShown = shown;
    this.activeInterruptionType = shown ? type : null;
    this.persist();
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
    this.detectOrStartSession();
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
    const installSnoozed = this.installSnoozeUntil
      ? Date.now() < this.installSnoozeUntil
      : isSnoozed(this.installPromptDismissedAt, installSnoozeMs);
    const pushSnoozed = this.pushSnoozeUntil
      ? Date.now() < this.pushSnoozeUntil
      : isSnoozed(this.pushPromptDismissedAt, pushSnoozeMs);

    const isInstallable = this.isInstallable || (isIosSafari && !isStandalone);
    const isInstalled = isStandalone || Boolean(this.installedAt);

    // 1. Welcome Modal: Session 1 / First login
    // Mutually exclusive single interruption: can only show if stage is NEW_USER
    // and no other interruption has been shown in this session (or welcome is already active).
    const canShowWelcome =
      this.stage === "NEW_USER" &&
      (!this.sessionInterruptionShown || this.activeInterruptionType === "WELCOME");

    // 2. PWA Install Prompt:
    // Session 2+ (or engagement actions >= 2): Only prompt PWA Install if not installed.
    // Suppressed if welcome modal is showing, or if an interruption was already shown in this session.
    const isInstallEligibleStage =
      this.stage === "INSTALL_ELIGIBLE" ||
      (this.stage === "ENGAGED" && (this.sessionCount >= 2 || this.engagement.actionCount >= 2)) ||
      (this.sessionCount >= 2 && this.stage !== "NEW_USER");

    const canShowInstallPrompt =
      !isInstalled &&
      !installSnoozed &&
      isInstallable &&
      !canShowWelcome &&
      isInstallEligibleStage &&
      (!this.sessionInterruptionShown || this.activeInterruptionType === "PWA_INSTALL");

    // 3. Web Push Permission Prompt:
    // Only after PWA install or explicit engagement: Prompt Web Push permission.
    // Never stack Welcome -> Tour -> Install -> Push in the same session.
    // If not installed and installable, PWA Install takes precedence.
    const isPushEligibleTarget =
      isInstalled ||
      (this.stage === "PUSH_ELIGIBLE" && !isInstallable);

    const canShowPushPrompt =
      !pushSnoozed &&
      !canShowWelcome &&
      !canShowInstallPrompt &&
      isPushEligibleTarget &&
      (this.stage === "PUSH_ELIGIBLE" || isInstalled) &&
      (!this.sessionInterruptionShown || this.activeInterruptionType === "PUSH");

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
      canShowWelcome,
      canShowInstallPrompt,
      canShowPushPrompt,
      installSnoozed,
      pushSnoozed,
      installedAt: this.installedAt,
      installGuidance,
      sessionCount: this.sessionCount,
      sessionInterruptionShown: this.sessionInterruptionShown,
      activeInterruptionType: this.activeInterruptionType,
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
    if (this.activeInterruptionType === "WELCOME") {
      this.activeInterruptionType = null;
    }
    this.setWelcomeDone();
  }

  public setState(partial: Partial<CoordinatorState>): void {
    if (partial.stage) this.stage = partial.stage;
    if (partial.installedAt !== undefined) this.installedAt = partial.installedAt;
    if (partial.isInstalled) this.installedAt = this.installedAt ?? Date.now();
    if (partial.actionsCount !== undefined) this.engagement.actionCount = partial.actionsCount;
    if (partial.sessionCount !== undefined) this.sessionCount = partial.sessionCount;
    if (partial.sessionInterruptionShown !== undefined) {
      this.sessionInterruptionShown = partial.sessionInterruptionShown;
    }
    if (partial.activeInterruptionType !== undefined) {
      this.activeInterruptionType = partial.activeInterruptionType;
    }
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

  public captureInstallPrompt(event: BeforeInstallPromptEvent): void {
    this.handleBeforeInstallPrompt(event);
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

  public recordInstalled(): void {
    this.handleAppInstalled();
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
    const durationDays = days ?? this.config.installSnoozeDays;
    const now = Date.now();
    this.installPromptDismissedAt = now;
    this.installSnoozeUntil = now + durationDays * 24 * 60 * 60 * 1000;
    this.sessionInterruptionShown = true;
    if (this.activeInterruptionType === "PWA_INSTALL") {
      this.activeInterruptionType = null;
    }
    this.persist();

    // Snoozing install unblocks progressing to PUSH_ELIGIBLE
    if (this.stage === "INSTALL_ELIGIBLE") {
      this.transitionTo("PUSH_ELIGIBLE");
    } else {
      this.notify();
    }
  }

  /**
   * Alias for snoozeInstall to support explicit dismissal
   */
  public dismissInstallPrompt(days?: number): void {
    this.snoozeInstall(days);
  }

  /**
   * Snoozes the push notification prompt
   */
  public snoozePush(days?: number): void {
    const durationDays = days ?? this.config.pushSnoozeDays;
    const now = Date.now();
    this.pushPromptDismissedAt = now;
    this.pushSnoozeUntil = now + durationDays * 24 * 60 * 60 * 1000;
    this.sessionInterruptionShown = true;
    if (this.activeInterruptionType === "PUSH") {
      this.activeInterruptionType = null;
    }
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
    this.sessionInterruptionShown = true;
    if (this.activeInterruptionType === "PWA_INSTALL") {
      this.activeInterruptionType = null;
    }
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
    this.installSnoozeUntil = null;
    this.pushSnoozeUntil = null;
    this.installedAt = null;
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.sessionCount = 1;
    this.sessionInterruptionShown = false;
    this.activeInterruptionType = null;
    this.lastSessionId = null;
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

  /**
   * Allows non-installable desktop platforms (e.g. desktop browsers without beforeinstallprompt or install support)
   * to advance to PUSH_ELIGIBLE after achieving engagement.
   */
  public advanceNonInstallableDesktop(): boolean {
    const isIos = checkIsIOS();
    const isStandalone = checkIsStandalone();
    if (this.stage === "ENGAGED" && !isIos && !this.isInstallable && !this.deferredPrompt && !isStandalone) {
      this.transitionTo("PUSH_ELIGIBLE");
      return true;
    }
    return false;
  }

  /**
   * Advances stage directly to PUSH_ELIGIBLE when conditions are met
   */
  public advanceToPushEligible(): void {
    if (this.stage === "ENGAGED" || this.stage === "INSTALL_ELIGIBLE" || this.stage === "INSTALLED") {
      this.transitionTo("PUSH_ELIGIBLE");
    }
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
      if (parsed.installSnoozeUntil !== undefined) this.installSnoozeUntil = parsed.installSnoozeUntil;
      if (parsed.pushSnoozeUntil !== undefined) this.pushSnoozeUntil = parsed.pushSnoozeUntil;
      if (parsed.installedAt) this.installedAt = parsed.installedAt;
      if (parsed.sessionCount !== undefined) this.sessionCount = parsed.sessionCount;
      if (parsed.sessionInterruptionShown !== undefined) this.sessionInterruptionShown = parsed.sessionInterruptionShown;
      if (parsed.activeInterruptionType !== undefined) this.activeInterruptionType = parsed.activeInterruptionType;
      if (parsed.lastSessionId !== undefined) this.lastSessionId = parsed.lastSessionId;
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
        installSnoozeUntil: this.installSnoozeUntil,
        pushSnoozeUntil: this.pushSnoozeUntil,
        installedAt: this.installedAt,
        sessionCount: this.sessionCount,
        sessionInterruptionShown: this.sessionInterruptionShown,
        activeInterruptionType: this.activeInterruptionType,
        lastSessionId: this.lastSessionId,
        updatedAt: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Storage write error
    }
  }

  private setupWindowListeners(): void {
    if (typeof window === "undefined") return;

    // Attach the global install listeners exactly once per coordinator instance.
    // `init` runs on every identity change; without this guard each re-init would
    // stack another pair of `beforeinstallprompt`/`appinstalled` handlers (T68).
    if (this.windowListenersAttached) return;
    this.windowListenersAttached = true;

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

  const recordAction = React.useCallback(
    (actionName?: string) => pwaOnboardingCoordinator.recordAction(actionName),
    []
  );
  const recordPageView = React.useCallback(
    (path?: string) => pwaOnboardingCoordinator.recordPageView(path),
    []
  );
  const recordStepCompleted = React.useCallback(
    (stepId: string) => pwaOnboardingCoordinator.recordStepCompleted(stepId),
    []
  );
  const setWelcomeDone = React.useCallback(
    () => pwaOnboardingCoordinator.setWelcomeDone(),
    []
  );
  const completeWelcome = React.useCallback(
    () => pwaOnboardingCoordinator.completeWelcome(),
    []
  );
  const promptInstall = React.useCallback(
    () => pwaOnboardingCoordinator.promptInstall(),
    []
  );
  const snoozeInstall = React.useCallback(
    (days?: number) => pwaOnboardingCoordinator.snoozeInstall(days),
    []
  );
  const snoozePush = React.useCallback(
    (days?: number) => pwaOnboardingCoordinator.snoozePush(days),
    []
  );
  const markInstalled = React.useCallback(
    () => pwaOnboardingCoordinator.markInstalled(),
    []
  );
  const advanceNonInstallableDesktop = React.useCallback(
    () => pwaOnboardingCoordinator.advanceNonInstallableDesktop(),
    []
  );
  const advanceToPushEligible = React.useCallback(
    () => pwaOnboardingCoordinator.advanceToPushEligible(),
    []
  );
  const recordInterruptionShown = React.useCallback(
    (type: InterruptionType) => pwaOnboardingCoordinator.recordInterruptionShown(type),
    []
  );
  const clearActiveInterruption = React.useCallback(
    () => pwaOnboardingCoordinator.clearActiveInterruption(),
    []
  );
  const reset = React.useCallback(() => pwaOnboardingCoordinator.reset(), []);

  return React.useMemo(
    () => ({
      stage: state.stage,
      state,
      isInstallable: state.isInstallable,
      isInstalled: state.isInstalled,
      isStandalone: state.isStandalone,
      isIOS: state.isIOS,
      isIOSSafari: state.isIOSSafari,
      installSnoozed: state.installSnoozed,
      pushSnoozed: state.pushSnoozed,
      canShowWelcome: state.canShowWelcome,
      canShowInstallPrompt: state.canShowInstallPrompt,
      canShowPushPrompt: state.canShowPushPrompt,
      recordAction,
      recordPageView,
      recordStepCompleted,
      setWelcomeDone,
      completeWelcome,
      promptInstall,
      snoozeInstall,
      snoozePush,
      markInstalled,
      advanceNonInstallableDesktop,
      advanceToPushEligible,
      recordInterruptionShown,
      clearActiveInterruption,
      reset,
    }),
    [
      state,
      recordAction,
      recordPageView,
      recordStepCompleted,
      setWelcomeDone,
      completeWelcome,
      promptInstall,
      snoozeInstall,
      snoozePush,
      markInstalled,
      advanceNonInstallableDesktop,
      advanceToPushEligible,
      recordInterruptionShown,
      clearActiveInterruption,
      reset,
    ]
  );
}

