/**
 * QCET E-Office - PWA True Connectivity Detector & Manager
 *
 * Classifies network connectivity into 3 institutional states:
 * 1. ONLINE: Browser reports connected AND backend probe succeeds.
 * 2. DEGRADED: Browser reports online (Wi-Fi/LAN attached), but backend probe fails or times out.
 * 3. OFFLINE: Browser reports no network connection (navigator.onLine === false).
 *
 * Institutional Invariant: 0% emojis, clean telemetry integration, resilient to captive portals.
 */

import * as React from "react";
import { recordTelemetry } from "./telemetry";

export type ConnectionState = "ONLINE" | "DEGRADED" | "OFFLINE";

export interface ConnectivityProbeOptions {
  probeUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export const DEFAULT_PROBE_URL = "/api/health";
export const DEFAULT_PROBE_TIMEOUT_MS = 3500;
export const HEARTBEAT_INTERVAL_MS = 30000;

/**
 * Checks if the backend server is reachable via a lightweight probe.
 */
export async function checkServerReachable(
  options?: ConnectivityProbeOptions
): Promise<boolean> {
  if (typeof window === "undefined") {
    return true;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }

  const probeUrl = options?.probeUrl || DEFAULT_PROBE_URL;
  const timeoutMs = options?.timeoutMs || DEFAULT_PROBE_TIMEOUT_MS;
  const fetcher = options?.fetchFn || (typeof fetch !== "undefined" ? fetch : null);

  if (!fetcher) {
    return true;
  }

  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const response = await fetcher(`${probeUrl}?_t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller?.signal,
    }).catch(async () => {
      // Fallback: if HEAD is not supported by some proxy or firewall, attempt GET
      return await fetcher(`${probeUrl}?_t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        signal: controller?.signal,
      });
    });

    if (timeoutId) clearTimeout(timeoutId);

    // Any response under 500 (even 401/403/200) means server network route is reachable
    return response.status > 0 && response.status < 500;
  } catch {
    return false;
  }
}

type ConnectivityListener = (state: ConnectionState) => void;

export class PWAConnectivityManager {
  private state: ConnectionState = "ONLINE";
  private listeners = new Set<ConnectivityListener>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isChecking = false;
  private lastProbeTime = 0;
  private probeUrl = DEFAULT_PROBE_URL;
  private timeoutMs = DEFAULT_PROBE_TIMEOUT_MS;
  private fetchFn?: typeof fetch;

  constructor(options?: {
    probeUrl?: string;
    timeoutMs?: number;
    fetchFn?: typeof fetch;
    autoStart?: boolean;
  }) {
    if (options?.probeUrl) this.probeUrl = options.probeUrl;
    if (options?.timeoutMs) this.timeoutMs = options.timeoutMs;
    if (options?.fetchFn) this.fetchFn = options.fetchFn;

    if (typeof window !== "undefined" && (options?.autoStart ?? true)) {
      this.init();
    }
  }

  public init(): void {
    if (typeof window === "undefined") return;

    // Initial state check
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.transitionTo("OFFLINE");
    } else {
      this.checkConnectivity();
    }

    // Attach DOM event listeners
    window.addEventListener("online", this.handleBrowserOnline);
    window.addEventListener("offline", this.handleBrowserOffline);
    window.addEventListener("focus", this.handleWindowFocus);

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    // Periodic heartbeat check
    this.startHeartbeat();
  }

  public destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleBrowserOnline);
      window.removeEventListener("offline", this.handleBrowserOffline);
      window.removeEventListener("focus", this.handleWindowFocus);
    }

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }

    this.stopHeartbeat();
    this.listeners.clear();
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getLastProbeTime(): number {
    return this.lastProbeTime;
  }

  public setFetchFn(fn: typeof fetch): void {
    this.fetchFn = fn;
  }

  public setStateForTesting(newState: ConnectionState): void {
    this.transitionTo(newState);
  }

  public async checkConnectivity(forceProbe = false): Promise<ConnectionState> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.transitionTo("OFFLINE");
      return "OFFLINE";
    }

    // Throttle checks within 4 seconds unless forced
    const now = Date.now();
    if (!forceProbe && now - this.lastProbeTime < 4000 && this.state !== "OFFLINE") {
      return this.state;
    }

    if (this.isChecking) {
      return this.state;
    }

    this.isChecking = true;
    try {
      const isReachable = await checkServerReachable({
        probeUrl: this.probeUrl,
        timeoutMs: this.timeoutMs,
        fetchFn: this.fetchFn,
      });

      this.lastProbeTime = Date.now();

      if (isReachable) {
        this.transitionTo("ONLINE");
      } else {
        // Browser says online, but server is unreachable
        this.transitionTo("DEGRADED");
      }
    } catch {
      this.transitionTo("DEGRADED");
    } finally {
      this.isChecking = false;
    }

    return this.state;
  }

  public subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private transitionTo(newState: ConnectionState): void {
    if (this.state === newState) return;

    const previousState = this.state;
    this.state = newState;

    // Track privacy-preserving operational telemetry for offline entry/exit
    if ((newState === "OFFLINE" || newState === "DEGRADED") && previousState === "ONLINE") {
      recordTelemetry("offline.enter", { state: newState, previousState });
    } else if (newState === "ONLINE" && (previousState === "OFFLINE" || previousState === "DEGRADED")) {
      recordTelemetry("offline.exit", { state: newState, previousState });
    }

    // Dispatch DOM CustomEvent
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      try {
        window.dispatchEvent(
          new CustomEvent("qcet:connectivity-changed", {
            detail: { state: newState, previousState },
          })
        );
      } catch {
        // Ignore
      }
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(newState);
      } catch (err) {
        console.warn("[PWA Connectivity] Listener error:", err);
      }
    }
  }

  private handleBrowserOnline = (): void => {
    // Probe immediately to see if connection is truly working or degraded
    this.checkConnectivity(true);
  };

  private handleBrowserOffline = (): void => {
    this.transitionTo("OFFLINE");
  };

  private handleWindowFocus = (): void => {
    if (this.state !== "OFFLINE") {
      this.checkConnectivity();
    }
  };

  private handleVisibilityChange = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      this.checkConnectivity();
    }
  };

  private startHeartbeat(): void {
    this.stopHeartbeat();
    if (typeof window === "undefined") return;

    this.heartbeatTimer = setInterval(() => {
      if (this.state !== "OFFLINE") {
        this.checkConnectivity();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const pwaConnectivityManager = new PWAConnectivityManager();

/**
 * React hook to observe true connectivity state.
 */
export function useConnectivity(options?: { probeIntervalMs?: number }) {
  const [state, setState] = React.useState<ConnectionState>(() =>
    pwaConnectivityManager.getState()
  );
  const [lastCheckedAt, setLastCheckedAt] = React.useState<number>(() =>
    pwaConnectivityManager.getLastProbeTime()
  );

  React.useEffect(() => {
    setState(pwaConnectivityManager.getState());
    setLastCheckedAt(pwaConnectivityManager.getLastProbeTime());

    const unsubscribe = pwaConnectivityManager.subscribe((newState) => {
      setState(newState);
      setLastCheckedAt(pwaConnectivityManager.getLastProbeTime());
    });

    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (options?.probeIntervalMs && options.probeIntervalMs > 0) {
      intervalId = setInterval(() => {
        pwaConnectivityManager.checkConnectivity();
      }, options.probeIntervalMs);
    }

    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, [options?.probeIntervalMs]);

  const checkNow = React.useCallback(async () => {
    const newState = await pwaConnectivityManager.checkConnectivity(true);
    setState(newState);
    setLastCheckedAt(pwaConnectivityManager.getLastProbeTime());
    return newState;
  }, []);

  return {
    connectionState: state,
    isOnline: state === "ONLINE",
    isDegraded: state === "DEGRADED",
    isOffline: state === "OFFLINE",
    checkNow,
    lastCheckedAt,
  };
}
