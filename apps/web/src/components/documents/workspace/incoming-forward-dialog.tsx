"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StandardDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { useDepartmentList, type DepartmentOption } from "@/hooks/use-department-list";
import { cn } from "@/lib/utils";

import { Spinner } from "@/components/ui/spinner";
export type ForwardMode = "unit" | "person";

export interface ForwardPayload {
  /** Người/đơn vị xử lý chính (XLC): đúng một. */
  mainId: string;
  /** Người/đơn vị phối hợp (PH). */
  coordinatorIds: string[];
  instruction: string;
  deadline: string | null;
  createTask: boolean;
}

interface Row {
  id: string;
  name: string;
  caption?: string;
}

/** Hộp "Chọn người nhận" (kiểu VNPT): tìm theo tên, XLC chọn một, PH chọn nhiều. Chưa có cột XEM vì chưa có quyền chỉ-xem theo văn bản. */
export function IncomingForwardDialog({
  open,
  onOpenChange,
  mode,
  pending,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ForwardMode;
  pending: boolean;
  error: string | null;
  onSubmit: (payload: ForwardPayload) => void;
}) {
  const { departments, isLoading } = useDepartmentList({ enabled: open, includePersonnel: mode === "person" });
  const [query, setQuery] = React.useState("");
  const [mainId, setMainId] = React.useState<string | null>(null);
  const [coordinators, setCoordinators] = React.useState<string[]>([]);
  const [instruction, setInstruction] = React.useState("");
  const [deadline, setDeadline] = React.useState<string | null>(null);
  const [createTask, setCreateTask] = React.useState(true);

  const groups = React.useMemo(() => groupRows(departments, mode, query), [departments, mode, query]);
  const needsInstruction = mode === "unit";
  const ready = Boolean(mainId) && (!needsInstruction || instruction.trim().length > 0);

  const setMain = (id: string, checked: boolean) => {
    setMainId(checked ? id : null);
    if (checked) setCoordinators((prev) => prev.filter((x) => x !== id));
  };
  const toggleCoordinator = (id: string, checked: boolean) => {
    setCoordinators((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
    if (checked && mainId === id) setMainId(null);
  };

  return (
    <StandardDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Chọn người nhận văn bản"
      description={mode === "unit" ? "Chọn đơn vị chủ trì (XLC) và các đơn vị phối hợp (PH)." : "Chọn người xử lý chính (XLC) và những người phối hợp (PH)."}
      size="md"
      compact
    >
      <div className="space-y-3">
        <Input
          compact
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={mode === "unit" ? "Tìm đơn vị" : "Tìm theo họ tên"}
          placeholder={mode === "unit" ? "Tìm đơn vị…" : "Họ tên…"}
        />

        <div className="max-h-72 overflow-y-auto rounded-md border border-border/60">
          <div className="sticky top-0 z-10 grid grid-cols-[1fr_3rem_3rem] items-center bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <span>Đơn vị/cá nhân</span>
            <span className="text-center">XLC</span>
            <span className="text-center">PH</span>
          </div>
          {isLoading ? (
            <p role="status" className="px-3 py-3 text-compact text-muted-foreground">Đang tải danh sách…</p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-3 text-compact text-muted-foreground">Không có kết quả phù hợp.</p>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                {group.heading ? <p className="bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">{group.heading}</p> : null}
                {group.rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_3rem_3rem] items-center px-3 py-1 text-compact hover:bg-accent/40">
                    <span className={cn("min-w-0 truncate", group.heading && "pl-3")} title={row.caption ? `${row.name} · ${row.caption}` : row.name}>
                      {row.name}
                      {row.caption ? <span className="ml-1.5 text-xs text-muted-foreground">{row.caption}</span> : null}
                    </span>
                    <span className="flex justify-center">
                      <Checkbox
                        aria-label={`Xử lý chính: ${row.name}`}
                        checked={mainId === row.id}
                        onChange={(e) => setMain(row.id, e.target.checked)}
                      />
                    </span>
                    <span className="flex justify-center">
                      <Checkbox
                        aria-label={`Phối hợp: ${row.name}`}
                        checked={coordinators.includes(row.id)}
                        onChange={(e) => toggleCoordinator(row.id, e.target.checked)}
                      />
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Xử lý chính: {mainId ? 1 : 0} · Phối hợp: {coordinators.length}
        </p>

        <Textarea
          compact
          value={instruction}
          maxLength={1000}
          aria-label="Ý kiến chỉ đạo"
          placeholder={needsInstruction ? "Ý kiến chỉ đạo (bắt buộc)" : "Ý kiến phân công (không bắt buộc)"}
          onChange={(e) => setInstruction(e.target.value)}
          className="min-h-16"
        />
        {mode === "person" ? (
          <label className="flex items-center gap-2 text-compact text-foreground">
            <Checkbox checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} />
            Giao thành nhiệm vụ
          </label>
        ) : null}
        {mode === "unit" || createTask ? (
          <VietnameseDatePicker
            variant="input"
            label="Hạn xử lý"
            placeholder={mode === "unit" ? "Hạn xử lý (không bắt buộc)" : "Hạn hoàn thành (mặc định 7 ngày)"}
            value={deadline}
            onChange={(iso) => setDeadline(iso || null)}
            minDate={new Date().toISOString().slice(0, 10)}
          />
        ) : null}

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Hủy
          </Button>
          <Button
            size="sm"
            disabled={!ready || pending}
            onClick={() =>
              mainId &&
              onSubmit({
                mainId,
                coordinatorIds: coordinators,
                instruction: instruction.trim(),
                deadline: (mode === "unit" || createTask) && deadline ? deadline : null,
                createTask: mode === "person" && createTask,
              })
            }
          >
            {pending ? <Spinner size="xs" /> : null}
            Chuyển
          </Button>
        </div>
      </div>
    </StandardDialog>
  );
}

function groupRows(departments: DepartmentOption[], mode: ForwardMode, query: string) {
  const needle = query.trim().toLowerCase();
  const match = (text: string) => !needle || text.toLowerCase().includes(needle);
  if (mode === "unit") {
    const rows: Row[] = departments.filter((d) => match(d.name)).map((d) => ({ id: d.id, name: d.name }));
    return rows.length ? [{ key: "units", heading: null as string | null, rows }] : [];
  }
  return departments
    .map((d) => ({
      key: d.id,
      heading: d.name as string | null,
      rows: (d.personnel ?? [])
        .filter((p) => match(p.name) || match(d.name))
        .map((p): Row => ({ id: p.id, name: p.name, caption: p.title ?? undefined })),
    }))
    .filter((g) => g.rows.length > 0);
}
