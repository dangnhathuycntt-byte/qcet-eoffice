"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Calendar,
  FileText,
  BarChart3,
  Tv,
  User,
  Settings,
  LogOut,
  X,
  ChevronRight,
  Bell,
  BellRing,
  BellOff,
  Volume2,
  Download,
  Smartphone,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetClose,
} from "@/components/ui/bottom-sheet";
import { useAuth } from "@/context/auth-context";
import { usePushNotification } from "@/hooks/use-push-notification";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMenuDrawer({ open, onOpenChange }: MobileMenuDrawerProps) {
  const { user, logout, setIsProfileModalOpen } = useAuth();
  const pathname = usePathname();
  const [isTestingPush, setIsTestingPush] = React.useState(false);
  const [testPushResult, setTestPushResult] = React.useState<"success" | "failed" | null>(null);

  const {
    isSupported,
    isSubscribed,
    isLoading,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification,
  } = usePushNotification();

  const {
    isInstallable,
    isInstalled,
    isIOS,
    isStandalone,
    installApp,
  } = usePWAInstall();

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="max-h-[85vh] overflow-y-auto">
        <BottomSheetHeader className="border-b border-border/50 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {user?.name?.slice(0, 2).toUpperCase() || "ND"}
              </div>
              <div className="min-w-0">
                <BottomSheetTitle className="text-sm font-semibold truncate">
                  {user?.name || "Người dùng QCET"}
                </BottomSheetTitle>
                <BottomSheetDescription className="text-xs truncate">
                  {user?.title || "Cán bộ giảng viên"} • {user?.department || "Trường CĐ Kỹ thuật Công nghệ Quy Nhơn"}
                </BottomSheetDescription>
              </div>
            </div>
            <BottomSheetClose className="flex items-center justify-center min-w-[48px] min-h-[48px] p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer">
              <X size={18} />
            </BottomSheetClose>
          </div>
        </BottomSheetHeader>

        <div className="p-4 space-y-4">
          {/* Core App Navigation Shortcuts - 2-Column Grid with 48px targets */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 pb-0.5">
              LỐI TẮT HỆ THỐNG
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/documents"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenChange(false);
                }}
                className="flex flex-col justify-between p-3 min-h-[48px] rounded-xl border border-border/50 bg-card hover:bg-muted/50 text-foreground transition-all active:scale-[0.98] group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <FileText size={16} />
                  </div>
                  <span className="text-xs font-semibold truncate">Văn bản</span>
                  <span className="sr-only">Đang phát triển</span>
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  Sổ công văn, tờ trình
                </span>
              </Link>

              <Link
                href="/dashboard"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenChange(false);
                }}
                className="flex flex-col justify-between p-3 min-h-[48px] rounded-xl border border-border/50 bg-card hover:bg-muted/50 text-foreground transition-all active:scale-[0.98] group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <BarChart3 size={16} />
                  </div>
                  <span className="text-xs font-semibold truncate">Báo cáo KPI</span>
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  Tiến độ & chỉ số
                </span>
              </Link>

              <Link
                href="/calendar"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenChange(false);
                }}
                className="flex flex-col justify-between p-3 min-h-[48px] rounded-xl border border-border/50 bg-card hover:bg-muted/50 text-foreground transition-all active:scale-[0.98] group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Calendar size={16} />
                  </div>
                  <span className="text-xs font-semibold truncate">Lịch công tác</span>
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  Lịch tuần, sự kiện
                </span>
              </Link>

              <Link
                href="/org"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenChange(false);
                }}
                className="flex flex-col justify-between p-3 min-h-[48px] rounded-xl border border-border/50 bg-card hover:bg-muted/50 text-foreground transition-all active:scale-[0.98] group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Building2 size={16} />
                  </div>
                  <span className="text-xs font-semibold truncate">Cơ cấu tổ chức</span>
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  Đơn vị & danh bạ
                </span>
              </Link>

              <Link
                href="/kiosk"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenChange(false);
                }}
                className="flex flex-col justify-between p-3 min-h-[48px] rounded-xl border border-border/50 bg-card hover:bg-muted/50 text-foreground transition-all active:scale-[0.98] group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Tv size={16} />
                  </div>
                  <span className="text-xs font-semibold truncate">Kiosk TV</span>
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  Màn hình điều hành
                </span>
              </Link>

              <Link
                href="/settings"
                onClick={() => {
                  triggerHaptic("light");
                  onOpenChange(false);
                }}
                className="flex flex-col justify-between p-3 min-h-[48px] rounded-xl border border-border/50 bg-card hover:bg-muted/50 text-foreground transition-all active:scale-[0.98] group cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Settings size={16} />
                  </div>
                  <span className="text-xs font-semibold truncate">Cài đặt</span>
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  Hệ thống & tùy chọn
                </span>
              </Link>
            </div>

            {/* Profile Quick Link */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenChange(false);
                if (setIsProfileModalOpen) {
                  setIsProfileModalOpen(true);
                } else if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("qcet:open-profile-modal"));
                }
              }}
              className="w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl border border-border/50 bg-card hover:bg-muted/50 text-foreground transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold">Hồ sơ cá nhân</div>
                  <div className="text-xs text-muted-foreground">Xem chi tiết tài khoản & phân quyền</div>
                </div>
              </div>
              <ChevronRight size={15} className="text-muted-foreground" />
            </button>
          </div>

          {/* Mobile Push Notification & App Section */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between px-1 pb-1">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bell size={13} className="text-primary" />
                <span>THÔNG BÁO ĐIỆN THOẠI & ỨNG DỤNG</span>
              </div>
              {isSupported ? (
                isSubscribed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <CheckCircle2 size={11} />
                    Đã kích hoạt
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    Chưa bật
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/40">
                  Không hỗ trợ
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {/* Push Toggle Button */}
              {isSupported && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    if (isSubscribed) {
                      await unsubscribeFromPush();
                    } else {
                      await subscribeToPush();
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl text-xs font-medium transition-colors border cursor-pointer",
                    isSubscribed
                      ? "bg-muted/40 hover:bg-muted/60 border-border/50 text-foreground"
                      : "bg-primary/10 hover:bg-primary/15 border-primary/30 text-primary font-semibold"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isLoading ? (
                      <Loader2 size={17} className="animate-spin text-primary" />
                    ) : isSubscribed ? (
                      <BellOff size={17} className="text-muted-foreground" />
                    ) : (
                      <BellRing size={17} className="text-primary" />
                    )}
                    <span>{isSubscribed ? "Tắt thông báo chuông" : "Bật thông báo chuông"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {isSubscribed ? "Đang bật" : "Kích hoạt"}
                  </span>
                </button>
              )}

              {/* Test Ring Button */}
              {isSupported && isSubscribed && (
                <button
                  type="button"
                  disabled={isTestingPush || isLoading}
                  onClick={async () => {
                    setIsTestingPush(true);
                    setTestPushResult(null);
                    try {
                      const ok = await sendTestNotification({
                        title: "BGH giao việc mới",
                        body: "Thử nghiệm kết nối chuông đẩy QCET E-Office thành công.",
                        linkHref: "/?zone=tasks",
                      });
                      setTestPushResult(ok ? "success" : "failed");
                      setTimeout(() => setTestPushResult(null), 3000);
                    } finally {
                      setIsTestingPush(false);
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl bg-muted/40 hover:bg-muted/70 text-xs font-medium text-foreground transition-colors cursor-pointer border border-border/40"
                >
                  <div className="flex items-center gap-3">
                    {isTestingPush ? (
                      <Loader2 size={17} className="animate-spin text-primary" />
                    ) : (
                      <Volume2 size={17} className="text-primary" />
                    )}
                    <span>Thử chuông ngay</span>
                  </div>
                  <span className="text-xs font-semibold text-primary font-mono">
                    {testPushResult === "success"
                      ? "Đã gửi chuông"
                      : testPushResult === "failed"
                      ? "Lỗi gửi"
                      : "Gửi thử"}
                  </span>
                </button>
              )}

              {/* Install App Button if installable */}
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    await installApp();
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl bg-primary text-primary-foreground font-semibold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Download size={17} />
                    <span>Cài đặt lên màn hình chính</span>
                  </div>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md">
                    1-Chạm
                  </span>
                </button>
              )}

              {/* iOS Safari Guide Button if iOS & not standalone */}
              {isIOS && !isStandalone && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("qcet:open-push-onboarding"));
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 min-h-[48px] rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-medium text-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone size={17} />
                    <span>Xem hướng dẫn cài đặt iOS</span>
                  </div>
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Preferences & Actions */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={() => {
                logout();
                onOpenChange(false);
              }}
              className="w-full flex items-center justify-center gap-2 p-3 min-h-[48px] rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
