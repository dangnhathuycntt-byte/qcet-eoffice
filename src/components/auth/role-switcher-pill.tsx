"use client";

import * as React from "react";
import { Landmark, Building2, User, Check, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { cn } from "@/lib/utils";

export interface RoleConfigItem {
  role: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Landmark;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfigItem> = {
  ADMIN: {
    role: "ADMIN",
    label: "BGH (Toàn quyền)",
    shortLabel: "BGH",
    description: "Ban Giám hiệu (Hiệu trưởng)",
    icon: Landmark,
  },
  MANAGER: {
    role: "MANAGER",
    label: "Trưởng đơn vị (Đào tạo/CNTT)",
    shortLabel: "Trưởng đơn vị",
    description: "Trưởng phòng Đào tạo & QLKH (Trần Hùng)",
    icon: Building2,
  },
  STAFF: {
    role: "STAFF",
    label: "Viên chức (Cá nhân)",
    shortLabel: "Viên chức",
    description: "Chuyên viên CNTT (Nguyễn Ngọc Vinh)",
    icon: User,
  },
};

export const ROLE_ORDER: UserRole[] = ["ADMIN", "MANAGER", "STAFF"];

export function RoleSwitcherPill({ className }: { className?: string }) {
  const { user, switchRole } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const activeConfig = ROLE_CONFIGS[user.role] || ROLE_CONFIGS.ADMIN;
  const ActiveIcon = activeConfig.icon;

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", className)}
    >
      {/* Role Dropdown Trigger Pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={`Chuyển vai trò xem: ${activeConfig.label}`}
        className="group inline-flex h-8 items-center gap-1.5 rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl px-2.5 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-card hover:border-border cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-95"
      >
        <ActiveIcon className="size-3.5 text-primary transition-colors" />
        <span className="hidden sm:inline font-semibold">{activeConfig.label}</span>
        <span className="inline sm:hidden font-semibold">{activeConfig.shortLabel}</span>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground transition-transform duration-150 group-hover:text-foreground",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Glassmorphic Role Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border/60 bg-card/95 p-1.5 text-popover-foreground shadow-card backdrop-blur-xl z-50 animate-in fade-in-0 zoom-in-95 focus:outline-none"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground border-b border-border/50 mb-1">
            Góc nhìn vai trò (RBAC Demo)
          </div>

          <div className="space-y-1">
            {ROLE_ORDER.map((roleKey) => {
              const item = ROLE_CONFIGS[roleKey];
              const Icon = item.icon;
              const isActive = user.role === roleKey;

              return (
                <button
                  key={roleKey}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    switchRole(roleKey);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer text-left",
                    isActive
                      ? "bg-primary/10 text-primary font-bold border border-primary/20"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground border border-transparent"
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px]",
                        isActive
                          ? "border-primary/40 bg-primary/20 text-primary"
                          : "border-border/60 bg-background text-muted-foreground"
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <Check
                      className="size-3.5 shrink-0 text-primary"
                      aria-label="Đang chọn"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
