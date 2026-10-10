"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DisposalState {
  permanent: boolean;
  retentionEndsAt: string | null;
  expired: boolean;
  disposed: boolean;
  open: { id: string; minutesReference: string; reason: string; createdAt: string } | null;
  history: Array<{ id: string; status: string; minutesReference: string; decidedAt: string | null; extendYears: number | null; decisionNote: string | null }>;
  canPropose: boolean;
  canDecide: boolean;
}

type Mode = "idle" | "propose" | "decide";

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

const formatDate = (raw: string | null) => (raw ? new Date(raw).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—");

/**
 * Xét hủy và gia hạn bảo quản hồ sơ (V-07): Văn thư đề nghị, lãnh đạo quyết định hủy hoặc gia hạn.
 * Quyền lấy từ server (GET /disposal) nên nút chỉ hiện khi người xem thực sự làm được.
 * Xóa hẳn dữ liệu là việc của quản trị hệ thống qua API riêng, không có nút ở đây.
 */
export function DossierDisposalPanel({ dossierId }: { dossierId: string }) {
  const [state, setState] = React.useState<DisposalState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("idle");
  const [minutes, setMinutes] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [extendYears, setExtendYears] = React.useState("");
  const [note, setNote] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/disposal`, { cache: "no-store" });
      if (res.status === 403) {
        setState(null);
        return;
      }
      if (!res.ok) throw new Error(await readError(res, "Không tải được thông tin xét hủy"));
      setState(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được thông tin xét hủy");
    }
  }, [dossierId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const call = async (path: string, body: Record<string, unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/actions/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res, fallback));
      setMode("idle");
      setMinutes("");
      setReason("");
      setExtendYears("");
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  if (!state) return error ? <InlineAlert variant="error">{error}</InlineAlert> : null;
  // Không hiện khi chưa có gì để làm: chưa hết hạn, không có đề nghị mở, không có lịch sử.
  if (!state.expired && !state.open && state.history.length === 0) return null;

  const years = Number(extendYears);
  const yearsValid = Number.isInteger(years) && years >= 1 && years <= 70;

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.06))]" aria-label="Xét hủy hồ sơ">
      <h2 className="mb-3 text-xs font-semibold text-foreground">Xét hủy hồ sơ</h2>
      <div className="space-y-2 text-compact">
        <p className="text-muted-foreground">
          {state.permanent ? "Bảo quản vĩnh viễn" : `Hết hạn bảo quản: ${formatDate(state.retentionEndsAt)}`}
          {state.expired && !state.permanent ? " · đã hết hạn" : ""}
        </p>

        {state.open ? (
          <div className="space-y-1">
            <p className="text-foreground">
              Đang chờ lãnh đạo quyết định · biên bản <span className="font-medium">{state.open.minutesReference}</span>
            </p>
            <p className="text-xs text-muted-foreground">{state.open.reason}</p>
          </div>
        ) : null}

        {state.history.map((h) => (
          <p key={h.id} className="text-xs text-muted-foreground">
            {formatDate(h.decidedAt)} · {h.status === "EXTEND" ? `Gia hạn thêm ${h.extendYears} năm` : "Đã quyết định hủy"} · biên bản {h.minutesReference}
            {h.decisionNote ? ` · ${h.decisionNote}` : ""}
          </p>
        ))}

        {mode === "idle" ? (
          <div className="flex gap-2">
            {state.canPropose ? (
              <Button type="button" size="sm" onClick={() => setMode("propose")}>
                Đề nghị xét hủy
              </Button>
            ) : null}
            {state.canDecide ? (
              <Button type="button" size="sm" onClick={() => setMode("decide")}>
                Quyết định
              </Button>
            ) : null}
          </div>
        ) : null}

        {mode === "propose" ? (
          <div className="space-y-2">
            <Input value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Số biên bản xét hủy" aria-label="Số biên bản xét hủy" />
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do đề nghị" aria-label="Lý do đề nghị" rows={2} />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || minutes.trim().length < 3 || reason.trim().length < 3}
                onClick={() => void call("propose-disposal", { minutesReference: minutes.trim(), reason: reason.trim() }, "Không gửi được đề nghị")}
              >
                Gửi đề nghị
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setMode("idle")}>
                Hủy
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "decide" && state.open ? (
          <div className="space-y-2">
            <Input
              value={extendYears}
              onChange={(e) => setExtendYears(e.target.value.replace(/\D/g, ""))}
              placeholder="Số năm gia hạn (chỉ khi gia hạn)"
              aria-label="Số năm gia hạn"
              inputMode="numeric"
            />
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú quyết định" rows={2} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void call("dispose", { proposalId: state.open!.id, decision: "DISPOSE", note: note.trim() || undefined }, "Không ghi nhận được quyết định")}
              >
                Hủy hồ sơ
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || !yearsValid}
                onClick={() => void call("dispose", { proposalId: state.open!.id, decision: "EXTEND", extendYears: years, note: note.trim() || undefined }, "Không ghi nhận được quyết định")}
              >
                Gia hạn bảo quản
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setMode("idle")}>
                Đóng
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      </div>
    </section>
  );
}
