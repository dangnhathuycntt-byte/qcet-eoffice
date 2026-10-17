"use client";

import * as React from "react";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { IconSidebarFolder } from "@/components/layout/sidebar-rounded-icons";

interface DisposedDossier {
  id: string;
  code: string;
  title: string;
  disposedAt: string | null;
  itemCount: number;
  minutesReference: string | null;
}

/** Lỗi có thể thử lại hay không: 401/403 thì thử lại cũng vậy. */
interface LoadError {
  message: string;
  retry: boolean;
}

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "Phiên đăng nhập đã hết hạn. Thầy/Cô đăng nhập lại để tiếp tục.";
  if (res.status === 403) return "Chỉ tài khoản quản trị hệ thống mới xem và xóa hẳn được hồ sơ đã hủy.";
  const json = await res.json().catch(() => null);
  const detail = json && (json.detail || json.error?.message || json.message);
  return typeof detail === "string" && detail ? detail : fallback;
}

const DATE = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const formatDate = (raw: string | null) => (raw ? DATE.format(new Date(raw)) : "—");

/**
 * Hồ sơ chờ xóa hẳn (`/admin/dossiers`, nhóm "Quản trị" trong menu "Thêm"): hồ sơ đã có quyết định hủy và biên bản, quản trị hệ thống
 * xóa hẳn (V-07). Quyền do máy chủ quyết định (`/api/admin/*` chỉ cho quản trị). Dựng lại 15/10/2026 theo khung một thẻ.
 */
export function DisposedDossiersView() {
  const [items, setItems] = React.useState<DisposedDossier[] | null>(null);
  const [error, setError] = React.useState<LoadError | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<DisposedDossier | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dossiers", { cache: "no-store" });
      if (!res.ok) {
        setError({ message: await readError(res, "Chưa tải được danh sách hồ sơ."), retry: res.status !== 401 && res.status !== 403 });
        return;
      }
      const json = await res.json();
      setItems(json?.data?.items ?? json?.items ?? []);
      setError(null);
    } catch {
      setError({ message: "Mất kết nối khi tải danh sách hồ sơ.", retry: true });
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
      if (!res.ok) throw new Error(await readError(res, "Chưa xóa hẳn được hồ sơ."));
      setNotice(`Đã xóa hẳn hồ sơ ${target.code}. Tệp không còn nơi dùng sẽ được dọn nền.`);
      setError(null);
      setTarget(null);
      await load();
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Chưa xóa hẳn được hồ sơ.", retry: false });
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkspacePageCard
      title="Hồ sơ chờ xóa hẳn"
      description="Hồ sơ đã có quyết định hủy và biên bản. Xóa hẳn chỉ xóa hồ sơ, các mục và tệp không còn nơi khác dùng; văn bản trong hồ sơ giữ nguyên."
      hideTitleOnMobile
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-4 pb-6">
        {notice ? <InlineAlert variant="info">{notice}</InlineAlert> : null}
        {error ? (
          <InlineAlert actionLabel={error.retry ? "Thử lại" : undefined} onAction={error.retry ? () => void load() : undefined}>
            {error.message}
          </InlineAlert>
        ) : null}
        {items === null ? (
          error ? null : (
            <div aria-busy className="flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <EmptyState
            density="compact"
            illustration="all-done"
            title="Không có hồ sơ nào chờ xóa hẳn"
            description="Hồ sơ được hủy theo quyết định và có biên bản sẽ hiện ở đây."
          />
        ) : (
          <ul className="-mx-2 flex flex-col">
            {items.map((d) => (
              <li key={d.id} className="flex h-12 items-center gap-3 rounded-md px-2">
                <IconSidebarFolder aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-compact font-medium text-foreground" title={d.title}>
                    {d.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {d.code} · Hủy ngày {formatDate(d.disposedAt)} · Biên bản {d.minutesReference ?? "—"} · {d.itemCount} mục
                  </span>
                </div>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => setTarget(d)}>
                  Xóa hẳn
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <DestructiveConfirmDialog
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={purge}
        isConfirming={busy}
        title="Xóa hẳn hồ sơ?"
        description={target ? `Hồ sơ ${target.code} (${target.itemCount} mục) sẽ bị xóa khỏi hệ thống. Văn bản trong hồ sơ được giữ nguyên; tệp không còn nơi khác dùng sẽ bị xóa khỏi đĩa.` : undefined}
        confirmLabel="Xóa hẳn"
      />
    </WorkspacePageCard>
  );
}
