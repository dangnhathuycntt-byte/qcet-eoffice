"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { confirmAction } from "@/components/ui/confirm-host";
import { useDepartmentList } from "@/hooks/use-department-list";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { DocumentItem } from "@qcet/contracts/types/document";
import { formatLedgerDate } from "@qcet/shared/lib/documents/document-ledger-format";
import { buildIncomingQuotes, formatShortDateTime, getIncomingActions, getIncomingFlow } from "@/lib/documents/incoming-workflow";
import { InspectorRow, SectionHeading } from "../document-detail-parts";
import { IncomingForwardDialog, type ForwardMode, type ForwardPayload } from "./incoming-forward-dialog";

import { Spinner } from "@/components/ui/spinner";
/** Thao tác theo bước của văn bản đến; hiện theo vai trò, server kiểm quyền khi thực thi. */
export function IncomingWorkflowActions({
  documentId,
  status,
  marked = false,
  onDone,
}: {
  documentId: string;
  status: string;
  /** Người đang xem đã đánh dấu văn bản này. */
  marked?: boolean;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  // `role` là vai trò giao diện (ADMIN/MANAGER/STAFF); thao tác theo bước dùng vai trò nghiệp vụ trong DB.
  const role = (user as { dbRole?: string } | null)?.dbRole;
  const [pending, setPending] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<{ key: string; input: NonNullable<ReturnType<typeof getIncomingActions>[number]["input"]> } | null>(null);
  const [reason, setReason] = React.useState("");
  const [unitId, setUnitId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const { departments, isLoading: isDepartmentsLoading } = useDepartmentList({ enabled: form?.input === "unit" || form?.input === "file" });
  const [forwardMode, setForwardMode] = React.useState<ForwardMode | null>(null);
  const [dossierId, setDossierId] = React.useState<string | null>(null);
  const [dossiers, setDossiers] = React.useState<{ value: string; label: string }[]>([]);
  const [newDossierTitle, setNewDossierTitle] = React.useState<string | null>(null);
  const [newDossierUnitId, setNewDossierUnitId] = React.useState<string | null>(null);
  const userDepartment = (user as { department?: string } | null)?.department;
  React.useEffect(() => {
    if (newDossierUnitId || !userDepartment) return;
    const own = departments.find((d) => d.name === userDepartment);
    if (own) setNewDossierUnitId(own.id);
  }, [departments, userDepartment, newDossierUnitId]);
  const formKey = form?.input;
  React.useEffect(() => {
    if (formKey !== "file") return;
    let alive = true;
    fetch("/api/dossiers?limit=100", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const items = (json?.data?.items ?? json?.items ?? []) as { id: string; title: string; code?: string | null }[];
        if (alive) setDossiers(items.map((d) => ({ value: d.id, label: d.code ? `${d.code} · ${d.title}` : d.title })));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [formKey]);
  const actions = getIncomingActions(status, role);
  const [isMarked, setIsMarked] = React.useState(marked);
  React.useEffect(() => setIsMarked(marked), [marked, documentId]);

  // Bộ nút cố định như VNPT: nút chưa đến lượt vẫn hiện, mờ và nói rõ đang chờ ai.
  const flow = getIncomingFlow(status);
  const notYourTurn = flow?.waitingFor ? `Chưa đến lượt bạn. Đang chờ: ${flow.waitingFor}` : "Văn bản đã hoàn tất, không còn thao tác này";
  const forwardAction = actions.find((a) => ["present", "direct", "assign-unit", "reroute"].includes(a.key));
  const finishAction = actions.find((a) => a.key === "resolve");
  const fileAction = actions.find((a) => a.key === "file");
  const returnAction = actions.find((a) => a.key === "return");

  async function toggleMark() {
    const next = !isMarked;
    setIsMarked(next);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/actions/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ marked: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setIsMarked(!next);
      setError("Không đánh dấu được văn bản. Vui lòng thử lại.");
    }
  }

  const slot = (action: (typeof actions)[number] | undefined, fallbackLabel: string, primary = false) => (
    <span key={fallbackLabel} title={action ? undefined : notYourTurn} className="inline-flex">
      <Button
        size="sm"
        variant={primary && action ? "default" : "outline"}
        disabled={!action || pending !== null}
        onClick={action ? () => void run(action) : undefined}
      >
        {action && pending === action.key ? <Spinner size="xs" /> : null}
        {action?.label ?? fallbackLabel}
      </Button>
    </span>
  );

  async function post(key: string, body: Record<string, unknown>): Promise<boolean> {
    setPending(key);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/actions/${key}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Phân công kèm tạo nhiệm vụ và báo cáo kết quả: server bắt buộc khóa chống gửi trùng.
          ...(body.createTask || key === "resolve" ? { "Idempotency-Key": crypto.randomUUID() } : {}),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.detail || err?.error || "Thao tác thất bại");
        return false;
      }
      onDone?.();
      return true;
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function run(action: (typeof actions)[number]) {
    if (action.input === "direct" || action.input === "person") {
      setForwardMode(action.input === "direct" ? "unit" : "person");
      setError(null);
      return;
    }
    if (action.input) {
      setForm({ key: action.key, input: action.input });
      setError(null);
      return;
    }
    if (!(await confirmAction({ title: action.confirmMsg, confirmLabel: action.label }))) return;
    await post(action.key, action.body);
  }

  async function submitForm() {
    if (!form) return;
    const body =
      form.input === "reason"
        ? { reason: reason.trim() }
        : form.input === "resolve"
          ? { resolutionSummary: note.trim() }
          : form.input === "file"
            ? { dossierId, filingNotes: note.trim() || undefined }
            : { leadUnitId: unitId, note: note.trim() || undefined };
    if (await post(form.key, body)) {
      setForm(null);
      setReason("");
      setUnitId(null);
      setDossierId(null);
      setNote("");
    }
  }

  async function createDossier() {
    if (!newDossierTitle?.trim() || !newDossierUnitId) return;
    setPending("dossier");
    setError(null);
    try {
      const res = await fetch("/api/dossiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newDossierTitle.trim(), owningUnitId: newDossierUnitId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.id) {
        setError(json?.detail || json?.error || "Không tạo được hồ sơ");
        return;
      }
      const label = json.code ? `${json.code} · ${json.title}` : json.title;
      setDossiers((prev) => [{ value: json.id, label }, ...prev]);
      setDossierId(json.id);
      setNewDossierTitle(null);
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setPending(null);
    }
  }

  async function submitForward(payload: ForwardPayload) {
    const body =
      forwardMode === "unit"
        ? { leadUnitId: payload.mainId, coordinatingUnitIds: payload.coordinatorIds, instruction: payload.instruction, deadline: payload.deadline ?? undefined }
        : {
            driUserId: payload.mainId,
            collaboratorUserIds: payload.coordinatorIds,
            instruction: payload.instruction || undefined,
            createTask: payload.createTask,
            deadline: payload.deadline ?? undefined,
          };
    const key = forwardMode === "unit" ? "direct" : "assign-unit";
    if (await post(key, body)) setForwardMode(null);
  }

  const formReady =
    form?.input === "reason"
      ? reason.trim().length >= 3
      : form?.input === "resolve"
        ? note.trim().length > 0
        : form?.input === "file"
          ? true
          : Boolean(unitId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Thao tác xử lý văn bản">
        {slot(forwardAction, "Chuyển", true)}
        <Button size="sm" variant="outline" aria-pressed={isMarked} onClick={() => void toggleMark()}>
          {isMarked ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
          {isMarked ? "Hủy đánh dấu" : "Đánh dấu"}
        </Button>
        {slot(finishAction, "Kết thúc")}
        {slot(fileAction, "Lưu hồ sơ")}
        {returnAction ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={pending !== null}
            onClick={() => void run(returnAction)}
          >
            {returnAction.label}
          </Button>
        ) : null}
      </div>

      {form?.input === "reason" && (
        <div className="space-y-1.5">
          <Textarea
            compact
            value={reason}
            maxLength={1000}
            aria-label="Lý do trả lại"
            placeholder="Lý do trả lại (bắt buộc)"
            onChange={(e) => setReason(e.target.value)}
            className="min-h-16"
          />
        </div>
      )}
      {form?.input === "unit" && (
        <div className="space-y-1.5">
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Đơn vị nhận văn bản"
            placeholder={isDepartmentsLoading ? "Đang tải danh sách đơn vị..." : "— Chọn đơn vị nhận —"}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            value={unitId}
            onValueChange={(val) => setUnitId(val || null)}
          />
          <Textarea
            compact
            value={note}
            maxLength={1000}
            aria-label="Ghi chú chuyển đơn vị"
            placeholder="Ghi chú (không bắt buộc)"
            onChange={(e) => setNote(e.target.value)}
            className="min-h-12"
          />
        </div>
      )}
      {form?.input === "resolve" && (
        <Textarea
          compact
          value={note}
          maxLength={1000}
          aria-label="Kết quả giải quyết"
          placeholder="Kết quả giải quyết (bắt buộc)"
          onChange={(e) => setNote(e.target.value)}
          className="min-h-16"
        />
      )}
      {form?.input === "file" && (
        <div className="space-y-1.5">
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Hồ sơ lưu"
            placeholder={dossiers.length === 0 ? "Chưa có hồ sơ công việc" : "— Chọn hồ sơ (không bắt buộc) —"}
            options={dossiers}
            value={dossierId}
            onValueChange={(val) => setDossierId(val || null)}
          />
          {newDossierTitle === null ? (
            <Button size="xs" variant="ghost" onClick={() => setNewDossierTitle("")}>
              Tạo hồ sơ mới
            </Button>
          ) : (
            <div className="space-y-1.5 rounded-md border border-border/60 p-2">
              <Input compact value={newDossierTitle} maxLength={255} aria-label="Tên hồ sơ mới" placeholder="Tên hồ sơ mới" onChange={(e) => setNewDossierTitle(e.target.value)} />
              <Select
                compact
                positionerClassName="z-50"
                aria-label="Đơn vị quản lý hồ sơ"
                placeholder="— Đơn vị quản lý hồ sơ —"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                value={newDossierUnitId}
                onValueChange={(val) => setNewDossierUnitId(val || null)}
              />
              <div className="flex gap-1.5">
                <Button size="xs" disabled={pending !== null || !newDossierTitle.trim() || !newDossierUnitId} onClick={() => void createDossier()}>
                  Tạo hồ sơ
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setNewDossierTitle(null)}>
                  Hủy
                </Button>
              </div>
            </div>
          )}
          <Textarea
            compact
            value={note}
            maxLength={1000}
            aria-label="Ghi chú lưu hồ sơ"
            placeholder="Ghi chú (không bắt buộc)"
            onChange={(e) => setNote(e.target.value)}
            className="min-h-12"
          />
        </div>
      )}
      {form && (
        <div className="flex gap-1.5">
          <Button size="xs" disabled={pending !== null || !formReady} onClick={() => void submitForm()}>
            {form.input === "reason" ? "Trả lại văn bản" : form.input === "resolve" ? "Kết thúc" : form.input === "file" ? "Lưu hồ sơ" : "Chuyển văn bản"}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => { setForm(null); setError(null); }}>
            Hủy
          </Button>
        </div>
      )}
      {error && !forwardMode && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {forwardMode ? (
        <IncomingForwardDialog
          open
          mode={forwardMode}
          pending={pending !== null}
          error={error}
          onOpenChange={(next) => {
            if (!next) setForwardMode(null);
          }}
          onSubmit={(payload) => void submitForward(payload)}
        />
      ) : null}
    </div>
  );
}

/** Các bước xử lý văn bản đến, bước đang chờ và người cần làm (ai không có thao tác vẫn biết đang chờ ai). */
export function IncomingFlowProgress({ status, leadUnitName }: { status: string; leadUnitName?: string | null }) {
  const flow = getIncomingFlow(status);
  if (!flow) return null;
  const waiting = flow.waitingFor ? `${flow.waitingFor}${leadUnitName && flow.steps[2].state === "active" ? ` (${leadUnitName})` : ""}` : null;
  return (
    <div className="space-y-1.5" data-slot="incoming-flow">
      <ol aria-label="Luồng xử lý văn bản đến" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {flow.steps.map((step, i) => (
          <li
            key={step.key}
            aria-current={step.state === "active" ? "step" : undefined}
            className={cn(
              "flex items-center gap-1",
              step.state === "active" ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 items-center justify-center rounded-full border",
                step.state === "done" && "border-primary bg-primary text-primary-foreground",
                step.state === "active" && "border-primary text-primary",
                step.state === "upcoming" && "border-border",
              )}
            >
              {step.state === "done" ? <Check className="size-3" /> : step.state === "active" ? <span className="size-1.5 rounded-full bg-primary" /> : null}
            </span>
            {step.label}
            <span className="sr-only">{step.state === "done" ? " (đã xong)" : step.state === "active" ? " (đang chờ)" : ` (bước ${i + 1})`}</span>
          </li>
        ))}
      </ol>
      {waiting ? <p className="text-compact text-muted-foreground">Đang chờ: <span className="text-foreground">{waiting}</span></p> : null}
    </div>
  );
}

/** Thuộc tính quy trình văn bản đến (chưa có ở tiêu đề): nhãn, giá trị, có dùng font mono. */
export function getIncomingAttributes(item: DocumentItem): [string, React.ReactNode, boolean][] {
  const wf = (item.incomingWorkflow ?? {}) as {
    resolutionSummary?: string | null;
    dossierId?: string | null;
    unitAssignments?: { driUser?: { name?: string | null } | null }[];
  };
  const assignees = (wf.unitAssignments ?? []).map((a) => a.driUser?.name).filter(Boolean).join(", ");
  // Số đến, hạn xử lý, mức khẩn đã nằm ở tiêu đề và dòng trạng thái: không lặp lại ở đây.
  const attributes: [string, React.ReactNode, boolean][] = [
    ["Ngày đến", formatLedgerDate(item.registeredDate), false],
    ["Loại văn bản", item.category, false],
    ["Chủ trì", item.leadUnitName, false],
    ["Phụ trách", assignees, false],
    ["Kết quả", wf.resolutionSummary, false],
    ["Hồ sơ lưu", wf.dossierId, true],
  ];
  return attributes.filter(([, value]) => Boolean(value));
}

/** Ý kiến chỉ đạo của văn bản đến; không có thì không dựng gì. */
export function IncomingDirectives({ item }: { item: DocumentItem }) {
  const quotes = buildIncomingQuotes(item);
  if (quotes.length === 0) return null;
  return (
    <section aria-label="Ý kiến chỉ đạo">
      <SectionHeading count={quotes.length}>Ý kiến chỉ đạo</SectionHeading>
      <div className="space-y-3">
        {quotes.map((q) => (
          <figure key={q.id} className="border-l-2 border-border pl-3">
            {q.text ? <blockquote className="text-compact leading-relaxed text-foreground">{q.text}</blockquote> : null}
            <figcaption className="mt-1 text-xs text-muted-foreground">
              {q.who}
              {q.at ? <> · <span className="tabular-nums">{formatShortDateTime(q.at)}</span></> : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * Thuộc tính (chỉ những gì chưa có ở tiêu đề) và ý kiến chỉ đạo. Luân chuyển dùng chung
 * `DocumentAuditTimeline` (dữ liệu từ server) nên không dựng thêm danh sách bước ở đây.
 */
export function IncomingWorkflowDetails({ item }: { item: DocumentItem }) {
  const visibleAttributes = getIncomingAttributes(item);
  return (
    <>
      {visibleAttributes.length > 0 ? (
        <section aria-label="Thuộc tính">
          <SectionHeading>Thuộc tính</SectionHeading>
          <div className="pb-1">
            {visibleAttributes.map(([label, value, mono]) => (
              <InspectorRow key={label} label={label} mono={mono}>{value}</InspectorRow>
            ))}
          </div>
        </section>
      ) : null}
      <IncomingDirectives item={item} />
    </>
  );
}
