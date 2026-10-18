"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileInput,
  FileOutput,
  FileText,
  Filter,
  FolderOpen,
  Handshake,
  Inbox,
  Keyboard,
  LayoutDashboard,
  LifeBuoy,
  LogIn,
  Menu,
  MessageSquare,
  PenLine,
  Repeat,
  Search,
  Settings,
  Shield,
  Smartphone,
  SquareArrowOutUpRight,
  TrendingUp,
  UserCheck,
  UserCircle,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StandardDialog } from "@/components/ui/dialog";
import { Pressable } from "@/components/ui/pressable";
import { cn } from "@/lib/utils";
import { ALL_DOCS, DOC_GROUPS, docOutline, findDoc } from "./docs-lib";
import type { DocIconName } from "./docs-types";

const ICONS: Record<DocIconName, LucideIcon> = {
  BookOpen,
  LogIn,
  LayoutDashboard,
  Smartphone,
  CheckSquare,
  Users,
  TrendingUp,
  Filter,
  Handshake,
  Repeat,
  MessageSquare,
  FileInput,
  FileOutput,
  FileText,
  FolderOpen,
  PenLine,
  CalendarDays,
  Building2,
  UserCheck,
  UserCircle,
  Bell,
  Settings,
  Shield,
  Search,
  Keyboard,
  Inbox,
};

export function DocIcon({ name, className }: { name: DocIconName; className?: string }) {
  const Icon = ICONS[name] ?? BookOpen;
  return <Icon aria-hidden className={className} />;
}

/** Cùng địa chỉ hỗ trợ ở trang đăng nhập và thư chào mừng. */
const SUPPORT_EMAIL = "hotro@cdktcnqn.edu.vn";

const currentSlug = (pathname: string) => (pathname.startsWith("/docs/") ? pathname.slice("/docs/".length) : null);

/**
 * Khung trang Tài liệu hướng dẫn, dựng theo linear.app/docs (đo 14/10/2026, giao diện sáng):
 * sidebar trái 280px (logo + "Tài liệu" + nút tìm, nhóm mục thu/mở, liên kết cuối), header 64px có đường dẫn trang và nút "Mở ứng dụng".
 * Điện thoại: sidebar thành ngăn trượt mở từ nút menu ở header.
 */
export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const slug = currentSlug(pathname);
  const doc = slug ? findDoc(slug) : null;
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);

  React.useEffect(() => setNavOpen(false), [pathname]);

  React.useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, [contenteditable='true']");
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sidebar = <DocsSidebar activeSlug={slug} onSearch={() => setSearchOpen(true)} />;

  return (
    <div data-slot="docs" className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-70 border-r border-border/70 bg-background md:flex">{sidebar}</aside>

      {navOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <Pressable aria-label="Đóng mục lục" className="absolute inset-0 bg-overlay" onClick={() => setNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-70 max-w-[85vw] bg-background shadow-dialog">{sidebar}</aside>
        </div>
      ) : null}

      <div className="md:pl-70">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/70 bg-background/95 px-4 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Mở mục lục" onClick={() => setNavOpen(true)}>
            <Menu />
          </Button>
          <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-2 text-sm font-medium">
            {doc ? (
              <>
                <span className="truncate text-muted-foreground">{doc.group.title}</span>
                <span aria-hidden className="text-muted-foreground/60">/</span>
                <span className="truncate text-foreground">{doc.page.title}</span>
              </>
            ) : (
              <span className="text-foreground">Trang chủ</span>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Tìm trong tài liệu" onClick={() => setSearchOpen(true)}>
              <Search />
            </Button>
            <Button asChild size="pill" variant="toolbar">
              <Link href="/tasks">Mở ứng dụng</Link>
            </Button>
          </div>
        </header>
        <main id="main-content">{children}</main>
      </div>

      <DocsSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function DocsSidebar({ activeSlug, onSearch }: { activeSlug: string | null; onSearch: () => void }) {
  const activeGroup = DOC_GROUPS.find((group) => group.pages.some((page) => page.slug === activeSlug))?.key;
  // Như Linear: nhóm chứa trang đang xem mở sẵn, các nhóm khác thu gọn; bấm tiêu đề nhóm để thu/mở
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => new Set(activeGroup ? [activeGroup] : []));
  React.useEffect(() => {
    if (activeGroup) setOpenGroups((current) => (current.has(activeGroup) ? current : new Set(current).add(activeGroup)));
  }, [activeGroup]);

  const toggle = (key: string) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-3">
        <Link href="/docs" className="flex items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Image src="/logo-qcet.webp" alt="" width={24} height={24} className="size-6 rounded-full object-contain" />
          <span aria-hidden className="h-5 w-px bg-border" />
          <span className="text-base font-medium text-foreground">Tài liệu</span>
        </Link>
        <Button variant="ghost" size="icon-sm" className="rounded-full max-md:hidden" aria-label="Tìm trong tài liệu (⌘K)" title="Tìm trong tài liệu (⌘K)" onClick={onSearch}>
          <Search />
        </Button>
      </div>

      <nav aria-label="Mục lục tài liệu" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
        <ul className="space-y-0.5">
          {DOC_GROUPS.map((group) => {
            const open = openGroups.has(group.key);
            return (
              <li key={group.key}>
                <Pressable
                  aria-expanded={open}
                  onClick={() => toggle(group.key)}
                  className={cn(
                    "flex h-9 w-full items-center justify-between rounded-lg px-2 text-sm font-medium transition-colors hover:bg-accent",
                    open ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {group.title}
                  {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </Pressable>
                {open ? (
                  <ul className="mb-2 mt-0.5 space-y-0.5">
                    {group.pages.map((page) => {
                      const active = page.slug === activeSlug;
                      return (
                        <li key={page.slug}>
                          <Link
                            href={`/docs/${page.slug}`}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <DocIcon name={page.icon} className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground/80")} />
                            <span className="truncate">{page.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-border/70 px-3 py-3">
        <SidebarFooterLink href="/docs" icon={BookOpen} active={activeSlug === null}>
          Tài liệu
        </SidebarFooterLink>
        <SidebarFooterLink href="/tasks" icon={SquareArrowOutUpRight}>
          Mở ứng dụng
        </SidebarFooterLink>
        <SidebarFooterLink href={`mailto:${SUPPORT_EMAIL}`} icon={LifeBuoy}>
          Liên hệ hỗ trợ
        </SidebarFooterLink>
      </div>
    </div>
  );
}

function SidebarFooterLink({ href, icon: Icon, active, children }: { href: string; icon: LucideIcon; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {children}
    </Link>
  );
}

const fold = (text: string) =>
  text
    .replace(/\*\*|`/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

/** Tìm trong tài liệu: khớp tiêu đề trang, mô tả và tiêu đề mục (không phân biệt dấu); Enter mở kết quả đầu. */
function DocsSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = React.useMemo(() => {
    const q = fold(query.trim());
    if (!q) return ALL_DOCS.slice(0, 8).map(({ group, page }) => ({ group, page, heading: null as null | { id: string; text: string } }));
    return ALL_DOCS.flatMap(({ group, page }) => {
      const pageHit = fold(page.title).includes(q) || fold(page.description).includes(q);
      const headings = docOutline(page).filter((h) => fold(h.text).includes(q));
      return [
        ...(pageHit ? [{ group, page, heading: null }] : []),
        ...headings.map((heading) => ({ group, page, heading })),
      ];
    }).slice(0, 20);
  }, [query]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <StandardDialog open={open} onOpenChange={onOpenChange} title="Tìm trong tài liệu" showHeader={false} size="md" className="w-[calc(100%-2rem)] overflow-hidden p-0 sm:p-0">
      <div className="flex items-center gap-2 border-b border-border/70 px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          autoFocus
          variant="menu"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            const first = results[0];
            if (event.key === "Enter" && first) go(`/docs/${first.page.slug}${first.heading ? `#${first.heading.id}` : ""}`);
          }}
          placeholder="Tìm hướng dẫn…"
          aria-label="Tìm hướng dẫn"
          className="h-12 px-0 text-base sm:h-12 sm:text-sm"
        />
        <Button variant="ghost" size="icon-xs" aria-label="Đóng" onClick={() => onOpenChange(false)}>
          <X />
        </Button>
      </div>
      <ul className="max-h-[60vh] overflow-y-auto p-2">
        {results.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">Không tìm thấy hướng dẫn phù hợp.</li>
        ) : (
          results.map(({ group, page, heading }) => {
            const href = `/docs/${page.slug}${heading ? `#${heading.id}` : ""}`;
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <DocIcon name={page.icon} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{heading ? heading.text : page.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {heading ? `${group.title} · ${page.title}` : group.title}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </StandardDialog>
  );
}
