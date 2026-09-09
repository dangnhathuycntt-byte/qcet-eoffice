"use client";

import * as React from "react";
import { Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UnassignedDepartmentStateProps {
  onOpenProfile?: () => void;
}

export function UnassignedDepartmentState({ onOpenProfile }: UnassignedDepartmentStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/40 my-6 shadow-xs animate-in fade-in-50 duration-200">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 border border-amber-200/80 mb-4 shadow-xs">
        <Building2 className="size-7" strokeWidth={1.5} />
      </div>

      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-800 border border-amber-200 mb-2">
        Hồ sơ chưa hoàn tất
      </span>

      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1.5">
        Tài khoản chưa liên kết Khoa / Phòng công tác
      </h3>

      <p className="text-xs sm:text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        Bạn đang đăng nhập với tư cách Cán bộ / Giảng viên nhưng chưa được xếp vào Khoa hoặc Phòng ban cụ thể. Vui lòng cập nhật đơn vị để hệ thống đồng bộ và hiển thị công việc của đơn vị bạn.
      </p>

      {onOpenProfile && (
        <Button
          type="button"
          onClick={onOpenProfile}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 cursor-pointer transition-all active:scale-98"
        >
          <Building2 className="size-4" strokeWidth={1.5} />
          <span>Cập nhật Khoa / Phòng công tác ngay</span>
          <ArrowRight className="size-3.5" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );
}
