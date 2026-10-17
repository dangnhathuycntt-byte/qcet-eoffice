"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MenuActionItem, MenuContent, MenuRoot, MenuTrigger } from "@/components/ui/menu";
import { useAgentModel } from "@/components/agent-chat/agent-models";

/**
 * Chọn model cho lượt sau, cạnh nút gửi như bộ chọn model ở ô soạn của Claude/Linear Agent (người dùng yêu cầu
 * 17/10/2026), dùng ở ô soạn của Trợ lý và Agent tạo nhiệm vụ. Chỉ hiện khi máy chủ cho từ hai model trở lên
 * (`TASK_AGENT_MODELS`); lượt đang chạy giữ model cũ.
 */
export function AgentModelPicker({
  className,
  positionerClassName,
}: {
  className?: string;
  /** Lớp của menu; trong hộp thoại (z-50) truyền "z-50" để menu nổi trên hộp như Select của hộp đó. */
  positionerClassName?: string;
}) {
  const { models, model, setModel } = useAgentModel();
  if (models.length < 2) return null;
  const current = models.find((option) => option.id === model) ?? models[0];
  return (
    <MenuRoot modal={false}>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="pill-xs"
          title="Đổi model"
          className={cn("max-w-40 text-muted-foreground data-[popup-open]:bg-accent data-[popup-open]:text-foreground", className)}
        >
          <span className="sr-only">Model: </span>
          <span className="truncate">{current.label}</span>
          <ChevronDown className="size-3 shrink-0" />
        </Button>
      </MenuTrigger>
      <MenuContent side="top" align="end" className="w-56 min-w-0" positionerClassName={positionerClassName} mobileSheet sheetTitle="Model">
        {models.map((option) => (
          <MenuActionItem key={option.id} selected={option.id === current.id} onClick={() => setModel(option.id)}>
            {option.label}
          </MenuActionItem>
        ))}
      </MenuContent>
    </MenuRoot>
  );
}
