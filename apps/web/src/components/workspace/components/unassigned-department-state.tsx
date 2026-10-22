"use client";

import * as React from "react";
import { Building2, UserCheck } from "lucide-react";

/** Đơn vị lấy từ phân công vị trí việc làm do quản trị viên gán, người dùng không tự chọn được nên trạng thái này không có nút sửa. */
export function UnassignedDepartmentState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs my-6 max-w-xl mx-auto shadow-xs animate-in fade-in-50 duration-200">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 mb-4 shadow-2xs">
        <Building2 className="size-7" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted/80 text-muted-foreground border border-border/60 mb-3">
        <UserCheck className="size-3.5 text-primary" />
        <span>Chưa phân bổ đơn vị công tác</span>
      </div>

      <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight mb-2">
        Tài khoản chưa liên kết Khoa / Phòng ban
      </h3>

      <p className="text-xs sm:text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        Bạn đang xem không gian làm việc Đơn vị nhưng tài khoản của bạn chưa được liên kết với Khoa hoặc Phòng ban trực thuộc. Đơn vị do quản trị viên hệ thống gán theo phân công vị trí việc làm; liên hệ quản trị viên để được gán, sau đó danh sách nhiệm vụ của đơn vị sẽ hiện ở đây.
      </p>
    </div>
  );
}

