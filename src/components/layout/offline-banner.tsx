"use client";

/**
 * QCET E-Office - Canonical Offline & Sync Banner
 * Delegates directly to PWASyncStatusBar for true connectivity detection,
 * progressive outbox sync, and conflict management.
 */

import * as React from "react";
import { PWASyncStatusBar } from "@/components/pwa/pwa-sync-status";

export function OfflineBanner() {
  return <PWASyncStatusBar />;
}
