"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  ExternalLink,
  ArrowRight,
  Maximize2,
  MoveUp,
  MoveDown,
  Clock,
  Layers,
  Calendar,
  AlertTriangle,
  Info,
  CheckCircle2,
  RotateCw,
  SlidersHorizontal,
  Table as TableIcon,
  Kanban as KanbanIcon,
  User,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { InlineAlert } from "@/components/ui/inline-alert";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import { DrawerRoot, DrawerContent, DrawerOverlay, DrawerPortal } from "@/components/ui/drawer";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { motionEase, motionTransition, motionSpring } from "@/lib/motion/tokens";
import { popoverVariants } from "@/lib/motion/variants";
import { cn } from "@/lib/utils";

// ============================================================================
// Token Definitions & Metadata
// ============================================================================

const COLORS_GRAY: Array<[string, string, string, string]> = [
  ["Bậc 1 · bg-app", "--gray-1", "#FAFBFC", "Nền trang"],
  ["Bậc 2 · bg-panel", "--gray-2", "#FFFFFF", "Panel, hộp thoại, menu"],
  ["Bậc 3 · bg-control", "--gray-3", "#F2F4F7", "Ô nhập, nút phụ, chip"],
  ["Bậc 4 · bg-hover", "--gray-4", "#EAEDF1", "Di chuột dòng, nút"],
  ["Bậc 5 · bg-selected", "--accent-3", "#E1EBF8", "Dòng đang chọn, tiêu điểm"],
  ["Bậc 6 · bg-mark", "--gray-6", "#DADDE2", "Ô chọn chưa tick, thanh mảnh"],
  ["Bậc 7 · fg-faint", "--gray-7", "#C9CDD3", "Tay nắm, dấu chia, icon mờ"],
  ["Bậc 8 · fg-disabled", "--gray-8", "#9AA0A9", "Chữ, icon vô hiệu"],
  ["Bậc 9 · action", "--accent-9", "#0058A0", "Nút chính, ô tick, công tắc"],
  ["Bậc 10 · action-hover", "--accent-10", "#004A88", "Nút chính khi di chuột"],
  ["Bậc 11 · text-secondary", "--gray-11", "#5F6671", "Nhãn, chú thích (5.8:1)"],
  ["Bậc 12 · text-primary", "--gray-12", "#1A1D23", "Chữ chính, tiêu đề"],
];

const COLORS_SEMANTIC: Array<[string, string, string, string]> = [
  ["Hành động chính", "--accent-9", "#0058A0", "Xanh trường: nút chính, CTA, focus ring"],
  ["Hành động hover", "--accent-10", "#004A88", "Di chuột nút chính"],
  ["Vùng đang chọn", "--accent-3", "#E1EBF8", "Nền dòng/khối được chọn"],
  ["Nguy hiểm / Quá hạn", "--destructive", "#B91C1C", "Quá hạn, lỗi, xóa"],
  ["Nền lỗi / Xóa", "--danger-soft", "#FBEDED", "Nền ô lỗi, nút xóa"],
  ["Nhấn tranh / Icon", "--icon-accent", "#C0D0F4", "Nền chip icon nghiệp vụ"],
  ["Nhấn logo trường", "--brand-accent", "#F8F000", "Chỉ dùng trong logo và tranh"],
  ["Lớp tối hộp thoại", "--overlay", "rgb(0 0 0 / .4)", "Overlay phía sau modal"],
];

const STATUSES = [
  ["NOT_STARTED", "Mới", "Chưa bắt đầu thực hiện"],
  ["IN_PROGRESS", "Đang thực hiện", "Đang trong tiến độ"],
  ["WAITING_APPROVAL", "Chờ duyệt", "Chờ lãnh đạo / BGH phê duyệt"],
  ["NEEDS_REVIEW", "Cần xem lại", "Yêu cầu bổ sung hoặc chỉnh sửa"],
  ["COMPLETED", "Hoàn thành", "Đã duyệt và hoàn tất kết quả"],
  ["CANCELLED", "Đã hủy", "Nhiệm vụ bị dừng hoặc hủy"],
] as const;

const PRIORITIES = [
  ["URGENT", "Khẩn cấp", "3 vạch đỏ #B91C1C (duy nhất mức này có màu)"],
  ["HIGH", "Cao", "3 vạch tối"],
  ["NORMAL", "Bình thường", "2 vạch tối, 1 vạch mờ"],
  ["LOW", "Thấp", "1 vạch tối, 2 vạch mờ"],
] as const;

const SPACING_SCALE = [
  { token: "space-01", px: 2, use: "Viền micro, khoảng cách vạch priority" },
  { token: "space-02", px: 4, use: "Lưới 4px cơ sở, gap chip nhỏ, padding icon" },
  { token: "space-03", px: 8, use: "Khoảng cách icon ↔ chữ, gap giữa 2 chip" },
  { token: "space-04", px: 12, use: "Đệm nút, padding ô nhập, khoảng cách nhãn" },
  { token: "space-05", px: 16, use: "Padding thẻ, gap cột, lề trang mobile" },
  { token: "space-06", px: 24, use: "Đệm panel hai bên, lề trang desktop, gap khối" },
  { token: "space-07", px: 32, use: "Đệm panel lớn, chiều cao menu item / icon chip" },
  { token: "space-08", px: 40, use: "Chiều cao dòng bảng chuẩn, khoảng cách cụm" },
  { token: "space-09", px: 48, use: "Khoảng cách giữa hai khối lớn, dòng bảng 2 lớp" },
  { token: "space-10", px: 64, use: "Khoảng cách lớn phân đoạn, chiều cao sidebar thu gọn" },
];

const NAV_ITEMS = [
  { id: "mau", label: "Màu sắc", group: "Nền tảng" },
  { id: "chu", label: "Kiểu chữ", group: "Nền tảng" },
  { id: "khoang-cach-le", label: "Khoảng cách & Lề", group: "Nền tảng" },
  { id: "spacing", label: "Thang khoảng cách", group: "Nền tảng" },
  { id: "nut", label: "Nút bấm", group: "Điều khiển" },
  { id: "o-nhap", label: "Ô nhập liệu", group: "Điều khiển" },
  { id: "chon-cong-tac", label: "Chọn & Công tắc", group: "Điều khiển" },
  { id: "bo-loc-chips", label: "Bộ lọc & Chip lọc", group: "Điều khiển" },
  { id: "trang-thai-uu-tien", label: "Trạng thái & Ưu tiên", group: "Trạng thái & Phản hồi" },
  { id: "nhan-nguoi-tien-do", label: "Nhãn & Tiến độ", group: "Trạng thái & Phản hồi" },
  { id: "cac-trang-thai", label: "Trạng thái hệ thống", group: "Trạng thái & Phản hồi" },
  { id: "stepper", label: "Stepper tiến trình", group: "Thành phần nâng cao" },
  { id: "thao-tac-hang-loat", label: "Thao tác hàng loạt", group: "Thành phần nâng cao" },
  { id: "peek-drawer", label: "Ngăn kéo xem nhanh", group: "Thành phần nâng cao" },
  { id: "trang-danh-sach-nhiem-vu", label: "Trang nhiệm vụ (T3List)", group: "Mẫu ứng dụng" },
];

// ============================================================================
// Helper Components
// ============================================================================

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 space-y-4">
      <div className="border-b border-border/40 pb-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Cell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <span>{label}</span>
        {hint ? <span className="text-[11px] text-muted-foreground/75 font-normal">({hint})</span> : null}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Main Showcase Component
// ============================================================================

export function DesignShowcase() {
  const [checked, setChecked] = React.useState(true);
  const [on, setOn] = React.useState(true);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState("mau");
  const [activeTab, setActiveTab] = React.useState("table");

  // Filter chips state
  const [filterChips, setFilterChips] = React.useState([
    { id: "time", label: "Thời gian: Tháng 10" },
    { id: "priority", label: "Ưu tiên: Khẩn cấp, Cao" },
    { id: "status", label: "Trạng thái: Chờ duyệt" },
  ]);
  const [filterOpen, setFilterOpen] = React.useState(false);

  // Stepper active step state
  const [activeStep, setActiveStep] = React.useState(2);

  // Task list group collapsible state
  const [groupCollapse, setGroupCollapse] = React.useState<{ [key: string]: boolean }>({
    waiting: false,
    doing: false,
    new: false,
  });

  // Selected task codes in task table
  const [selectedTaskCodes, setSelectedTaskCodes] = React.useState<string[]>(["NV-133", "NV-129"]);

  const toggleTask = (code: string) => {
    setSelectedTaskCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const deselectAllTasks = () => {
    setSelectedTaskCodes([]);
  };

  const selectAllTasks = () => {
    const allCodes = [
      "NV-131",
      "NV-132",
      "NV-135",
      "NV-133",
      "NV-129",
      "NV-134",
      "NV-136",
      "NV-137",
      "NV-130",
      "NV-138",
      "NV-139",
    ];
    if (selectedTaskCodes.length === allCodes.length) {
      setSelectedTaskCodes([]);
    } else {
      setSelectedTaskCodes(allCodes);
    }
  };

  const removeChip = (id: string) => {
    setFilterChips((prev) => prev.filter((c) => c.id !== id));
  };

  const clearAllChips = () => {
    setFilterChips([]);
  };

  // Scrollspy effect
  React.useEffect(() => {
    const handleScroll = () => {
      const sectionElements = NAV_ITEMS.map((item) => document.getElementById(item.id));
      const scrollY = window.scrollY;

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const el = sectionElements[i];
        if (el && el.offsetTop - 120 <= scrollY) {
          setActiveSection(NAV_ITEMS[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Container: Sidebar + Content */}
      <div className="mx-auto flex w-full max-w-[1440px]">
        {/* Left Sidebar Menu */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/40 bg-card p-4 lg:flex overflow-y-auto">
          <div className="mb-6 px-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                QC
              </span>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-foreground leading-none">QCET E-Office</h1>
                <span className="text-[11px] text-muted-foreground">Bảng mẫu hệ thống thiết kế</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Chỉ chạy ở môi trường Dev</span>
            </div>
          </div>

          <nav className="flex-1 space-y-6 text-xs">
            {Array.from(new Set(NAV_ITEMS.map((i) => i.group))).map((group) => (
              <div key={group} className="space-y-1">
                <div className="px-2 text-[11px] font-semibold text-muted-foreground/80">
                  {group}
                </div>
                <div className="space-y-0.5">
                  {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
                    const isActive = activeSection === item.id;
                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={cn(
                          "relative flex h-7 items-center rounded-lg px-2 text-xs transition-colors select-none",
                          isActive
                            ? "font-semibold text-primary"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                        )}
                      >
                        {isActive && (
                          <m.span
                            layoutId="sidebar-active-indicator"
                            className="absolute inset-0 rounded-lg bg-selected"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          />
                        )}
                        <span className="relative z-10 truncate">{item.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-border/40 pt-3 text-[11px] text-muted-foreground/75 px-2">
            <div>QCET E-Office · Canvas v1.0</div>
            <div className="text-[10px]">Action #0058A0 · Lưới 4px</div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-6 py-8 lg:px-12 lg:py-10 space-y-16 max-w-[1200px]">
          {/* Header */}
          <header className="space-y-2 border-b border-border/40 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
                  Hệ thống thiết kế QCET E-Office
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Đồng bộ chuẩn xác với canvas thiết kế E-Office. Nút hành động xanh #0058A0, vùng chọn #E1EBF8, chữ
                  12/14/16/20/24/28, lưới 4px.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setDrawerOpen(true)}>
                  <Maximize2 className="size-3.5" /> Mở Peek Drawer
                </Button>
                <Button size="sm" asChild>
                  <a href="#trang-danh-sach-nhiem-vu">Xem trang nhiệm vụ mẫu</a>
                </Button>
              </div>
            </div>
          </header>

          {/* 1. MÀU SẮC */}
          <Section
            id="mau"
            title="Màu sắc"
            note="Thang xám 12 bậc (mỗi bậc một nhiệm vụ) và màu hành động xanh trường #0058A0. Tuyệt đối không dùng nút đen, không bôi đen."
          >
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-xs font-semibold text-muted-foreground">
                  Thang xám 12 bậc
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {COLORS_GRAY.map(([name, token, hex, desc]) => (
                    <div key={token} className="space-y-1.5 rounded-xl border border-border/40 bg-card p-3 shadow-subtle">
                      <div
                        className="h-10 w-full rounded-lg"
                        style={{
                          background: `var(${token})`,
                          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
                        }}
                      />
                      <div className="text-xs font-semibold leading-tight text-foreground">{name}</div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">{hex}</div>
                      <div className="text-[11px] text-muted-foreground/80 line-clamp-1">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold text-muted-foreground">
                  Màu ngữ nghĩa & Thương hiệu
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {COLORS_SEMANTIC.map(([name, token, hex, desc]) => (
                    <div key={token} className="space-y-1.5 rounded-xl border border-border/40 bg-card p-3 shadow-subtle">
                      <div
                        className="h-10 w-full rounded-lg"
                        style={{
                          background: `var(${token})`,
                          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                        }}
                      />
                      <div className="text-xs font-semibold leading-tight text-foreground">{name}</div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">{hex}</div>
                      <div className="text-[11px] text-muted-foreground/80">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* 2. KIỂU CHỮ */}
          <Section
            id="chu"
            title="Kiểu chữ"
            note="Phông duy nhất Be Vietnam Pro. Thang cỡ chữ nghiêm ngặt: 12 · 14 · 16 · 20 · 24 · 28 (ngoại lệ: chữ viết tắt avatar 10px). Số và ngày dùng tabular-nums."
          >
            <div className="space-y-3 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
              <div className="flex flex-col justify-between gap-1 border-b border-border/40 pb-3 sm:flex-row sm:items-baseline">
                <span className="text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                  28px · Tiêu đề trang lớn
                </span>
                <span className="text-xs text-muted-foreground">font-semibold · tracking-tight</span>
              </div>
              <div className="flex flex-col justify-between gap-1 border-b border-border/40 pb-3 sm:flex-row sm:items-baseline">
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  24px · Tên trang chính
                </span>
                <span className="text-xs text-muted-foreground">font-semibold · tracking-tight</span>
              </div>
              <div className="flex flex-col justify-between gap-1 border-b border-border/40 pb-3 sm:flex-row sm:items-baseline">
                <span className="text-xl font-semibold text-foreground">
                  20px · Tiêu đề phần, hộp thoại
                </span>
                <span className="text-xs text-muted-foreground">font-semibold</span>
              </div>
              <div className="flex flex-col justify-between gap-1 border-b border-border/40 pb-3 sm:flex-row sm:items-baseline">
                <span className="text-base text-foreground leading-relaxed">
                  16px · Nội dung người dùng đọc và nhập trong văn bản / trình soạn thảo
                </span>
                <span className="text-xs text-muted-foreground">font-normal · line-height 1.65</span>
              </div>
              <div className="flex flex-col justify-between gap-1 border-b border-border/40 pb-3 sm:flex-row sm:items-baseline">
                <span className="text-sm font-medium text-foreground">
                  14px · Giao diện, nút bấm, ô nhập, dòng bảng, menu item
                </span>
                <span className="text-xs text-muted-foreground">font-medium</span>
              </div>
              <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
                <span className="text-xs text-muted-foreground tabular-nums">
                  12px · Chú thích, mã nhiệm vụ (NV-2026-09), nhãn phụ, ngày tháng (28/09/2026)
                </span>
                <span className="text-xs text-muted-foreground">font-normal · tabular-nums</span>
              </div>
            </div>
          </Section>

          {/* 3. KHOẢNG CÁCH & LỀ (REDLINE) */}
          <Section
            id="khoang-cach-le"
            title="Khoảng cách & Lề"
            note="Mô phỏng bản vẽ đo đạc (redline) chuẩn xác từ canvas: Inset (4/8/12/16/24), Stack (4/8/16/24/48), Inline (4/8/12/16) và lề trang (24/20/16)."
          >
            <div className="space-y-6">
              {/* Lề trang & Container */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Quy chuẩn lề trang & giới hạn chiều rộng</h3>
                  <Badge variant="outline">content-max: 1440px</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                    <div className="text-xs font-semibold text-rose-700">Máy tính (Desktop ≥1280)</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-rose-900">24px</div>
                    <p className="mt-1 text-[11px] text-rose-600">Lề hai bên trang (--page-gutter)</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <div className="text-xs font-semibold text-amber-700">Máy tính bảng (Tablet 640–1023)</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-amber-900">20px</div>
                    <p className="mt-1 text-[11px] text-amber-600">Lề trang trung gian</p>
                  </div>
                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
                    <div className="text-xs font-semibold text-sky-700">Điện thoại (Mobile &lt;640)</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-sky-900">16px</div>
                    <p className="mt-1 text-[11px] text-sky-600">Lề thu gọn cho màn hình nhỏ</p>
                  </div>
                </div>
              </div>

              {/* Redline Component Simulation */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Bản vẽ Redline cấu trúc thẻ & dòng dữ liệu</h3>
                  <p className="text-xs text-muted-foreground">
                    Các vạch màu đỏ/hồng thể hiện vùng đệm (padding), khoảng hở (stack/inline gap) chính xác trên lưới 4px.
                  </p>
                </div>

                {/* Mock Card with Redline visual guides */}
                <div className="relative rounded-2xl border border-dashed border-rose-400 bg-rose-50/20 p-6">
                  {/* Inset Badge */}
                  <div className="absolute top-2 left-2 rounded bg-rose-600 px-1.5 py-0.5 font-mono text-[10px] text-white">
                    inset-24 (24px)
                  </div>

                  <div className="space-y-4 rounded-xl bg-card p-4 shadow-subtle border border-border/40">
                    <div className="flex items-center justify-between border-b border-border/40 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="text-sm font-semibold text-foreground">Chi tiết công việc</span>
                      </div>
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] text-rose-700">
                        inline-8 (8px)
                      </span>
                    </div>

                    {/* Redline Task Row */}
                    <div className="relative flex items-center justify-between rounded-lg bg-secondary/80 px-3 py-2 text-xs">
                      <div className="flex items-center gap-3">
                        <Checkbox checked readOnly />
                        <TaskStatusCircle status="IN_PROGRESS" />
                        <span className="font-medium text-foreground">Soạn tờ trình phân bổ ngân sách</span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span className="rounded bg-rose-500/10 px-1 font-mono text-[10px] text-rose-600">h-10 (40px)</span>
                        <UserAvatar name="Đặng Nhật Huy" size="sm" />
                        <span className="tabular-nums">12/10</span>
                      </div>
                    </div>

                    {/* Stack Annotation */}
                    <div className="flex items-center justify-center py-1">
                      <div className="flex items-center gap-1.5 rounded bg-rose-100 px-2 py-0.5 font-mono text-[10px] text-rose-800">
                        <MoveDown className="size-3" /> stack-16 (16px) <MoveUp className="size-3" />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] text-rose-700">
                        inline-8 (8px)
                      </span>
                      <Button variant="secondary" size="sm">
                        Đóng
                      </Button>
                      <Button size="sm">Lưu lại</Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inset, Stack, Inline Comparison Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border/40 bg-card p-4 shadow-subtle">
                  <div className="text-xs font-semibold text-foreground mb-2">Đệm lọt lòng (Inset)</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">inset-4</span>
                      <span className="font-mono font-medium">4px</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">inset-8</span>
                      <span className="font-mono font-medium">8px</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">inset-12</span>
                      <span className="font-mono font-medium">12px</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">inset-16</span>
                      <span className="font-mono font-medium">16px</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">inset-24</span>
                      <span className="font-mono font-medium">24px</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/40 bg-card p-4 shadow-subtle">
                  <div className="text-xs font-semibold text-foreground mb-2">Khoảng cách dọc (Stack)</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">stack-4</span>
                      <span className="font-mono font-medium">4px</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">stack-8</span>
                      <span className="font-mono font-medium">8px</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">stack-16</span>
                      <span className="font-mono font-medium">16px</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">stack-24</span>
                      <span className="font-mono font-medium">24px</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">stack-48</span>
                      <span className="font-mono font-medium">48px</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/40 bg-card p-4 shadow-subtle">
                  <div className="text-xs font-semibold text-foreground mb-2">Khoảng cách ngang (Inline)</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">inline-4</span>
                      <span className="font-mono font-medium">4px</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">inline-8</span>
                      <span className="font-mono font-medium">8px</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">inline-12</span>
                      <span className="font-mono font-medium">12px</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">inline-16</span>
                      <span className="font-mono font-medium">16px</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 4. THANG KHOẢNG CÁCH LƯỚI 4 */}
          <Section
            id="spacing"
            title="Thang khoảng cách (Lưới 4px)"
            note="Lưới 4px tăng dần (space-01 đến space-10). Mọi padding, margin, gap trong hệ thống đều phải bắt mốc theo thang này."
          >
            <div className="space-y-6">
              <div className="space-y-2 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
                {SPACING_SCALE.map(({ token, px, use }) => (
                  <div key={token} className="grid grid-cols-[80px_48px_minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-3 text-xs py-1">
                    <span className="font-mono font-semibold text-foreground">{token}</span>
                    <span className="tabular-nums font-mono text-muted-foreground">{px}px</span>
                    <div className="flex items-center">
                      <div
                        className="h-3 rounded-sm bg-primary"
                        style={{ width: `${Math.min(px * 3, 240)}px` }}
                      />
                    </div>
                    <span className="text-muted-foreground truncate">{use}</span>
                  </div>
                ))}
              </div>

              {/* Bảng quy tắc khoảng đệm */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Khoảng đệm hay dùng trong ứng dụng</h3>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="flex justify-between rounded-lg bg-secondary/60 p-2.5">
                    <span className="text-muted-foreground">Đệm trong panel:</span>
                    <span className="font-medium text-foreground">26px trên · 28px hai bên</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-secondary/60 p-2.5">
                    <span className="text-muted-foreground">Giữa hai khối lớn:</span>
                    <span className="font-medium text-foreground">40 – 48px</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-secondary/60 p-2.5">
                    <span className="text-muted-foreground">Giữa nhãn và giá trị:</span>
                    <span className="font-medium text-foreground">12 – 18px</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-secondary/60 p-2.5">
                    <span className="text-muted-foreground">Icon ↔ chữ:</span>
                    <span className="font-medium text-foreground">8px</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-secondary/60 p-2.5">
                    <span className="text-muted-foreground">Giữa hai chip / tag:</span>
                    <span className="font-medium text-foreground">6 – 8px</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-secondary/60 p-2.5">
                    <span className="text-muted-foreground">Chiều cao dòng bảng chuẩn:</span>
                    <span className="font-medium text-foreground">40px (gọn) · 48px (mặc định)</span>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 5. NÚT BẤM */}
          <Section
            id="nut"
            title="Nút bấm"
            note="Mỗi màn hình chỉ có một nút chính (Primary). Nút chính dùng màu xanh #0058A0, hover #004A88, text trắng #FAFAFA. Không nút đen."
          >
            <div className="space-y-6 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Các biến thể (Variants) · Cao 34px (bo 12px)</div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Nút chính (Primary)</Button>
                  <Button variant="secondary">Nút phụ (Secondary)</Button>
                  <Button variant="outline">Đường viền (Outline)</Button>
                  <Button variant="ghost">Bóng mờ (Ghost)</Button>
                  <Button variant="destructive">Hủy / Xóa</Button>
                  <Button variant="link">Liên kết</Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Kích thước (Sizes) · Toolbar 28px (bo 8px) · Default 34px (bo 12px) · Lớn 44px</div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">
                    <Plus className="size-3.5" /> Tạo việc (sm 28px)
                  </Button>
                  <Button size="sm" variant="secondary">
                    <Filter className="size-3.5" /> Bộ lọc (sm 28px)
                  </Button>
                  <Button size="icon-sm" variant="secondary" aria-label="Tìm kiếm">
                    <Search className="size-3.5" />
                  </Button>
                  <Button size="default">
                    <Plus className="size-4" /> Mặc định (34px)
                  </Button>
                  <Button size="lg">
                    Nút lớn (44px)
                  </Button>
                  <Button disabled>Vô hiệu</Button>
                  <Button variant="secondary" disabled>
                    Vô hiệu
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          {/* 6. Ô NHẬP LIỆU */}
          <Section
            id="o-nhap"
            title="Ô nhập liệu"
            note="Nền xám nhạt #F2F4F7, không viền cứng, bo 12px, cao 36px. Ô chỉ đọc bỏ nền xám để sao chép được. Ô lỗi đổi nền #FBEDED kèm hướng dẫn sửa."
          >
            <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
              <Cell label="Mặc định" hint="Nền #F2F4F7">
                <Input placeholder="Tìm kiếm hoặc gõ nội dung…" />
              </Cell>
              <Cell label="Đã nhập dữ liệu">
                <Input defaultValue="Tổng hợp báo cáo tuyển sinh tháng 9" />
              </Cell>
              <Cell label="Chỉ đọc (Read-only)" hint="Không nền, sao chép được">
                <Input readOnly defaultValue="NV-2026-09-129" className="bg-transparent" />
              </Cell>
              <Cell label="Vô hiệu (Disabled)" hint="Nền nhạt, chữ mờ">
                <Input disabled placeholder="Không thể chỉnh sửa" />
              </Cell>
              <Cell label="Trạng thái lỗi (Error)" hint="Nền #FBEDED">
                <Input aria-invalid defaultValue="" placeholder="Vui lòng nhập tên công việc" />
                <span className="text-[12px] text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="size-3 shrink-0" /> Tên công việc không được để trống.
                </span>
              </Cell>
              <Cell label="Ô tìm kiếm có phím tắt (Toolbar Search)" hint="Rộng 280px">
                <div className="relative w-full max-w-[280px]">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Tìm kiếm…" className="h-8 pl-8 pr-7 text-xs rounded-lg" />
                  <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    /
                  </kbd>
                </div>
              </Cell>
            </div>
          </Section>

          {/* 7. CHỌN & CÔNG TẮC */}
          <Section
            id="chon-cong-tac"
            title="Chọn & Công tắc"
            note="Checkbox xanh #0058A0 khi tick, Switch công tắc tức thì không cần nút Lưu. Bo góc chip 8px."
          >
            <div className="flex flex-wrap items-center gap-8 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
              <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                <span>Đã chọn (Checked)</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                <Checkbox />
                <span>Chưa chọn</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                <Checkbox indeterminate readOnly />
                <span>Một phần (Indeterminate)</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-not-allowed select-none">
                <Checkbox disabled />
                <span>Vô hiệu (Disabled)</span>
              </label>
              <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                <Switch checked={on} onChange={(e) => setOn(e.target.checked)} />
                <span>Công tắc ({on ? "Bật" : "Tắt"})</span>
              </label>
            </div>
          </Section>

          {/* 8. BỘ LỌC & CHIP LỌC */}
          <Section
            id="bo-loc-chips"
            title="Bộ lọc & Chip lọc"
            note="Bộ lọc 2 cấp, tick không tự đóng menu. Kết quả lọc hiển thị thành các chip có nút × xóa nhanh, kèm nút 'Xóa lọc'."
          >
            <div className="space-y-4 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
              {/* Filter Controls Row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5 cursor-pointer"
                    onClick={() => setFilterOpen((p) => !p)}
                  >
                    <Filter className="size-3.5" />
                    <span>Bộ lọc</span>
                    {filterChips.length > 0 ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {filterChips.length}
                      </span>
                    ) : null}
                  </Button>

                  {/* Filter Menu with Popover Variants Animation */}
                  <AnimatePresence>
                    {filterOpen && (
                      <m.div
                        variants={popoverVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-border/60 bg-popover p-3 shadow-menu z-20 space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b border-border/40 pb-2 px-1">
                          <span>Tiêu chí lọc 2 cấp</span>
                          <button
                            type="button"
                            onClick={() => setFilterOpen(false)}
                            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              if (!filterChips.some((c) => c.id === "time")) {
                                setFilterChips((p) => [...p, { id: "time", label: "Thời gian: Tháng 10" }]);
                              }
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 hover:bg-secondary/70 transition-colors text-left cursor-pointer"
                          >
                            <span className="text-foreground font-medium">Thời gian</span>
                            <span className="text-primary font-medium text-[11px]">Tháng 10 ›</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!filterChips.some((c) => c.id === "priority")) {
                                setFilterChips((p) => [...p, { id: "priority", label: "Ưu tiên: Khẩn cấp, Cao" }]);
                              }
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 hover:bg-secondary/70 transition-colors text-left cursor-pointer"
                          >
                            <span className="text-foreground font-medium">Ưu tiên</span>
                            <span className="text-muted-foreground text-[11px]">Khẩn cấp, Cao ›</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!filterChips.some((c) => c.id === "status")) {
                                setFilterChips((p) => [...p, { id: "status", label: "Trạng thái: Chờ duyệt" }]);
                              }
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 hover:bg-secondary/70 transition-colors text-left cursor-pointer"
                          >
                            <span className="text-foreground font-medium">Trạng thái</span>
                            <span className="text-muted-foreground text-[11px]">Chờ duyệt ›</span>
                          </button>
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="text-xs text-muted-foreground">Bấm mở menu lọc cấp 1 → cấp 2 (có chuyển động popover)</div>
              </div>

              {/* Filter Chips Container with AnimatedPresence & layout spring */}
              <div className="flex flex-wrap items-center gap-2 pt-1 min-h-[32px]">
                <AnimatePresence mode="popLayout">
                  {filterChips.map((chip) => (
                    <m.span
                      key={chip.id}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-chip bg-secondary px-2.5 text-xs font-medium text-foreground border border-border/40 transition-colors"
                    >
                      <span>{chip.label}</span>
                      <button
                        type="button"
                        onClick={() => removeChip(chip.id)}
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                        title="Xóa bộ lọc này"
                      >
                        <X className="size-3" />
                      </button>
                    </m.span>
                  ))}
                </AnimatePresence>

                {filterChips.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearAllChips}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline ml-2 cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Không có bộ lọc nào đang bật.</span>
                )}
              </div>

              {/* Sample Popover simulation */}
              <div className="rounded-xl bg-secondary/50 p-4 border border-border/30 max-w-[360px] space-y-2">
                <div className="text-xs font-semibold text-foreground">Menu lọc 2 cấp (mô phỏng)</div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between rounded-lg bg-card px-2.5 py-1.5 shadow-xs">
                    <span className="font-medium text-foreground">Thời gian</span>
                    <span className="text-primary font-medium">Tháng 10 ›</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-card px-2.5 py-1.5 shadow-xs">
                    <span className="font-medium text-foreground">Ưu tiên</span>
                    <span className="text-muted-foreground">Khẩn cấp, Cao ›</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-card px-2.5 py-1.5 shadow-xs">
                    <span className="font-medium text-foreground">Người phụ trách</span>
                    <span className="text-muted-foreground">Tất cả ›</span>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 9. TRẠNG THÁI & ƯU TIÊN */}
          <Section
            id="trang-thai-uu-tien"
            title="Trạng thái & Mức ưu tiên"
            note="Trạng thái dùng biểu tượng hình học xám, không tô màu sắc sặc sỡ. Chỉ duy nhất mức ưu tiên Khẩn cấp được dùng màu đỏ #B91C1C."
          >
            <div className="grid gap-8 sm:grid-cols-2 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Trạng thái nhiệm vụ (Icon hình)
                </h3>
                <div className="space-y-2">
                  {STATUSES.map(([key, label, desc]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg p-1.5 hover:bg-secondary/60">
                      <div className="flex items-center gap-2.5 text-sm">
                        <TaskStatusCircle status={key} />
                        <span className="font-medium text-foreground">{label}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Mức độ ưu tiên (Signal Bars)
                </h3>
                <div className="space-y-2">
                  {PRIORITIES.map(([p, label, desc]) => (
                    <div key={p} className="flex items-center justify-between rounded-lg p-1.5 hover:bg-secondary/60">
                      <div className="flex items-center gap-2.5 text-sm">
                        <PrioritySignalBars priority={p} showLabel />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* 10. NHÃN & TIẾN ĐỘ */}
          <Section
            id="nhan-nguoi-tien-do"
            title="Nhãn, Người & Tiến độ"
            note="Avatar ảnh hoặc chữ cái đầu (10px). Nhóm avatar tối đa 3 người rồi +N. Thanh tiến độ mảnh xám fill xanh #0058A0."
          >
            <div className="grid gap-8 sm:grid-cols-2 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Thẻ nhãn (Badges)</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Mặc định</Badge>
                    <Badge variant="secondary">Thứ cấp</Badge>
                    <Badge variant="outline">Đường viền</Badge>
                    <Badge variant="destructive">Quá hạn 2 ngày</Badge>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Avatar người dùng</div>
                  <div className="flex items-center gap-3">
                    <UserAvatar name="Đặng Nhật Huy" size="xs" title="xs: 16px" />
                    <UserAvatar name="Đặng Nhật Huy" size="sm" title="sm: 20px (bảng)" />
                    <UserAvatar name="Ngô Lê Minh Khuê" size="md" title="md: 24px (hoạt động)" />
                    <UserAvatar name="Nguyễn Ngọc Vinh" size="lg" title="lg: 32px (hồ sơ)" />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Thanh tiến độ (Progress)</div>
                  <div className="space-y-2 max-w-[320px]">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tiến độ thực hiện việc con</span>
                      <span className="tabular-nums font-mono font-medium text-foreground">60%</span>
                    </div>
                    <Progress value={60} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Thông báo trong trang (Inline Alerts)</div>
                <InlineAlert variant="error" actionLabel="Thử lại" onAction={() => {}}>
                  Chưa lưu được. Dữ liệu bạn vừa nhập vẫn được giữ an toàn trên trang.
                </InlineAlert>
                <InlineAlert variant="warning">Hạn kết thúc phải sau ngày bắt đầu nhiệm vụ.</InlineAlert>
                <InlineAlert variant="info">Hệ thống tự động lưu bản nháp sau 800ms ngừng gõ.</InlineAlert>
              </div>
            </div>
          </Section>

          {/* 11. CÁC TRẠNG THÁI HỆ THỐNG */}
          <Section
            id="cac-trang-thai"
            title="Trạng thái hệ thống"
            note="Khung xương tĩnh (skeleton), ô chỉ đọc, ô vô hiệu, nút đang xử lý (processing) và thông báo rỗng."
          >
            <div className="space-y-6">
              {/* Nút đang xử lý vs Thường */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-subtle space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Nút đang xử lý (Processing State)</h3>
                <p className="text-xs text-muted-foreground">
                  Giữ nguyên chiều rộng nút, đổi chữ sang dạng đang làm ('Đang nộp…'), có spinner quay nhẹ, khóa bấm.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <Button>Nộp kết quả</Button>
                  <Button disabled className="bg-primary/90 text-primary-foreground min-w-[124px]">
                    <RotateCw className="size-3.5 animate-spin" />
                    <span>Đang nộp…</span>
                  </Button>
                  <Button variant="secondary">Lưu bản nháp</Button>
                  <Button variant="secondary" disabled className="min-w-[120px]">
                    <RotateCw className="size-3.5 animate-spin" />
                    <span>Đang lưu…</span>
                  </Button>
                </div>
              </div>

              {/* Skeleton Loading State */}
              <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Khung xương tĩnh (Skeleton Loading)</h3>
                  <span className="text-xs text-muted-foreground">Xuất hiện từ giây thứ 1</span>
                </div>
                <div className="space-y-2 rounded-xl border border-border/30 bg-background/50 p-2">
                  {[1, 2, 3].map((row) => (
                    <div
                      key={row}
                      className="grid h-10 grid-cols-[16px_16px_56px_1fr_160px_28px_200px_64px] items-center gap-3 px-3 animate-pulse"
                    >
                      <div className="size-4 rounded bg-muted" />
                      <div className="size-4 rounded-full bg-muted" />
                      <div className="h-3 w-10 rounded bg-muted" />
                      <div className="h-3 rounded bg-muted" style={{ width: `${60 + row * 12}%` }} />
                      <div className="flex items-center gap-2">
                        <div className="size-5 rounded-full bg-muted" />
                        <div className="h-3 w-20 rounded bg-muted" />
                      </div>
                      <div className="h-3 w-5 rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                      <div className="h-3 w-12 rounded bg-muted ml-auto" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Read-only vs Disabled Comparison */}
              <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground">Ô chỉ đọc (Read-only)</h4>
                  <p className="text-xs text-muted-foreground">
                    Bỏ nền xám, dạng chữ thường, có thể chọn và sao chép.
                  </p>
                  <div className="rounded-lg border border-border/30 p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mã nhiệm vụ:</span>
                      <span className="font-mono font-medium select-all">NV-2026-09-0412</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ngày khởi tạo:</span>
                      <span className="tabular-nums font-medium select-all">25/09/2026</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground">Ô vô hiệu (Disabled)</h4>
                  <p className="text-xs text-muted-foreground">
                    Nền xám nhạt #F2F4F7, chữ mờ #9AA0A9, không click hay chọn được.
                  </p>
                  <div className="rounded-lg bg-secondary/80 p-3 space-y-2 text-xs text-muted-foreground/75 cursor-not-allowed">
                    <div className="flex justify-between">
                      <span>Phòng ban liên quan:</span>
                      <span>Chưa phân bổ</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quyền phê duyệt:</span>
                      <span>Bị khóa bởi phân quyền</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 12. STEPPER TIẾN TRÌNH */}
          <Section
            id="stepper"
            title="Quy trình tiến trình (Stepper)"
            note="Hiển thị các bước trong quy trình phê duyệt hoặc luồng soạn thảo. Hoàn thành (✓), đang làm (● xanh #0058A0), chưa làm (○ xám)."
          >
            <div className="space-y-8 rounded-2xl border border-border/40 bg-card p-6 shadow-subtle">
              {/* Stepper ngang */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Quy trình ngang (Horizontal Stepper)</h3>
                  <span className="text-xs text-muted-foreground">Bấm các bước để thử chuyển trạng thái</span>
                </div>
                <div className="flex items-center justify-between">
                  {[
                    { step: 1, title: "Khởi tạo việc" },
                    { step: 2, title: "Phân công & Hạn" },
                    { step: 3, title: "Đính kèm hồ sơ" },
                    { step: 4, title: "Hoàn tất & Giao" },
                  ].map((s, idx) => {
                    const isDone = s.step < activeStep;
                    const isActive = s.step === activeStep;
                    return (
                      <React.Fragment key={s.step}>
                        <m.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveStep(s.step)}
                          className="flex items-center gap-2 text-left group cursor-pointer"
                        >
                          {isDone ? (
                            <m.span
                              initial={{ scale: 0.8 }}
                              animate={{ scale: 1 }}
                              className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20"
                            >
                              <Check className="size-3.5 stroke-[2.5]" />
                            </m.span>
                          ) : isActive ? (
                            <m.span
                              layoutId="stepper-active-circle"
                              className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs shadow-xs"
                              transition={{ type: "spring", stiffness: 450, damping: 30 }}
                            >
                              {s.step}
                            </m.span>
                          ) : (
                            <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-muted-foreground font-medium text-xs transition-colors group-hover:bg-accent">
                              {s.step}
                            </span>
                          )}
                          <span
                            className={cn(
                              "text-xs transition-colors",
                              isActive
                                ? "font-semibold text-foreground"
                                : isDone
                                ? "text-muted-foreground"
                                : "text-muted-foreground/60"
                            )}
                          >
                            {s.title}
                          </span>
                        </m.button>
                        {idx < 3 ? (
                          <div className="relative h-[2px] flex-1 bg-border/40 mx-3 overflow-hidden rounded-full">
                            <m.div
                              className="absolute inset-y-0 left-0 bg-primary rounded-full"
                              initial={false}
                              animate={{ width: activeStep > s.step ? "100%" : "0%" }}
                              transition={{ duration: 0.25, ease: motionEase.enter }}
                            />
                          </div>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Stepper dọc (Wizard) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Quy trình dọc (Vertical Wizard Stepper)</h3>
                <div className="max-w-[280px] space-y-1 rounded-xl bg-secondary/40 p-4 border border-border/30">
                  <div className="flex items-center gap-3 py-1.5 text-xs text-muted-foreground">
                    <Check className="size-4 text-primary shrink-0 stroke-[2]" />
                    <span>Nội dung văn bản</span>
                  </div>
                  <div className="flex items-center gap-3 py-1.5 text-xs text-muted-foreground">
                    <Check className="size-4 text-primary shrink-0 stroke-[2]" />
                    <span>Người ký và nơi nhận</span>
                  </div>
                  <div className="flex items-center gap-3 py-1.5 text-xs font-semibold text-foreground">
                    <span className="size-2 rounded-full bg-primary ml-1 mr-1" />
                    <span>Xem lại trước khi gửi</span>
                  </div>
                  <div className="flex items-center gap-3 py-1.5 text-xs text-muted-foreground/50">
                    <span className="size-2 rounded-full bg-border ml-1 mr-1" />
                    <span>Trình ký số tự động</span>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 13. THAO TÁC HÀNG LOẠT */}
          <Section
            id="thao-tac-hang-loat"
            title="Thao tác hàng loạt"
            note="Thanh dock hành động nổi với elevation sâu, nút dạng viên thuốc (SaaS pill). Các dòng được chọn liền kề nhau gộp thành một khối xanh #E1EBF8 không có vạch kẻ chia."
          >
            <div className="space-y-6">
              {/* Floating Action Dock Demo */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Thanh hành động nổi dạng Dock (Floating Action Dock)</h3>
                  <span className="text-xs text-muted-foreground font-mono">h-12 (48px) · rounded-full · shadow-dialog · SaaS button pills</span>
                </div>
                <div className="flex items-center justify-center rounded-2xl border border-border/40 bg-secondary/25 py-8 px-4">
                  <div className="inline-flex h-12 items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 shadow-[0_16px_36px_-8px_rgba(26,29,35,0.22),0_4px_12px_-2px_rgba(26,29,35,0.08)] backdrop-blur-md">
                    <div className="flex items-center gap-2 pl-1 pr-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        2
                      </span>
                      <span className="text-xs font-semibold text-foreground whitespace-nowrap">Đã chọn</span>
                    </div>

                    <div className="h-4 w-[1px] bg-border/60 mx-1" />

                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary hover:bg-accent px-3.5 text-xs font-medium text-foreground transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      <Calendar className="size-3.5 text-muted-foreground" />
                      <span>Đổi hạn</span>
                    </button>

                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary hover:bg-accent px-3.5 text-xs font-medium text-foreground transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      <User className="size-3.5 text-muted-foreground" />
                      <span>Giao người</span>
                    </button>

                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary hover:bg-accent px-3.5 text-xs font-medium text-foreground transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      <Clock className="size-3.5 text-muted-foreground" />
                      <span>Trạng thái</span>
                    </button>

                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-destructive/10 hover:bg-destructive/15 text-destructive px-3.5 text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                      <span>Hủy việc</span>
                    </button>

                    <div className="h-4 w-[1px] bg-border/60 mx-1" />

                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                      title="Bỏ chọn"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Continuous Selection Block */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Selection gộp khối (Seamless Selected Rows)</h3>
                <p className="text-xs text-muted-foreground">
                  Hai dòng được chọn liền nhau nối lại thành một mảng nền #E1EBF8 duy nhất, bo 12px viền ngoài, không viền ngăn cách giữa các dòng.
                </p>

                <div className="rounded-xl border border-border/40 bg-card p-2 space-y-0.5">
                  <SampleRowItem
                    code="NV-131"
                    name="Tổng hợp báo cáo tuyển sinh tháng 9"
                    status="WAITING_APPROVAL"
                    priority="URGENT"
                    who="Nguyễn Ngọc Vinh"
                    due="28/09"
                    late
                  />
                  {/* Contiguous block of selected rows */}
                  <div className="my-0.5 rounded-xl bg-selected py-0.5">
                    <SampleRowItem
                      code="NV-133"
                      name="Chuẩn bị hội nghị cán bộ viên chức năm 2026"
                      status="IN_PROGRESS"
                      priority="HIGH"
                      who="Đặng Nhật Huy"
                      due="28/09"
                      late
                      selected
                    />
                    <SampleRowItem
                      code="NV-129"
                      name="Rà soát danh sách học sinh trúng tuyển đợt 2"
                      status="IN_PROGRESS"
                      priority="NORMAL"
                      who="Ngô Lê Minh Khuê"
                      due="02/10"
                      selected
                    />
                  </div>
                  <SampleRowItem
                    code="NV-130"
                    name="Soạn thảo kế hoạch kiểm tra cơ sở vật chất năm 2027"
                    status="NOT_STARTED"
                    priority="LOW"
                    who="Đặng Nhật Huy"
                    due="12/10"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* 14. NGĂN KÉO XEM NHANH (PEEK DRAWER) */}
          <Section
            id="peek-drawer"
            title="Ngăn kéo xem nhanh (Peek Drawer)"
            note="Panel trượt từ phải ra, chiều rộng 560px–640px (--subtask-peek-width). Hiển thị đầy đủ thông tin chi tiết việc con và thao tác nhanh mà không cần rời trang."
          >
            <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Bản xem trước Peek Drawer</h3>
                  <p className="text-xs text-muted-foreground">
                    Có thể mở drawer tương tác thực tế hoặc xem comp bên dưới.
                  </p>
                </div>
                <Button size="sm" onClick={() => setDrawerOpen(true)}>
                  <Maximize2 className="size-3.5" /> Mở Drawer Trượt Thật
                </Button>
              </div>

              {/* Inline mockup of Peek Drawer */}
              <div className="mx-auto max-w-[620px] rounded-2xl border border-border/60 bg-card p-6 shadow-card space-y-6">
                <div className="flex items-center justify-between border-b border-border/40 pb-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Việc con 1 trên 2</span>
                  <div className="flex items-center gap-3">
                    <button type="button" className="hover:text-foreground" title="Toàn trang">
                      <Maximize2 className="size-3.5" />
                    </button>
                    <button type="button" className="hover:text-foreground" title="Việc trước">
                      <MoveUp className="size-3.5" />
                    </button>
                    <button type="button" className="hover:text-foreground" title="Việc kế">
                      <MoveDown className="size-3.5" />
                    </button>
                    <button type="button" className="hover:text-foreground" title="Đóng">
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-semibold tracking-tight text-foreground">
                    Thu số liệu tuyển sinh các khoa phòng
                  </h4>
                </div>

                <div className="space-y-2 rounded-xl bg-secondary/40 p-3 text-xs">
                  <div className="grid grid-cols-[120px_1fr] items-center py-1">
                    <span className="text-muted-foreground">Tình trạng:</span>
                    <div className="flex items-center gap-2">
                      <TaskStatusCircle status="IN_PROGRESS" />
                      <span className="font-medium text-foreground">Đang thực hiện</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] items-center py-1">
                    <span className="text-muted-foreground">Phụ trách:</span>
                    <div className="flex items-center gap-2">
                      <UserAvatar name="Ngô Lê Minh Khuê" size="xs" />
                      <span className="font-medium text-foreground">Ngô Lê Minh Khuê</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] items-center py-1">
                    <span className="text-muted-foreground">Hạn chót:</span>
                    <span className="tabular-nums font-medium text-destructive">
                      27/09/2026 (trễ 2 ngày)
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] items-center py-1">
                    <span className="text-muted-foreground">Mức ưu tiên:</span>
                    <PrioritySignalBars priority="HIGH" showLabel />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">Nội dung chi tiết</div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    Thu số liệu tuyển sinh từ 6 phòng ban và khoa chuyên môn, đối chiếu với chỉ tiêu tuyển sinh 2026.
                    Phòng ban nào chưa nộp thì đôn đốc trực tiếp trước 17h00.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* 15. MẪU TRANG DANH SÁCH NHIỆM VỤ (T3List) */}
          <Section
            id="trang-danh-sach-nhiem-vu"
            title="Trang danh sách nhiệm vụ (T3List)"
            note="Dựng chính xác từ mẫu T3List: toolbar gọn cao 28px, ô tìm kiếm 280px có phím tắt '/', bảng grid chuẩn 16/16/56/1fr/160/28/200/64, phân nhóm Chờ duyệt / Đang thực hiện / Mới. Các nút thao tác dạng pill chuẩn SaaS."
          >
            <div className="space-y-6">
              {/* Page Title & Stats */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">Nhiệm vụ</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    11 nhiệm vụ · <span className="font-medium text-foreground">3 chờ duyệt</span> ·{" "}
                    <span className="font-medium text-destructive">2 quá hạn</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-full bg-primary hover:bg-primary-hover text-primary-foreground px-4 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Plus className="size-3.5 stroke-[2.5]" />
                    <span>Giao việc mới</span>
                  </button>
                </div>
              </div>

              {/* Canonical Toolbar (SaaS Pill Controls) */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border/40 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search box 280px pill */}
                  <div className="relative w-[280px]">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm nhiệm vụ…"
                      className="h-8 w-full pl-8.5 pr-8 text-xs rounded-full bg-secondary/80 focus:bg-background border border-transparent focus:border-border/60 transition-all outline-none"
                    />
                    <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-card px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground shadow-2xs">
                      /
                    </kbd>
                  </div>

                  {/* Filter Button Pill */}
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary hover:bg-accent px-3.5 text-xs font-medium text-foreground transition-all cursor-pointer"
                  >
                    <Filter className="size-3.5 text-muted-foreground" />
                    <span>Bộ lọc</span>
                    <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      1
                    </span>
                  </button>

                  {/* Filter Chip Pill */}
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium text-foreground border border-border/40">
                    <span>Thời gian: Tháng 10</span>
                    <button type="button" className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                </div>

                {/* View Switcher: Bảng | Kanban Segmented Pill */}
                <div className="relative inline-flex h-8 items-center rounded-full bg-secondary p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("table")}
                    className={cn(
                      "relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors cursor-pointer select-none",
                      activeTab === "table"
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {activeTab === "table" && (
                      <m.span
                        layoutId="active-view-tab"
                        className="absolute inset-0 rounded-full bg-card shadow-xs"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      />
                    )}
                    <TableIcon className="relative z-10 size-3.5" />
                    <span className="relative z-10">Bảng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("kanban")}
                    className={cn(
                      "relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors cursor-pointer select-none",
                      activeTab === "kanban"
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {activeTab === "kanban" && (
                      <m.span
                        layoutId="active-view-tab"
                        className="absolute inset-0 rounded-full bg-card shadow-xs"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      />
                    )}
                    <KanbanIcon className="relative z-10 size-3.5" />
                    <span className="relative z-10">Kanban</span>
                  </button>
                </div>
              </div>

              {/* Data Table / Kanban View with Presence Animation */}
              <AnimatePresence mode="wait">
                {activeTab === "table" ? (
                  <m.div
                    key="table-view"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: motionEase.enter }}
                    className="relative space-y-4"
                  >
                  {/* Table Header Row */}
                  <div className="grid h-8 grid-cols-[16px_16px_56px_1fr_160px_28px_200px_64px] items-center gap-3 px-3 text-xs font-medium text-muted-foreground border-b border-border/30">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedTaskCodes.length > 0 && selectedTaskCodes.length === 11}
                        indeterminate={selectedTaskCodes.length > 0 && selectedTaskCodes.length < 11}
                        onChange={selectAllTasks}
                        className="size-4 cursor-pointer"
                      />
                    </div>
                    <span className="sr-only">Trạng thái</span>
                    <span>Mã</span>
                    <span>Nhiệm vụ</span>
                    <span>Phụ trách</span>
                    <span title="Mức ưu tiên" className="text-center">ƯT</span>
                    <span>Đơn vị</span>
                    <span className="text-right">Hạn chót</span>
                  </div>

                  {/* Group 1: Chờ duyệt (3 việc) */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setGroupCollapse((p) => ({ ...p, waiting: !p.waiting }))}
                      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-xs font-semibold text-foreground hover:bg-secondary/50 transition-colors cursor-pointer select-none"
                    >
                      <m.span
                        animate={{ rotate: groupCollapse.waiting ? 0 : 90 }}
                        transition={{ duration: 0.16, ease: motionEase.enter }}
                        className="inline-flex shrink-0"
                      >
                        <ChevronRight className="size-3.5" />
                      </m.span>
                      <TaskStatusCircle status="WAITING_APPROVAL" />
                      <span>Chờ duyệt</span>
                      <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                        3
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {!groupCollapse.waiting && (
                        <m.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: motionEase.enter }}
                          className="overflow-hidden space-y-0.5 pl-2"
                        >
                          <SampleRowGrid
                            code="NV-131"
                            name="Tổng hợp báo cáo tuyển sinh và kế hoạch kinh phí tháng 9"
                            status="WAITING_APPROVAL"
                            priority="URGENT"
                            who="Đặng Nhật Huy"
                            dept="Phòng Đào tạo"
                            due="28/09"
                            late
                            selected={selectedTaskCodes.includes("NV-131")}
                            onToggleSelect={() => toggleTask("NV-131")}
                          />
                          <SampleRowGrid
                            code="NV-132"
                            name="Dự thảo đề án chuyển đổi số công tác hành chính giai đoạn 2026-2030"
                            status="WAITING_APPROVAL"
                            priority="HIGH"
                            who="Nguyễn Ngọc Vinh"
                            dept="Phòng CNTT & ĐBCL"
                            due="30/09"
                            selected={selectedTaskCodes.includes("NV-132")}
                            onToggleSelect={() => toggleTask("NV-132")}
                          />
                          <SampleRowGrid
                            code="NV-135"
                            name="Kế hoạch nâng cấp trang thiết bị phòng thực hành cơ điện tử"
                            status="WAITING_APPROVAL"
                            priority="NORMAL"
                            who="Trần Văn An"
                            dept="Khoa Cơ khí"
                            due="05/10"
                            selected={selectedTaskCodes.includes("NV-135")}
                            onToggleSelect={() => toggleTask("NV-135")}
                          />
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Group 2: Đang thực hiện (5 việc, gồm selection gộp khối) */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setGroupCollapse((p) => ({ ...p, doing: !p.doing }))}
                      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-xs font-semibold text-foreground hover:bg-secondary/50 transition-colors cursor-pointer select-none"
                    >
                      <m.span
                        animate={{ rotate: groupCollapse.doing ? 0 : 90 }}
                        transition={{ duration: 0.16, ease: motionEase.enter }}
                        className="inline-flex shrink-0"
                      >
                        <ChevronRight className="size-3.5" />
                      </m.span>
                      <TaskStatusCircle status="IN_PROGRESS" />
                      <span>Đang thực hiện</span>
                      <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                        5
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {!groupCollapse.doing && (
                        <m.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: motionEase.enter }}
                          className="overflow-hidden space-y-0.5 pl-2"
                        >
                          {/* If both NV-133 and NV-129 are selected, wrap them into a continuous block */}
                          {selectedTaskCodes.includes("NV-133") && selectedTaskCodes.includes("NV-129") ? (
                            <m.div layout className="rounded-xl bg-selected py-0.5 transition-colors">
                              <SampleRowGrid
                                code="NV-133"
                                name="Chuẩn bị tài liệu hội nghị cán bộ viên chức và người lao động năm học 2026"
                                status="IN_PROGRESS"
                                priority="HIGH"
                                who="Đặng Nhật Huy"
                                dept="Phòng Tổ chức - Hành chính"
                                due="28/09"
                                late
                                selected={true}
                                onToggleSelect={() => toggleTask("NV-133")}
                              />
                              <SampleRowGrid
                                code="NV-129"
                                name="Rà soát hồ sơ xét tuyển học bạ đợt 2 theo đề án tuyển sinh"
                                status="IN_PROGRESS"
                                priority="NORMAL"
                                who="Ngô Lê Minh Khuê"
                                dept="Phòng Đào tạo"
                                due="02/10"
                                selected={true}
                                onToggleSelect={() => toggleTask("NV-129")}
                              />
                            </m.div>
                          ) : (
                            <>
                              <SampleRowGrid
                                code="NV-133"
                                name="Chuẩn bị tài liệu hội nghị cán bộ viên chức và người lao động năm học 2026"
                                status="IN_PROGRESS"
                                priority="HIGH"
                                who="Đặng Nhật Huy"
                                dept="Phòng Tổ chức - Hành chính"
                                due="28/09"
                                late
                                selected={selectedTaskCodes.includes("NV-133")}
                                onToggleSelect={() => toggleTask("NV-133")}
                              />
                              <SampleRowGrid
                                code="NV-129"
                                name="Rà soát hồ sơ xét tuyển học bạ đợt 2 theo đề án tuyển sinh"
                                status="IN_PROGRESS"
                                priority="NORMAL"
                                who="Ngô Lê Minh Khuê"
                                dept="Phòng Đào tạo"
                                due="02/10"
                                selected={selectedTaskCodes.includes("NV-129")}
                                onToggleSelect={() => toggleTask("NV-129")}
                              />
                            </>
                          )}

                          <SampleRowGrid
                            code="NV-134"
                            name="Cập nhật quy chế đào tạo và chuẩn đầu ra ngành Công nghệ Kỹ thuật Điện"
                            subtaskCount="1/3"
                            status="IN_PROGRESS"
                            priority="HIGH"
                            who="Ngô Lê Minh Khuê"
                            dept="Phòng Đào tạo"
                            due="03/10"
                            selected={selectedTaskCodes.includes("NV-134")}
                            onToggleSelect={() => toggleTask("NV-134")}
                          />
                          <SampleRowGrid
                            code="NV-136"
                            name="Kiểm tra an toàn lao động và vận hành máy công cụ tại Xưởng Cơ khí"
                            status="IN_PROGRESS"
                            priority="NORMAL"
                            who="Nguyễn Văn Bình"
                            dept="Khoa Cơ khí"
                            due="06/10"
                            selected={selectedTaskCodes.includes("NV-136")}
                            onToggleSelect={() => toggleTask("NV-136")}
                          />
                          <SampleRowGrid
                            code="NV-137"
                            name="Lập dự toán mua sắm vật tư tiêu hao kỳ thực tập tốt nghiệp năm 2026"
                            status="IN_PROGRESS"
                            priority="LOW"
                            who="Lê Thị Mai"
                            dept="Phòng Kế hoạch - Tài chính"
                            due="15/10"
                            selected={selectedTaskCodes.includes("NV-137")}
                            onToggleSelect={() => toggleTask("NV-137")}
                          />
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Group 3: Mới (3 việc) */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setGroupCollapse((p) => ({ ...p, new: !p.new }))}
                      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-xs font-semibold text-foreground hover:bg-secondary/50 transition-colors cursor-pointer select-none"
                    >
                      <m.span
                        animate={{ rotate: groupCollapse.new ? 0 : 90 }}
                        transition={{ duration: 0.16, ease: motionEase.enter }}
                        className="inline-flex shrink-0"
                      >
                        <ChevronRight className="size-3.5" />
                      </m.span>
                      <TaskStatusCircle status="NOT_STARTED" />
                      <span>Mới</span>
                      <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                        3
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {!groupCollapse.new && (
                        <m.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: motionEase.enter }}
                          className="overflow-hidden space-y-0.5 pl-2"
                        >
                          <SampleRowGrid
                            code="NV-130"
                            name="Soạn thảo kế hoạch tư vấn tuyển sinh và hướng nghiệp các trường THPT"
                            status="NOT_STARTED"
                            priority="LOW"
                            who="Đặng Nhật Huy"
                            dept="Phòng Tuyển sinh & Truyền thông"
                            due="12/10"
                            selected={selectedTaskCodes.includes("NV-130")}
                            onToggleSelect={() => toggleTask("NV-130")}
                          />
                          <SampleRowGrid
                            code="NV-138"
                            name="Cập nhật danh bạ điện tử cán bộ giảng viên và đơn vị trực thuộc"
                            status="NOT_STARTED"
                            priority="NORMAL"
                            who="Hoàng Minh Tuấn"
                            dept="Văn phòng Trường"
                            due="20/10"
                            selected={selectedTaskCodes.includes("NV-138")}
                            onToggleSelect={() => toggleTask("NV-138")}
                          />
                          <SampleRowGrid
                            code="NV-139"
                            name="Thống kê hiện trạng giảng đường, phòng thí nghiệm chuẩn bị năm học mới"
                            status="NOT_STARTED"
                            priority="LOW"
                            who="Vũ Thị Hạnh"
                            dept="Phòng Quản trị Thiết bị"
                            due="25/10"
                            selected={selectedTaskCodes.includes("NV-139")}
                            onToggleSelect={() => toggleTask("NV-139")}
                          />
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Floating Action Dock anchored at bottom of task list when tasks are selected */}
                  <AnimatePresence>
                    {selectedTaskCodes.length > 0 && (
                      <m.div
                        initial={{ opacity: 0, y: 24, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.95 }}
                        transition={motionSpring.snappy}
                        className="sticky bottom-6 z-30 flex justify-center pointer-events-none"
                      >
                        <div className="pointer-events-auto inline-flex h-12 items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 shadow-[0_16px_40px_-8px_rgba(26,29,35,0.25),0_4px_16px_-2px_rgba(26,29,35,0.1)] backdrop-blur-md">
                          <div className="flex items-center gap-2 pl-1 pr-2">
                            <m.span
                              key={selectedTaskCodes.length}
                              initial={{ scale: 0.75, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 24 }}
                              className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
                            >
                              {selectedTaskCodes.length}
                            </m.span>
                            <span className="text-xs font-semibold text-foreground whitespace-nowrap">Đã chọn</span>
                          </div>

                          <div className="h-4 w-[1px] bg-border/60 mx-1" />

                          <m.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary hover:bg-accent px-3.5 text-xs font-medium text-foreground transition-colors cursor-pointer"
                          >
                            <Calendar className="size-3.5 text-muted-foreground" />
                            <span>Đổi hạn</span>
                          </m.button>

                          <m.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary hover:bg-accent px-3.5 text-xs font-medium text-foreground transition-colors cursor-pointer"
                          >
                            <User className="size-3.5 text-muted-foreground" />
                            <span>Giao người</span>
                          </m.button>

                          <m.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary hover:bg-accent px-3.5 text-xs font-medium text-foreground transition-colors cursor-pointer"
                          >
                            <Clock className="size-3.5 text-muted-foreground" />
                            <span>Trạng thái</span>
                          </m.button>

                          <m.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-destructive/10 hover:bg-destructive/15 text-destructive px-3.5 text-xs font-medium transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                            <span>Hủy việc</span>
                          </m.button>

                          <div className="h-4 w-[1px] bg-border/60 mx-1" />

                          <m.button
                            type="button"
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={deselectAllTasks}
                            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                            title="Bỏ chọn tất cả"
                          >
                            <X className="size-4" />
                          </m.button>
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                  </m.div>
                ) : (
                  /* Kanban View Demo */
                  <m.div
                    key="kanban-view"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: motionEase.enter }}
                    className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                  >
                    <div className="rounded-xl bg-secondary/40 p-3 space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
                        <span className="flex items-center gap-1.5">
                          <TaskStatusCircle status="WAITING_APPROVAL" /> Chờ duyệt
                        </span>
                        <span className="rounded bg-muted px-1.5 text-[10px]">3</span>
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-lg bg-card p-3 shadow-xs border border-border/40 space-y-2">
                          <div className="text-xs font-medium text-foreground">Tổng hợp báo cáo tuyển sinh</div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <UserAvatar name="Đặng Nhật Huy" size="xs" />
                            <span className="text-destructive font-medium">28/09 (Quá hạn)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-secondary/40 p-3 space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
                        <span className="flex items-center gap-1.5">
                          <TaskStatusCircle status="IN_PROGRESS" /> Đang thực hiện
                        </span>
                        <span className="rounded bg-muted px-1.5 text-[10px]">5</span>
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-lg bg-card p-3 shadow-xs border border-border/40 space-y-2">
                          <div className="text-xs font-medium text-foreground">Chuẩn bị tài liệu hội nghị cán bộ</div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <UserAvatar name="Đặng Nhật Huy" size="xs" />
                            <span className="text-destructive font-medium">28/09 (Quá hạn)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-secondary/40 p-3 space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
                        <span className="flex items-center gap-1.5">
                          <TaskStatusCircle status="NOT_STARTED" /> Mới
                        </span>
                        <span className="rounded bg-muted px-1.5 text-[10px]">3</span>
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-lg bg-card p-3 shadow-xs border border-border/40 space-y-2">
                          <div className="text-xs font-medium text-foreground">Soạn kế hoạch tuyển sinh</div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <UserAvatar name="Đặng Nhật Huy" size="xs" />
                            <span>12/10</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </Section>
        </main>
      </div>

      {/* Slide-out Peek Drawer (Interactive Demo) */}
      <DrawerRoot open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerPortal>
          <DrawerOverlay />
          <DrawerContent className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[600px] flex-col border-l border-border/40 bg-card p-6 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/40 pb-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Việc con 1 trên 2</span>
              <div className="flex items-center gap-3">
                <button type="button" className="hover:text-foreground" title="Toàn trang">
                  <Maximize2 className="size-3.5" />
                </button>
                <button type="button" className="hover:text-foreground" title="Việc trước">
                  <MoveUp className="size-3.5" />
                </button>
                <button type="button" className="hover:text-foreground" title="Việc kế">
                  <MoveDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded p-1 hover:bg-accent text-foreground"
                  title="Đóng (Esc)"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                  Thu số liệu các phòng ban
                </h3>
                <span className="text-xs text-muted-foreground mt-1 inline-block font-mono">
                  Mã: VC-2026-09-001
                </span>
              </div>

              {/* Properties Grid */}
              <div className="space-y-2 rounded-xl bg-secondary/50 p-4 text-xs">
                <div className="grid grid-cols-[120px_1fr] items-center py-1">
                  <span className="text-muted-foreground">Tình trạng:</span>
                  <div className="flex items-center gap-2">
                    <TaskStatusCircle status="IN_PROGRESS" />
                    <span className="font-medium text-foreground">Đang thực hiện</span>
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center py-1">
                  <span className="text-muted-foreground">Phụ trách:</span>
                  <div className="flex items-center gap-2">
                    <UserAvatar name="Ngô Lê Minh Khuê" size="xs" />
                    <span className="font-medium text-foreground">Ngô Lê Minh Khuê</span>
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center py-1">
                  <span className="text-muted-foreground">Hạn chót:</span>
                  <span className="tabular-nums font-medium text-destructive">
                    27/09/2026 (trễ 2 ngày)
                  </span>
                </div>
                <div className="grid grid-cols-[120px_1fr] items-center py-1">
                  <span className="text-muted-foreground">Mức ưu tiên:</span>
                  <PrioritySignalBars priority="HIGH" showLabel />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground">Ghi chú & Chỉ đạo</div>
                <p className="text-sm leading-relaxed text-foreground/90">
                  Thu số liệu tuyển sinh từ 6 phòng ban, đối chiếu với chỉ tiêu tuyển sinh trường giao. Phòng ban nào
                  chưa gửi thì nhắc trực tiếp qua Zalo hoặc điện thoại trước 17h00 hôm nay.
                </p>
              </div>

              <div className="border-t border-border/40 pt-4 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
                  Đóng
                </Button>
                <Button size="sm">Cập nhật tiến độ</Button>
              </div>
            </div>
          </DrawerContent>
        </DrawerPortal>
      </DrawerRoot>
    </div>
  );
}

// ============================================================================
// Sample Row Helpers
// ============================================================================

function SampleRowItem({
  code,
  name,
  status,
  priority,
  who,
  due,
  late,
  selected,
}: {
  code: string;
  name: string;
  status: string;
  priority: string;
  who: string;
  due: string;
  late?: boolean;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid h-10 grid-cols-[16px_16px_56px_minmax(0,1fr)_28px_180px_56px] items-center gap-3 px-3 text-sm transition-colors",
        selected ? "font-medium" : "hover:bg-accent/60 rounded-lg"
      )}
    >
      {selected ? <Checkbox checked readOnly className="size-4" /> : <span />}
      <TaskStatusCircle status={status} />
      <span className="text-xs tabular-nums text-muted-foreground font-mono">{code}</span>
      <span className="truncate">{name}</span>
      <PrioritySignalBars priority={priority} />
      <span className="flex items-center gap-2 truncate text-foreground/80 text-xs">
        <UserAvatar name={who} size="xs" />
        <span className="truncate">{who}</span>
      </span>
      <span className={cn("text-right tabular-nums text-xs", late ? "text-destructive font-medium" : "text-muted-foreground")}>
        {due}
      </span>
    </div>
  );
}

function SampleRowGrid({
  code,
  name,
  subtaskCount,
  status,
  priority,
  who,
  dept,
  due,
  late,
  selected,
  onToggleSelect,
}: {
  code: string;
  name: string;
  subtaskCount?: string;
  status: string;
  priority: string;
  who: string;
  dept: string;
  due: string;
  late?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  return (
    <div
      onClick={onToggleSelect}
      className={cn(
        "grid h-10 grid-cols-[16px_16px_56px_1fr_160px_28px_200px_64px] items-center gap-3 px-3 text-xs transition-colors cursor-pointer select-none",
        selected ? "font-medium" : "hover:bg-secondary/70 rounded-lg"
      )}
    >
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onChange={onToggleSelect}
          className="size-4 cursor-pointer"
        />
      </div>
      <TaskStatusCircle status={status} />
      <span className="tabular-nums font-mono text-muted-foreground text-[11px]">{code}</span>
      <div className="flex items-center gap-2 truncate">
        <span className={cn("truncate text-foreground", selected ? "font-semibold" : "font-normal")}>
          {name}
        </span>
        {subtaskCount ? (
          <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground shrink-0">
            {subtaskCount}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 truncate">
        <UserAvatar name={who} size="xs" />
        <span className="truncate text-foreground/90">{who}</span>
      </div>
      <div className="flex items-center justify-center">
        <PrioritySignalBars priority={priority} />
      </div>
      <span className="truncate text-muted-foreground">{dept}</span>
      <span
        className={cn(
          "text-right tabular-nums",
          late ? "text-destructive font-semibold" : "text-muted-foreground"
        )}
      >
        {due}
      </span>
    </div>
  );
}
