/** Khối nội dung của một trang tài liệu. Chữ trong `text`/`items` cho phép **đậm** (nhãn giao diện) và `mã` (phím, đường dẫn). */
export type DocBlock =
  | { type: "p" | "h2" | "h3"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "callout"; tone: "info" | "warning"; text: string };

export type DocIconName =
  | "BookOpen"
  | "LogIn"
  | "LayoutDashboard"
  | "Smartphone"
  | "CheckSquare"
  | "Users"
  | "TrendingUp"
  | "Filter"
  | "Handshake"
  | "Repeat"
  | "MessageSquare"
  | "FileInput"
  | "FileOutput"
  | "FileText"
  | "FolderOpen"
  | "PenLine"
  | "CalendarDays"
  | "Building2"
  | "UserCheck"
  | "UserCircle"
  | "Bell"
  | "Settings"
  | "Shield"
  | "Search"
  | "Keyboard"
  | "Inbox";

export interface DocPage {
  slug: string;
  title: string;
  /** Một câu: dùng làm đoạn mở đầu của trang và mô tả trên thẻ ở trang chủ tài liệu. */
  description: string;
  icon: DocIconName;
  blocks: DocBlock[];
}

export interface DocGroup {
  key: string;
  title: string;
  pages: DocPage[];
}
