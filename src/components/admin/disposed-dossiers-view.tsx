"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { cn } from "@/lib/utils";

interface DisposedDossier {
  id: string;
  code: string;
  title: string;
  disposedAt: string | null;
  itemCount: number;
  minutesReference: string | null;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

const formatDate = (raw: string | null) => (raw ? new Date(raw).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—");

/** Danh sách hồ sơ đã hủy và nút xóa hẳn cho quản trị hệ thống (V-07). Quyền do máy chủ quyết định. */
export function DisposedDossiersView({ className }: { className?: string }) {
  const [items, setItems] = React.useState<DisposedDossier[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<DisposedDossier | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dossiers", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Không tải được danh sách hồ sơ"));
      const json = await res.json();
      setItems(json?.data?.items ?? json?.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách hồ sơ");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const purge = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/dossiers/${target.id}/actions/purge`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error(await readError(res, "Không xóa hẳn được hồ sơ"));
      setNotice(`Đã xóa hẳn hồ sơ ${target.code}. Tệp không còn nơi dùng sẽ được dọn nền.`);
      setError(null);
      setTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa hẳn được hồ sơ");
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {notice ? <InlineAlert variant="info">{notice}</InlineAlert> : null}
      {items === null && !error ? <p className="text-compact text-muted-foreground">Đang tải…</p> : null}
      {items?.length === 0 ? <p className="text-compact text-muted-foreground">Không có hồ sơ nào chờ xóa hẳn.</p> : null}
      {items && items.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-compact text-foreground" title={d.title}>{d.code} · {d.title}</p>
                <p className="text-xs text-muted-foreground">
                  Hủy ngày {formatDate(d.disposedAt)} · Biên bản {d.minutesReference ?? "—"} · {d.itemCount} mục
                </p>
              </div>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => setTarget(d)}>
                Xóa hẳn
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <DestructiveConfirmDialog
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={purge}
        isConfirming={busy}
        title="Xóa hẳn hồ sơ?"
        description={target ? `Hồ sơ ${target.code} (${target.itemCount} mục) sẽ bị xóa khỏi hệ thống. Văn bản trong hồ sơ được giữ nguyên; tệp không còn nơi khác dùng sẽ bị xóa khỏi đĩa.` : undefined}
        confirmLabel="Xóa hẳn"
      />
    </div>
  );
}
