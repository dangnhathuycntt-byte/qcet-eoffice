import {
  LayoutDashboard,
  Calendar,
  Bell,
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
    id: "desk",
    label: "Bàn làm việc",
    href: "/",
    icon: LayoutDashboard,
    badgeKey: "myFocus",
  },
  {
    id: "calendar",
    label: "Lịch công tác",
    href: "/calendar",
    icon: Calendar,
    badgeKey: "calendar",
  },
  {
    id: "notifications",
    label: "Thông báo",
    href: "/notifications",
    icon: Bell,
    badgeKey: "notifications",
  },
  {
    id: "tasks",
    label: "Kho nhiệm vụ",
    href: "/tasks",
    icon: CheckSquare,
    aliases: ["/unit-tasks"],
    badgeKey: "allTasks",
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
