"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Textarea } from "@/components/ui/textarea";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { cn } from "@/lib/utils";

interface ExtensionRequestView {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COUNTERED" | "ACCEPTED" | "DECLINED";
  requestedBy: { id: string; name: string };
  requestedDueDate: string;
  counterDueDate: string | null;
  reason: string;
  decisionNote: string | null;
}

interface ExtensionView {
  active: ExtensionRequestView | null;
  appliedCount: number;
  canRequest: boolean;
  canDecide: boolean;
  canRespond: boolean;
  version: number;
  dueDate: string;
}

const TZ = "Asia/Ho_Chi_Minh";

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Ngày YYYY-MM-DD theo giờ Việt Nam của một mốc thời gian, dùng làm giới hạn nhỏ nhất của lịch chọn. */
function ictDay(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

export interface TaskExtensionProps {
  taskId: string;
  /** Phiên bản nhiệm vụ trên trang; gửi kèm các lệnh đổi hạn. */
  version: number;
  status?: string;
  /** Báo trang cập nhật hạn và phiên bản sau khi hạn đổi hoặc yêu cầu được tạo. */
  onTaskChange?: (change: { version: number; dueDate?: string }) => void;
  className?: string;
}

type Mode = "idle" | "request" | "reject" | "counter";

/**
 * Xin gia hạn (T-01). Người thực hiện chính xin; người giao đồng ý, từ chối kèm lý do
 * hoặc đề xuất hạn khác; người xin nhận hoặc không nhận hạn đề xuất.
 */
export function TaskExtension({ taskId, version, status, onTaskChange, className }: TaskExtensionProps) {
  const [view, setView] = React.useState<ExtensionView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>("idle");
  const [date, setDate] = React.useState("");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/extensions`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Không tải được yêu cầu gia hạn"));
      setView(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được yêu cầu gia hạn");
    }
  }, [taskId]);

  React.useEffect(() => {
    void load();
  }, [load, status]);

  const reset = () => {
    setMode("idle");
    setDate("");
    setText("");
  };

  const send = async (path: string, body: Record<string, unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/actions/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res, fallback));
      const json = await res.json();
      const next = await fetch(`/api/tasks/${taskId}/extensions`, { cache: "no-store" });
      if (next.ok) {
        const fresh: ExtensionView = await next.json();
        setView(fresh);
        onTaskChange?.({ version: json.data?.version ?? fresh.version, dueDate: fresh.dueDate });
      }
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  if (!view) {
    return error ? (
      <p role="alert" className="px-4 text-xs text-destructive">
        {error}
      </p>
    ) : null;
  }

  const active = view.active;
  if (!active && !view.canRequest) return null;

  const minDate = ictDay(view.dueDate);
  const decide = (decision: string, extra: Record<string, unknown> = {}) =>
    send("decide-extension", { requestId: active?.id, decision, expectedVersion: version, ...extra }, "Không xử lý được yêu cầu gia hạn");

  return (
    <section aria-label="Xin gia hạn" className={cn("space-y-2 px-4", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-compact font-semibold text-foreground tracking-tight">Gia hạn</h2>
        {view.appliedCount >= 3 && (
          <span className="text-xs text-warning">Đã gia hạn {view.appliedCount} lần</span>
        )}
        {!active && view.canRequest && mode === "idle" && (
          <Button type="button" variant="ghost" size="xs" className="ml-auto" onClick={() => setMode("request")}>
            Xin gia hạn
          </Button>
        )}
      </div>

      {active && (
        <div className="space-y-1.5 text-compact">
          <p className="text-foreground">
            <span className="font-medium">{active.requestedBy.name}</span> xin gia hạn đến{" "}
            <span className="tabular-nums font-medium">{fmt(active.requestedDueDate)}</span>
            <span className="text-muted-foreground"> (hạn hiện tại {fmt(view.dueDate)})</span>
          </p>
          <p className="whitespace-pre-wrap break-words text-muted-foreground">{active.reason}</p>

          {active.status === "PENDING" && !view.canDecide && (
            <p className="text-xs text-muted-foreground">Đang chờ người giao quyết định.</p>
          )}
          {active.status === "COUNTERED" && active.counterDueDate && (
            <p className="text-foreground">
              Người giao đề xuất hạn <span className="tabular-nums font-medium">{fmt(active.counterDueDate)}</span>
              {active.decisionNote ? <span className="text-muted-foreground">: {active.decisionNote}</span> : null}
            </p>
          )}

          {view.canDecide && mode === "idle" && (
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="xs" disabled={busy} onClick={() => void decide("APPROVE")}>
                Đồng ý
              </Button>
              <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={() => setMode("counter")}>
                Đề xuất hạn khác
              </Button>
              <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={() => setMode("reject")}>
                Từ chối
              </Button>
            </div>
          )}

          {view.canRespond && (
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="xs" disabled={busy} onClick={() => void decide("ACCEPT")}>
                Nhận hạn {active.counterDueDate ? fmt(active.counterDueDate) : ""}
              </Button>
              <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={() => void decide("DECLINE")}>
                Không nhận
              </Button>
            </div>
          )}
        </div>
      )}

      {mode === "request" && (
        <div className="space-y-1.5">
          <VietnameseDatePicker
            value={date}
            onChange={setDate}
            variant="chip"
            label="Hạn mới:"
            placeholder="dd/mm/yyyy"
            minDate={minDate}
          />
          <Textarea
            compact
            value={text}
            maxLength={1000}
            aria-label="Lý do xin gia hạn"
            placeholder="Lý do xin gia hạn"
            onChange={(e) => setText(e.target.value)}
            className="min-h-16"
          />
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="xs"
              disabled={busy || !date || text.trim().length < 3}
              onClick={() => void send("request-extension", { requestedDueDate: date, reason: text.trim(), expectedVersion: version }, "Không gửi được yêu cầu gia hạn")}
            >
              Gửi
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={reset}>
              Hủy
            </Button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <div className="space-y-1.5">
          <Textarea
            compact
            value={text}
            maxLength={1000}
            aria-label="Lý do từ chối"
            placeholder="Lý do từ chối (bắt buộc)"
            onChange={(e) => setText(e.target.value)}
            className="min-h-16"
          />
          <div className="flex gap-1.5">
            <Button type="button" size="xs" disabled={busy || text.trim().length < 3} onClick={() => void decide("REJECT", { note: text.trim() })}>
              Từ chối gia hạn
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={reset}>
              Hủy
            </Button>
          </div>
        </div>
      )}

      {mode === "counter" && (
        <div className="space-y-1.5">
          <VietnameseDatePicker value={date} onChange={setDate} variant="chip" label="Hạn đề xuất:" placeholder="dd/mm/yyyy" minDate={minDate} />
          <Textarea
            compact
            value={text}
            maxLength={1000}
            aria-label="Ghi chú cho người xin"
            placeholder="Ghi chú (không bắt buộc)"
            onChange={(e) => setText(e.target.value)}
            className="min-h-12"
          />
          <div className="flex gap-1.5">
            <Button type="button" size="xs" disabled={busy || !date} onClick={() => void decide("COUNTER", { newDueDate: date, note: text.trim() || undefined })}>
              Gửi đề xuất
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={reset}>
              Hủy
            </Button>
          </div>
        </div>
      )}

      {error && <InlineAlert variant="error">{error}</InlineAlert>}
    </section>
  );
}
