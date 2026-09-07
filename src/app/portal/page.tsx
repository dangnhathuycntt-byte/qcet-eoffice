"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Tv,
  CheckSquare,
  Calendar,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Clock,
  Sun,
  Moon,
  Briefcase,
  Users,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function PortalLiveClock() {
  const [timeStr, setTimeStr] = React.useState<string>("");

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!timeStr) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/80 border border-border/60 text-xs font-mono font-bold text-foreground shadow-2xs">
      <Clock size={13} className="text-primary" strokeWidth={1.5} />
      <span className="tabular-nums">{timeStr}</span>
    </div>
  );
}

function PortalZoomToggle() {
  const [zoomLevel, setZoomLevel] = React.useState<number>(1.0);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("qcet_ui_zoom");
    if (saved) {
      const z = parseFloat(saved);
      if (!isNaN(z)) {
        setZoomLevel(z);
        document.documentElement.style.zoom = String(z);
      }
    } else {
      document.documentElement.style.zoom = "1.0";
    }
  }, []);

  const toggleZoom = () => {
    const nextZoom = zoomLevel === 1.2 ? 1.0 : 1.2;
    setZoomLevel(nextZoom);
    document.documentElement.style.zoom = String(nextZoom);
    localStorage.setItem("qcet_ui_zoom", String(nextZoom));
  };

  return (
    <button
      type="button"
      onClick={toggleZoom}
      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-card/80 hover:bg-card border border-border/60 text-xs font-bold text-foreground shadow-2xs transition-all cursor-pointer hover:border-primary/40 active:scale-95"
      title="Bật / Tắt phóng to (100% / 120%)"
    >
      <span className="text-muted-foreground font-medium">Zoom:</span>
      <span className="font-mono text-primary font-bold">
        {mounted ? `${Math.round(zoomLevel * 100)}%` : "100%"}
      </span>
    </button>
  );
}

export default function PortalPage() {
  const { resolved, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col justify-between selection:bg-primary/20 selection:text-primary">
      {/* Top Header matching QCET SmartLibrary styling */}
      <header className="w-full border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Avatar initial badge + QCET Logo + Branding */}
          <div className="flex items-center gap-3 min-w-0">
            {/* User Avatar Circle */}
            <div className="size-8 rounded-full bg-foreground text-background font-black text-xs flex items-center justify-center shadow-xs shrink-0 select-none">
              {user?.name ? user.name.slice(0, 1).toUpperCase() : "Q"}
            </div>

            {/* School Crest / Logo */}
            <div className="relative size-8 shrink-0">
              <Image
                src="/qcet-logo.png"
                alt="Logo QCET"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>

            {/* Title stacked */}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase leading-tight truncate">
                TRƯỜNG CĐ KTCN QUY NHƠN
              </span>
              <span className="text-xs sm:text-sm font-extrabold tracking-tight text-foreground leading-tight truncate">
                VĂN PHÒNG ĐIỆN TỬ
              </span>
            </div>
          </div>

          {/* Right: Live Clock + Zoom + Theme */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <PortalLiveClock />
            </div>

            <PortalZoomToggle />

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="size-8 rounded-full bg-card/80 hover:bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
              title="Chuyển đổi giao diện sáng / tối"
              aria-label="Chuyển đổi giao diện"
            >
              {resolved === "dark" ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content: Hero + Bento Navigation Hub */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 md:py-16 flex flex-col justify-center">
        {/* Centered Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground font-heading">
            Hệ Thống Điều Hành QCET
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed font-normal">
            Hệ thống phân cấp nhiệm vụ và quản lý công việc toàn trường
          </p>
        </div>

        {/* Bento Grid Layout (1 Wide Card + 2 Stacked Cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Card: Main Executive Dashboard (col-span-7) */}
          <Link
            href="/dashboard"
            className="lg:col-span-7 relative rounded-[2rem] border border-border/70 bg-card/80 backdrop-blur-xl p-7 md:p-8 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group cursor-pointer"
          >
            {/* Subtle background ambient tint */}
            <div className="absolute -top-20 -right-20 size-64 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Top header within card */}
            <div>
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <span className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                  Màn hình Điều hành BGH
                </span>
                <div className="size-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <Tv size={22} strokeWidth={1.75} />
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-6 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Dashboard Điều Hành & Báo Cáo KPI
              </h2>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                Theo dõi toàn cảnh tiến độ 11 Khoa/Phòng, chỉ số hoàn thành toàn trường, ma trận nghẽn việc và hàng đợi duyệt công việc chiến lược.
              </p>

              {/* Two Micro Feature Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-7">
                <div className="p-3.5 rounded-2xl bg-background/80 dark:bg-card/80 border border-border/70 flex items-center gap-3 shadow-2xs">
                  <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Activity size={17} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">Tiến độ Toàn trường</div>
                    <div className="text-xs text-muted-foreground font-medium font-mono tabular-nums">32% hoàn thành (340 việc)</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-background/80 dark:bg-card/80 border border-border/70 flex items-center gap-3 shadow-2xs">
                  <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={17} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">Nhiệm vụ Cấp trường</div>
                    <div className="text-xs text-muted-foreground font-medium font-mono tabular-nums">94 việc trọng tâm</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action */}
            <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
                KHỞI CHẠY DASHBOARD ĐIỀU HÀNH
              </span>
              <span className="size-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 active:scale-95 transition-all">
                <ArrowUpRight size={18} strokeWidth={2.2} />
              </span>
            </div>
          </Link>

          {/* Right Column: 2 Stacked Cards (col-span-5) */}
          <div className="lg:col-span-5 flex flex-col gap-6 justify-between">
            {/* Top Right Card: Quản lý Công việc */}
            <Link
              href="/"
              className="relative rounded-[2rem] border border-border/70 bg-card/80 backdrop-blur-xl p-6 md:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Briefcase size={12} strokeWidth={1.75} />
                    Dành cho Khoa / Phòng
                  </span>
                  <div className="size-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <CheckSquare size={20} strokeWidth={1.75} />
                  </div>
                </div>

                <h3 className="text-xl font-bold tracking-tight text-foreground mt-4 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Quản Lý Công Việc 2 Cấp
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                  Bảng nhiệm vụ cấp Trường & Đơn vị: Phân cấp rõ ràng, giao việc nhanh, tìm kiếm và phân trang tối ưu không giật lag.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Vào bảng công việc</span>
                <ArrowUpRight size={15} strokeWidth={2.2} />
              </div>
            </Link>

            {/* Bottom Right Card: Lịch công tác & Cơ cấu */}
            <Link
              href="/calendar"
              className="relative rounded-[2rem] border border-border/70 bg-card/80 backdrop-blur-xl p-6 md:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                    <Users size={12} strokeWidth={1.75} />
                    Toàn thể Cán bộ & Giảng viên
                  </span>
                  <div className="size-11 rounded-2xl bg-slate-500/10 dark:bg-slate-500/15 border border-slate-500/20 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <Calendar size={20} strokeWidth={1.75} />
                  </div>
                </div>

                <h3 className="text-xl font-bold tracking-tight text-foreground mt-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Lịch Công Tác & Cơ Cấu Tổ Chức
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                  Tra cứu lịch công tác tuần Ban Giám hiệu, sự kiện đào tạo, lịch làm việc các khoa phòng và sơ đồ tổ chức nhân sự 11 đơn vị.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span>Xem lịch công tác & danh bạ</span>
                <ArrowUpRight size={15} strokeWidth={2.2} />
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* Clean Footer matching QCET SmartLibrary */}
      <footer className="w-full py-8 text-center text-xs text-muted-foreground border-t border-border/40">
        <p>© 2026 Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn</p>
      </footer>
    </div>
  );
}
