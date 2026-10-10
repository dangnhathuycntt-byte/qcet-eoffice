"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDepartmentList } from "@/hooks/use-department-list";
import { cn } from "@/lib/utils";

interface RequestView {
  id: string;
  targetUnit: { id: string; name: string };
  note: string | null;
  status: "PENDING" | "ASSIGNED" | "DECLINED" | "CANCELLED";
  assignee: { id: string; name: string } | null;
  decisionNote: string | null;
  respondBy: string | null;
  overdue: boolean;
  canCancel: boolean;
}

const STATUS_LABEL: Record<RequestView["status"], string> = {
  PENDING: "Chờ trả lời",
  ASSIGNED: "Đã cử người",
  DECLINED: "Bị từ chối",
  CANCELLED: "Đã rút lại",
};

const RESPOND_OPTIONS = [
  { value: "1", label: "Trả lời trong 1 ngày" },
  { value: "3", label: "Trả lời trong 3 ngày" },
  { value: "5", label: "Trả lời trong 5 ngày" },
  { value: "7", label: "Trả lời trong 7 ngày" },
];

const formatDay = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

/**
 * Phối hợp liên đơn vị (T-12): người giao đề nghị đơn vị khác cử người; trưởng đơn vị đó trả lời.
 * Chỉ hiện khi người xem gửi được yêu cầu hoặc nhiệm vụ đã có yêu cầu.
 */
export function TaskUnitRequests({ taskId, onChanged, className }: { taskId: string; onChanged?: () => void; className?: string }) {
  const [state, setState] = React.useState<{ requests: RequestView[]; canRequest: boolean } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [unitId, setUnitId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [respondInDays, setRespondInDays] = React.useState("3");
  const { departments } = useDepartmentList({ enabled: adding });

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/unit-requests`, { cache: "no-store" });
      if (!res.ok) {
        setState(null);
        return;
      }
      setState(await res.json());
    } catch {
      setState(null);
    }
  }, [taskId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const send = async (path: string, body: Record<string, unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await readError(res, fallback));
      setAdding(false);
      setUnitId(null);
      setNote("");
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  if (!state || (!state.canRequest && state.requests.length === 0)) return null;

  return (
    <section aria-label="Phối hợp liên đơn vị" className={cn("space-y-1.5", className)}>
      <h2 className="text-compact font-semibold text-foreground tracking-tight">Phối hợp liên đơn vị</h2>
      {state.requests.length > 0 && (
        <ul className="space-y-0.5">
          {state.requests.map((r) => (
            <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground" title={r.note ?? undefined}>
                {r.targetUnit.name}
                {r.assignee ? <span className="text-muted-foreground"> · {r.assignee.name}</span> : null}
                {r.decisionNote ? <span className="text-muted-foreground"> · {r.decisionNote}</span> : null}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                {r.status === "PENDING" && r.respondBy ? (
                  <span className={r.overdue ? "text-destructive" : undefined}>{r.overdue ? "Quá hạn trả lời" : "Hạn trả lời"} {formatDay(r.respondBy)}</span>
                ) : null}
                {STATUS_LABEL[r.status]}
                {r.canCancel ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void send(`/api/tasks/${taskId}/actions/fulfill-unit-request`, { requestId: r.id, decision: "CANCEL" }, "Không rút lại được")}
                  >
                    Rút lại
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {state.canRequest && !adding && (
        <Button type="button" size="xs" variant="ghost" onClick={() => setAdding(true)}>
          Đề nghị đơn vị khác phối hợp
        </Button>
      )}
      {adding && (
        <div className="space-y-1.5">
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Đơn vị được đề nghị"
            placeholder="— Chọn đơn vị —"
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            value={unitId}
            onValueChange={(v) => setUnitId(v || null)}
          />
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Hạn trả lời"
            options={RESPOND_OPTIONS}
            value={respondInDays}
            onValueChange={(v) => setRespondInDays(v || "3")}
          />
          <Textarea compact value={note} maxLength={1000} aria-label="Nội dung đề nghị" placeholder="Cần đơn vị hỗ trợ việc gì (không bắt buộc)" onChange={(e) => setNote(e.target.value)} className="min-h-14" />
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="xs"
              disabled={busy || !unitId}
              onClick={() => void send(`/api/tasks/${taskId}/unit-requests`, { targetUnitId: unitId, respondInDays: Number(respondInDays), ...(note.trim() ? { note: note.trim() } : {}) }, "Không gửi được đề nghị")}
            >
              Gửi đề nghị
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setAdding(false)}>
              Hủy
            </Button>
          </div>
        </div>
      )}
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
    </section>
  );
}
