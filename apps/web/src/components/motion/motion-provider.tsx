"use client";

import * as React from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

// Nạp đồng bộ, không dùng `features={() => import(...)}`: LazyMotion tải xong bộ tính năng thì dựng giá trị context mới,
// rơi vào lúc khung trang stream từ server còn chờ hiện ("$~", React 19.2 hiện theo đợt ~300ms) làm React bỏ HTML server
// và vẽ lại cả trang ở client (đo 22/10/2026 ở chi tiết nhiệm vụ: Plate gắn hai lần, khối phụ tải lại).
export function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
