"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TaskAddChip } from "./task-add-chip";

interface DeclineState {
  declined: { by: { id: string; name: string }; reason: string; at: string } | null;
  canDecline: boolean;
  version: number;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

export interface TaskDeclineProps {
  taskId: string;
  version: number;
  status?: string;
  onVersionChange?: (version: number) => void;
  className?: string;
}

/**
 * Từ chối nhận việc (T-02). Không có trạng thái "từ chối" (ADR-003): người chủ trì giữ nguyên
 * cho đến khi người giao giao lại, nên khối này chỉ ghi lý do và báo cho mọi người trong nhiệm vụ.
 */
export function TaskDecline({ taskId, version, status, onVersionChange, className }: TaskDeclineProps) {
  const [state, setState] = React.useState<DeclineState | null>(null);
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/actions/decline`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Không tải được trạng thái nhận việc"));
      setState(await res.json());
    } catch {
      setState(null);
    }
  }, [taskId]);

  React.useEffect(() => {
    void load();
  }, [load, status, version]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/actions/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), expectedVersion: version }),
      });
      if (!res.ok) throw new Error(await readError(res, "Không gửi được lý do từ chối"));
      const json = await res.json();
      onVersionChange?.(json.data?.version ?? version + 1);
      setOpen(false);
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được lý do từ chối");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  if (!state.declined && !state.canDecline) return null;
  const declineForm = (
    <div className="space-y-1.5">
      <Textarea
        compact
        value={reason}
        maxLength={1000}
        aria-label="Lý do từ chối nhận việc"
        placeholder="Nêu lý do (bắt buộc)"
        countOnlyNearLimit
        onChange={(e) => setReason(e.target.value)}
        className="min-h-16"
      />
      <div className="flex gap-1.5">
        <Button type="button" size="xs" variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void submit()}>
          Gửi từ chối
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={() => { setOpen(false); setReason(""); setError(null); }}>
          Hủy
        </Button>
      </div>
    </div>
  );
  if (!state.declined) {
    return (
      <TaskAddChip
        icon={false}
        panelTitle="Lý do không nhận việc"
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) { setReason(""); setError(null); }
        }}
        panel={<>{declineForm}{error && <InlineAlert variant="error">{error}</InlineAlert>}</>}
      >
        Từ chối nhận việc
      </TaskAddChip>
    );
  }

  return (
    <section aria-label="Nhận việc" className={cn("space-y-2 px-4", className)}>
      {state.declined ? (
        <InlineAlert variant="warning">
          {state.declined.by.name} đã từ chối nhận việc: {state.declined.reason}. Chờ người giao giao lại.
        </InlineAlert>
      ) : open ? (
        declineForm
      ) : (
        <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(true)}>
          Từ chối nhận việc
        </Button>
      )}
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
    </section>
  );
}
