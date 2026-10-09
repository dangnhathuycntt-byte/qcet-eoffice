"use client";

import * as React from "react";
import type { DocumentItem } from "@/types/document";
import { fromDocumentItem } from "@/lib/documents/document-view-model";
import { DocumentFullPage } from "./document-full-page";
import { DocumentInfoSections, DocumentSummaryBlock } from "./document-workspace-parts";

const BREADCRUMB = {
  incoming: { href: "/documents?type=inbox", label: "Văn bản đến" },
  outgoing: { href: "/documents?type=outbox", label: "Văn bản đi" },
  submission: { href: "/documents?type=submission", label: "Tờ trình nội bộ" },
} as const;

/**
 * Full Page cho loại văn bản chưa có trang riêng (tờ trình nội bộ): dùng đúng bộ khung, view model
 * và các phần thông tin của Quick View.
 */
export function GenericDocumentDetailView({ item }: { item: DocumentItem }) {
  const vm = React.useMemo(() => fromDocumentItem(item), [item]);
  const crumb = BREADCRUMB[vm.kind];
  return (
    <DocumentFullPage
      docId={vm.id}
      breadcrumb={{ href: crumb.href, label: crumb.label, current: vm.numberLabel ?? vm.documentNumber ?? "Chi tiết" }}
      header={<DocumentSummaryBlock vm={vm} />}
      files={vm.files}
      panel={<DocumentInfoSections vm={vm} item={item} />}
    />
  );
}
