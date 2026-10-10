"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDepartmentList } from "@/hooks/use-department-list";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { STEP_STATUS_LABEL, WORKFLOW_STATUS_LABEL } from "@/domain/documents/submission-rules";
import { cn } from "@/lib/utils";

type Decision = "APPROVE" | "REVISION" | "REJECT";

interface Step {
  id: string;
  round: number;
  stage: "UNIT_HEAD" | "LEADER";
  unit: { id: string; name: string } | null;
  approver: { id: string; name: string } | null;
  status: keyof typeof STEP_STATUS_LABEL;
  decidedBy: { id: string; name: string } | null;
  note: string | null;
}

interface Consultation {
  id: string;
  askedBy: { name: string };
  consultant: { name: string };
  question: string;
  answer: string | null;
  canAnswer: boolean;
}

interface State {
  workflow: { status: keyof typeof WORKFLOW_STATUS_LABEL; round: number; decisionNote: string | null } | null;
  steps: Step[];
  consultations: Consultation[];
  canSubmit: boolean;
  canWithdraw: boolean;
  myStep: { id: string; decisions: Decision[] } | null;
  canAskConsultation: boolean;
  reassignableStepIds?: string[];
  returnRequest?: { note: string | null; requestedAt: string } | null;
  canRequestReturn?: boolean;
  canDecideReturn?: boolean;
}

const DECISION_LABEL: Record<Decision, string> = { APPROVE: "Đồng ý", REVISION: "Cần bổ sung", REJECT: "Không phê duyệt" };

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

/**
 * Luồng duyệt tờ trình nội bộ (V-06): trình, rút lại, duyệt, xin ý kiến. Quyền lấy từ server
 * (GET /approval) nên nút chỉ hiện khi người xem thực sự làm được.
 */
export function SubmissionApprovalPanel({
  documentId,
  onChanged,
  className,
}: {
  documentId: string;
  onChanged?: () => void;
  className?: string;
}) {
  const [state, setState] = React.useState<State | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<"idle" | "submit" | "decide" | "consult" | "reassign" | "return">("idle");
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const [note, setNote] = React.useState("");
  const [units, setUnits] = React.useState<string[]>([]);
  const [consultantId, setConsultantId] = React.useState<string | null>(null);
  const [question, setQuestion] = React.useState("");
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [reassignStepId, setReassignStepId] = React.useState<string | null>(null);
  const [reassignTo, setReassignTo] = React.useState<string | null>(null);
  const [reassignReason, setReassignReason] = React.useState("");

  const { departments } = useDepartmentList({ enabled: mode === "submit" });
  const { personnel } = usePersonnelList({ enabled: mode === "consult" || mode === "reassign" });

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/approval`, { cache: "no-store" });
      if (res.status === 403) {
        setState(null);
        return;
      }
      if (!res.ok) throw new Error(await readError(res, "Không tải được luồng duyệt"));
      setState(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được luồng duyệt");
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
      setDecision(null);
      setNote("");
      setUnits([]);
      setConsultantId(null);
      setQuestion("");
      setReassignStepId(null);
      setReassignTo(null);
      setReassignReason("");
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return error ? <InlineAlert variant="error">{error}</InlineAlert> : null;
  }

  const round = state.workflow?.round ?? 0;
  const current = state.steps.filter((s) => s.round === round);
  const statusLabel = state.workflow ? WORKFLOW_STATUS_LABEL[state.workflow.status] : "Nháp";
  const mustNote = decision !== null && decision !== "APPROVE";

  return (
    <section aria-label="Luồng duyệt tờ trình" className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-compact font-semibold text-foreground">Duyệt tờ trình</h3>
        <span className="text-xs text-muted-foreground">
          {statusLabel}
          {round > 1 ? ` · lần trình ${round}` : ""}
        </span>
      </div>

      {current.length > 0 && (
        <ul className="space-y-0.5">
          {current.map((s) => (
            <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground">
                {s.stage === "LEADER" ? "Lãnh đạo" : s.unit?.name ?? "Đơn vị"}
                {s.approver ? <span className="text-muted-foreground"> · {s.approver.name}</span> : null}
                {s.note ? <span className="text-muted-foreground"> · {s.note}</span> : null}
              </span>
              <span className={cn("flex shrink-0 items-center gap-1", s.status === "PENDING" ? "text-muted-foreground" : "text-foreground")}>
                {STEP_STATUS_LABEL[s.status]}
                {s.status === "PENDING" && state.reassignableStepIds?.includes(s.id) ? (
                  <Button type="button" size="xs" variant="ghost" onClick={() => { setReassignStepId(s.id); setMode("reassign"); }}>
                    Thay người
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {state.workflow?.status === "NEEDS_REVISION" && state.workflow.decisionNote && (
        <InlineAlert variant="warning">Cần bổ sung: {state.workflow.decisionNote}</InlineAlert>
      )}
      {state.workflow?.status === "REJECTED" && state.workflow.decisionNote && (
        <InlineAlert variant="error">Không phê duyệt: {state.workflow.decisionNote}</InlineAlert>
      )}

      {state.returnRequest && (
        <InlineAlert variant="warning">
          Người trình xin trả lại tờ trình{state.returnRequest.note ? `: ${state.returnRequest.note}` : ""}
          {state.canDecideReturn && mode === "idle" ? (
            <span className="mt-1.5 flex gap-1.5">
              <Button type="button" size="xs" disabled={busy} onClick={() => void call("decide-return-approval", { accept: true }, "Không ghi nhận được")}>
                Đồng ý trả lại
              </Button>
              <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={() => void call("decide-return-approval", { accept: false }, "Không ghi nhận được")}>
                Từ chối
              </Button>
            </span>
          ) : null}
        </InlineAlert>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-1.5">
          {state.canSubmit && (
            <Button type="button" size="sm" onClick={() => setMode("submit")}>
              {state.workflow?.status === "NEEDS_REVISION" ? "Trình lại" : "Trình duyệt"}
            </Button>
          )}
          {state.canRequestReturn && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode("return")}>
              Xin trả lại
            </Button>
          )}
          {state.canWithdraw && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void call("withdraw-approval", {}, "Không rút lại được")}>
              Rút lại
            </Button>
          )}
          {state.myStep?.decisions.map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={d === "APPROVE" ? "default" : "ghost"}
              className={cn(d === "REJECT" && "text-destructive hover:text-destructive")}
              disabled={busy}
              onClick={() => (d === "APPROVE" ? void call("decide-approval", { stepId: state.myStep!.id, decision: d }, "Không ghi được quyết định") : (setDecision(d), setMode("decide")))}
            >
              {DECISION_LABEL[d]}
            </Button>
          ))}
          {state.canAskConsultation && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode("consult")}>
              Xin ý kiến
            </Button>
          )}
        </div>
      )}

      {mode === "submit" && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Đơn vị của bạn mặc định phải duyệt. Chọn thêm đơn vị liên quan (duyệt song song):</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {departments.map((d) => (
              <li key={d.id}>
                <label className="flex cursor-pointer items-center gap-2 text-compact">
                  <Checkbox
                    checked={units.includes(d.id)}
                    onChange={(e) => setUnits((prev) => (e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id)))}
                  />
                  <span>{d.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-1.5">
            <Button type="button" size="xs" disabled={busy} onClick={() => void call("submit-approval", { involvedUnitIds: units }, "Không trình được tờ trình")}>
              Trình
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setMode("idle")}>Hủy</Button>
          </div>
        </div>
      )}

      {mode === "decide" && decision && state.myStep && (
        <div className="space-y-1.5">
          <Textarea compact value={note} maxLength={1000} aria-label={`Lý do ${DECISION_LABEL[decision].toLowerCase()}`} placeholder="Lý do (bắt buộc)" onChange={(e) => setNote(e.target.value)} className="min-h-16" />
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="xs"
              disabled={busy || (mustNote && note.trim().length < 3)}
              onClick={() => void call("decide-approval", { stepId: state.myStep!.id, decision, note: note.trim() }, "Không ghi được quyết định")}
            >
              {DECISION_LABEL[decision]}
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => { setMode("idle"); setDecision(null); setNote(""); }}>Hủy</Button>
          </div>
        </div>
      )}

      {mode === "return" && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Tờ trình đã có người mở nên cần người đang chờ duyệt đồng ý mới trả về Nháp.</p>
          <Textarea compact value={note} maxLength={1000} aria-label="Lý do xin trả lại" placeholder="Lý do (bắt buộc)" onChange={(e) => setNote(e.target.value)} className="min-h-14" />
          <div className="flex gap-1.5">
            <Button type="button" size="xs" disabled={busy || note.trim().length < 3} onClick={() => void call("request-return-approval", { note: note.trim() }, "Không gửi được đề nghị")}>
              Gửi đề nghị
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => { setMode("idle"); setNote(""); }}>Hủy</Button>
          </div>
        </div>
      )}

      {mode === "reassign" && reassignStepId && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Thay người xử lý ở bước đang chờ (người nghỉ, vắng). Có ghi dấu vết, không làm lại từ đầu.</p>
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Người xử lý mới"
            placeholder="— Chọn người —"
            options={personnel.map((p) => ({ value: p.id, label: p.name }))}
            value={reassignTo}
            onValueChange={(v) => setReassignTo(v || null)}
          />
          <Textarea compact value={reassignReason} maxLength={1000} aria-label="Lý do thay người" placeholder="Lý do (bắt buộc)" onChange={(e) => setReassignReason(e.target.value)} className="min-h-12" />
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="xs"
              disabled={busy || !reassignTo || reassignReason.trim().length < 3}
              onClick={() => void call("reassign-approval-step", { stepId: reassignStepId, approverUserId: reassignTo, reason: reassignReason.trim() }, "Không thay được người xử lý")}
            >
              Thay người
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setMode("idle")}>Hủy</Button>
          </div>
        </div>
      )}

      {mode === "consult" && (
        <div className="space-y-1.5">
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Người được xin ý kiến"
            placeholder="— Chọn người —"
            options={personnel.map((p) => ({ value: p.id, label: p.name }))}
            value={consultantId}
            onValueChange={(v) => setConsultantId(v || null)}
          />
          <Textarea compact value={question} maxLength={1000} aria-label="Nội dung xin ý kiến" placeholder="Nội dung cần xin ý kiến" onChange={(e) => setQuestion(e.target.value)} className="min-h-16" />
          <div className="flex gap-1.5">
            <Button type="button" size="xs" disabled={busy || !consultantId || question.trim().length < 3} onClick={() => void call("ask-consultation", { consultantId, question: question.trim() }, "Không gửi được phiếu xin ý kiến")}>
              Gửi
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setMode("idle")}>Hủy</Button>
          </div>
        </div>
      )}

      {state.consultations.length > 0 && (
        <ul className="space-y-1.5">
          {state.consultations.map((c) => (
            <li key={c.id} className="text-xs">
              <p className="text-foreground">
                <span className="font-medium">{c.askedBy.name}</span> hỏi <span className="font-medium">{c.consultant.name}</span>: {c.question}
              </p>
              {c.answer ? (
                <p className="text-muted-foreground">Trả lời: {c.answer}</p>
              ) : c.canAnswer ? (
                <div className="mt-1 space-y-1">
                  <Textarea compact value={answers[c.id] ?? ""} maxLength={2000} aria-label="Ý kiến trả lời" placeholder="Ý kiến của bạn" onChange={(e) => setAnswers((p) => ({ ...p, [c.id]: e.target.value }))} className="min-h-12" />
                  <Button type="button" size="xs" disabled={busy || !(answers[c.id] ?? "").trim()} onClick={() => void call("answer-consultation", { consultationId: c.id, answer: answers[c.id].trim() }, "Không gửi được ý kiến")}>
                    Trả lời
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Chờ trả lời</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <InlineAlert variant="error">{error}</InlineAlert>}
    </section>
  );
}
