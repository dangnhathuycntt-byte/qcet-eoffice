"use client";

import * as React from "react";
import { PlusCircle, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActionableEmptyStateProps {
  onCreateTask?: () => void;
  onOpenDocs?: () => void;
}

export function ActionableEmptyState({
  onCreateTask,
  onOpenDocs,
}: ActionableEmptyStateProps) {
  return (
    <div
      id="tour-empty-state-cta"
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-4"
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
        <Sparkles className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-foreground mb-1">
        Chào mừng Thầy/Cô đến với Bàn làm việc!
      </h3>
      <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
        Hiện tại đơn vị chưa phân công nhiệm vụ mới. Thầy/Cô có thể tham khảo Sổ tay văn bản hoặc chủ động lập Tờ trình nội bộ để gửi Trưởng đơn vị.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onCreateTask && (
          <Button
            onClick={onCreateTask}
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Soạn Tờ trình / Nhiệm vụ mới
          </Button>
        )}
        {onOpenDocs && (
          <Button
            onClick={onOpenDocs}
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" /> Tra cứu văn bản trường (NĐ 30)
          </Button>
        )}
      </div>
    </div>
  );
}
