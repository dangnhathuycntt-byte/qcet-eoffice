"use client";

import * as React from "react";
import { PWAUpdateDialog } from "@/components/pwa/pwa-update-dialog";

declare global {
  interface Window {
    __QCET_HAS_UNSAVED_CHANGES__?: boolean | (() => boolean);
    __QCET_FORCE_SW_REGISTER__?: boolean;
  }
}

/**
 * Checks whether the page has active unsaved form edits, active text editing focus,
 * or explicit application-level unsaved state.
 * Used to protect against accidental data loss when triggering Service Worker updates.
 */
export function checkHasUnsavedChanges(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  // 1. Explicit application-level unsaved changes flag (boolean or function)
  const customFlag = window.__QCET_HAS_UNSAVED_CHANGES__;
  if (typeof customFlag === "function") {
    try {
      if (customFlag()) return true;
    } catch {
      // Ignore custom function errors
    }
  } else if (customFlag === true) {
    return true;
  }

  // 2. DOM elements marked with data-unsaved-changes="true" or data-dirty="true"
  try {
    if (document.querySelector('[data-unsaved-changes="true"], [data-dirty="true"]')) {
      return true;
    }
  } catch {
    // Ignore DOM selector errors in constrained environments
  }

  // 3. Active element check: user currently typing or focused in input/textarea/contenteditable
  const active = document.activeElement;
  if (active && active !== document.body) {
    if (typeof HTMLTextAreaElement !== "undefined" && active instanceof HTMLTextAreaElement) {
      if (active.value && active.value.trim().length > 0) {
        return true;
      }
    } else if (typeof HTMLInputElement !== "undefined" && active instanceof HTMLInputElement) {
      const editableTypes = ["text", "search", "url", "tel", "email", "password", "number"];
      if (editableTypes.includes(active.type) && active.value && active.value.trim().length > 0) {
        return true;
      }
    } else if ((active as HTMLElement).isContentEditable) {
      return true;
    }
  }

  // 4. Form inputs that have been modified from their initial default values
  if (document.forms && document.forms.length > 0) {
    for (let i = 0; i < document.forms.length; i++) {
      const form = document.forms[i];
      if (form.getAttribute("data-dirty") === "true") return true;

      const elements = form.elements;
      if (!elements) continue;

      for (let j = 0; j < elements.length; j++) {
        const el = elements[j];
        if (typeof HTMLInputElement !== "undefined" && el instanceof HTMLInputElement) {
          if (["text", "search", "url", "tel", "email", "password", "number"].includes(el.type)) {
            if (el.defaultValue !== undefined && el.value !== el.defaultValue) {
              return true;
            }
          } else if (["checkbox", "radio"].includes(el.type)) {
            if (el.defaultChecked !== undefined && el.checked !== el.defaultChecked) {
              return true;
            }
          }
        } else if (typeof HTMLTextAreaElement !== "undefined" && el instanceof HTMLTextAreaElement) {
          if (el.defaultValue !== undefined && el.value !== el.defaultValue) {
            return true;
          }
        } else if (typeof HTMLSelectElement !== "undefined" && el instanceof HTMLSelectElement) {
          for (let k = 0; k < el.options.length; k++) {
            const opt = el.options[k];
            if (opt.defaultSelected !== undefined && opt.defaultSelected !== opt.selected) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

export interface RegisterSWOptions {
  swUrl?: string;
  scope?: string;
  force?: boolean;
  onWaiting?: (worker: ServiceWorker) => void;
  onUpdateFound?: (worker: ServiceWorker) => void;
}

/**
 * Sets up a listener on navigator.serviceWorker 'controllerchange' event.
 * Guards against reloading on first-time PWA installation when self.clients.claim()
 * takes control of an uncontrolled client (navigator.serviceWorker.controller === null).
 * Only reloads when an existing controller was replaced.
 */
export function setupControllerChangeListener(
  onReload: () => void = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }
): (() => void) | undefined {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return undefined;
  }

  let hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  const handleControllerChange = () => {
    // If there was no controller when this page loaded, this controllerchange event
    // is caused by the initial Service Worker activating and claiming clients.
    // We must NOT reload the page on first install!
    if (!hadController) {
      hadController = true;
      return;
    }

    if (refreshing) return;
    refreshing = true;
    onReload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
  };
}

/**
 * Registers /sw.js with controlled update detection.
 * Only registers on window load in production, or when NEXT_PUBLIC_ENABLE_SW is enabled in dev.
 */
export async function registerServiceWorker(
  options: RegisterSWOptions = {}
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const isDevEnabled = process.env.NEXT_PUBLIC_ENABLE_SW === "true";
  const force = options.force ?? Boolean(window.__QCET_FORCE_SW_REGISTER__);

  // If in development and not explicitly enabled, check existing registration for waiting worker
  if (!isProduction && !isDevEnabled && !force) {
    try {
      const existingReg = await navigator.serviceWorker.getRegistration(options.scope || "/");
      if (existingReg?.waiting && options.onWaiting) {
        options.onWaiting(existingReg.waiting);
      }
      return existingReg || null;
    } catch {
      return null;
    }
  }

  try {
    const scope = options.scope || "/";
    const registration = options.swUrl
      ? await navigator.serviceWorker.register(options.swUrl, { scope })
      : await navigator.serviceWorker.register("/sw.js", { scope });

    // 1. Existing waiting worker (downloaded from previous session)
    if (registration.waiting && options.onWaiting) {
      options.onWaiting(registration.waiting);
    }

    // 2. Listen for newly discovered updates
    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed") {
          // If navigator.serviceWorker.controller exists, this installed worker is an update
          if (navigator.serviceWorker.controller) {
            if (options.onWaiting) {
              options.onWaiting(installingWorker);
            }
            if (options.onUpdateFound) {
              options.onUpdateFound(installingWorker);
            }
          }
        }
      });
    });

    return registration;
  } catch (error) {
    console.error("ServiceWorker registration failed:", error);
    return null;
  }
}

/**
 * Sends SKIP_WAITING to waiting worker with dirty-form protection.
 */
export function applyServiceWorkerUpdate(
  waitingWorker?: ServiceWorker | null,
  options?: {
    force?: boolean;
    onBlockedByUnsaved?: () => void;
  }
): boolean {
  if (typeof window === "undefined") return false;

  const isDirty = !options?.force && checkHasUnsavedChanges();
  if (isDirty) {
    if (options?.onBlockedByUnsaved) {
      options.onBlockedByUnsaved();
    }
    return false;
  }

  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration("/").then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } else {
        window.location.reload();
      }
    });
    return true;
  }

  window.location.reload();
  return true;
}

/**
 * PWA Service Worker Manager Component.
 * Replaces inline fire-and-forget registration script with safe update lifecycle management.
 */
export function PWAServiceWorkerManager() {
  const [waitingWorker, setWaitingWorker] = React.useState<ServiceWorker | null>(null);
  const [updateAvailable, setUpdateAvailable] = React.useState<boolean>(false);
  const [hasUnsaved, setHasUnsaved] = React.useState<boolean>(false);
  const [isUpdating, setIsUpdating] = React.useState<boolean>(false);
  const [dismissed, setDismissed] = React.useState<boolean>(false);

  // 1. Listen to navigator.serviceWorker.oncontrollerchange to reload smoothly (ignoring first-time client claim)
  React.useEffect(() => {
    return setupControllerChangeListener();
  }, []);

  // 2. Register Service Worker on window load in production (or when enabled in dev) - runs once on mount
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let isMounted = true;

    const handleWaitingWorker = (worker: ServiceWorker) => {
      if (!isMounted) return;
      setWaitingWorker(worker);
      setUpdateAvailable(true);
      setHasUnsaved(checkHasUnsavedChanges());
    };

    const runRegistration = () => {
      void registerServiceWorker({
        onWaiting: handleWaitingWorker,
        onUpdateFound: handleWaitingWorker,
      });
    };

    if (document.readyState === "complete") {
      runRegistration();
    } else {
      window.addEventListener("load", runRegistration, { once: true });
    }

    // Optional manual update check trigger
    const handleManualCheck = () => {
      runRegistration();
    };
    window.addEventListener("qcet:check-sw-update", handleManualCheck);

    return () => {
      isMounted = false;
      window.removeEventListener("load", runRegistration);
      window.removeEventListener("qcet:check-sw-update", handleManualCheck);
    };
  }, []);

  // 3. Keep dirty status updated on user typing / form interactions when update banner is displayed
  React.useEffect(() => {
    if (typeof window === "undefined" || !updateAvailable) return;

    const handleActivity = () => {
      setHasUnsaved(checkHasUnsavedChanges());
    };

    window.addEventListener("input", handleActivity, { passive: true });
    window.addEventListener("change", handleActivity, { passive: true });

    return () => {
      window.removeEventListener("input", handleActivity);
      window.removeEventListener("change", handleActivity);
    };
  }, [updateAvailable]);

  // 3. User update action
  const handleUpdate = React.useCallback(() => {
    const isDirty = checkHasUnsavedChanges();
    if (isDirty) {
      setHasUnsaved(true);
      return;
    }

    setIsUpdating(true);
    const success = applyServiceWorkerUpdate(waitingWorker, {
      force: false,
      onBlockedByUnsaved: () => {
        setIsUpdating(false);
        setHasUnsaved(true);
      },
    });

    if (success) {
      // Fallback reload in case controllerchange does not fire within 3.5s
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 3500);
    }
  }, [waitingWorker]);

  const handleDismiss = React.useCallback(() => {
    setDismissed(true);
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <PWAUpdateDialog
      isOpen={updateAvailable && !dismissed}
      hasUnsavedChanges={hasUnsaved}
      isUpdating={isUpdating}
      onUpdate={handleUpdate}
      onDismiss={handleDismiss}
    />
  );
}

export default PWAServiceWorkerManager;
