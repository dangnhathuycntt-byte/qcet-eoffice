"use client";

/**
 * QCET E-Office - Canonical Offline & Sync Banner
 * Delegates directly to PWASyncStatusBar for true connectivity detection,
 * progressive outbox sync, and conflict management.
 * Avoids colliding with mobile bottom navigation bar via bottom-[calc(4.5rem+env(safe-area-inset-bottom))].
 */

import * as React from "react";
import { PWASyncStatusBar } from "@/components/pwa/pwa-sync-status";

export function OfflineBanner() {
  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 md:bottom-4 pointer-events-none">
      <div className="pointer-events-auto">
        <PWASyncStatusBar />
      </div>
    </div>
  );
}
