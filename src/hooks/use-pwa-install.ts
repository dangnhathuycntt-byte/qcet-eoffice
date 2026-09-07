'use client';

import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface UsePWAInstallReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  installApp: () => Promise<'accepted' | 'dismissed' | null>;
}

/**
 * Checks whether the browser is running on an iOS device
 * (iPhone, iPad, iPod, or modern iPadOS reporting as Macintosh with multi-touch).
 */
export function checkIsIOS(userAgent?: string, maxTouchPoints?: number): boolean {
  const ua =
    userAgent !== undefined
      ? userAgent
      : typeof navigator !== 'undefined'
      ? navigator.userAgent
      : '';

  if (!ua) {
    return false;
  }

  const touchPoints =
    maxTouchPoints !== undefined
      ? maxTouchPoints
      : typeof navigator !== 'undefined'
      ? navigator.maxTouchPoints || 0
      : 0;

  // Classic iOS UA pattern
  if (/iPad|iPhone|iPod/.test(ua)) {
    return true;
  }

  // Modern iPadOS 13+ reports Macintosh with multitouch capability
  if (/Macintosh|MacIntel/.test(ua) && touchPoints > 1) {
    return true;
  }

  return false;
}

/**
 * Checks whether the application is running in standalone mode (already installed).
 */
export function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const isMatchMedia =
    window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;

  const isNavigatorStandalone = Boolean(
    (navigator as unknown as { standalone?: boolean }).standalone
  );

  return isMatchMedia || isNavigatorStandalone;
}

/**
 * Hook to manage PWA installation state and deferred prompt actions.
 */
export function usePWAInstall(): UsePWAInstallReturn {
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const standalone = checkIsStandalone();
    setIsStandalone(standalone);
    if (standalone) {
      setIsInstalled(true);
    }

    setIsIOS(checkIsIOS());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setIsInstallable(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredPrompt) {
      return null;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);

      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      return choice.outcome;
    } catch (err) {
      console.error('PWA install prompt error:', err);
      setDeferredPrompt(null);
      return null;
    }
  }, [deferredPrompt]);

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isStandalone,
    installApp,
  };
}
