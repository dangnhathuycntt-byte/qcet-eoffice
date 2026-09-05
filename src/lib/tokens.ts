export const QCET_TOKENS = {
  colors: {
    light: {
      appBg: "oklch(0.985 0.003 250)",
      cardBg: "oklch(1 0 0)",
      sidebarBg: "oklch(0.985 0 0)",
      hoverBg: "oklch(0.965 0.005 250)",
      border: "oklch(0.915 0.006 250)",
      borderHover: "oklch(0.85 0.01 250)",
      textPrimary: "oklch(0.145 0.015 250)",
      textSecondary: "oklch(0.48 0.015 250)",
      textMuted: "oklch(0.65 0.015 250)",
      accentPrimary: "#2563EB",
      accentForeground: "oklch(0.985 0 0)",
      primary: "oklch(0.42 0.18 250)",
      primaryHex: "#2563EB",
    },
    dark: {
      appBg: "oklch(0.12 0.018 250)",
      cardBg: "oklch(0.16 0.018 250)",
      sidebarBg: "oklch(0.15 0.015 250)",
      hoverBg: "oklch(0.20 0.015 250)",
      border: "oklch(0.24 0.015 250)",
      borderHover: "oklch(0.32 0.015 250)",
      textPrimary: "oklch(0.98 0.003 250)",
      textSecondary: "oklch(0.65 0.015 250)",
      textMuted: "oklch(0.50 0.015 250)",
      accentPrimary: "oklch(0.70 0.18 250)",
      accentForeground: "oklch(0.12 0.02 250)",
      primary: "oklch(0.70 0.18 250)",
      primaryHex: "#60A5FA",
    },
  },
  statusColors: {
    inProgress: {
      name: "Sapphire Blue",
      classes: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-500/20",
      label: "Đang thực hiện",
      hex: "#2563EB",
      oklch: "oklch(0.42 0.18 250)",
    },
    completed: {
      name: "Emerald Green",
      classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/20",
      label: "Hoàn thành",
      hex: "#10B981",
      oklch: "oklch(0.68 0.17 150)",
    },
    overdue: {
      name: "Crimson Rose",
      classes: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      bg: "bg-rose-500/10",
      text: "text-rose-600 dark:text-rose-400",
      border: "border-rose-500/20",
      label: "Quá hạn",
      hex: "#F43F5E",
      oklch: "oklch(0.63 0.22 25)",
    },
    needsReview: {
      name: "Warm Amber",
      classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/20",
      label: "Cần chỉnh sửa",
      hex: "#F59E0B",
      oklch: "oklch(0.74 0.17 75)",
    },
    new: {
      name: "Purple Violet",
      classes: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      bg: "bg-violet-500/10",
      text: "text-violet-600 dark:text-violet-400",
      border: "border-violet-500/20",
      label: "Mới tiếp nhận",
      hex: "#8B5CF6",
      oklch: "oklch(0.65 0.20 300)",
    },
  },
  radius: {
    card: "0.75rem",    // 12px (rounded-xl)
    control: "0.5rem",  // 8px (rounded-lg)
    sm: "0.375rem",     // 6px
    full: "9999px",
  },
  shadows: {
    card: "shadow-card",
    cardHover: "shadow-card-hover",
    premium: "shadow-premium",
    glowPrimary: "shadow-glow-primary",
  },
  typography: {
    fontSans: "var(--font-sans), 'Plus Jakarta Sans', system-ui, sans-serif",
    fontMono: "var(--font-mono), 'JetBrains Mono', monospace",
  },
} as const;

// Alias for convenience
export const qcetTokens = QCET_TOKENS;
export const twentyTokens = QCET_TOKENS;

// Backward-compatible alias
export const DESIGN_TOKENS = {
  light: {
    background: QCET_TOKENS.colors.light.appBg,
    foreground: QCET_TOKENS.colors.light.textPrimary,
    primary: QCET_TOKENS.colors.light.accentPrimary,
    primaryForeground: QCET_TOKENS.colors.light.accentForeground,
    secondary: QCET_TOKENS.colors.light.hoverBg,
    secondaryForeground: QCET_TOKENS.colors.light.textPrimary,
    muted: QCET_TOKENS.colors.light.hoverBg,
    mutedForeground: QCET_TOKENS.colors.light.textSecondary,
    accent: QCET_TOKENS.colors.light.hoverBg,
    accentForeground: QCET_TOKENS.colors.light.textPrimary,
    card: QCET_TOKENS.colors.light.cardBg,
    cardForeground: QCET_TOKENS.colors.light.textPrimary,
    border: QCET_TOKENS.colors.light.border,
    input: QCET_TOKENS.colors.light.border,
    ring: QCET_TOKENS.colors.light.accentPrimary,
    destructive: "oklch(0.577 0.245 27.325)",
  },
  dark: {
    background: QCET_TOKENS.colors.dark.appBg,
    foreground: QCET_TOKENS.colors.dark.textPrimary,
    primary: QCET_TOKENS.colors.dark.accentPrimary,
    primaryForeground: QCET_TOKENS.colors.dark.accentForeground,
    secondary: QCET_TOKENS.colors.dark.hoverBg,
    secondaryForeground: QCET_TOKENS.colors.dark.textPrimary,
    muted: QCET_TOKENS.colors.dark.hoverBg,
    mutedForeground: QCET_TOKENS.colors.dark.textSecondary,
    accent: QCET_TOKENS.colors.dark.hoverBg,
    accentForeground: QCET_TOKENS.colors.dark.textPrimary,
    card: QCET_TOKENS.colors.dark.cardBg,
    cardForeground: QCET_TOKENS.colors.dark.textPrimary,
    border: QCET_TOKENS.colors.dark.border,
    input: QCET_TOKENS.colors.dark.border,
    ring: QCET_TOKENS.colors.dark.accentPrimary,
    destructive: "oklch(0.65 0.22 25)",
  },
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
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Quản lý công việc", icon: "CheckSquare" },
  { href: "/dashboard", label: "Báo cáo KPI", icon: "LayoutDashboard" },
  { href: "/org", label: "Cơ cấu & Danh bạ", icon: "Network" },
  { href: "/notifications", label: "Thông báo", icon: "Bell" },
];
