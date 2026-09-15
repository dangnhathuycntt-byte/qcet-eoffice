"use client";

import * as React from "react";
import { Building2, ArrowRight, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UnassignedDepartmentStateProps {
  onOpenProfile?: () => void;
}

export function UnassignedDepartmentState({ onOpenProfile }: UnassignedDepartmentStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs my-6 max-w-xl mx-auto shadow-xs animate-in fade-in-50 duration-200">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 mb-4 shadow-2xs">
        <Building2 className="size-7" strokeWidth={1.5} />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted/80 text-muted-foreground border border-border/60 mb-3">
        <UserCheck className="size-3.5 text-primary" strokeWidth={1.5} />
        <span>Chưa phân bổ đơn vị công tác</span>
      </div>

      <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight mb-2">
        Tài khoản chưa liên kết Khoa / Phòng ban
      </h3>

      <p className="text-xs sm:text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        Bạn đang xem không gian làm việc Đơn vị nhưng tài khoản của bạn chưa được liên kết với Khoa hoặc Phòng ban trực thuộc. Vui lòng cập nhật thông tin đơn vị để hệ thống hiển thị danh sách nhiệm vụ tương ứng.
      </p>

      {onOpenProfile && (
        <Button
          type="button"
          onClick={onOpenProfile}
          className="h-10 px-5 rounded-xl font-medium text-xs sm:text-sm inline-flex items-center gap-2 shadow-xs cursor-pointer transition-all active:scale-98"
        >
          <Building2 className="size-4" strokeWidth={1.5} />
          <span>Cập nhật đơn vị công tác</span>
          <ArrowRight className="size-3.5" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );
}

