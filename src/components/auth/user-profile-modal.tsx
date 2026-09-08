"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  User,
  Building2,
  Mail,
  Phone,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  X,
  Save,
  Sparkles,
  Award,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { QCET_DEPARTMENT_GROUPS } from "@/lib/departments";
import { cn } from "@/lib/utils";

export function UserProfileModal() {
  const { user, updateProfile, isProfileModalOpen, setIsProfileModalOpen } = useAuth();

  const [name, setName] = React.useState(user?.name || "");
  const [department, setDepartment] = React.useState(user?.department || "");
  const [departmentCode, setDepartmentCode] = React.useState(user?.departmentCode || "QCET");
  const [title, setTitle] = React.useState(user?.title || "Viên chức");
  const [phone, setPhone] = React.useState(user?.phone || "");
  const [role, setRole] = React.useState<UserRole>(user?.role || "STAFF");
  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state with current user when modal opens
  React.useEffect(() => {
    if (isProfileModalOpen && user) {
      setName(user.name || "");
      setDepartment(user.department || "");
      setDepartmentCode(user.departmentCode || "QCET");
      setTitle(user.title || "Viên chức");
      setPhone(user.phone || "");
      setRole(user.role || "STAFF");
      setSavedSuccess(false);
    }
  }, [isProfileModalOpen, user]);

  if (!isProfileModalOpen || !user) return null;

  const handleDepartmentChange = (code: string) => {
    setDepartmentCode(code);
    const found = QCET_DEPARTMENT_GROUPS.find((g) => g.code === code);
    if (found) {
      setDepartment(found.name || found.department || "");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const roleLabel =
      role === "ADMIN"
        ? "Ban Giám hiệu"
        : role === "MANAGER"
        ? `Trưởng ${department || "đơn vị"}`
        : "Viên chức / Giảng viên";

    updateProfile({
      name: name.trim() || user.name,
      department: department || "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
      departmentCode: departmentCode || "QCET",
      title: title.trim() || "Viên chức",
      phone: phone.trim(),
      role,
      roleLabel,
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setIsProfileModalOpen(false);
      setSavedSuccess(false);
    }, 800);
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto !m-0">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in !m-0"
        onClick={() => setIsProfileModalOpen(false)}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto my-auto thin-scrollbar">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 text-sm font-bold shadow-xs">
              {user.name
                ? user.name
                    .split(" ")
                    .slice(-2)
                    .map((w) => w[0])
                    .join("")
                : "CB"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Hồ sơ Cán bộ & Viên chức
                </h3>
                {user.emailVerified && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
                    <CheckCircle2 className="size-3" strokeWidth={1.5} />
                    Đã xác thực Google
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsProfileModalOpen(false)}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* First Login Welcome Banner */}
        {user.isFirstLogin && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/[0.06] p-3 text-xs text-foreground animate-in fade-in">
            <Sparkles className="size-4 shrink-0 text-primary mt-0.5" strokeWidth={1.5} />
            <div className="leading-relaxed">
              <strong className="font-semibold text-primary">
                Chào mừng bạn đến với QCET E-Office!
              </strong>{" "}
              Tài khoản email trường của bạn đã được kích hoạt thành công. Vui lòng
              hoàn thiện thông tin đơn vị và chức danh để thuận tiện trong điều hành công việc.
            </div>
          </div>
        )}

        {/* Success Alert */}
        {savedSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 animate-in fade-in">
            <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.5} />
            <span>Cập nhật thông tin cán bộ thành công!</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Họ và tên */}
          <div className="space-y-1.5">
            <label
              htmlFor="profileName"
              className="block text-xs font-semibold text-foreground"
            >
              Họ và tên đầy đủ <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <User className="size-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <input
                id="profileName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Đặng Nhật Huy"
                className="block w-full rounded-xl border border-border/80 bg-background py-2.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-medium"
              />
            </div>
          </div>

          {/* Đơn vị / Khoa / Phòng ban */}
          <div className="space-y-1.5">
            <label
              htmlFor="profileDept"
              className="block text-xs font-semibold text-foreground"
            >
              Đơn vị / Khoa / Phòng ban <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Building2 className="size-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <select
                id="profileDept"
                value={departmentCode}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="block w-full rounded-xl border border-border/80 bg-background py-2.5 pl-9 pr-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
              >
                <option value="QCET">-- Chọn đơn vị trực thuộc trường --</option>
                {QCET_DEPARTMENT_GROUPS.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.name || g.department}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Chức danh & Số điện thoại */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="profileTitle"
                className="block text-xs font-semibold text-foreground"
              >
                Chức danh / Vị trí
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Briefcase className="size-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <input
                  id="profileTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Vd: Giảng viên, Chuyên viên..."
                  className="block w-full rounded-xl border border-border/80 bg-background py-2.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="profilePhone"
                className="block text-xs font-semibold text-foreground"
              >
                Số điện thoại liên hệ
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Phone className="size-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <input
                  id="profilePhone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xx xxx xxx"
                  className="block w-full rounded-xl border border-border/80 bg-background py-2.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Quyền hạn điều hành hệ thống (Role) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Phân quyền điều hành (Vai trò hệ thống)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole("STAFF")}
                className={cn(
                  "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                  role === "STAFF"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30"
                    : "border-border/80 bg-background hover:bg-secondary text-muted-foreground"
                )}
              >
                <User className="size-4 mb-1" strokeWidth={1.5} />
                <span className="text-xs font-bold">Viên chức</span>
                <span className="text-xs opacity-80">Xem việc trực tiếp</span>
              </button>

              <button
                type="button"
                onClick={() => setRole("MANAGER")}
                className={cn(
                  "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                  role === "MANAGER"
                    ? "border-blue-500 bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/30"
                    : "border-border/80 bg-background hover:bg-secondary text-muted-foreground"
                )}
              >
                <Building2 className="size-4 mb-1" strokeWidth={1.5} />
                <span className="text-xs font-bold">Trưởng đơn vị</span>
                <span className="text-xs opacity-80">Quản trị khoa/phòng</span>
              </button>

              <button
                type="button"
                onClick={() => setRole("ADMIN")}
                className={cn(
                  "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                  role === "ADMIN"
                    ? "border-purple-500 bg-purple-500/10 text-purple-700 ring-1 ring-purple-500/30"
                    : "border-border/80 bg-background hover:bg-secondary text-muted-foreground"
                )}
              >
                <Award className="size-4 mb-1" strokeWidth={1.5} />
                <span className="text-xs font-bold">Ban Giám hiệu</span>
                <span className="text-xs opacity-80">Điều hành toàn trường</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-end gap-2.5 border-t border-border/60 bg-card/95 backdrop-blur-md pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(false)}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all active:scale-[0.99] cursor-pointer"
            >
              <Save className="size-3.5" strokeWidth={1.5} />
              <span>Lưu thông tin hồ sơ</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
