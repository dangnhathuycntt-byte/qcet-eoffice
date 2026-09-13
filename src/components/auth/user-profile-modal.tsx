"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  User,
  Building2,
  Phone,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  X,
  Save,
  Sparkles,
  Lock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { QCET_DEPARTMENT_GROUPS } from "@/lib/departments";

export function UserProfileModal() {
  const { user, updateProfile, isProfileModalOpen, setIsProfileModalOpen } = useAuth();

  const [name, setName] = React.useState(user?.name || "");
  const [department, setDepartment] = React.useState(user?.department || "");
  const [departmentCode, setDepartmentCode] = React.useState(user?.departmentCode || "QCET");
  const [title, setTitle] = React.useState(user?.title || "Viên chức");
  const [phone, setPhone] = React.useState(user?.phone || "");
  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
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
      setSavedSuccess(false);
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [isProfileModalOpen, user]);

  if (!isProfileModalOpen || !user) return null;

  const isDepartmentAuthoritative = Boolean(user.department && user.departmentCode && user.departmentCode !== "QCET");

  const handleDepartmentChange = (code: string) => {
    setDepartmentCode(code);
    const found = QCET_DEPARTMENT_GROUPS.find((g) => g.code === code);
    if (found) {
      setDepartment(found.name || found.department || "");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    const result = await updateProfile({
      name: name.trim() || user.name,
      title: title.trim() || "Viên chức",
      phone: phone.trim(),
    });

    setIsSaving(false);

    if (result && !result.success) {
      setErrorMessage(result.error || "Không thể cập nhật hồ sơ trên máy chủ");
      return;
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setIsProfileModalOpen(false);
      setSavedSuccess(false);
    }, 800);
  };

  const roleDescription =
    user.role === "ADMIN"
      ? "Ban Giám hiệu (Chỉ đạo & Điều hành toàn trường)"
      : user.role === "MANAGER"
      ? `Lãnh đạo đơn vị & Phê duyệt (${user.department || "Phòng/Khoa"})`
      : "Viên chức / Giảng viên (Thực hiện nhiệm vụ & Nộp minh chứng)";

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
                Kính chào Quý Thầy/Cô đến với QCET E-Office!
              </strong>{" "}
              Tài khoản email trường của bạn đã được kích hoạt thành công. Vui lòng
              hoàn thiện thông tin chức danh và liên hệ để thuận tiện trong điều hành công việc.
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

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive animate-in fade-in">
            <AlertCircle className="size-4 shrink-0" strokeWidth={1.5} />
            <span>{errorMessage}</span>
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
              Đơn vị / Khoa / Phòng ban {isDepartmentAuthoritative ? "(Do Nhà trường quản lý)" : <span className="text-destructive">*</span>}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                {isDepartmentAuthoritative ? (
                  <Lock className="size-4 text-muted-foreground" strokeWidth={1.5} />
                ) : (
                  <Building2 className="size-4 text-muted-foreground" strokeWidth={1.5} />
                )}
              </div>
              {isDepartmentAuthoritative ? (
                <div
                  id="profileDept"
                  className="flex items-center justify-between w-full rounded-xl border border-border/60 bg-muted/40 py-2.5 pl-9 pr-3 text-xs text-foreground font-medium select-none"
                >
                  <span>{user.department}</span>
                  <span className="text-xs text-muted-foreground">Chuẩn hóa</span>
                </div>
              ) : (
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
              )}
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

          {/* Quyền hạn điều hành hệ thống (Role) - CHỈ ĐỌC do Nhà trường quản lý */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Phân quyền điều hành (Vai trò hệ thống)
            </label>
            <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/40 p-3.5">
              <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {roleDescription}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground border border-border/60 shrink-0">
                    Chỉ đọc
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Phân quyền do Quản trị viên hệ thống quản lý theo cơ cấu tổ chức Nhà trường (không thể tự thay đổi).
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: single focused save button, no redundant close/cancel clutter */}
          <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-end border-t border-border/60 bg-card/95 backdrop-blur-md pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.99] cursor-pointer w-full sm:w-auto"
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Save className="size-3.5" strokeWidth={1.5} />
              )}
              <span>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</span>
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
