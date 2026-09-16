import {
  LayoutDashboard,
  Calendar,
  Bell,
  Inbox,
  CheckSquare,
  FileText,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/auth";

export interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  aliases?: string[];
  allowedRoles?: UserRole[];
  badgeKey?: string;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: "inbox",
    label: "Hộp thư",
    href: "/inbox",
    icon: Inbox,
    aliases: ["/notifications"],
    badgeKey: "notifications",
  },
  {
    id: "tasks",
    label: "Nhiệm vụ",
    href: "/tasks",
    icon: CheckSquare,
    aliases: ["/unit-tasks", "/dashboard", "/workbench"],
    badgeKey: "taskAttention",
  },
  {
    id: "calendar",
    label: "Lịch công tác",
    href: "/calendar",
    icon: Calendar,
    badgeKey: "calendar",
  },
  {
    id: "documents",
    label: "Văn bản & Công văn",
    href: "/documents",
    icon: FileText,
    badgeKey: "docsInbox",
  },
  {
    id: "org",
    label: "Cơ cấu & Danh bạ",
    href: "/org",
    icon: Building2,
  },
];
