"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { cn } from "@/lib/utils";
import { TaskAddChip } from "./task-add-chip";

interface CriterionView {
  id: string;
  text: string;
  checked: boolean;
}

interface CriteriaView {
  criteria: CriterionView[];
  unmet: number;
  canEdit: boolean;
  canCheck: boolean;
  version: number;
}

const MAX_CRITERIA = 20;

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title)) || fallback;
}

export interface TaskCriteriaProps {
  taskId: string;
  /** Phiên bản nhiệm vụ trên trang; gửi kèm khi sửa danh sách tiêu chí. */
  version: number;
  /** Báo trang cập nhật phiên bản sau khi sửa danh sách tiêu chí, để lần sửa sau không bị 412. */
  onVersionChange?: (version: number) => void;
  /** Đổi trạng thái nhiệm vụ làm tải lại (ví dụ vừa nộp duyệt). */
  status?: string;
  className?: string;
}

/**
 * Tiêu chí hoàn thành (T-04). Người giao sửa danh sách khi nhiệm vụ chưa nộp duyệt;
 * người duyệt đánh dấu từng tiêu chí khi chờ duyệt. Còn tiêu chí chưa đạt vẫn duyệt được
 * (quyết định Q3), nên chỉ hiện cảnh báo.
 */
export function TaskCriteria({ taskId, version, onVersionChange, status, className }: TaskCriteriaProps) {
  const [view, setView] = React.useState<CriteriaView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Array<{ id?: string; text: string }>>([]);
  const [saving, setSaving] = React.useState(false);
  const addRef = React.useRef<HTMLInputElement | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/criteria`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Không tải được tiêu chí hoàn thành"));
      setView(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được tiêu chí hoàn thành");
    }
  }, [taskId]);

  React.useEffect(() => {
    void load();
  }, [load, status]);

  const startEdit = () => {
    const current = (view?.criteria ?? []).map((c) => ({ id: c.id, text: c.text }));
    // Chưa có tiêu chí: mở sẵn một ô trống để gõ ngay
    setDrafts(current.length > 0 ? current : [{ text: "" }]);
    setEditing(true);
    if (current.length === 0) requestAnimationFrame(() => addRef.current?.focus());
  };

  const save = async () => {
    const criteria = drafts.map((d) => ({ ...(d.id ? { id: d.id } : {}), text: d.text.trim() })).filter((d) => d.text.length > 0);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/criteria`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria, expectedVersion: version }),
      });
      if (!res.ok) throw new Error(await readError(res, "Không lưu được tiêu chí hoàn thành"));
      const next: CriteriaView = await res.json();
      setView(next);
      onVersionChange?.(next.version);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được tiêu chí hoàn thành");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, checked: boolean) => {
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/criteria/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked }),
      });
      if (!res.ok) throw new Error(await readError(res, "Không đánh dấu được tiêu chí"));
      setView(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đánh dấu được tiêu chí");
    }
  };

  if (!view) {
    return error ? (
      <p role="alert" className="px-4 text-xs text-destructive">
        {error}
      </p>
    ) : null;
  }

  // Không có tiêu chí và không ai thêm được thì không chiếm chỗ trên trang.
  if (view.criteria.length === 0 && !view.canEdit && !editing) return null;
  const editForm = (
    <div className="space-y-1.5">
      {drafts.map((d, i) => (
        <div key={d.id ?? `new-${i}`} className="flex items-center gap-1.5">
          <Input
            compact
            value={d.text}
            maxLength={300}
            aria-label={`Tiêu chí ${i + 1}`}
            onChange={(e) => setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            ref={i === drafts.length - 1 ? addRef : undefined}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Bỏ tiêu chí ${i + 1}`}
            onClick={() => setDrafts((prev) => prev.filter((_, j) => j !== i))}
          >
            <X strokeWidth={1.5} />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={drafts.length >= MAX_CRITERIA}
          onClick={() => {
            setDrafts((prev) => [...prev, { text: "" }]);
            requestAnimationFrame(() => addRef.current?.focus());
          }}
        >
          <Plus strokeWidth={1.5} />
          Thêm tiêu chí
        </Button>
        <span className="text-xs text-muted-foreground">
          {drafts.length}/{MAX_CRITERIA}
        </span>
        <span className="ml-auto flex gap-1.5">
          <Button type="button" size="xs" onClick={() => void save()} disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => { setEditing(false); setError(null); }}>
            Hủy
          </Button>
        </span>
      </div>
    </div>
  );
  if (view.criteria.length === 0) {
    return (
      <TaskAddChip
        open={editing}
        onOpenChange={(next) => (next ? startEdit() : (setEditing(false), setError(null)))}
        panel={<>{editForm}{error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}</>}
      >
        Tiêu chí hoàn thành
      </TaskAddChip>
    );
  }

  const total = view.criteria.length;
  const met = total - view.unmet;

  return (
    <section aria-labelledby={`task-criteria-${taskId}`} className={cn("space-y-2 px-4", className)}>
      <div className="flex items-center gap-2">
        <h2 id={`task-criteria-${taskId}`} className="text-compact font-semibold text-foreground tracking-tight">
          Tiêu chí hoàn thành
        </h2>
        {total > 0 && !editing && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {met}/{total} đạt
          </span>
        )}
        {view.canEdit && !editing && (
          <Button type="button" variant="ghost" size="xs" className="ml-auto" onClick={startEdit}>
            {total === 0 ? "Thêm tiêu chí" : "Sửa"}
          </Button>
        )}
      </div>

      {editing ? (
        editForm
      ) : (
        <ul className="space-y-1">
          {view.criteria.map((c) => (
            <li key={c.id}>
              <label className={cn("flex items-start gap-2 text-compact", view.canCheck ? "cursor-pointer" : "cursor-default")}>
                <Checkbox
                  checked={c.checked}
                  disabled={!view.canCheck}
                  aria-label={c.text}
                  className="mt-0.5"
                  onChange={(e) => void toggle(c.id, e.target.checked)}
                />
                <span className={cn(c.checked ? "text-muted-foreground" : "text-foreground")}>{c.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {view.canCheck && view.unmet > 0 && !editing && (
        <InlineAlert variant="warning">
          Còn {view.unmet} tiêu chí chưa đạt. Vẫn duyệt được, hoặc chọn Yêu cầu chỉnh sửa.
        </InlineAlert>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
