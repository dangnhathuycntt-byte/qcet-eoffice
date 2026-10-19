"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { formatDisplayDate } from "@qcet/shared/lib/format/date";
import { planProposalBatch, type ProposalBatchRow } from "@qcet/shared/domain/assistant/assistant-task-proposal";
import type { AssistantProposalTask } from "@qcet/contracts/assistant";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StandardDialog } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PersonPillPicker } from "@/components/tasks/create/person-pill-picker";
import { describeCreateTaskFailure, performCreateTaskSubmission, useCreateTaskDepartments } from "@/hooks/use-create-task-form";
import type { CreateTaskDraft } from "@/lib/adapters/create-task-mapper";
import type { ProposalTarget } from "@/components/assistant/assistant-model";

/** Máy chủ báo 429 mà không kèm `Retry-After` thì chờ hết một cửa sổ giới hạn (30 lần tạo mỗi phút). */
const RATE_LIMIT_FALLBACK_SECONDS = 60;

type RowResult =
  | { status: "creating" }
  | { status: "created"; task: AssistantProposalTask }
  | { status: "failed"; message: string };

const keyOf = (item: ProposalTarget) => `${item.replyKey}:${item.index}`;

/** Nháp của hàng thành thân `POST /api/tasks` qua adapter chung (cấp đơn vị, việc con kế thừa đơn vị và hạn ở máy chủ). */
function toCreateDraft(row: ProposalBatchRow, leadName: string | undefined): CreateTaskDraft {
  const { draft } = row;
  return {
    level: "DON_VI",
    title: draft.title ?? "",
    startDate: draft.startDate,
    dueDate: draft.dueDate ?? "",
    description: draft.description ?? "",
    leadAssigneeName: leadName,
    priority: draft.priority,
    subtasks: draft.subtasks?.map(({ title, description, assigneeId, dueDate }) => ({ title, description, assigneeId, dueDate })),
  };
}

function missingLabel(missing: ProposalBatchRow["missing"]): string {
  if (missing.includes("dueDate") && missing.includes("lead")) return "Thiếu hạn và chủ trì";
  return missing.includes("dueDate") ? "Thiếu hạn" : "Chưa khớp chủ trì";
}

/**
 * "Tạo tất cả" đề xuất của Trợ lý (kế hoạch nhiều nhiệm vụ, ADR-010): người dùng chọn đơn vị, xem bảng đề xuất, bỏ chọn
 * đề xuất không cần rồi tự bấm Tạo. Mỗi đề xuất qua đúng `POST /api/tasks` như hộp tạo nhiệm vụ (máy chủ kiểm quyền),
 * lần lượt từng cái, mỗi cái một khóa idempotency giữ lại khi chưa rõ kết quả. Chạm giới hạn tạo mỗi phút thì tự chờ rồi
 * tạo tiếp. Đề xuất thiếu hạn hoặc chủ trì không tạo ở đây: người dùng mở thẻ để xem lại và tạo riêng. Tệp gửi kèm lượt
 * hỏi không đính vào từng nhiệm vụ (hộp tạo riêng mới đính).
 */
export function AssistantBulkCreateDialog({
  open,
  items,
  onClose,
  onCreated,
}: {
  open: boolean;
  items: ProposalTarget[];
  onClose: () => void;
  /** Thẻ đề xuất chuyển sang "Đã tạo"; trả promise thì chờ lưu xong mới tạo cái tiếp theo. */
  onCreated: (item: ProposalTarget, task: AssistantProposalTask) => Promise<void> | void;
}) {
  const { userDeptCode, availableDepartments, isLoadingDepartments } = useCreateTaskDepartments();
  const [deptCode, setDeptCode] = React.useState("");
  const [fallbackLeadId, setFallbackLeadId] = React.useState("");
  const [leadPickerOpen, setLeadPickerOpen] = React.useState(false);
  const [excluded, setExcluded] = React.useState<Set<string>>(() => new Set());
  const [results, setResults] = React.useState<Record<string, RowResult>>({});
  const [running, setRunning] = React.useState(false);
  const [waitSeconds, setWaitSeconds] = React.useState(0);
  const stopRef = React.useRef(false);
  // Khóa idempotency của đề xuất chưa rõ kết quả: tạo lại dùng đúng khóa đó để máy chủ không tạo trùng
  const idempotencyKeys = React.useRef(new Map<string, string>());

  // Mỗi lần mở là một lượt mới theo danh sách đề xuất lúc mở
  React.useEffect(() => {
    if (!open) return;
    setExcluded(new Set());
    setResults({});
    setFallbackLeadId("");
    setWaitSeconds(0);
    stopRef.current = false;
    idempotencyKeys.current.clear();
  }, [open]);

  const dept = availableDepartments.find((d) => d.code === deptCode) ?? availableDepartments.find((d) => d.code === userDeptCode) ?? availableDepartments[0];
  const personnel = React.useMemo(() => dept?.personnel ?? [], [dept]);
  const proposals = React.useMemo(() => items.map((item) => item.proposal), [items]);
  const rows = React.useMemo(() => planProposalBatch(proposals, personnel, fallbackLeadId || undefined), [proposals, personnel, fallbackLeadId]);
  // Có đề xuất mà tên chủ trì không khớp ai trong đơn vị: hiện ô chọn chủ trì dùng chung cho các đề xuất đó
  const unmatchedLead = React.useMemo(() => planProposalBatch(proposals, personnel).some((row) => row.missing.includes("lead")), [proposals, personnel]);
  const nameOf = (id: string | undefined) => (id ? personnel.find((person) => person.id === id)?.name : undefined);

  const created = items.filter((item) => results[keyOf(item)]?.status === "created").length;
  const selectable = items.filter((item, i) => rows[i].missing.length === 0 && results[keyOf(item)]?.status !== "created");
  const selected = selectable.filter((item) => !excluded.has(keyOf(item)));
  const failed = items.filter((item) => results[keyOf(item)]?.status === "failed").length;

  const toggle = (key: string, checked: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(key);
      else next.add(key);
      return next;
    });

  const waitFor = async (seconds: number) => {
    for (let left = Math.max(1, Math.ceil(seconds)); left > 0 && !stopRef.current; left--) {
      setWaitSeconds(left);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setWaitSeconds(0);
  };

  const run = async () => {
    if (running || !dept) return;
    stopRef.current = false;
    setRunning(true);
    const departmentId = dept.code || dept.id || userDeptCode;
    const people = personnel.map((person) => ({ id: person.id, name: person.name }));
    try {
      for (const item of selected) {
        if (stopRef.current) break;
        const key = keyOf(item);
        const row = rows[items.indexOf(item)];
        setResults((prev) => ({ ...prev, [key]: { status: "creating" } }));
        const submit = () =>
          performCreateTaskSubmission(toCreateDraft(row, nameOf(row.draft.leadAssigneeId)), {
            personnel: people,
            assigneeId: row.draft.leadAssigneeId,
            departmentId,
            idempotencyKey: idempotencyKeys.current.get(key),
          });
        let outcome = await submit();
        // Giới hạn 30 lần tạo mỗi phút: chờ theo máy chủ báo rồi gửi lại (yêu cầu bị từ chối nên gửi lại không tạo trùng)
        while (!outcome.result.ok && outcome.result.status === 429 && !stopRef.current) {
          await waitFor(outcome.result.retryAfterSeconds ?? RATE_LIMIT_FALLBACK_SECONDS);
          if (stopRef.current) break;
          outcome = await submit();
        }
        if (outcome.result.ok) {
          idempotencyKeys.current.delete(key);
          const task = { id: outcome.result.task.id, code: outcome.result.task.code ?? null };
          setResults((prev) => ({ ...prev, [key]: { status: "created", task } }));
          await onCreated(item, task);
        } else if (outcome.status === "unknown") {
          idempotencyKeys.current.set(key, outcome.result.idempotencyKey);
          setResults((prev) => ({ ...prev, [key]: { status: "failed", message: "Chưa xác nhận được kết quả. Bấm Tạo để thử lại an toàn." } }));
        } else if (stopRef.current && outcome.result.status === 429) {
          setResults((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        } else {
          const message = describeCreateTaskFailure(outcome.result);
          setResults((prev) => ({ ...prev, [key]: { status: "failed", message } }));
        }
      }
    } finally {
      setRunning(false);
      setWaitSeconds(0);
    }
  };

  const allChecked = selectable.length > 0 && selected.length === selectable.length;
  const done = !running && created > 0 && selected.length === 0;

  return (
    <StandardDialog
      open={open}
      onOpenChange={(next) => {
        // Đang tạo thì chỉ dừng bằng nút Dừng, không đóng giữa chừng bằng Esc hay bấm ra ngoài
        if (!next && !running) onClose();
      }}
      title={`Tạo ${items.length} nhiệm vụ từ đề xuất`}
      description="Mỗi đề xuất thành một nhiệm vụ cấp đơn vị, kèm việc con nếu có. Đề xuất thiếu hạn hoặc chủ trì thì mở thẻ để xem lại và tạo riêng."
      size="lg"
      compact
      showCloseButton={false}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {availableDepartments.length > 1 ? (
            <Select
              compact
              aria-label="Đơn vị"
              className="w-64"
              positionerClassName="z-50"
              disabled={running || created > 0}
              value={dept?.code ?? ""}
              onValueChange={(value) => {
                if (!value) return;
                setDeptCode(value);
                setFallbackLeadId("");
              }}
              options={availableDepartments.map((d) => ({ value: d.code, label: d.name }))}
            />
          ) : dept ? (
            <span className="text-xs text-muted-foreground">Đơn vị: {dept.name}</span>
          ) : null}
          {unmatchedLead ? (
            <PersonPillPicker
              people={personnel}
              valueId={fallbackLeadId}
              onSelect={(person) => setFallbackLeadId(person.id)}
              open={leadPickerOpen}
              onOpenChange={setLeadPickerOpen}
              loading={isLoadingDepartments}
              emptyLabel="Chủ trì khi tên không khớp"
              compactWhenEmpty={false}
            />
          ) : null}
        </div>

        <div className="-mx-1 max-h-[50dvh] min-h-0 overflow-y-auto px-1 thin-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-8 pl-1">
                  <Checkbox
                    aria-label="Chọn tất cả đề xuất tạo được"
                    checked={allChecked}
                    indeterminate={selected.length > 0 && !allChecked}
                    disabled={running || selectable.length === 0}
                    onChange={(e) => setExcluded(e.currentTarget.checked ? new Set() : new Set(selectable.map(keyOf)))}
                  />
                </TableHead>
                <TableHead>Nhiệm vụ</TableHead>
                <TableHead className="w-24">Hạn</TableHead>
                <TableHead className="w-40 max-md:hidden">Chủ trì</TableHead>
                <TableHead className="w-36">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => {
                const key = keyOf(item);
                const row = rows[i];
                const result = results[key];
                const ready = row.missing.length === 0;
                const subtasks = row.draft.subtasks?.length ?? 0;
                return (
                  <TableRow key={key}>
                    <TableCell className="pl-1">
                      {result?.status === "created" ? (
                        <Check aria-label="Đã tạo" className="size-4 text-foreground" />
                      ) : (
                        <Checkbox
                          aria-label={`Tạo nhiệm vụ: ${item.proposal.title}`}
                          checked={ready && !excluded.has(key)}
                          disabled={running || !ready}
                          onChange={(e) => toggle(key, e.currentTarget.checked)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="max-w-0">
                      <span className="block truncate" title={item.proposal.title}>
                        {item.proposal.title}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {row.draft.dueDate ? formatDisplayDate(row.draft.dueDate) : "—"}
                    </TableCell>
                    <TableCell className="max-w-0 max-md:hidden">
                      <span className="block truncate text-muted-foreground" title={nameOf(row.draft.leadAssigneeId) ?? item.proposal.leadAssigneeName}>
                        {nameOf(row.draft.leadAssigneeId) ?? item.proposal.leadAssigneeName ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-0 text-xs">
                      {result?.status === "created" ? (
                        <Link href={`/tasks/${encodeURIComponent(result.task.id)}`} className="block truncate text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
                          {result.task.code ?? "Mở nhiệm vụ"}
                        </Link>
                      ) : result?.status === "creating" ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Spinner size="sm" />
                          {waitSeconds > 0 ? `Chờ ${waitSeconds} giây` : "Đang tạo"}
                        </span>
                      ) : result?.status === "failed" ? (
                        <span className="block truncate text-destructive" title={result.message}>
                          {result.message}
                        </span>
                      ) : !ready ? (
                        <span className="block truncate text-warning">{missingLabel(row.missing)}</span>
                      ) : (
                        <span className="text-muted-foreground">{subtasks > 0 ? `${subtasks} việc con` : "Chưa tạo"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {waitSeconds > 0 ? (
          <InlineAlert variant="info">
            Đã tạo {created} nhiệm vụ. Hệ thống giới hạn 30 nhiệm vụ mỗi phút, tự tạo tiếp sau {waitSeconds} giây.
          </InlineAlert>
        ) : failed > 0 && !running ? (
          <InlineAlert variant="warning">Có {failed} đề xuất chưa tạo được. Xem lý do ở cột Trạng thái, rồi bấm Tạo để thử lại.</InlineAlert>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <p role="status" className="mr-auto text-xs text-muted-foreground">
            {created > 0 ? `Đã tạo ${created}/${items.length} nhiệm vụ` : `${selected.length} đề xuất được chọn`}
          </p>
          {running ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              Dừng
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onClose}>
              {done ? "Xong" : "Đóng"}
            </Button>
          )}
          {done ? null : (
            <Button size="sm" disabled={running || selected.length === 0 || !dept} onClick={() => void run()}>
              {running ? "Đang tạo…" : `Tạo ${selected.length} nhiệm vụ`}
            </Button>
          )}
        </div>
      </div>
    </StandardDialog>
  );
}
