import type { UserRole } from "@/types/auth";

// Global CSS owns the palette; JS consumers resolve the same semantic tokens.
const LIGHT_COLORS = {
  appBg: "var(--background)",
  cardBg: "var(--card)",
  sidebarBg: "var(--sidebar)",
  controlBg: "var(--secondary)",
  hoverBg: "var(--accent)",
  selectedBg: "var(--selected)",
  border: "var(--border)",
  borderHover: "var(--selected)",
  textPrimary: "var(--foreground)",
  textSecondary: "var(--muted-foreground)",
  textMuted: "var(--muted-foreground)",
  accentPrimary: "var(--primary)",
  accentForeground: "var(--primary-foreground)",
  primary: "var(--primary)",
  primaryHex: "#25282F",
  action: "var(--primary)",
  actionHover: "var(--primary-hover)",
  onAction: "var(--on-action)",
  danger: "var(--destructive)",
  dangerBg: "var(--danger-soft)",
  brand: "var(--brand)",
  brandAccent: "var(--brand-accent)",
  iconAccent: "var(--icon-accent)",
  overlay: "var(--overlay)",
} as const;

export const QCET_TOKENS = {
  colors: {
    light: LIGHT_COLORS,
    dark: LIGHT_COLORS,
  },
  statusColors: {
    inProgress: {
      name: "Sapphire Blue",
      classes: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      bg: "bg-blue-500/10",
      text: "text-blue-600",
      border: "border-blue-500/20",
      label: "Đang thực hiện",
      hex: "#2563EB",
      oklch: "oklch(0.42 0.18 250)",
    },
    completed: {
      name: "Emerald Green",
      classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
      bg: "bg-emerald-500/10",
      text: "text-emerald-700",
      border: "border-emerald-500/20",
      label: "Hoàn thành",
      hex: "#10B981",
      oklch: "oklch(0.68 0.17 150)",
    },
    overdue: {
      name: "Crimson Rose",
      classes: "bg-rose-500/10 text-rose-600 border-rose-500/20",
      bg: "bg-rose-500/10",
      text: "text-rose-600",
      border: "border-rose-500/20",
      label: "Trễ hạn",
      hex: "#F43F5E",
      oklch: "oklch(0.63 0.22 25)",
    },
    needsReview: {
      name: "Warm Amber",
      classes: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      bg: "bg-amber-500/10",
      text: "text-amber-700",
      border: "border-amber-500/20",
      label: "Cần chỉnh sửa",
      hex: "#F59E0B",
      oklch: "oklch(0.74 0.17 75)",
    },
    new: {
      name: "Purple Violet",
      classes: "bg-violet-500/10 text-violet-600 border-violet-500/20",
      bg: "bg-violet-500/10",
      text: "text-violet-600",
      border: "border-violet-500/20",
      label: "Mới tiếp nhận",
      hex: "#8B5CF6",
      oklch: "oklch(0.65 0.20 300)",
    },
  },
  radius: {
    card: "1rem",       // 16px (rounded-xl)
    control: "0.75rem", // 12px (rounded-lg)
    sm: "0.5rem",       // 8px
    full: "9999px",
  },
  shadows: {
    card: "shadow-none",
    cardHover: "shadow-none",
    premium: "shadow-none",
    glowPrimary: "shadow-none",
  },
  typography: {
    fontSans: "var(--font-sans), 'Be Vietnam Pro', system-ui, sans-serif",
    fontHeading: "var(--font-heading), var(--font-sans), 'Be Vietnam Pro', system-ui, sans-serif",
    fontMono: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
} as const;

export const qcetTokens = QCET_TOKENS;

// Backward-compatible alias
const LIGHT_DESIGN_TOKENS = {
  background: QCET_TOKENS.colors.light.appBg,
  foreground: QCET_TOKENS.colors.light.textPrimary,
  primary: QCET_TOKENS.colors.light.accentPrimary,
  primaryForeground: QCET_TOKENS.colors.light.accentForeground,
  secondary: QCET_TOKENS.colors.light.controlBg,
  secondaryForeground: QCET_TOKENS.colors.light.textPrimary,
  muted: QCET_TOKENS.colors.light.controlBg,
  mutedForeground: QCET_TOKENS.colors.light.textSecondary,
  accent: QCET_TOKENS.colors.light.hoverBg,
  accentForeground: QCET_TOKENS.colors.light.textPrimary,
  card: QCET_TOKENS.colors.light.cardBg,
  cardForeground: QCET_TOKENS.colors.light.textPrimary,
  border: QCET_TOKENS.colors.light.border,
  input: QCET_TOKENS.colors.light.border,
  ring: "var(--ring)",
  destructive: "var(--destructive)",
} as const;

export const DESIGN_TOKENS = {
  light: LIGHT_DESIGN_TOKENS,
  dark: LIGHT_DESIGN_TOKENS,
  radius: QCET_TOKENS.radius.card,
  fonts: {
    sans: QCET_TOKENS.typography.fontSans,
    display: QCET_TOKENS.typography.fontSans,
    mono: QCET_TOKENS.typography.fontMono,
  },
} as const;

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
  allowedRoles?: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Quản lý công việc", icon: "CheckSquare" },
  { href: "/dashboard", label: "Báo cáo KPI", icon: "LayoutDashboard" },
  { href: "/org", label: "Cơ cấu & Danh bạ", icon: "Network" },
  { href: "/notifications", label: "Thông báo", icon: "Bell" },
];
