export const twentyTokens = {
  colors: {
    light: {
      appBg: "#FBFBFB",
      cardBg: "#FFFFFF",
      sidebarBg: "#FAFAFA",
      hoverBg: "#F4F4F5",
      border: "#E4E4E7",
      borderHover: "#D4D4D8",
      textPrimary: "#09090B",
      textSecondary: "#52525B",
      textMuted: "#A1A1AA",
      accentPrimary: "#18181B",
      accentForeground: "#FFFFFF",
    },
    dark: {
      appBg: "#0B0C0E",
      cardBg: "#16181D",
      sidebarBg: "#111215",
      hoverBg: "#22252B",
      border: "#27272A",
      borderHover: "#3F3F46",
      textPrimary: "#F4F4F5",
      textSecondary: "#A1A1AA",
      textMuted: "#71717A",
      accentPrimary: "#FFFFFF",
      accentForeground: "#09090B",
    },
  },
  statusColors: {
    completed: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", label: "Hoàn thành 👍" },
    inProgress: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", label: "Đang thực hiện 🔨" },
    needsReview: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", label: "Cần chỉnh sửa ⚠️" },
    new: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", label: "Mới 🆕" },
  },
  radius: {
    card: "0.5rem",     // 8px
    control: "0.375rem", // 6px
    full: "9999px",
  },
  typography: {
    fontSans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
  },
} as const;

// Backward-compatible alias
export const DESIGN_TOKENS = {
  light: {
    background: twentyTokens.colors.light.appBg,
    foreground: twentyTokens.colors.light.textPrimary,
    primary: twentyTokens.colors.light.accentPrimary,
    primaryForeground: twentyTokens.colors.light.accentForeground,
    secondary: twentyTokens.colors.light.hoverBg,
    secondaryForeground: twentyTokens.colors.light.textPrimary,
    muted: twentyTokens.colors.light.hoverBg,
    mutedForeground: twentyTokens.colors.light.textSecondary,
    accent: twentyTokens.colors.light.hoverBg,
    accentForeground: twentyTokens.colors.light.textPrimary,
    card: twentyTokens.colors.light.cardBg,
    cardForeground: twentyTokens.colors.light.textPrimary,
    border: twentyTokens.colors.light.border,
    input: twentyTokens.colors.light.border,
    ring: twentyTokens.colors.light.accentPrimary,
    destructive: "#DC2626",
  },
  dark: {
    background: twentyTokens.colors.dark.appBg,
    foreground: twentyTokens.colors.dark.textPrimary,
    primary: twentyTokens.colors.dark.accentPrimary,
    primaryForeground: twentyTokens.colors.dark.accentForeground,
    secondary: twentyTokens.colors.dark.hoverBg,
    secondaryForeground: twentyTokens.colors.dark.textPrimary,
    muted: twentyTokens.colors.dark.hoverBg,
    mutedForeground: twentyTokens.colors.dark.textSecondary,
    accent: twentyTokens.colors.dark.hoverBg,
    accentForeground: twentyTokens.colors.dark.textPrimary,
    card: twentyTokens.colors.dark.cardBg,
    cardForeground: twentyTokens.colors.dark.textPrimary,
    border: twentyTokens.colors.dark.border,
    input: twentyTokens.colors.dark.border,
    ring: twentyTokens.colors.dark.accentPrimary,
    destructive: "#EF4444",
  },
  radius: twentyTokens.radius.card,
  fonts: {
    sans: twentyTokens.typography.fontSans,
    display: twentyTokens.typography.fontSans,
    mono: twentyTokens.typography.fontMono,
  },
} as const;

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/tasks", label: "Nhiệm vụ cấp Trường", icon: "CheckSquare" },
  { href: "/unit-tasks", label: "Công việc Đơn vị", icon: "Briefcase" },
  { href: "/calendar", label: "Lịch công tác", icon: "Calendar" },
  { href: "/org", label: "Cơ cấu tổ chức", icon: "Network" },
];
