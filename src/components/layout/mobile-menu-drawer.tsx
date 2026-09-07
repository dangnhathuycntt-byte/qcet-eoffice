"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Calendar,
  FileText,
  Settings,
  Moon,
  Sun,
  LogOut,
  X,
  ChevronRight,
  ShieldCheck,
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
import { cn } from "@/lib/utils";
import { DEMO_USERS } from "@/lib/auth/roles";

export interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMenuDrawer({ open, onOpenChange }: MobileMenuDrawerProps) {
  const { user, switchUser, logout } = useAuth();
  const pathname = usePathname();
  const [isDark, setIsDark] = React.useState(false);
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

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

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
                  {user?.title || "Cán bộ giảng viên"} • {user?.department || "Trường CĐ Kỹ thuật Cao Thắng"}
                </BottomSheetDescription>
              </div>
            </div>
            <BottomSheetClose className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <X size={18} />
            </BottomSheetClose>
          </div>
        </BottomSheetHeader>

        <div className="p-4 space-y-4">
          {/* Quick Demo Role Switcher */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-primary" />
              CHUYỂN VAI TRÒ TRẢI NGHIỆM
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {DEMO_USERS.map((demo) => {
                const isCurrent = user?.id === demo.id;
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => {
                      switchUser(demo.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-2.5 min-h-[44px] rounded-xl text-left text-xs transition-colors border cursor-pointer",
                      isCurrent
                        ? "bg-primary/10 border-primary/40 text-primary font-semibold"
                        : "bg-muted/30 hover:bg-muted/60 border-border/40 text-foreground"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{demo.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {demo.title} • {demo.department}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="size-2 rounded-full bg-primary shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core App Navigation Shortcuts */}
          <div className="space-y-1 pt-1 border-t border-border/40">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1">
              LỐI TẮT HỆ THỐNG
            </div>
            <Link
              href="/schedule"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between p-3 min-h-[44px] rounded-xl hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar size={17} className="text-primary" />
                <span>Lịch công tác tuần</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </Link>
            <Link
              href="/organization"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between p-3 min-h-[44px] rounded-xl hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 size={17} className="text-primary" />
                <span>Cơ cấu tổ chức & Đơn vị</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </Link>
            <Link
              href="/documents"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between p-3 min-h-[44px] rounded-xl hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText size={17} className="text-primary" />
                <span>Văn bản & Điều hành</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </Link>
            <Link
              href="/settings"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between p-3 min-h-[44px] rounded-xl hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings size={17} className="text-primary" />
                <span>Cài đặt hệ thống</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </Link>
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 size={11} />
                    Đã kích hoạt
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
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
                    "w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl text-xs font-medium transition-colors border cursor-pointer",
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
                        title: "Thử nghiệm chuông QCET",
                        body: "Thông báo chuông điện thoại đang hoạt động chuẩn xác.",
                        linkHref: "/?zone=tasks",
                      });
                      setTestPushResult(ok ? "success" : "failed");
                      setTimeout(() => setTestPushResult(null), 3000);
                    } finally {
                      setIsTestingPush(false);
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl bg-muted/40 hover:bg-muted/70 text-xs font-medium text-foreground transition-colors cursor-pointer border border-border/40"
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
                  className="w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl bg-primary text-primary-foreground font-semibold text-xs transition-colors cursor-pointer shadow-sm"
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
                  className="w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-medium text-xs transition-colors cursor-pointer"
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
              onClick={toggleTheme}
              className="w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl bg-muted/40 hover:bg-muted/70 text-xs font-medium text-foreground transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {isDark ? (
                  <Sun size={17} className="text-amber-500" />
                ) : (
                  <Moon size={17} className="text-indigo-500" />
                )}
                <span>Giao diện: {isDark ? "Tối (Dark Mode)" : "Sáng (Light Mode)"}</span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">Đổi</span>
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                onOpenChange(false);
              }}
              className="w-full flex items-center justify-center gap-2 p-3 min-h-[44px] rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer"
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
