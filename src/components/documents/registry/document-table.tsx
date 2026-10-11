"use client";

import * as React from "react";
import { OfficialDocument } from "@/types/document";

export interface DocumentTableProps {
  documents: OfficialDocument[];
  selectedDocument?: OfficialDocument | null;
  selectedIds?: Set<string>;
  onSelectDocument?: (doc: OfficialDocument) => void;
  onToggleSelect?: (docId: string, isShift?: boolean) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onViewPdf?: (doc: OfficialDocument) => void;
  onLinkTask?: (doc: OfficialDocument) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  selectable?: boolean;
}
