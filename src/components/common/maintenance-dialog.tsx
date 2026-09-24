"use client";

import * as React from "react";
import Link from "next/link";
import { Wrench, Clock, ArrowRight, ShieldCheck } from "lucide-react";
import { StandardDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface MaintenanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  feature?: string;
  description?: string;
}

export function MaintenanceDialog({
  isOpen,
  onClose,
  title,
  feature,
  description,
}: MaintenanceDialogProps) {
  const featureKey = feature || "general";
  const desc =
    description ||
    "Tính năng này đang trong kế hoạch hoàn thiện và nâng cấp đồng bộ theo tiến trình Chuyển đổi số của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET - Version 2.4.3). Quý Thầy/Cô và Cán bộ vui lòng quay lại sau.";

  return (
    <StandardDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={desc}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-4 pt-1">
          <div className="size-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
            <Wrench className="size-6" strokeWidth={1.5} />
          </div>

          <div className="space-y-1 pr-6 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs"
              >
                <Clock className="size-3 mr-1 inline-block" />
                Đang bảo trì
              </Badge>
              <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                v2.4.3
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              Hệ thống đang tiến hành nâng cấp phân hệ chức năng này.
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Mã hệ thống:</span>
            <span className="font-mono font-medium text-foreground">QCET-CDS-{featureKey}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Trạng thái:</span>
            <span className="text-amber-600 font-medium">Đang nâng cấp đồng bộ</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Đơn vị chủ quản:</span>
            <span className="text-foreground">Trường CĐ Kỹ thuật Công nghệ Quy Nhơn</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary shrink-0" />
            <span>An toàn dữ liệu</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Đã hiểu
            </Button>
            <Button variant="default" size="sm" asChild className="text-xs gap-1">
              <Link
                href={`/maintenance?feature=${encodeURIComponent(
                  featureKey
                )}&title=${encodeURIComponent(title)}`}
                onClick={onClose}
              >
                <span>Xem chi tiết</span>
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </StandardDialog>
  );
}
