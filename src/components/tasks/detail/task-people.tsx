"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Select } from "@/components/ui/select";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { cn } from "@/lib/utils";

interface PeopleView {
  version: number;
  canManage: boolean;
  people: Array<{ userId: string; name: string; role: string; roleLabel: string; removable: boolean }>;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && (json.detail || json.error || json.title || json.message)) || fallback;
}

/**
 * Người tham gia nhiệm vụ (T-07): người giao thêm, bớt người phối hợp (cùng đơn vị chủ trì) và người theo dõi.
 * Người của đơn vị khác phải qua khối "Phối hợp liên đơn vị" (T-12).
 */
export function TaskPeople({ taskId, onVersionChange, className }: { taskId: string; onVersionChange?: (version: number) => void; className?: string }) {
  const [view, setView] = React.useState<PeopleView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<"COLLABORATOR" | "FOLLOWER">("COLLABORATOR");
  const { personnel } = usePersonnelList({ enabled: adding });

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/people`, { cache: "no-store" });
      if (!res.ok) {
        setView(null);
        return;
      }
      const json: PeopleView = await res.json();
      setView(json);
      onVersionChange?.(json.version);
    } catch {
      setView(null);
    }
  }, [taskId, onVersionChange]);

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const call = async (method: "POST" | "DELETE", body: Record<string, unknown>, fallback: string) => {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/people`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, expectedVersion: view.version }),
      });
      if (!res.ok) throw new Error(await readError(res, fallback));
      setAdding(false);
      setUserId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  if (!view || (view.people.length === 0 && !view.canManage)) return null;
  const existing = new Set(view.people.map((p) => p.userId));

  return (
    <section aria-label="Người tham gia" className={cn("space-y-1.5", className)}>
      <h3 className="text-compact font-semibold text-foreground">Người tham gia</h3>
      <ul className="space-y-0.5">
        {view.people.map((p) => (
          <li key={`${p.userId}-${p.role}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
            <span className="min-w-0 truncate text-foreground">{p.name}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
              {p.roleLabel}
              {view.canManage && p.removable ? (
                <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={() => void call("DELETE", { userId: p.userId }, "Không bớt được người")}>
                  Bớt
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {view.canManage && !adding && (
        <Button type="button" size="xs" variant="ghost" onClick={() => setAdding(true)}>
          Thêm người
        </Button>
      )}
      {adding && (
        <div className="space-y-1.5">
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Người được thêm"
            placeholder="— Chọn người —"
            options={personnel.filter((p) => !existing.has(p.id)).map((p) => ({ value: p.id, label: p.name }))}
            value={userId}
            onValueChange={(v) => setUserId(v || null)}
          />
          <Select
            compact
            positionerClassName="z-50"
            aria-label="Vai trò"
            options={[
              { value: "COLLABORATOR", label: "Phối hợp (cùng đơn vị chủ trì)" },
              { value: "FOLLOWER", label: "Theo dõi" },
            ]}
            value={role}
            onValueChange={(v) => setRole(v === "FOLLOWER" ? "FOLLOWER" : "COLLABORATOR")}
          />
          <div className="flex gap-1.5">
            <Button type="button" size="xs" disabled={busy || !userId} onClick={() => void call("POST", { userId, role }, "Không thêm được người")}>
              Thêm
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setAdding(false)}>
              Hủy
            </Button>
          </div>
        </div>
      )}
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
    </section>
  );
}
