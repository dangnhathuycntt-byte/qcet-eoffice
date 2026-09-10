"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const DocumentRegistryView = dynamic(
  () =>
    import("@/components/documents/document-registry-view").then(
      (m) => m.DocumentRegistryView
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-muted/60 rounded-xl w-1/3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-24 bg-muted/40 rounded-2xl" />
          <div className="h-24 bg-muted/40 rounded-2xl" />
          <div className="h-24 bg-muted/40 rounded-2xl" />
          <div className="h-24 bg-muted/40 rounded-2xl" />
        </div>
        <div className="h-64 bg-muted/30 rounded-2xl w-full" />
      </div>
    ),
  }
);

function DocumentsZoneComponent() {
  return (
    <div className="space-y-6" data-slot="zone-documents">
      <React.Suspense
        fallback={
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-muted/60 rounded-xl w-1/3" />
            <div className="h-64 bg-muted/30 rounded-2xl w-full" />
          </div>
        }
      >
        <DocumentRegistryView />
      </React.Suspense>
    </div>
  );
}

export const DocumentsZone = React.memo(DocumentsZoneComponent);
