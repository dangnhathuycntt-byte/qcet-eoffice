"use client";

import * as React from "react";
import { Plus, BookOpen, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActionableEmptyStateProps {
  onCreateTask?: () => void;
  onOpenDocs?: () => void;
}

export function ActionableEmptyState({ onCreateTask, onOpenDocs }: ActionableEmptyStateProps) {
  return (
    <section id="tour-empty-state-cta" aria-labelledby="onboarding-empty-title" className="my-4 flex flex-col items-center justify-center rounded-2xl bg-card px-6 py-12 text-center sm:px-10">
      <ClipboardList aria-hidden="true" className="mb-6 size-12 text-muted-foreground" strokeWidth={1.5} />
      <h3 id="onboarding-empty-title" className="text-base font-semibold text-foreground">Chưa có nhiệm vụ nào</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Nhiệm vụ bạn được giao sẽ hiện ở đây. Bạn có thể tra cứu văn bản của nhà trường để bắt đầu.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onCreateTask && <Button type="button" onClick={onCreateTask}><Plus aria-hidden="true" strokeWidth={1.5} />Tạo nhiệm vụ</Button>}
        {onOpenDocs && <Button type="button" onClick={onOpenDocs} variant={onCreateTask ? "ghost" : "default"}><BookOpen aria-hidden="true" strokeWidth={1.5} />Tra cứu văn bản</Button>}
      </div>
    </section>
  );
}
