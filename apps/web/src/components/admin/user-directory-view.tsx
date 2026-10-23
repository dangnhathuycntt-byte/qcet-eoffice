"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { readUserDirectoryResponse } from "@/lib/admin/api-response";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { ListToolbarSearch } from "@/components/ui/list-toolbar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";

interface UserPublicDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  position: string | null;
  avatarUrl: string | null;
  department: { id: string; code: string; name: string } | null;
}

/** Vai trò theo enum `UserRole` (prisma/schema.prisma). */
const ROLE_LABELS: Record<string, string> = {
  BAN_GIAM_HIEU: "Ban Giám hiệu",
  TRUONG_PHONG: "Trưởng phòng",
  CHUYEN_VIEN: "Chuyên viên",
  VAN_THU: "Văn thư",
  ADMIN: "Quản trị hệ thống",
};

const ROLE_TABS = [{ key: "", label: "Tất cả" }, ...Object.entries(ROLE_LABELS).map(([key, label]) => ({ key, label }))];

const PAGE_SIZE = 20;

/**
 * Tài khoản và vai trò (`/admin/users`, nhóm "Quản trị" trong menu "Thêm"): tài khoản đang có chức vụ ở đơn vị đang hoạt động
 * (`GET /api/users`), chỉ xem. Dựng lại 15/10/2026 theo khung một thẻ; tạo, khóa tài khoản và đổi vai trò chưa có trên giao diện.
 */
export function UserDirectoryView() {
  const [users, setUsers] = React.useState<UserPublicDTO[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (roleFilter) params.set("role", roleFilter);
    setLoading(true);
    setError(null);
    fetch(`/api/users?${params.toString()}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 401) throw new Error("Phiên đăng nhập đã hết hạn. Thầy/Cô đăng nhập lại để xem danh sách tài khoản.");
        if (res.status === 429) throw new Error("Tìm quá nhiều lần trong thời gian ngắn. Thầy/Cô thử lại sau ít phút.");
        if (!res.ok) throw new Error("Chưa tải được danh sách tài khoản.");
        const response = readUserDirectoryResponse<UserPublicDTO>(await res.json());
        setUsers(response.users);
        setTotal(response.total);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Mất kết nối khi tải danh sách tài khoản.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [page, debouncedSearch, roleFilter, retryKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <WorkspacePageCard
      title="Tài khoản và vai trò"
      description="Tài khoản đang có chức vụ tại đơn vị, kèm vai trò trong hệ thống · chỉ xem"
      hideTitleOnMobile
      className="max-w-5xl"
      actions={
        <ListToolbarSearch value={search} onChange={setSearch} placeholder="Tìm tên hoặc email…" aria-label="Tìm tài khoản" />
      }
    >
      <div className="empty-fill flex flex-col gap-4 pb-6">
        <Tabs
          value={roleFilter}
          onValueChange={(next) => {
            setRoleFilter(String(next));
            setPage(1);
          }}
          className="max-w-full overflow-x-auto"
        >
          <TabsList variant="pill" size="sm" aria-label="Lọc theo vai trò">
            {ROLE_TABS.map((tab) => (
              <TabsTrigger key={tab.key || "all"} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {error ? (
          <InlineAlert actionLabel="Thử lại" onAction={() => setRetryKey((k) => k + 1)}>
            {error}
          </InlineAlert>
        ) : loading && users.length === 0 ? (
          <div aria-busy className="flex flex-col gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            role="status"
            density="page"
            glyph={debouncedSearch || roleFilter ? "no-results" : "directory"}
            title="Không có tài khoản phù hợp"
            description={debouncedSearch || roleFilter ? "Thử từ khóa khác hoặc chọn vai trò khác." : "Chưa có tài khoản nào đang có chức vụ tại đơn vị."}
          />
        ) : (
          <>
            <Table density="two-line" aria-busy={loading || undefined} className="min-w-[680px] table-fixed">
              <TableHeader>
                <TableRow>
                  {/* Cột thuộc tính rộng cố định, cột tên lấy phần còn lại (như bảng /org) */}
                  <TableHead>Họ tên</TableHead>
                  <TableHead className="w-[200px]">Chức vụ</TableHead>
                  <TableHead className="w-[248px]">Đơn vị</TableHead>
                  <TableHead className="w-[136px]">Vai trò</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={loading ? "opacity-60" : undefined}>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{user.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="truncate" title={user.position ?? undefined}>
                      {user.position ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-2 text-pretty">{user.department?.name ?? <span className="text-muted-foreground">—</span>}</span>
                    </TableCell>
                    <TableCell className="truncate text-xs">{ROLE_LABELS[user.role] ?? user.role}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tabular-nums text-muted-foreground">
                {total} tài khoản · Trang {page}/{totalPages}
              </p>
              {totalPages > 1 ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft />
                    Trước
                  </Button>
                  <Button variant="ghost" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                    Sau
                    <ChevronRight />
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Tạo tài khoản, khóa tài khoản và đổi vai trò do Chủ sở hữu hệ thống thực hiện; giao diện cho các thao tác này chưa có.
        </p>
      </div>
    </WorkspacePageCard>
  );
}
