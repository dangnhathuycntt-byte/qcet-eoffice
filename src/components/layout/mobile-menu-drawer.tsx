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
