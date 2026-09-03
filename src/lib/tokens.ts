export const DESIGN_TOKENS = {
  light: {
    background: "#F9F8F6",
    foreground: "#141312",
    primary: "#E05D38",
    primaryForeground: "#FFFFFF",
    secondary: "#F2EFEB",
    secondaryForeground: "#141312",
    muted: "#F2EFEB",
    mutedForeground: "#6E6862",
    accent: "#F2EFEB",
    accentForeground: "#141312",
    card: "#FFFFFF",
    cardForeground: "#141312",
    border: "#E8E4DC",
    input: "#E8E4DC",
    ring: "#E05D38",
    destructive: "#D93829",
  },
  dark: {
    background: "#0E0D0C",
    foreground: "#F5F3EF",
    primary: "#E56A47",
    primaryForeground: "#FFFFFF",
    secondary: "#22201D",
    secondaryForeground: "#F5F3EF",
    muted: "#22201D",
    mutedForeground: "#9E968D",
    accent: "#22201D",
    accentForeground: "#F5F3EF",
    card: "#171614",
    cardForeground: "#F5F3EF",
    border: "#2B2824",
    input: "#2B2824",
    ring: "#E56A47",
    destructive: "#E04E3E",
  },
  radius: "0.875rem",
  fonts: {
    sans: '"Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    display: '"Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"JetBrains Mono", "SFMono-Regular", Consolas, Menlo, monospace',
  },
} as const;

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Trang chủ", icon: "LayoutDashboard" },
  { href: "/tasks", label: "Công việc", icon: "CheckSquare" },
  { href: "/calendar", label: "Lịch biểu", icon: "Calendar" },
  { href: "/org", label: "Cơ cấu tổ chức", icon: "Network" },
  { href: "/notifications", label: "Thông báo", icon: "Bell" },
];
