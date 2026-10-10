"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Select } from "@/components/ui/select";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { cn } from "@/lib/utils";
import { TaskAddPanel } from "./task-add-chip";

interface BackupView {
  backup: { userId: string; name: string; active: boolean } | null;
  canEdit: boolean;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

/**
 * Người duyệt dự phòng (T-05): chỉ nhận việc khi kết quả chờ duyệt đủ 96 giờ.
 * Chỉ hiện cho người giao (canEdit) hoặc khi đã có người dự phòng.
 */
export function TaskBackupReviewer({ taskId, className }: { taskId: string; className?: string }) {
  const [view, setView] = React.useState<BackupView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const { personnel } = usePersonnelList({ enabled: editing });

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/backup-reviewer`, { cache: "no-store" });
      if (!res.ok) {
        setView(null);
        return;
      }
      setView(await res.json());
    } catch {
      setView(null);
    }
  }, [taskId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async (next: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/backup-reviewer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: next }),
      });
      if (!res.ok) throw new Error(await readError(res, "Không lưu được người duyệt dự phòng"));
      setView(await res.json());
      setEditing(false);
      setUserId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được người duyệt dự phòng");
    } finally {
      setBusy(false);
    }
  };

  if (!view || (!view.backup && !view.canEdit)) return null;
  const editForm = (
    <div className="space-y-1.5">
      <Select
        compact
        positionerClassName="z-50"
        aria-label="Người duyệt dự phòng"
        placeholder="— Chọn người —"
        options={personnel.map((p) => ({ value: p.id, label: p.name }))}
        value={userId}
        onValueChange={(v) => setUserId(v || null)}
      />
      <div className="flex gap-1.5">
        <Button type="button" size="xs" disabled={busy || !userId} onClick={() => void save(userId)}>
          Lưu
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(false)}>
          Hủy
        </Button>
      </div>
    </div>
  );
  if (!view.backup) {
    return (
      <TaskAddPanel entry="backup" label="Người duyệt dự phòng" open={editing} onOpenChange={setEditing} panel={<>{editForm}{error ? <InlineAlert variant="error">{error}</InlineAlert> : null}</>} />
    );
  }

  return (
    <section aria-label="Người duyệt dự phòng" className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-compact font-semibold text-foreground tracking-tight">Người duyệt dự phòng</h2>
        {view.backup?.active ? <span className="text-xs text-warning">Đang duyệt thay</span> : null}
      </div>

      {view.backup && !editing ? (
        <p className="text-compact text-foreground">
          {view.backup.name}
          <span className="text-xs text-muted-foreground"> · nhận việc khi chờ duyệt quá 4 ngày</span>
        </p>
      ) : null}
      {!view.backup && !editing ? <p className="text-xs text-muted-foreground">Chưa chỉ định. Người dự phòng nhận việc duyệt khi chờ duyệt quá 4 ngày.</p> : null}

      {view.canEdit && !editing ? (
        <div className="flex gap-1.5">
          <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(true)}>
            {view.backup ? "Đổi" : "Chỉ định"}
          </Button>
          {view.backup ? (
            <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={() => void save(null)}>
              Gỡ
            </Button>
          ) : null}
        </div>
      ) : null}

      {editing ? editForm : null}

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
    </section>
  );
}
