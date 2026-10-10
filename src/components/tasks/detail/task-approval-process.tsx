"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { cn } from "@/lib/utils";
import { TaskAddChip } from "./task-add-chip";

interface StepView {
  id: string;
  order: number;
  title: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "BYPASSED";
  reviewer: { id: string; name: string } | null;
  backupReviewer: { id: string; name: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  current: boolean;
  backupDue: boolean;
}

interface ProcessView {
  process: { id: string; status: "NOT_STARTED" | "IN_REVIEW" | "APPROVED" | "REJECTED"; steps: StepView[] } | null;
  canDefine: boolean;
}

interface DraftStep {
  title: string;
  reviewerUserId: string | null;
  backupReviewerUserId: string | null;
}

const MAX_STEPS = 5;
const emptyStep = (index: number): DraftStep => ({ title: `Bước ${index + 1}`, reviewerUserId: null, backupReviewerUserId: null });

const STEP_LABEL: Record<StepView["status"], string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Không duyệt",
  BYPASSED: "Vượt cấp",
};
const PROCESS_LABEL: Record<NonNullable<ProcessView["process"]>["status"], string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_REVIEW: "Đang duyệt",
  APPROVED: "Đã duyệt xong",
  REJECTED: "Bị trả lại",
};

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

/**
 * Luồng duyệt nhiều bước (T-05): người giao lập các bước khi nhiệm vụ chờ duyệt; mỗi bước có người duyệt và
 * tùy chọn người dự phòng (nhận việc khi bước chờ quá 4 ngày). Chỉ hiện khi đã có luồng hoặc người xem lập được.
 */
export function TaskApprovalProcess({ taskId, className }: { taskId: string; className?: string }) {
  const [view, setView] = React.useState<ProcessView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftStep[]>([emptyStep(0)]);
  const { personnel } = usePersonnelList({ enabled: editing });

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/approval-process`, { cache: "no-store" });
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

  const patchStep = (index: number, patch: Partial<DraftStep>) =>
    setDraft((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const steps = draft.map((s) => ({
        title: s.title.trim(),
        reviewerUserId: s.reviewerUserId,
        ...(s.backupReviewerUserId ? { backupReviewerUserId: s.backupReviewerUserId } : {}),
      }));
      const res = await fetch(`/api/tasks/${taskId}/approval-process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) throw new Error(await readError(res, "Không lập được luồng duyệt"));
      setView(await res.json());
      setEditing(false);
      setDraft([emptyStep(0)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lập được luồng duyệt");
    } finally {
      setBusy(false);
    }
  };

  if (!view || (!view.process && !view.canDefine)) return null;
  if (!view.process && !editing) {
    return <TaskAddChip onClick={() => setEditing(true)}>Luồng duyệt nhiều bước</TaskAddChip>;
  }
  const options = personnel.map((p) => ({ value: p.id, label: p.name }));
  const valid = draft.length > 0 && draft.every((s) => s.title.trim() && s.reviewerUserId);

  return (
    <section aria-label="Luồng duyệt nhiều bước" className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-compact font-semibold text-foreground tracking-tight">Luồng duyệt</h2>
        {view.process ? <span className="text-xs text-muted-foreground">{PROCESS_LABEL[view.process.status]}</span> : null}
      </div>

      {view.process ? (
        <ol className="space-y-0.5">
          {view.process.steps.map((s) => (
            <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
              <span className={cn("min-w-0 truncate", s.current ? "text-foreground" : "text-muted-foreground")} title={s.decisionNote ?? undefined}>
                {s.order}. {s.title} · {s.reviewer?.name ?? "—"}
                {s.backupReviewer ? <span className="text-muted-foreground"> (dự phòng: {s.backupReviewer.name})</span> : null}
              </span>
              <span className={cn("shrink-0", s.status === "REJECTED" ? "text-destructive" : s.backupDue ? "text-warning" : "text-muted-foreground")}>
                {s.current && s.backupDue ? "Quá 4 ngày, dự phòng duyệt được" : STEP_LABEL[s.status]}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        !editing && <p className="text-xs text-muted-foreground">Chưa có. Lập luồng để nhiều người duyệt lần lượt thay cho một người duyệt.</p>
      )}

      {view.canDefine && !editing ? (
        <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(true)}>
          Lập luồng duyệt
        </Button>
      ) : null}

      {editing ? (
        <div className="space-y-2">
          {draft.map((s, index) => (
            <div key={index} className="space-y-1.5 rounded-md border border-border p-2">
              <Input compact value={s.title} maxLength={255} aria-label={`Tên bước ${index + 1}`} onChange={(e) => patchStep(index, { title: e.target.value })} />
              <Select compact positionerClassName="z-50" aria-label={`Người duyệt bước ${index + 1}`} placeholder="— Người duyệt —" options={options} value={s.reviewerUserId} onValueChange={(v) => patchStep(index, { reviewerUserId: v || null })} />
              <Select compact positionerClassName="z-50" aria-label={`Người dự phòng bước ${index + 1}`} placeholder="— Người dự phòng (không bắt buộc) —" options={options} value={s.backupReviewerUserId} onValueChange={(v) => patchStep(index, { backupReviewerUserId: v || null })} />
              {draft.length > 1 ? (
                <Button type="button" size="xs" variant="ghost" onClick={() => setDraft((prev) => prev.filter((_, i) => i !== index))}>
                  Bỏ bước này
                </Button>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            {draft.length < MAX_STEPS ? (
              <Button type="button" size="xs" variant="ghost" onClick={() => setDraft((prev) => [...prev, emptyStep(prev.length)])}>
                Thêm bước
              </Button>
            ) : null}
            <Button type="button" size="xs" disabled={busy || !valid} onClick={() => void save()}>
              Lập luồng
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(false)}>
              Hủy
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
    </section>
  );
}
