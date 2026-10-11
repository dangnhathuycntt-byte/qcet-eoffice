"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface State {
  records: Array<{ id: string; signatureType: string; signerName: string | null; signedAt: string; version: number }>;
  canInitialSign: boolean;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

/** Ký nháy văn bản đi (V-09): tùy chọn, hiện danh sách người đã ký nháy và nút cho người có thẩm quyền. */
export function OutgoingInitialSign({ documentId, className }: { documentId: string; className?: string }) {
  const [state, setState] = React.useState<State | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/signatures`, { cache: "no-store" });
      setState(res.ok ? await res.json() : null);
    } catch {
      setState(null);
    }
  }, [documentId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const sign = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/actions/initial-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error((json && (json.detail || json.error || json.title)) || "Không ký nháy được");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không ký nháy được");
    } finally {
      setBusy(false);
    }
  };

  const initials = (state?.records ?? []).filter((r) => r.signatureType === "INITIAL");
  if (!state || (initials.length === 0 && !state.canInitialSign)) return null;

  return (
    <section aria-label="Ký nháy" className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-compact font-semibold text-foreground">Ký nháy</h3>
        <span className="text-xs text-muted-foreground">Tùy chọn</span>
      </div>
      {initials.length > 0 && (
        <ul className="space-y-0.5">
          {initials.map((r) => (
            <li key={r.id} className="text-xs text-foreground">
              {r.signerName ?? "—"} <span className="text-muted-foreground">· {fmt(r.signedAt)}{r.version > 1 ? ` · bản ${r.version}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {state.canInitialSign && (
        <Button size="xs" variant="ghost" disabled={busy} onClick={() => void sign()}>
          Ký nháy
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
