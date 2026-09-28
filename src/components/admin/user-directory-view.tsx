"use client";

import * as React from "react";
import { Search, Users, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { readUserDirectoryResponse } from "@/lib/admin/api-response";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DepartmentDTO {
  id: string;
  code: string;
  name: string;
}

interface UserPublicDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  position: string | null;
  phone: string | null;
  avatarUrl: string | null;
  departmentId: string | null;
  department: DepartmentDTO | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  BAN_GIAM_HIEU: "Ban Giám hiệu",
  TRUONG_PHONG: "Trưởng phòng",
  CHUYEN_VIEN: "Chuyên viên",
  GIANG_VIEN: "Giảng viên",
  VAN_THU: "Văn thư",
  STAFF: "Nhân viên",
  MANAGER: "Quản lý",
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserDirectoryView() {
  const [users, setUsers] = React.useState<UserPublicDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [unauthorized, setUnauthorized] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [retryKey, setRetryKey] = React.useState(0);

  // Debounce search input (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users
  React.useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      setLoading(true);
      setError(null);
      setUnauthorized(false);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (debouncedSearch.trim()) {
        params.set("q", debouncedSearch.trim());
      }
      if (roleFilter) {
        params.set("role", roleFilter);
      }

      try {
        const res = await fetch(`/api/users?${params.toString()}`);

        if (cancelled) return;

        if (res.status === 401) {
          setUnauthorized(true);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error(`Lỗi ${res.status}: Không thể tải danh sách nhân sự`);
        }

        const response = readUserDirectoryResponse<UserPublicDTO>(await res.json());

        if (!cancelled) {
          setUsers(response.users);
          setTotalPages(Math.max(1, Math.ceil(response.total / PAGE_SIZE)));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải dữ liệu");
          setLoading(false);
        }
      }
    }

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, roleFilter, retryKey]);

  // --- Unauthorized state ---
  if (unauthorized) {
    return (
      <div className="rounded-xl border border-border bg-muted/50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium text-foreground">
          Phiên đăng nhập đã hết hạn
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Vui lòng đăng nhập lại để xem danh bạ nhân sự.
        </p>
      </div>
    );
  }

  // --- Error state ---
  if (error && !loading) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="mt-3 inline-flex items-center rounded-lg border border-red-300 bg-background px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search bar + Role filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 min-h-[44px] sm:min-h-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground min-h-[44px] sm:min-h-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
        >
          <option value="">Tất cả vai trò</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/50/80">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Họ tên</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                Chức vụ
              </th>
              <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                Đơn vị
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vai trò</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                    </td>
                  </tr>
                ))
              : users.map((user) => (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-muted/50/60"
                  >
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {user.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{user.email}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                      {user.position ?? "—"}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                      {user.department?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Empty state */}
        {!loading && users.length === 0 && (
          <div className="py-16 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Không tìm thấy nhân sự phù hợp</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && users.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Trang {page} / {totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground min-h-[44px] sm:min-h-0 transition-colors hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Trước
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground min-h-[44px] sm:min-h-0 transition-colors hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sau
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Admin note */}
      <p className="text-xs text-muted-foreground/60 mt-4">
        Việc tạo mới, kích hoạt, vô hiệu hóa tài khoản và thay đổi vai trò là thẩm quyền của Chủ
        sở hữu hệ thống (Owner). Chức năng quản trị tài khoản sẽ được triển khai khi hoàn tất
        thiết kế RBAC provisioning.
      </p>
    </div>
  );
}
