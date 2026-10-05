"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";

interface WorkbenchRouterProps {
  userId: string;
  userRole: string;
  userName: string;
}

export function WorkbenchRouter({
  userId,
  userRole,
  userName,
}: WorkbenchRouterProps) {
  // Suppress unused-var lint — userId will be used when wiring /api/dashboard/overview
  void userId;

  const roleLabels: Record<string, string> = {
    BAN_GIAM_HIEU: "Ban Giám hiệu",
    TRUONG_PHONG: "Trưởng đơn vị",
    CHUYEN_VIEN: "Chuyên viên",
    VAN_THU: "Văn thư",
    ADMIN: "Quản trị viên",
  };

  const roleLabel = roleLabels[userRole] || "Người dùng";
  const greeting = getGreeting();

  return (
    <m.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={motionTransition.enter}
      className="mx-auto max-w-7xl space-y-6 p-4 md:p-6"
    >
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">
          {greeting}, {userName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {roleLabel} - Bàn làm việc
        </p>
      </div>

      {/* Quick stats placeholder — will be wired to /api/dashboard/overview */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Nhiệm vụ đang thực hiện" value="-" />
        <StatCard label="Văn bản chờ xử lý" value="-" />
        <StatCard label="Cuộc họp hôm nay" value="-" />
        <StatCard label="Hồ sơ đang mở" value="-" />
      </div>

      {/* Placeholder sections for zone content */}
      <div className="grid gap-4 md:grid-cols-2">
        <ZonePlaceholder
          title="Nhiệm vụ"
          description="Nhiệm vụ được giao và đang theo dõi"
          href="/tasks"
        />
        <ZonePlaceholder
          title="Văn bản"
          description="Văn bản đến/đi chờ xử lý"
          href="/documents"
        />
        <ZonePlaceholder
          title="Lịch công tác"
          description="Lịch họp và sự kiện sắp tới"
          href="/calendar"
        />
        <ZonePlaceholder
          title="Hồ sơ công việc"
          description="Hồ sơ đang mở và cần lưu trữ"
          href="/dossiers"
        />
      </div>
    </m.div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function ZonePlaceholder({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-border/50 bg-card p-4 transition-colors hover:bg-muted/30 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <h3 className="text-sm font-medium text-foreground group-hover:text-foreground/90">
        {title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </a>
  );
}
