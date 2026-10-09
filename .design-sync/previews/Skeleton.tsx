import React from "react";
import { Skeleton, SkeletonText } from "qcet-eoffice";

export function TaskRows() {
  return (
    <div style={{ width: 420, padding: 20, display: "flex", flexDirection: "column", gap: 16 }} aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Skeleton className="size-4 rounded-full" />
          <div style={{ flex: 1 }}>
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function Paragraph() {
  return (
    <div style={{ width: 360, padding: 20 }}>
      <SkeletonText lines={4} />
    </div>
  );
}
