"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface InboxRow {
  id: string;
  taskId: string;
  task: { code: string; title: string; dueDate: string; leadUnitName: string | null };
  targetUnit: { id: string; name: string };
  requestedBy: { id: string; name: string };
  note: string | null;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

/**
 * Hộp thư yêu cầu phối hợp liên đơn vị (T-12) dành cho trưởng đơn vị được yêu cầu.
 * Trưởng đơn vị chưa đọc được nhiệm vụ nên mỗi dòng mang đủ thông tin để quyết định.
 */
export function UnitRequestInbox({ className }: { className?: string }) {
  const [rows, setRows] = React.useState<InboxRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"assign" | "decline">("assign");
  const [members, setMembers] = React.useState<Member[]>([]);
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/task-unit-requests", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Không tải được yêu cầu phối hợp"));
      const json = await res.json();
      setRows(json.requests ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được yêu cầu phối hợp");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const open = async (row: InboxRow, nextMode: "assign" | "decline") => {
    setOpenId(row.id);
    setMode(nextMode);
    setAssigneeId(null);
    setNote("");
    if (nextMode === "assign") {
      try {
        const res = await fetch(`/api/users?departmentId=${encodeURIComponent(row.targetUnit.id)}&limit=100`, { cache: "no-store" });
        const json = await res.json();
        setMembers(Array.isArray(json.users) ? json.users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })) : []);
      } catch {
        setMembers([]);
      }
    }
  };

  const submit = async (row: InboxRow) => {
    setBusyId(row.id);
    setError(null);
    try {
      const body =
        mode === "assign"
          ? { requestId: row.id, decision: "ASSIGN", assigneeUserId: assigneeId, ...(note.trim() ? { note: note.trim() } : {}) }
          : { requestId: row.id, decision: "DECLINE", note: note.trim() };
      const res = await fetch(`/api/tasks/${row.taskId}/actions/fulfill-unit-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res, "Không ghi nhận được phản hồi"));
      setOpenId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không ghi nhận được phản hồi");
    } finally {
      setBusyId(null);
    }
  };

  if (rows === null && !error) return <p className={cn("text-xs text-muted-foreground", className)}>Đang tải…</p>;

  return (
    <section aria-label="Yêu cầu phối hợp" className={cn("space-y-2", className)}>
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      {rows && rows.length === 0 && <p className="text-compact text-muted-foreground">Không có yêu cầu nào đang chờ.</p>}
      <ul className="space-y-2">
        {(rows ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border border-border bg-card p-3">
            <p className="text-compact font-medium text-foreground">{row.task.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.task.code} · hạn {fmt(row.task.dueDate)} · chủ trì {row.task.leadUnitName ?? "—"} · {row.requestedBy.name} đề nghị {fmt(row.createdAt)}
            </p>
            {row.note && <p className="mt-1 text-compact text-foreground">{row.note}</p>}

            {openId === row.id ? (
              <div className="mt-2 space-y-1.5">
                {mode === "assign" ? (
                  <Select
                    compact
                    positionerClassName="z-50"
                    aria-label="Người được cử"
                    placeholder="— Chọn người của đơn vị —"
                    options={members.map((m) => ({ value: m.id, label: m.name }))}
                    value={assigneeId}
                    onValueChange={(v) => setAssigneeId(v || null)}
                  />
                ) : null}
                <Textarea
                  compact
                  value={note}
                  maxLength={1000}
                  aria-label={mode === "assign" ? "Ghi chú" : "Lý do từ chối"}
                  placeholder={mode === "assign" ? "Ghi chú (không bắt buộc)" : "Lý do từ chối (bắt buộc)"}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-14"
                />
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="xs"
                    disabled={busyId === row.id || (mode === "assign" ? !assigneeId : note.trim().length < 3)}
                    onClick={() => void submit(row)}
                  >
                    {mode === "assign" ? "Cử phối hợp" : "Từ chối"}
                  </Button>
                  <Button type="button" size="xs" variant="ghost" onClick={() => setOpenId(null)}>
                    Hủy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-1.5">
                <Button type="button" size="xs" onClick={() => void open(row, "assign")}>
                  Cử người phối hợp
                </Button>
                <Button type="button" size="xs" variant="ghost" onClick={() => void open(row, "decline")}>
                  Từ chối
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
