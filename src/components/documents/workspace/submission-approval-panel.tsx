"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StandardDialog } from "@/components/ui/dialog";
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
  /** Đơn vị của người trình, luôn có trong lần trình; `skipped`: người trình là trưởng đơn vị nên bước đó bỏ qua. */
  ownUnits?: Array<{ id: string; name: string; skipped: boolean }>;
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
  row,
}: {
  documentId: string;
  onChanged?: () => void;
  className?: string;
  /** Quick View: nhãn "Phê duyệt" ở cột nhãn 112px, nội dung thẳng cột giá trị như lưới thuộc tính phía trên. */
  row?: boolean;
}) {
  const [state, setState] = React.useState<State | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<"idle" | "submit" | "decide" | "consult" | "reassign" | "return">("idle");
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const [note, setNote] = React.useState("");
  const [units, setUnits] = React.useState<string[]>([]);
  const [unitQuery, setUnitQuery] = React.useState("");
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
  // Nháp (kể cả sau khi rút lại): các bước của lần trình cũ đã bị bỏ qua, không hiện lại như đang chạy
  const current = state.workflow?.status === "DRAFT" ? [] : state.steps.filter((s) => s.round === round);
  const statusLabel = state.workflow ? WORKFLOW_STATUS_LABEL[state.workflow.status] : "Nháp";
  const mustNote = decision !== null && decision !== "APPROVE";

  const submitLabel = state.workflow?.status === "NEEDS_REVISION" ? "Trình lại" : "Trình duyệt";
  const closeSubmit = () => {
    setMode("idle");
    setUnitQuery("");
  };
  const query = unitQuery.trim().toLowerCase();
  const ownUnits = state.ownUnits ?? [];
  const ownIds = new Set(ownUnits.map((u) => u.id));
  // Giữ nguyên thứ tự khi tích: đưa mục đã chọn lên đầu ngay lúc bấm làm hàng nhảy khỏi con trỏ
  const visibleDepartments = departments.filter((d) => !ownIds.has(d.id) && (!query || d.name.toLowerCase().includes(query)));
  // Số bước trưởng đơn vị của lần trình này (đơn vị của mình mà mình là trưởng thì bỏ qua)
  const unitStepCount = ownUnits.filter((u) => !u.skipped).length + units.filter((id) => !ownIds.has(id)).length;
  const SECTION_LABEL = "px-2 pb-1 pt-3 text-xs text-muted-foreground";
  const ROW = "flex h-8 items-center gap-2.5 rounded-sm px-2 text-compact";
  // Ô tích nhỏ kiểu menu (14px, nét 1px, bo 4px) thay ô tích mặc định dày: danh sách đọc như một menu chọn nhiều
  const checkMark = (checked: boolean, muted = false) => (
    <span
      aria-hidden
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        checked
          ? muted
            ? "border-transparent bg-muted-foreground/30 text-background"
            : "border-primary bg-primary text-primary-foreground"
          : "border-control-edge bg-card",
        "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1",
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={1.5} /> : null}
    </span>
  );

  // Nội dung hộp thoại "Trình duyệt" (kiểu bảng lệnh): ô tìm tràn mép không nền, đơn vị của mình cố định ở đầu,
  // đơn vị liên quan chọn thêm; chân nói trước đường đi (bao nhiêu đơn vị duyệt rồi tới lãnh đạo)
  const submitForm = (
    <div className="-mx-4 -mb-4 flex min-h-0 flex-col sm:-mx-6 sm:-mb-6">
      <label className="flex h-10 items-center gap-2 border-y border-border px-4 sm:px-6">
        <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <input
          value={unitQuery}
          onChange={(e) => setUnitQuery(e.target.value)}
          placeholder="Tìm đơn vị liên quan"
          aria-label="Tìm đơn vị liên quan"
          className="h-full min-w-0 flex-1 bg-transparent text-compact text-foreground outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </label>
      <div className="max-h-80 overflow-y-auto px-2 pb-2 sm:px-4">
        {ownUnits.length > 0 && !query ? (
          <div role="group" aria-label="Đơn vị của bạn">
            <p className={SECTION_LABEL}>Đơn vị của bạn</p>
            {ownUnits.map((u) => (
              <div key={u.id} className={ROW}>
                {checkMark(true, true)}
                <span className="min-w-0 flex-1 truncate" title={u.name}>{u.name}</span>
                <span className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                  {u.skipped ? "Bỏ qua, bạn là trưởng đơn vị" : "Luôn duyệt"}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div role="group" aria-label="Đơn vị liên quan">
          {ownUnits.length > 0 && !query ? (
            <p className={SECTION_LABEL}>
              Đơn vị liên quan{units.length > 0 ? <span className="text-foreground"> · đã chọn {units.length}</span> : null}
            </p>
          ) : null}
          <ul className={cn(!(ownUnits.length > 0 && !query) && "pt-2")}>
            {visibleDepartments.map((d) => {
              const checked = units.includes(d.id);
              return (
                <li key={d.id}>
                  <label className={cn(ROW, "cursor-pointer transition-colors hover:bg-accent")}>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      onChange={(e) => setUnits((prev) => (e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id)))}
                    />
                    {checkMark(checked)}
                    <span className="min-w-0 truncate" title={d.name}>{d.name}</span>
                  </label>
                </li>
              );
            })}
            {visibleDepartments.length === 0 ? <li className="px-2 py-2 text-xs text-muted-foreground">Không có đơn vị phù hợp</li> : null}
          </ul>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-4 py-3 sm:px-6">
        <span className="mr-auto min-w-0 text-xs text-muted-foreground">
          {unitStepCount > 1 ? `${unitStepCount} đơn vị cùng duyệt → Lãnh đạo` : unitStepCount === 1 ? "1 đơn vị duyệt → Lãnh đạo" : "Chuyển thẳng lãnh đạo"}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={closeSubmit}>Hủy</Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => void call("submit-approval", { involvedUnitIds: units }, "Không trình được tờ trình")}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );

  // Thao tác theo bước. Ở Quick View đi liền sau trạng thái trên hàng "Phê duyệt", không thành một hàng nút lơ lửng;
  // "Trình duyệt" mở hộp thoại chọn đơn vị, trang chi tiết không bị đẩy xuống.
  const actions = (
    <>
      {state.canSubmit ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setMode("submit")}>
          {submitLabel}
        </Button>
      ) : null}
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
    </>
  );

  return (
    <section
      aria-label="Luồng duyệt tờ trình"
      className={cn(row ? "grid grid-cols-[112px_minmax(0,1fr)] gap-x-2 gap-y-1.5 [&>:not(:first-child)]:col-start-2" : "space-y-1.5", className)}
    >
      {row ? (
        <>
          <h3 className="flex h-7 items-center whitespace-nowrap text-xs font-normal text-muted-foreground">Phê duyệt</h3>
          <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-compact text-foreground">
            {statusLabel}
            {round > 1 ? <span className="text-xs text-muted-foreground">lần trình {round}</span> : null}
            {/* Nháp: nói trước đường đi để người trình biết nút "Trình duyệt" sẽ gửi tới ai */}
            {current.length === 0 && state.canSubmit ? (
              <span className="text-xs text-muted-foreground">· Trưởng đơn vị → Lãnh đạo</span>
            ) : null}
            {/* Nút đi liền sau trạng thái (không đẩy về mép phải): đọc thành "trạng thái → việc tiếp theo" */}
            {mode === "idle" || mode === "submit" ? <span className="ml-2 flex flex-wrap items-center gap-1.5">{actions}</span> : null}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Duyệt tờ trình</h3>
          <span className="text-xs text-foreground">
            · {statusLabel}
            {round > 1 ? ` · lần trình ${round}` : ""}
          </span>
        </div>
      )}

      {current.length > 0 && (
        <ul className="max-w-md">
          {current.map((s) => (
            <li key={s.id} className="grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-compact">
              <span className="min-w-0 truncate text-foreground" title={s.unit?.name ?? undefined}>
                {s.stage === "LEADER" ? "Lãnh đạo" : s.unit?.name ?? "Đơn vị"}
                {s.approver ? <span className="text-muted-foreground"> · {s.approver.name}</span> : null}
                {s.note ? <span className="text-muted-foreground"> · {s.note}</span> : null}
              </span>
              <span className={cn("flex shrink-0 items-center gap-1", s.status === "PENDING" ? "text-muted-foreground" : "text-foreground", "text-xs")}>
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

      {!row && mode === "idle" && <div className={cn("flex flex-wrap gap-1.5", !state.canSubmit && "-ml-2.5")}>{actions}</div>}

      <StandardDialog
        compact
        open={mode === "submit"}
        onOpenChange={(open) => (open ? setMode("submit") : closeSubmit())}
        title={state.workflow?.status === "NEEDS_REVISION" ? "Trình lại tờ trình" : "Trình duyệt tờ trình"}
        description="Trưởng các đơn vị được chọn duyệt song song, rồi tới lãnh đạo."
        size="sm"
        className="sm:max-w-md"
      >
        {submitForm}
      </StandardDialog>

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
