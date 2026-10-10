"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDepartmentList } from "@/hooks/use-department-list";
import { cn } from "@/lib/utils";

interface State {
  status: string;
  recipients: Array<{ id: string; kind: string; name: string; receivedAt: string | null }>;
  recall: { recalledAt: string; reason: string | null } | null;
  replaces: { documentId: string; numberStr: string | null } | null;
  replacedBy: { documentId: string; numberStr: string | null } | null;
  canRecall: boolean;
  canConfirmReceipt: boolean;
  canIssue: boolean;
  replaceCandidates: Array<{ documentId: string; numberStr: string | null; title: string }>;
  recallBlockedReason: string | null;
}

type Mode = "idle" | "issue" | "recall";

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title || json.message)) || fallback;
}

const formatDate = (raw: string) => new Date(raw).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

/**
 * Nơi nhận có định danh, phát hành, ghi nhận tiếp nhận và thu hồi văn bản đi (V-05a, V-05).
 * Quyền lấy từ server (GET /outgoing-recipients) nên nút chỉ hiện khi người xem thực sự làm được.
 */
export function OutgoingRecipientsPanel({ documentId, onChanged, className }: { documentId: string; onChanged?: () => void; className?: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<State | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("idle");
  const [units, setUnits] = React.useState<string[]>([]);
  const [external, setExternal] = React.useState("");
  const [replacesId, setReplacesId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");

  const { departments } = useDepartmentList({ enabled: mode === "issue" });

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/outgoing-recipients`, { cache: "no-store" });
      if (res.status === 403 || res.status === 404) {
        setState(null);
        return;
      }
      if (!res.ok) throw new Error(await readError(res, "Không tải được thông tin nơi nhận"));
      setState(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được thông tin nơi nhận");
    }
  }, [documentId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const call = async (path: string, body: Record<string, unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/actions/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res, fallback));
      setMode("idle");
      setUnits([]);
      setExternal("");
      setReplacesId(null);
      setReason("");
      await load();
      onChanged?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  if (!state) return error ? <InlineAlert variant="error">{error}</InlineAlert> : null;

  const hasContent = state.recipients.length > 0 || state.canIssue || state.recall || state.replaces || state.replacedBy;
  if (!hasContent) return null;

  const externalNames = external
    .split(/[\n;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const recipientsPayload = [...units.map((unitId) => ({ unitId })), ...externalNames.map((name) => ({ name }))];

  return (
    <section aria-label="Theo dõi nơi nhận" className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-compact font-semibold text-foreground">Theo dõi nơi nhận</h3>
        {state.status === "RECALLED" ? <span className="text-xs text-destructive">Đã thu hồi</span> : null}
      </div>

      {state.recipients.length > 0 && (
        <ul className="space-y-0.5">
          {state.recipients.map((r) => (
            <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground" title={r.name}>{r.name}</span>
              {r.receivedAt ? (
                <span className="shrink-0 text-muted-foreground">Đã nhận {formatDate(r.receivedAt)}</span>
              ) : state.canConfirmReceipt ? (
                <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={() => void call("confirm-receipt", { recipientId: r.id }, "Không ghi nhận được")}>
                  Ghi nhận đã nhận
                </Button>
              ) : (
                <span className="shrink-0 text-muted-foreground">Chưa nhận</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {state.recall && (
        <InlineAlert variant="warning">
          Đã thu hồi ngày {formatDate(state.recall.recalledAt)}
          {state.recall.reason ? `: ${state.recall.reason}` : ""}. Số văn bản không được cấp lại.
        </InlineAlert>
      )}
      {state.replacedBy && <p className="text-xs text-muted-foreground">Được thay thế bởi văn bản số {state.replacedBy.numberStr ?? "—"}</p>}
      {state.replaces && <p className="text-xs text-muted-foreground">Thay thế văn bản số {state.replaces.numberStr ?? "—"}</p>}
      {state.recallBlockedReason && <p className="text-xs text-muted-foreground">{state.recallBlockedReason}</p>}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-1.5">
          {state.canIssue && (
            <Button type="button" size="sm" onClick={() => setMode("issue")}>
              Phát hành
            </Button>
          )}
          {state.canRecall && (
            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setMode("recall")}>
              Thu hồi
            </Button>
          )}
        </div>
      )}

      {mode === "issue" && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Chọn đơn vị trong trường nhận văn bản:</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {departments.map((d) => (
              <li key={d.id}>
                <label className="flex cursor-pointer items-center gap-2 text-compact">
                  <Checkbox checked={units.includes(d.id)} onChange={(e) => setUnits((prev) => (e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id)))} />
                  <span>{d.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <Textarea
            compact
            value={external}
            maxLength={2000}
            aria-label="Cơ quan, tổ chức ngoài trường"
            placeholder="Cơ quan, tổ chức ngoài trường (mỗi nơi một dòng)"
            onChange={(e) => setExternal(e.target.value)}
            className="min-h-14"
          />
          {state.replaceCandidates.length > 0 && (
            <Select
              compact
              positionerClassName="z-50"
              aria-label="Văn bản được thay thế"
              placeholder="Thay thế văn bản đã thu hồi hoặc đã có nơi nhận (không bắt buộc)"
              options={state.replaceCandidates.map((c) => ({ value: c.documentId, label: `${c.numberStr ?? "—"} · ${c.title}` }))}
              value={replacesId}
              onValueChange={(v) => setReplacesId(v || null)}
            />
          )}
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="xs"
              disabled={busy || recipientsPayload.length === 0}
              onClick={() =>
                void call("issue", { recipients: recipientsPayload, ...(replacesId ? { replacesDocumentId: replacesId } : {}) }, "Không phát hành được văn bản")
              }
            >
              Phát hành
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setMode("idle")}>Hủy</Button>
          </div>
        </div>
      )}

      {mode === "recall" && (
        <div className="space-y-1.5">
          <Textarea compact value={reason} maxLength={1000} aria-label="Lý do thu hồi" placeholder="Lý do thu hồi (bắt buộc)" onChange={(e) => setReason(e.target.value)} className="min-h-16" />
          <div className="flex gap-1.5">
            <Button type="button" size="xs" variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void call("recall", { reason: reason.trim() }, "Không thu hồi được văn bản")}>
              Thu hồi văn bản
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setMode("idle")}>Hủy</Button>
          </div>
        </div>
      )}

      {error && <InlineAlert variant="error">{error}</InlineAlert>}
    </section>
  );
}
