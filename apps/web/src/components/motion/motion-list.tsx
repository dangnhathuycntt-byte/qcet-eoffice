"use client";

import * as React from "react";
import { useListMotion, useMergedRefs } from "@/hooks/use-list-motion";
import type { ListMotionOptions } from "@/lib/motion/list-motion";

/**
 * `<ul>` / `<div>` có chuyển động khi mục con thêm hoặc bỏ (xem `lib/motion/list-motion`: mờ dần và các mục sau trượt, chỉ
 * `transform`/`opacity`). Dùng thay thẻ trần ở danh sách mà người dùng thêm hoặc xóa từng mục (bình luận, tệp đính kèm, ghi nhớ…);
 * bảng dùng `TableBody`, nơi đã có sẵn. Tự gỡ hàm dọn khi cha gỡ, không cần đặt hook ở component cha.
 */
export function MotionUl({ item, flip, ref, ...props }: React.ComponentProps<"ul"> & ListMotionOptions) {
  const motionRef = useListMotion<HTMLUListElement>({ item, flip });
  const mergedRef = useMergedRefs<HTMLUListElement>(ref, motionRef);
  return <ul ref={mergedRef} {...props} />;
}

export function MotionDiv({ item, flip, ref, ...props }: React.ComponentProps<"div"> & ListMotionOptions) {
  const motionRef = useListMotion<HTMLDivElement>({ item, flip });
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, motionRef);
  return <div ref={mergedRef} {...props} />;
}
