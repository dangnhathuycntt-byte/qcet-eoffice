"use client";

import * as React from "react";
import { DocumentRegistryView } from "./document-registry-view";

export interface DocumentWorkspaceProps {
  className?: string;
}

/**
 * DocumentWorkspace - Canonical Unified Document Workspace (Sprint 8)
 *
 * Replaces role-specific document views with a single, capability-adaptive workspace.
 * Light-Only, mobile responsive, min 44px touch targets, zero emojis.
 */
export function DocumentWorkspace({ className }: DocumentWorkspaceProps = {}) {
  return (
    <div className={`w-full bg-background text-foreground ${className || ""}`} data-slot="document-workspace">
      <DocumentRegistryView />
    </div>
  );
}

export default DocumentWorkspace;
