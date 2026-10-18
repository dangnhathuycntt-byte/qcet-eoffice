"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SignatureState {
  incoming: { status: string; flagged: boolean; detail: string | null; checkedAt: string | null } | null;
  canRecheck: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  VALID: "Hợp lệ",
  INVALID: "Không hợp lệ",
  REVOKED: "Chứng thư đã bị thu hồi",
  UNVERIFIED: "Chưa xác thực",
};

/**
 * Trạng thái chữ ký số của bên gửi trên văn bản đến (V-03). Chưa xác thực được coi như chưa hợp lệ:
 * hiện cảnh báo, không bao giờ hiện là hợp lệ khi nhà cung cấp chưa xác nhận.
 */
export function IncomingSignatureStatus({ documentId, className, row }: { documentId: string; className?: string; row?: boolean }) {
  const [state, setState] = React.useState<SignatureState | null>(null);
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

  const recheck = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/actions/verify-signature`, { method: "POST" });
      if (!res.ok) throw new Error("Không kiểm lại được chữ ký số");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không kiểm lại được chữ ký số");
    } finally {
      setBusy(false);
    }
  };

  if (!state?.incoming) return null;
  const { status, flagged, detail } = state.incoming;

  const value = (
    <>
      <span className={cn(flagged ? "text-warning" : "text-foreground")}>{STATUS_LABEL[status] ?? status}</span>
      {flagged && detail ? <span className="text-muted-foreground">· {detail}</span> : null}
      {state.canRecheck ? (
        <Button size="xs" variant="ghost" disabled={busy} onClick={() => void recheck()}>
          Kiểm lại
        </Button>
      ) : null}
      {error ? <span className="text-destructive">{error}</span> : null}
    </>
  );

  if (row) {
    // Quick View: cùng cột nhãn 112px và nhịp hàng với lưới thuộc tính phía trên (bù khoảng cách 12px của thân)
    return (
      <div className={cn("-mt-3 grid min-h-7 grid-cols-[112px_minmax(0,1fr)] items-start gap-2 py-0.5", className)}>
        <span className="flex h-6 items-center whitespace-nowrap text-xs text-muted-foreground">Chữ ký số</span>
        <span className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-1.5 text-compact">{value}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", className)}>
      <span className="text-muted-foreground">Chữ ký số của bên gửi</span>
      <span className={cn("font-medium", flagged ? "text-warning" : "text-foreground")}>{STATUS_LABEL[status] ?? status}</span>
      {flagged && detail ? <span className="text-muted-foreground">· {detail}</span> : null}
      {state.canRecheck ? (
        <Button size="xs" variant="ghost" disabled={busy} onClick={() => void recheck()}>
          Kiểm lại
        </Button>
      ) : null}
      {error ? <span className="text-destructive">{error}</span> : null}
    </div>
  );
}
