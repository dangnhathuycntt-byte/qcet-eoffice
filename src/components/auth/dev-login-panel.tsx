"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { IS_DEV_TOOLS_ENABLED } from "@/config/dev";

interface DevUser {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  BAN_GIAM_HIEU: "Ban giám hiệu",
  TRUONG_PHONG: "Trưởng đơn vị",
  CHUYEN_VIEN: "Chuyên viên",
  VAN_THU: "Văn thư",
  ADMIN: "Quản trị",
};

/**
 * Đăng nhập thử theo vai trò để kiểm quyền khi phát triển (đăng nhập thật chỉ có Google).
 * Chỉ hiển thị với `next dev`: `NODE_ENV` được thay lúc build nên bản production không chứa khối này,
 * và `/api/dev/login-as` cũng tự từ chối ngoài dev cục bộ.
 */
export function DevLoginPanel({ returnTo }: { returnTo: string }) {
  const [users, setUsers] = React.useState<DevUser[] | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!IS_DEV_TOOLS_ENABLED) return;
    fetch("/api/dev/login-as", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setUsers(j?.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  if (!IS_DEV_TOOLS_ENABLED || !users || users.length === 0) return null;

  const login = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/login-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error("Không đăng nhập được");
      window.location.href = returnTo;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đăng nhập được");
      setBusy(false);
    }
  };

  return (
    <aside
      aria-label="Đăng nhập thử theo vai trò (chỉ môi trường phát triển)"
      className="fixed bottom-4 left-4 z-20 w-72 space-y-2 rounded-xl border border-border bg-card p-3 text-xs shadow-lg"
    >
      <p className="font-semibold text-foreground">Đăng nhập thử · chỉ môi trường dev</p>
      <Select
        compact
        positionerClassName="z-50"
        aria-label="Tài khoản thử"
        placeholder="— Chọn tài khoản —"
        options={users.map((u) => ({ value: u.id, label: `${ROLE_LABEL[u.role] ?? u.role} · ${u.name}` }))}
        value={userId}
        onValueChange={(v) => setUserId(v || null)}
      />
      {error ? <p className="text-destructive">{error}</p> : null}
      <Button size="sm" className="w-full" disabled={!userId || busy} onClick={() => void login()}>
        {busy ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </aside>
  );
}
