import * as React from "react";
import { DocumentFullPageSkeleton } from "@/components/documents/workspace/document-full-page-skeleton";

export default function DocumentDetailLoading() {
  return <DocumentFullPageSkeleton label="Đang tải chi tiết văn bản" />;
}
