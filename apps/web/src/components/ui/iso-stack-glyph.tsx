"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";

/**
 * Icon lớn "lọc không ra" vẽ bằng SVG theo icon trang trống của Linear (người dùng gửi đoạn quay 20/10/2026): ba tấm bo tròn
 * chiếu isometric trên nền viền đứt; tấm trên cùng nét đậm hơn, khi hiện thì bay vào lệch lên phải, nghiêng rồi rơi đúng chỗ
 * (lò xo ~0,5 giây, một lần lúc gắn). Mỗi tấm tô màu nền thẻ (`--card`) để che nét phía sau, nên chỉ đúng trên nền thẻ
 * (khung và trang Hộp thư); đặt trên popover trắng sẽ lộ mảng xám. Giảm chuyển động: `MotionConfig reducedMotion="user"` bỏ dịch
 * chuyển, chỉ còn hiện dần.
 */

type Point = [number, number];

const COS = Math.cos(Math.PI / 6);
const KAPPA = 0.5523;
const ORIGIN: Point = [28, 38.5];

/** Chiếu điểm (x, y) trên mặt phẳng ở độ cao z sang tọa độ màn hình (trục z hướng lên). */
function project([x, y]: Point, z: number): Point {
  return [ORIGIN[0] + (x - y) * COS, ORIGIN[1] + (x + y) * 0.5 - z];
}

const fmt = ([x, y]: Point) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** Hình vuông cạnh `w` bo góc `r` (tâm ở gốc) chiếu ở độ cao z: phép chiếu affine nên chiếu điểm điều khiển Bézier là đúng. */
function roundedSquarePath(w: number, r: number, z: number): string {
  const h = w / 2;
  const k = r * KAPPA;
  const P = (x: number, y: number) => fmt(project([x, y], z));
  return [
    `M${P(-h + r, -h)}`,
    `L${P(h - r, -h)}`,
    `C${P(h - r + k, -h)} ${P(h, -h + r - k)} ${P(h, -h + r)}`,
    `L${P(h, h - r)}`,
    `C${P(h, h - r + k)} ${P(h - r + k, h)} ${P(h - r, h)}`,
    `L${P(-h + r, h)}`,
    `C${P(-h + r - k, h)} ${P(-h, h - r + k)} ${P(-h, h - r)}`,
    `L${P(-h, -h + r)}`,
    `C${P(-h, -h + r - k)} ${P(-h + r - k, -h)} ${P(-h + r, -h)}`,
    "Z",
  ].join(" ");
}

/** Điểm trái nhất, phải nhất và gần nhất (trên màn hình) của hình vuông bo góc: điểm giữa cung góc tương ứng. */
function extremes(w: number, r: number) {
  const h = w / 2;
  const d = r * Math.SQRT1_2;
  return {
    left: [-h + r - d, h - r + d] as Point,
    right: [h - r + d, -h + r - d] as Point,
    front: [h - r + d, h - r + d] as Point,
  };
}

interface Slab {
  fill: string;
  bottom: string;
  body: string;
  edges: string;
  crease: string;
}

/**
 * Tấm dày `t` đặt ở độ cao `z`: tô và vẽ viền mặt đáy trước, rồi tô mặt trên cùng dải giữa hai điểm trái/phải (che nửa sau
 * của viền đáy), sau cùng là hai cạnh đứng, viền mặt trên và nếp gấp mờ ở góc trước.
 */
function slab(w: number, r: number, t: number, z: number): Slab {
  const { left, right, front } = extremes(w, r);
  const [lt, lb, rt, rb] = [project(left, z + t), project(left, z), project(right, z + t), project(right, z)];
  return {
    fill: roundedSquarePath(w, r, z + t),
    bottom: roundedSquarePath(w, r, z),
    body: `M${fmt(lt)} L${fmt(rt)} L${fmt(rb)} L${fmt(lb)} Z`,
    edges: `M${fmt(lt)} L${fmt(lb)} M${fmt(rt)} L${fmt(rb)}`,
    crease: `M${fmt(project(front, z + t))} L${fmt(project(front, z))}`,
  };
}

const PLATE = { w: 24, r: 4.5, t: 2.5 };
const FLOOR = roundedSquarePath(32, 6, 0);
const PLATES = [4, 13, 22].map((z) => slab(PLATE.w, PLATE.r, PLATE.t, z));

function SlabShape({ shape, strokeOpacity }: { shape: Slab; strokeOpacity: number }) {
  return (
    <g strokeOpacity={strokeOpacity}>
      <path d={shape.bottom} fill="var(--card)" />
      <path d={shape.fill} fill="var(--card)" stroke="none" />
      <path d={shape.body} fill="var(--card)" stroke="none" />
      <path d={shape.edges} fill="none" />
      <path d={shape.fill} fill="none" />
      <path d={shape.crease} fill="none" strokeOpacity={0.45} />
    </g>
  );
}

export function IsoStackGlyph({ className }: { className?: string }) {
  const [base1, base2, top] = PLATES;
  return (
    <svg
      viewBox="0 0 56 56"
      width={56}
      height={56}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-slot="empty-state-glyph"
      className={cn("block size-14 shrink-0 overflow-visible text-foreground", className)}
    >
      <path d={FLOOR} strokeOpacity={0.35} strokeDasharray="2 2.5" />
      <SlabShape shape={base1} strokeOpacity={0.55} />
      <SlabShape shape={base2} strokeOpacity={0.55} />
      <m.g
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={{ x: 4, y: -10, rotate: -14, opacity: 0 }}
        animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 17, delay: 0.18, opacity: { duration: 0.15, delay: 0.18 } }}
      >
        <SlabShape shape={top} strokeOpacity={0.9} />
      </m.g>
    </svg>
  );
}
