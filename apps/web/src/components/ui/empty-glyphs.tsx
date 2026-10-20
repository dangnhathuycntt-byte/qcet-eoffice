"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { useAnimationFrame, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Icon lớn của trạng thái trống, vẽ SVG theo icon trang trống của Linear (người dùng gửi ảnh và hai đoạn quay 20/10/2026):
 * vật thể chiếu isometric, khối bo tròn, nét 1,25px màu chữ, không chữ. Mỗi icon có đúng một mảnh nét đậm chuyển động, phần còn
 * lại nét nhạt đứng yên: mảnh đậm rơi vào chỗ một lần khi hiện (lò xo ~0,5 giây), riêng kính lúp của `no-results` trôi chậm liên
 * tục. Mặt khối tô màu nền thẻ (`--card`) để che nét phía sau, nên chỉ đặt trên nền thẻ (khung và trang Hộp thư). Giảm chuyển
 * động: `MotionConfig reducedMotion="user"` bỏ dịch chuyển của mảnh rơi, kính lúp đứng yên.
 */
export type EmptyGlyphName = "inbox" | "inbox-select" | "all-done" | "archive" | "no-results" | "load-error";

type Vec2 = [number, number];
type Vec3 = [number, number, number];
type Project = (point: Vec3) => Vec2;

const COS30 = Math.cos(Math.PI / 6);
const KAPPA = 0.5523;
/** Độ đậm nét: nền viền đứt, khối đứng yên, mảnh chuyển động. */
const INK = { floor: 0.35, base: 0.55, piece: 0.9 };

const fmt = ([x, y]: Vec2) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** Chiếu isometric quanh điểm `origin` trên màn hình: trục x xuống phải, y xuống trái, z lên. */
function projector([ox, oy]: Vec2): Project {
  return ([x, y, z]) => [ox + (x - y) * COS30, oy + (x + y) * 0.5 - z];
}

/** Đáy chữ nhật bo góc nằm ngang: tâm, cạnh theo trục x (`w`) và y (`d`), bán kính góc, góc xoay quanh trục đứng (độ). */
interface Footprint {
  c: Vec2;
  w: number;
  d: number;
  r: number;
  yaw?: number;
}

function planeMap(f: Footprint, z: number) {
  const angle = ((f.yaw ?? 0) * Math.PI) / 180;
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return (a: number, b: number): Vec3 => [f.c[0] + a * cos - b * sin, f.c[1] + a * sin + b * cos, z];
}

/** Viền chữ nhật bo góc trong hệ (a, b) đặt vào không gian bằng `map` rồi chiếu; phép chiếu affine nên chiếu điểm điều khiển Bézier là đúng. */
function roundedRectPath(project: Project, map: (a: number, b: number) => Vec3, w: number, h: number, r: number): string {
  const [hw, hh, k] = [w / 2, h / 2, r * KAPPA];
  const P = (a: number, b: number) => fmt(project(map(a, b)));
  return [
    `M${P(-hw + r, -hh)}`,
    `L${P(hw - r, -hh)}`,
    `C${P(hw - r + k, -hh)} ${P(hw, -hh + r - k)} ${P(hw, -hh + r)}`,
    `L${P(hw, hh - r)}`,
    `C${P(hw, hh - r + k)} ${P(hw - r + k, hh)} ${P(hw - r, hh)}`,
    `L${P(-hw + r, hh)}`,
    `C${P(-hw + r - k, hh)} ${P(-hw, hh - r + k)} ${P(-hw, hh - r)}`,
    `L${P(-hw, -hh + r)}`,
    `C${P(-hw, -hh + r - k)} ${P(-hw + r - k, -hh)} ${P(-hw + r, -hh)}`,
    "Z",
  ].join(" ");
}

function footprintPath(project: Project, f: Footprint, z: number): string {
  return roundedRectPath(project, planeMap(f, z), f.w, f.d, f.r);
}

/** Điểm trên viền đáy, lấy dày ở các cung góc, để tìm điểm trái nhất, phải nhất và gần nhất trên màn hình. */
function outlineSamples(f: Footprint): Vec2[] {
  const map = planeMap(f, 0);
  return Array.from({ length: 256 }, (_, i) => {
    const angle = (i / 256) * Math.PI * 2;
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const [x, y] = map(Math.sign(cos) * (f.w / 2 - f.r) + f.r * cos, Math.sign(sin) * (f.d / 2 - f.r) + f.r * sin);
    return [x, y] as Vec2;
  });
}

interface Solid {
  top: string;
  bottom: string;
  body: string;
  edges: string;
  crease: string;
}

/**
 * Khối lăng trụ đáy bo góc từ độ cao z0 tới z1. Vẽ: viền đáy (tô nền), tô mặt trên và dải giữa điểm trái/phải (che nửa sau của
 * viền đáy), rồi hai cạnh đứng, viền mặt trên và nếp gấp mờ ở góc trước.
 */
function solid(project: Project, f: Footprint, z0: number, z1: number): Solid {
  const points = outlineSamples(f);
  const pick = (score: (p: Vec2) => number) => points.reduce((best, p) => (score(p) > score(best) ? p : best));
  const left = pick(([x, y]) => y - x);
  const right = pick(([x, y]) => x - y);
  const front = pick(([x, y]) => x + y);
  const at = ([x, y]: Vec2, z: number) => fmt(project([x, y, z]));
  return {
    top: footprintPath(project, f, z1),
    bottom: footprintPath(project, f, z0),
    body: `M${at(left, z1)} L${at(right, z1)} L${at(right, z0)} L${at(left, z0)} Z`,
    edges: `M${at(left, z1)} L${at(left, z0)} M${at(right, z1)} L${at(right, z0)}`,
    crease: `M${at(front, z1)} L${at(front, z0)}`,
  };
}

function SolidShape({ shape, ink, nonScaling }: { shape: Solid; ink: number; nonScaling?: boolean }) {
  const vectorEffect = nonScaling ? "non-scaling-stroke" : undefined;
  return (
    <g strokeOpacity={ink}>
      <path d={shape.bottom} fill="var(--card)" vectorEffect={vectorEffect} />
      <path d={shape.top} fill="var(--card)" stroke="none" />
      <path d={shape.body} fill="var(--card)" stroke="none" />
      <path d={shape.edges} vectorEffect={vectorEffect} />
      <path d={shape.top} vectorEffect={vectorEffect} />
      <path d={shape.crease} strokeOpacity={ink * 0.5} vectorEffect={vectorEffect} />
    </g>
  );
}

/** Ellipse là hình chiếu của vòng tròn bán kính `r` nằm ngang tại tâm `c`. */
function flatCircle(project: Project, c: Vec3, r: number) {
  const [cx, cy] = project(c);
  return { cx, cy, rx: r * Math.sqrt(1.5), ry: r * Math.SQRT1_2 };
}

function useClipId() {
  return `glyph-clip${React.useId().replace(/[^\w-]/g, "")}`;
}

/** Mảnh đậm rơi vào chỗ một lần khi hiện: bay vào từ độ lệch `from`, nghiêng rồi về đúng chỗ theo lò xo. */
interface DropFrom {
  x: number;
  y: number;
  rotate?: number;
  delay?: number;
  stiffness?: number;
  damping?: number;
}

function DropIn({ from, children }: { from: DropFrom; children: React.ReactNode }) {
  const delay = from.delay ?? 0.18;
  return (
    <m.g
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      initial={{ x: from.x, y: from.y, rotate: from.rotate ?? 0, opacity: 0 }}
      animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: from.stiffness ?? 260,
        damping: from.damping ?? 17,
        delay,
        opacity: { duration: 0.15, delay },
      }}
    >
      {children}
    </m.g>
  );
}

function GlyphSvg({ className, children }: { className?: string; children: React.ReactNode }) {
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
      {children}
    </svg>
  );
}

/* Ba tấm xếp chồng trên nền viền đứt: "Đã đọc hết" tấm trên cùng rơi đúng chỗ, "Lỗi tải" tấm trên cùng rơi lệch. */
const STACK = (() => {
  const project = projector([28, 38]);
  const plate = (z: number, f: Partial<Footprint> = {}) => solid(project, { c: [0, 0], w: 22, d: 22, r: 4.5, ...f }, z, z + 2.5);
  return {
    floor: footprintPath(project, { c: [0, 0], w: 30, d: 30, r: 6 }, 0),
    base: [plate(4), plate(12.5)],
    top: plate(21),
    askew: plate(21, { c: [2.5, -1.5], yaw: 17 }),
  };
})();

function StackGlyph({ askew, className }: { askew?: boolean; className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d={STACK.floor} strokeOpacity={INK.floor} strokeDasharray="2 2.5" />
      {STACK.base.map((shape, index) => (
        <SolidShape key={index} shape={shape} ink={INK.base} />
      ))}
      <DropIn from={askew ? { x: -3, y: -11, rotate: 12, stiffness: 320, damping: 14 } : { x: 4, y: -10, rotate: -14 }}>
        <SolidShape shape={askew ? STACK.askew : STACK.top} ink={INK.piece} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Khay thư để mở hạ xuống nền viền đứt; lòng khay thấy đáy và góc trong phía sau. */
const TRAY = (() => {
  const project = projector([28, 30]);
  const outer: Footprint = { c: [0, 0], w: 30, d: 24, r: 5 };
  const inner: Footprint = { c: [0, 0], w: 26, d: 20, r: 3.2 };
  const [height, bed] = [6.5, 1.5];
  const back = outlineSamples(inner).reduce((best, p) => (p[0] + p[1] < best[0] + best[1] ? p : best));
  return {
    floor: footprintPath(project, { c: [0, 0], w: 36, d: 30, r: 8 }, 0),
    body: solid(project, outer, 0, height),
    rim: footprintPath(project, inner, height),
    bed: footprintPath(project, inner, bed),
    backCrease: `M${fmt(project([back[0], back[1], height]))} L${fmt(project([back[0], back[1], bed]))}`,
  };
})();

function TrayGlyph({ className }: { className?: string }) {
  const clipId = useClipId();
  return (
    <GlyphSvg className={className}>
      <defs>
        <clipPath id={clipId}>
          <path d={TRAY.rim} />
        </clipPath>
      </defs>
      <path d={TRAY.floor} strokeOpacity={INK.floor} strokeDasharray="2 2.5" />
      <DropIn from={{ x: 0, y: -9, rotate: -8 }}>
        <SolidShape shape={TRAY.body} ink={INK.piece} />
        <g clipPath={`url(#${clipId})`} strokeOpacity={INK.piece * 0.6}>
          <path d={TRAY.bed} />
          <path d={TRAY.backCrease} strokeOpacity={INK.piece * 0.35} />
        </g>
        <path d={TRAY.rim} strokeOpacity={INK.piece} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Hộp lưu trữ có khe tay cầm ở mặt trái; nắp đậy rơi xuống. */
const BOX = (() => {
  const project = projector([28, 34]);
  return {
    floor: footprintPath(project, { c: [0, 0], w: 32, d: 32, r: 7 }, 0),
    body: solid(project, { c: [0, 0], w: 24, d: 24, r: 3.5 }, 0, 11),
    slot: roundedRectPath(project, (a, b) => [a, 12, 6 + b], 9, 2.6, 1.3),
    lid: solid(project, { c: [0, 0], w: 27, d: 27, r: 4.5 }, 11, 14.5),
  };
})();

function ArchiveGlyph({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      <path d={BOX.floor} strokeOpacity={INK.floor} strokeDasharray="2 2.5" />
      <SolidShape shape={BOX.body} ink={INK.base} />
      <path d={BOX.slot} strokeOpacity={INK.base} />
      <DropIn from={{ x: 3, y: -10, rotate: -12 }}>
        <SolidShape shape={BOX.lid} ink={INK.piece} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Hai thẻ danh sách nằm trên mặt phẳng; con trỏ lướt vào chọn thẻ trước. */
const LIST = (() => {
  const project = projector([28, 26.5]);
  const [thickness, rows] = [1.75, [-6.5, 6.5]];
  const tip = project([3.5, 7.5, thickness]);
  // Con trỏ mũi tên vẽ thẳng trên màn hình (không chiếu), mũi ở `tip`
  const arrow: Vec2[] = [
    [0, 0],
    [0, 11],
    [2.9, 8.4],
    [4.8, 12.6],
    [6.6, 11.8],
    [4.7, 7.7],
    [8.4, 7.7],
  ];
  return {
    rows: rows.map((cy) => ({
      shape: solid(project, { c: [0, cy], w: 28, d: 10, r: 3 }, 0, thickness),
      dot: flatCircle(project, [-9.5, cy, thickness], 1.8),
      line: `M${fmt(project([-5.5, cy, thickness]))} L${fmt(project([9, cy, thickness]))}`,
    })),
    cursor: `M${arrow.map(([x, y]) => fmt([tip[0] + x, tip[1] + y])).join(" L")} Z`,
  };
})();

function ListSelectGlyph({ className }: { className?: string }) {
  return (
    <GlyphSvg className={className}>
      {LIST.rows.map((row, index) => (
        <g key={index}>
          <SolidShape shape={row.shape} ink={INK.base} />
          <ellipse {...row.dot} strokeOpacity={INK.base * 0.7} />
          <path d={row.line} strokeOpacity={INK.base * 0.7} />
        </g>
      ))}
      <DropIn from={{ x: 9, y: 7, delay: 0.25, stiffness: 170, damping: 22 }}>
        <path d={LIST.cursor} fill="var(--card)" strokeOpacity={INK.piece} />
      </DropIn>
    </GlyphSvg>
  );
}

/*
 * Kính lúp nằm ngang trôi chậm trên bốn tấm (theo đoạn quay Search của Linear): trong lòng kính là các tấm phóng to quanh điểm
 * ngay dưới tâm kính. Kính dịch `d` thì nhóm phóng to đổi theo: translate(c − s·(under + d)) scale(s), c là tâm kính trên màn hình.
 */
const LENS = (() => {
  const project = projector([29, 34]);
  const center: Vec3 = [-2.5, -3.5, 12];
  const [outerR, innerR, thickness] = [12.5, 10.3, 1.5];
  const dir: Vec2 = [-0.15, 1];
  const len = Math.hypot(dir[0], dir[1]);
  const u: Vec2 = [dir[0] / len, dir[1] / len];
  const handleLength = 11.5;
  const reach = outerR - 1 + handleLength / 2;
  const outer = flatCircle(project, center, outerR);
  const under = project([center[0], center[1], 0]);
  return {
    tiles: [
      [-6.75, -6.75],
      [-6.75, 6.75],
      [6.75, -6.75],
      [6.75, 6.75],
    ].map(([cx, cy]) => solid(project, { c: [cx, cy], w: 11, d: 11, r: 2.4 }, 0, 1.5)),
    handle: solid(
      project,
      { c: [center[0] + u[0] * reach, center[1] + u[1] * reach], w: handleLength, d: 3, r: 1.5, yaw: (Math.atan2(u[1], u[0]) * 180) / Math.PI },
      center[2] - thickness,
      center[2],
    ),
    outer,
    outerBottom: { ...outer, cy: outer.cy + thickness },
    inner: flatCircle(project, center, innerR),
    innerBottom: flatCircle(project, [center[0], center[1], center[2] - thickness], innerR),
    body: `M${fmt([outer.cx - outer.rx, outer.cy])} L${fmt([outer.cx + outer.rx, outer.cy])} L${fmt([outer.cx + outer.rx, outer.cy + thickness])} L${fmt([outer.cx - outer.rx, outer.cy + thickness])} Z`,
    edges: `M${fmt([outer.cx - outer.rx, outer.cy])} l0 ${thickness} M${fmt([outer.cx + outer.rx, outer.cy])} l0 ${thickness}`,
    magnify: (dx: number, dy: number, scale = 1.6) =>
      `translate(${(outer.cx - scale * (under[0] + dx)).toFixed(2)} ${(outer.cy - scale * (under[1] + dy)).toFixed(2)}) scale(${scale})`,
  };
})();

function Tiles({ ink, nonScaling }: { ink: number; nonScaling?: boolean }) {
  return LENS.tiles.map((shape, index) => <SolidShape key={index} shape={shape} ink={ink} nonScaling={nonScaling} />);
}

function MagnifierGlyph({ className }: { className?: string }) {
  const clipId = useClipId();
  const reduceMotion = useReducedMotion();
  const lensRef = React.useRef<SVGGElement>(null);
  const zoomRef = React.useRef<SVGGElement>(null);

  // Trôi theo đường Lissajous biên độ 4,5 × 2,5px, chu kỳ 6,5 và 4,8 giây; bắt đầu từ vị trí gốc nên khớp lần vẽ ở server
  useAnimationFrame((time) => {
    if (reduceMotion || !lensRef.current || !zoomRef.current) return;
    const t = time / 1000;
    const dx = 4.5 * Math.sin((2 * Math.PI * t) / 6.5);
    const dy = 2.5 * Math.sin((2 * Math.PI * t) / 4.8);
    lensRef.current.setAttribute("transform", `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    zoomRef.current.setAttribute("transform", LENS.magnify(dx, dy));
  });

  return (
    <GlyphSvg className={className}>
      <defs>
        <clipPath id={clipId}>
          <ellipse {...LENS.inner} />
        </clipPath>
      </defs>
      <Tiles ink={INK.base} />
      <g ref={lensRef}>
        <SolidShape shape={LENS.handle} ink={INK.piece} />
        <g strokeOpacity={INK.piece}>
          <ellipse {...LENS.outerBottom} fill="var(--card)" />
          <path d={LENS.body} fill="var(--card)" stroke="none" />
          <ellipse {...LENS.outer} fill="var(--card)" stroke="none" />
          <path d={LENS.edges} />
          <g clipPath={`url(#${clipId})`}>
            <g ref={zoomRef} transform={LENS.magnify(0, 0)}>
              <Tiles ink={INK.base * 0.8} nonScaling />
            </g>
            <ellipse {...LENS.innerBottom} strokeOpacity={INK.piece * 0.5} />
          </g>
          <ellipse {...LENS.inner} />
          <ellipse {...LENS.outer} />
        </g>
      </g>
    </GlyphSvg>
  );
}

export function EmptyGlyph({ name, className }: { name: EmptyGlyphName; className?: string }) {
  switch (name) {
    case "no-results":
      return <MagnifierGlyph className={className} />;
    case "all-done":
      return <StackGlyph className={className} />;
    case "load-error":
      return <StackGlyph askew className={className} />;
    case "inbox":
      return <TrayGlyph className={className} />;
    case "archive":
      return <ArchiveGlyph className={className} />;
    case "inbox-select":
      return <ListSelectGlyph className={className} />;
  }
}
