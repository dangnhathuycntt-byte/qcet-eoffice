"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDepartmentList } from "@/hooks/use-department-list";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { PRIORITY_DISPLAY_CONFIG } from "@/domain/tasks/display-config";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

interface Template {
  id: string;
  name: string;
  unitId: string;
  title: string;
  description: string | null;
  priority: string;
  dueDay: number;
  criteria: string[];
  subtasks: string[];
  isActive: boolean;
}

interface Recurrence {
  id: string;
  templateId: string;
  driUserId: string;
  collaboratorIds: string[];
  reviewerUserId: string | null;
  everyMonths: number;
  catchUpPeriods?: number;
  startPeriod: string;
  endPeriod: string | null;
  isActive: boolean;
  lastRun: { periodKey: string; taskId: string | null; error: string | null; status: "CREATED" | "PARTIAL" | "FAILED" | "CREATING" } | null;
}

const RUN_LABEL: Record<string, string> = { CREATED: "Đã tạo", PARTIAL: "Tạo thiếu việc con", FAILED: "Lỗi", CREATING: "Đang tạo" };
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json && (json.detail || json.error || json.title)) || "Thao tác không thành công");
  return json as T;
}

const lines = (text: string) => text.split("\n").map((x) => x.trim()).filter(Boolean);
const currentPeriod = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).slice(0, 7);

/**
 * Quản lý mẫu nhiệm vụ và lịch lặp lại theo tháng (T-09). Chỉ trưởng đơn vị và lãnh đạo thấy được mẫu của đơn vị mình;
 * quyền kiểm ở máy chủ nên người khác nhận danh sách rỗng hoặc bị từ chối khi lưu.
 */
export function TaskTemplatesManager({ className }: { className?: string }) {
  const [templates, setTemplates] = React.useState<Template[] | null>(null);
  const [recurrences, setRecurrences] = React.useState<Recurrence[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState<{ id: string | null } | null>(null);
  const [recFor, setRecFor] = React.useState<string | null>(null);

  const { departments } = useDepartmentList({ enabled: true });
  const { personnel } = usePersonnelList({ enabled: true });
  const unitName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;
  const personName = (id: string | null) => (id ? personnel.find((p) => p.id === id)?.name ?? id : "—");

  // Biểu mẫu mẫu nhiệm vụ
  const [name, setName] = React.useState("");
  const [unitId, setUnitId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<string>("NORMAL");
  const [dueDay, setDueDay] = React.useState("25");
  const [criteria, setCriteria] = React.useState("");
  const [subtasks, setSubtasks] = React.useState("");

  // Biểu mẫu lịch lặp lại
  const [dri, setDri] = React.useState<string | null>(null);
  const [reviewer, setReviewer] = React.useState<string | null>(null);
  const [every, setEvery] = React.useState("1");
  const [start, setStart] = React.useState(currentPeriod());
  const [end, setEnd] = React.useState("");
  const [catchUp, setCatchUp] = React.useState("0");

  const load = React.useCallback(async () => {
    try {
      const [t, r] = await Promise.all([api<{ templates: Template[] }>("/api/task-templates"), api<{ recurrences: Recurrence[] }>("/api/task-recurrences")]);
      setTemplates(t.templates);
      setRecurrences(r.recurrences);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác không thành công");
    } finally {
      setBusy(false);
    }
  };

  const openForm = (t: Template | null) => {
    setForm({ id: t?.id ?? null });
    setName(t?.name ?? "");
    setUnitId(t?.unitId ?? null);
    setTitle(t?.title ?? "");
    setDescription(t?.description ?? "");
    setPriority(t?.priority ?? "NORMAL");
    setDueDay(String(t?.dueDay ?? 25));
    setCriteria((t?.criteria ?? []).join("\n"));
    setSubtasks((t?.subtasks ?? []).join("\n"));
  };

  const saveTemplate = () =>
    run(async () => {
      const body = { name: name.trim(), unitId, title: title.trim(), description: description.trim() || null, priority, dueDay: Number(dueDay), criteria: lines(criteria), subtasks: lines(subtasks) };
      if (form?.id) await api(`/api/task-templates/${form.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/api/task-templates", { method: "POST", body: JSON.stringify(body) });
      setForm(null);
    });

  const saveRecurrence = (templateId: string) =>
    run(async () => {
      await api("/api/task-recurrences", {
        method: "POST",
        body: JSON.stringify({ templateId, driUserId: dri, reviewerUserId: reviewer, everyMonths: Number(every), startPeriod: start, endPeriod: end || null, catchUpPeriods: Number(catchUp) }),
      });
      setRecFor(null);
      setDri(null);
      setReviewer(null);
    });

  const patchRecurrence = (id: string, body: Record<string, unknown>) => run(() => api(`/api/task-recurrences/${id}`, { method: "PATCH", body: JSON.stringify(body) }));

  const dueDayNum = Number(dueDay);
  const formValid = name.trim() && unitId && title.trim() && Number.isInteger(dueDayNum) && dueDayNum >= 1 && dueDayNum <= 28;
  const recValid = dri && PERIOD_RE.test(start) && (!end || PERIOD_RE.test(end)) && Number(every) >= 1 && Number(every) <= 12;

  return (
    <section aria-label="Mẫu nhiệm vụ" className={cn("space-y-3", className)}>
      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {!form && (
        <Button size="sm" onClick={() => openForm(null)}>
          Tạo mẫu
        </Button>
      )}

      {form && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <h2 className="text-compact font-semibold text-foreground">{form.id ? "Sửa mẫu" : "Mẫu mới"}</h2>
          <Input compact value={name} maxLength={200} aria-label="Tên mẫu" placeholder="Tên mẫu (ví dụ: Báo cáo công tác tháng)" onChange={(e) => setName(e.target.value)} />
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Đơn vị"
            placeholder="— Đơn vị chủ quản —"
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            value={unitId}
            onValueChange={(v) => setUnitId(v || null)}
          />
          <Input compact value={title} maxLength={500} aria-label="Tiêu đề nhiệm vụ" placeholder="Tiêu đề, dùng {thang}, {nam}, {nam_hoc} để chèn kỳ" onChange={(e) => setTitle(e.target.value)} />
          <Textarea compact value={description} maxLength={5000} aria-label="Mô tả" placeholder="Mô tả (không bắt buộc)" onChange={(e) => setDescription(e.target.value)} className="min-h-14" />
          <div className="grid grid-cols-2 gap-2">
            <Select
              compact
              positionerClassName="z-50"
              aria-label="Ưu tiên"
              options={PRIORITY_DISPLAY_CONFIG.map((p) => ({ value: p.value, label: p.label }))}
              value={priority}
              onValueChange={(v) => setPriority(v || "NORMAL")}
            />
            <Input compact value={dueDay} inputMode="numeric" aria-label="Ngày hạn trong tháng" placeholder="Ngày hạn (1-28)" onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} />
          </div>
          <Textarea compact value={criteria} aria-label="Tiêu chí hoàn thành" placeholder="Tiêu chí hoàn thành (mỗi dòng một tiêu chí, tối đa 20)" onChange={(e) => setCriteria(e.target.value)} className="min-h-14" />
          <Textarea compact value={subtasks} aria-label="Việc con" placeholder="Việc con (mỗi dòng một việc, tối đa 20)" onChange={(e) => setSubtasks(e.target.value)} className="min-h-14" />
          <div className="flex gap-1.5">
            <Button size="sm" disabled={busy || !formValid} onClick={() => void saveTemplate()}>
              Lưu mẫu
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
              Hủy
            </Button>
          </div>
        </div>
      )}

      {templates && templates.length === 0 && !form && (
        <EmptyState
          role="status"
          density="compact"
          illustration="templates"
          title="Chưa có mẫu nào"
          description="Mẫu nhiệm vụ của các đơn vị bạn quản lý sẽ hiện ở đây."
        />
      )}

      <ul className="space-y-2">
        {(templates ?? []).map((t) => {
          const recs = recurrences.filter((r) => r.templateId === t.id);
          return (
            <li key={t.id} className={cn("rounded-lg border border-border bg-card p-3", !t.isActive && "opacity-70")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-compact font-medium text-foreground" title={t.name}>{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {unitName(t.unitId)} · hạn ngày {t.dueDay} · {t.criteria.length} tiêu chí · {t.subtasks.length} việc con{!t.isActive ? " · đã ngừng dùng" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="xs" variant="ghost" onClick={() => openForm(t)}>Sửa</Button>
                  <Button size="xs" variant="ghost" disabled={busy} onClick={() => void run(() => api(`/api/task-templates/${t.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !t.isActive }) }))}>
                    {t.isActive ? "Ngừng dùng" : "Dùng lại"}
                  </Button>
                </div>
              </div>

              {recs.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {recs.map((r) => (
                    <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
                      <span className="min-w-0 truncate text-foreground">
                        {personName(r.driUserId)} · mỗi {r.everyMonths} tháng từ {r.startPeriod}{r.endPeriod ? ` đến ${r.endPeriod}` : ""}{r.catchUpPeriods ? ` · bù ${r.catchUpPeriods} tháng` : ""}
                        {!r.isActive ? " · tạm dừng" : ""}
                        {r.lastRun ? (
                          <span className={cn("ml-1", r.lastRun.error ? "text-destructive" : "text-muted-foreground")} title={r.lastRun.error ?? undefined}>
                            · kỳ {r.lastRun.periodKey}: {RUN_LABEL[r.lastRun.status]}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {r.lastRun?.status === "FAILED" && (
                          <Button size="xs" variant="ghost" disabled={busy} onClick={() => void patchRecurrence(r.id, { retryFailed: true })}>Thử lại</Button>
                        )}
                        <Button size="xs" variant="ghost" disabled={busy} onClick={() => void patchRecurrence(r.id, { isActive: !r.isActive })}>
                          {r.isActive ? "Tạm dừng" : "Tiếp tục"}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {t.isActive && recFor !== t.id && (
                <Button size="xs" variant="ghost" className="mt-2" onClick={() => setRecFor(t.id)}>
                  Thêm lịch lặp lại
                </Button>
              )}
              {recFor === t.id && (
                <div className="mt-2 space-y-1.5">
                  <Select compact positionerClassName="z-50" aria-label="Người chủ trì" placeholder="— Người chủ trì —" options={personnel.map((p) => ({ value: p.id, label: p.name }))} value={dri} onValueChange={(v) => setDri(v || null)} />
                  <Select compact positionerClassName="z-50" aria-label="Người duyệt" placeholder="— Người duyệt (không bắt buộc) —" options={personnel.map((p) => ({ value: p.id, label: p.name }))} value={reviewer} onValueChange={(v) => setReviewer(v || null)} />
                  <div className="grid grid-cols-3 gap-2">
                    <Input compact value={every} inputMode="numeric" aria-label="Lặp mỗi (tháng)" placeholder="Mỗi N tháng" onChange={(e) => setEvery(e.target.value.replace(/\D/g, ""))} />
                    <Input compact value={start} aria-label="Kỳ bắt đầu" placeholder="Bắt đầu YYYY-MM" onChange={(e) => setStart(e.target.value)} />
                    <Input compact value={end} aria-label="Kỳ kết thúc" placeholder="Kết thúc YYYY-MM" onChange={(e) => setEnd(e.target.value)} />
                  </div>
                  <Select
                    compact
                    positionerClassName="z-50"
                    aria-label="Bù kỳ đã qua"
                    options={[
                      { value: "0", label: "Không bù kỳ đã qua" },
                      { value: "1", label: "Bù tối đa 1 tháng đã qua" },
                      { value: "2", label: "Bù tối đa 2 tháng đã qua" },
                      { value: "3", label: "Bù tối đa 3 tháng đã qua" },
                    ]}
                    value={catchUp}
                    onValueChange={(v) => setCatchUp(v || "0")}
                  />
                  <div className="flex gap-1.5">
                    <Button size="xs" disabled={busy || !recValid} onClick={() => void saveRecurrence(t.id)}>Lưu lịch</Button>
                    <Button size="xs" variant="ghost" onClick={() => setRecFor(null)}>Hủy</Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
