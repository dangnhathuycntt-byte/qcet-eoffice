import * as React from "react";

/** Thẻ một khối của trang chi tiết cuộc họp: tiêu đề kèm icon và nội dung bên dưới. */
export function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
