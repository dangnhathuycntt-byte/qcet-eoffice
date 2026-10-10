"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ReturnRow {
  id: string;
  fromUnit: { name: string };
  toUnit: { name: string } | null;
  returnedBy: { name: string };
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
  rerouteNote: string | null;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

/** Lịch sử trả lại, chuyển lại văn bản đến (V-01). Không hiện nếu chưa từng trả lại. */
export function IncomingReturnHistory({ documentId, refreshKey, className }: { documentId: string; refreshKey?: string; className?: string }) {
  const [rows, setRows] = React.useState<ReturnRow[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void fetch(`/api/documents/${documentId}/returns`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { returns: [] }))
      .then((json) => !cancelled && setRows(json.returns ?? []))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [documentId, refreshKey]);

  if (rows.length === 0) return null;
  return (
    <section aria-label="Lịch sử trả lại" className={cn("space-y-1", className)}>
      <h3 className="text-compact font-semibold text-foreground">Lịch sử trả lại</h3>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.id} className="text-xs text-foreground">
            <span className="font-medium">{r.fromUnit.name}</span> trả lại ngày {fmt(r.createdAt)}: {r.reason}
            <span className="text-muted-foreground">
              {r.toUnit ? ` · chuyển sang ${r.toUnit.name}${r.resolvedAt ? ` ngày ${fmt(r.resolvedAt)}` : ""}` : " · chờ chuyển lại"}
              {r.rerouteNote ? ` (${r.rerouteNote})` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
