"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { useAnimationFrame, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Icon lớn của trạng thái trống, vẽ SVG theo icon trang trống của Linear (người dùng gửi ảnh và hai đoạn quay 20/10/2026):
 * vật thể chiếu isometric, khối bo tròn, nét màu chữ, không chữ. Vẽ trên lưới 56, hiện 96px (khay Hộp thư của Linear ~97px,
 * người dùng chê bản 56px "nhỏ quá"); nét giữ 1,25px trên màn hình ở mọi cỡ nhờ `vector-effect` ở `globals.css`. Mỗi icon có
 * đúng một mảnh nét đậm chuyển động, phần còn lại nét nhạt đứng yên: mảnh đậm rơi vào chỗ một lần khi hiện (lò xo ~0,5 giây),
 * riêng kính lúp của `no-results` trôi chậm liên tục và kim đồng hồ của `overdue` quay một vòng. Mặt khối tô màu nền thẻ
 * (`--card`) để che nét phía sau, nên chỉ đặt trên nền thẻ. Giảm chuyển động: mảnh rơi hiện tại chỗ, kính lúp và kim đứng yên.
 * Từ 20/10/2026 bộ này thay cả tranh nét mực của trang chưa có dữ liệu (người dùng: "áp dụng cho toàn bộ tranh khác").
 */
export type EmptyGlyphName =
  | "inbox"
  | "inbox-select"
  | "all-done"
  | "archive"
  | "no-results"
  | "load-error"
  | "tasks"
  | "overdue"
  | "doc-in"
  | "doc-out"
  | "submission"
  | "dossier"
  | "unit-request"
  | "templates"
  | "calendar"
  | "directory";

type Vec2 = [number, number];
type Vec3 = [number, number, number];
interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const COS30 = Math.cos(Math.PI / 6);
const KAPPA = 0.5523;
/** Độ đậm nét: nền viền đứt, khối đứng yên, mảnh chuyển động. */
const INK = { floor: 0.35, base: 0.55, piece: 0.9 };
const DASH = "2 2.5";
/** Đáy nét vẽ của mọi icon trên lưới 56 (khung 96px thì cách tiêu đề ~23px như Linear). */
const BASELINE = 47;
/** px mỗi đơn vị lưới khi hiện vừa khít nét vẽ (khối căn trái của trang danh sách), cùng tỉ lệ với khung 96px. */
const TIGHT_SCALE = 96 / 56;

const fmt = ([x, y]: Vec2) => `${x.toFixed(2)} ${y.toFixed(2)}`;
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const rad = (deg: number) => (deg * Math.PI) / 180;

function argBest<T>(items: T[], score: (item: T) => number): number {
  let best = 0;
  items.forEach((item, index) => {
    if (score(item) > score(items[best])) best = index;
  });
  return best;
}

/** Khung vẽ: chiếu isometric quanh `origin` (trục x xuống phải, y xuống trái, z lên) và ghi khung bao của mọi điểm đã vẽ. */
interface Canvas {
  /** Chiếu và ghi vào khung bao. */
  project: (p: Vec3) => Vec2;
  /** Ghi một điểm vẽ thẳng trên màn hình. */
  track: (p: Vec2) => Vec2;
  /** Chiếu không ghi (khi chạy chuyển động hoặc dựng vùng che). */
  at: (p: Vec3) => Vec2;
  /** Hướng trên màn hình của một vectơ. */
  vec: (v: Vec3) => Vec2;
  bounds: () => Bounds;
}

function canvas([ox, oy]: Vec2): Canvas {
  const box: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const vec = ([x, y, z]: Vec3): Vec2 => [(x - y) * COS30, (x + y) * 0.5 - z];
  const at = (p: Vec3): Vec2 => {
    const [dx, dy] = vec(p);
    return [ox + dx, oy + dy];
  };
  const track = (p: Vec2) => {
    box.minX = Math.min(box.minX, p[0]);
    box.minY = Math.min(box.minY, p[1]);
    box.maxX = Math.max(box.maxX, p[0]);
    box.maxY = Math.max(box.maxY, p[1]);
    return p;
  };
  return { project: (p) => track(at(p)), track, at, vec, bounds: () => ({ ...box }) };
}

/** Dựng icon hai lần: lần đầu đo khung bao, lần sau dời gốc cho nét vẽ giữa khung 56 theo chiều ngang và đáy chạm BASELINE. */
function place<T extends object>(build: (c: Canvas) => T): T & { bounds: Bounds } {
  const probe = canvas([0, 0]);
  build(probe);
  const b = probe.bounds();
  const c = canvas([28 - (b.minX + b.maxX) / 2, BASELINE - b.maxY]);
  return { ...build(c), bounds: c.bounds() };
}

/* Viền phẳng trong hệ (a, b): đa giác bo góc hoặc vòng tròn, đặt vào không gian bằng một mặt phẳng rồi chiếu. Phép chiếu affine
   nên chiếu điểm điều khiển Bézier là đúng. */
interface Segment {
  c1?: Vec2;
  c2?: Vec2;
  to: Vec2;
}
interface Outline {
  start: Vec2;
  segments: Segment[];
}
type Plane = (a: number, b: number) => Vec3;

function roundedPolygon(points: Vec2[], radius: number | number[]): Outline {
  const n = points.length;
  const corners = points.map((v, i) => {
    const [prev, next] = [points[(i + n - 1) % n], points[(i + 1) % n]];
    const unit = (p: Vec2): [Vec2, number] => {
      const length = Math.hypot(p[0] - v[0], p[1] - v[1]);
      return [[(p[0] - v[0]) / length, (p[1] - v[1]) / length], length];
    };
    const [[d1, l1], [d2, l2]] = [unit(prev), unit(next)];
    const theta = Math.acos(Math.min(1, Math.max(-1, d1[0] * d2[0] + d1[1] * d2[1])));
    const r = typeof radius === "number" ? radius : radius[i];
    const t = Math.min(r / Math.tan(theta / 2), l1 / 2, l2 / 2);
    const k = (4 / 3) * Math.tan((Math.PI - theta) / 4) * t * Math.tan(theta / 2);
    const t1: Vec2 = [v[0] + d1[0] * t, v[1] + d1[1] * t];
    const t2: Vec2 = [v[0] + d2[0] * t, v[1] + d2[1] * t];
    return { t1, t2, c1: [t1[0] - d1[0] * k, t1[1] - d1[1] * k] as Vec2, c2: [t2[0] - d2[0] * k, t2[1] - d2[1] * k] as Vec2 };
  });
  return {
    start: corners[n - 1].t2,
    segments: corners.flatMap((corner) => [{ to: corner.t1 }, { c1: corner.c1, c2: corner.c2, to: corner.t2 }]),
  };
}

function rrect(w: number, h: number, r: number): Outline {
  return roundedPolygon(
    [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ],
    r,
  );
}

function circle(r: number): Outline {
  const k = r * KAPPA;
  return {
    start: [r, 0],
    segments: [
      { c1: [r, k], c2: [k, r], to: [0, r] },
      { c1: [-k, r], c2: [-r, k], to: [-r, 0] },
      { c1: [-r, -k], c2: [-k, -r], to: [0, -r] },
      { c1: [k, -r], c2: [r, -k], to: [r, 0] },
    ],
  };
}

function outlinePath(c: Canvas, outline: Outline, plane: Plane): string {
  const P = ([a, b]: Vec2) => fmt(c.project(plane(a, b)));
  const parts = outline.segments.map((s) => (s.c1 && s.c2 ? `C${P(s.c1)} ${P(s.c2)} ${P(s.to)}` : `L${P(s.to)}`));
  return `M${P(outline.start)} ${parts.join(" ")} Z`;
}

/** Điểm trên viền theo thứ tự đi vòng, lấy dày ở các cung. */
function outlineSamples(outline: Outline): Vec2[] {
  const points: Vec2[] = [];
  let from = outline.start;
  for (const s of outline.segments) {
    if (s.c1 && s.c2) {
      const [c1, c2, p0, p3] = [s.c1, s.c2, from, s.to];
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const u = 1 - t;
        points.push([
          u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
        ]);
      }
    } else {
      points.push(s.to);
    }
    from = s.to;
  }
  return points;
}

/** Mặt phẳng nằm ngang ở độ cao z, tâm `c`, xoay `yaw` độ quanh trục đứng. */
function flat([cx, cy]: Vec2, z: number, yaw = 0): Plane {
  const [cos, sin] = [Math.cos(rad(yaw)), Math.sin(rad(yaw))];
  return (a, b) => [cx + a * cos - b * sin, cy + a * sin + b * cos, z];
}

/** Mặt phẳng đứng vuông góc trục y (a theo x, b theo z): mặt quay về phía trước bên trái. */
function wallY(y: number, [cx, cz]: Vec2): Plane {
  return (a, b) => [cx + a, y, cz + b];
}

/** Mặt phẳng đứng vuông góc trục x (a theo y, b theo z): mặt quay về phía trước bên phải. */
function wallX(x: number, [cy, cz]: Vec2): Plane {
  return (a, b) => [x, cy + a, cz + b];
}

function segment(c: Canvas, p: Vec3, q: Vec3): string {
  return `M${fmt(c.project(p))} L${fmt(c.project(q))}`;
}

function polyline(c: Canvas, points: Vec3[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${fmt(c.project(p))}`).join(" ");
}

/** Ellipse là hình chiếu của vòng tròn bán kính `r` nằm ngang tại tâm `center`. */
function flatCircle(c: Canvas, center: Vec3, r: number) {
  const [cx, cy] = c.project(center);
  const [rx, ry] = [r * Math.sqrt(1.5), r * Math.SQRT1_2];
  c.track([cx - rx, cy - ry]);
  c.track([cx + rx, cy + ry]);
  return { cx, cy, rx, ry };
}

interface Prism {
  back: string;
  front: string;
  body: string;
  edges: string;
  crease: string | null;
}

/**
 * Khối lăng trụ: viền `outline` trên mặt phẳng `plane`, đẩy theo `extrude` (hướng +x, +y hoặc +z để mặt sau cùng là mặt nhìn
 * thấy). Vẽ: viền mặt đầu (tô nền), tô mặt cuối và dải giữa hai điểm tiếp tuyến (che nửa khuất của viền mặt đầu), rồi hai cạnh
 * tiếp tuyến, viền mặt cuối và nếp gấp mờ ở điểm gần người nhìn nhất (khối tròn thì không có nếp gấp).
 */
function prism(c: Canvas, outline: Outline, plane: Plane, extrude: Vec3, crease = true): Prism {
  const points = outlineSamples(outline).map(([a, b]) => plane(a, b));
  const screen = points.map(c.at);
  const e = c.vec(extrude);
  const side = (p: Vec2) => -p[0] * e[1] + p[1] * e[0];
  const [a, b] = [screen[argBest(screen, (p) => -side(p))], screen[argBest(screen, side)]];
  const shift = (p: Vec2): Vec2 => [p[0] + e[0], p[1] + e[1]];
  const near = screen[argBest(points, ([x, y, z]) => x + y + z)];
  return {
    back: outlinePath(c, outline, plane),
    front: outlinePath(c, outline, (u, v) => add3(plane(u, v), extrude)),
    body: `M${fmt(a)} L${fmt(b)} L${fmt(shift(b))} L${fmt(shift(a))} Z`,
    edges: `M${fmt(a)} L${fmt(shift(a))} M${fmt(b)} L${fmt(shift(b))}`,
    crease: crease ? `M${fmt(shift(near))} L${fmt(near)}` : null,
  };
}

function PrismShape({ shape, ink, dash }: { shape: Prism; ink: number; dash?: string }) {
  return (
    <g strokeOpacity={ink} strokeDasharray={dash}>
      <path d={shape.back} fill="var(--card)" />
      <path d={shape.front} fill="var(--card)" stroke="none" />
      <path d={shape.body} fill="var(--card)" stroke="none" />
      <path d={shape.edges} />
      <path d={shape.front} />
      {shape.crease ? <path d={shape.crease} strokeOpacity={ink * 0.5} /> : null}
    </g>
  );
}

/**
 * Hộp để mở nằm ngang: thân, miệng hộp, đáy và góc trong phía sau (chỉ thấy qua miệng), cùng vùng thành trước (dải miệng phía
 * trước và hai mặt ngoài phía trước) để che phần vật đặt trong hộp.
 */
interface OpenBox {
  body: Prism;
  rim: string;
  bed: string;
  backCrease: string;
  front: string;
}

function openBox(c: Canvas, w: number, d: number, r: number, wall: number, height: number, bedZ: number): OpenBox {
  const outer = rrect(w, d, r);
  const inner = rrect(w - wall * 2, d - wall * 2, Math.max(r - wall * 0.9, 1));
  const innerLocal = outlineSamples(inner);
  const back = innerLocal[argBest(innerLocal, ([x, y]) => -(x + y))];
  // Vùng thành trước: từ cung trước của miệng sang cung trước của đáy ngoài
  const frontArc = (local: Vec2[], z: number) => {
    const screen = local.map(([x, y]) => c.at([x, y, z]));
    const [left, right] = [argBest(screen, (p) => -p[0]), argBest(screen, (p) => p[0])];
    const nearest = argBest(local, ([x, y]) => x + y);
    const walk = (step: number) => {
      const out = [left];
      for (let i = left; i !== right; ) {
        i = (i + step + local.length) % local.length;
        out.push(i);
      }
      return out;
    };
    const forward = walk(1);
    return (forward.includes(nearest) ? forward : walk(-1)).map((i) => screen[i]);
  };
  const rimArc = frontArc(innerLocal, height);
  const outerLocal = outlineSamples(outer);
  const baseArc = frontArc(outerLocal, 0);
  const lift = (p: Vec2): Vec2 => [p[0], p[1] - height];
  const front = [...rimArc, lift(baseArc[baseArc.length - 1]), ...[...baseArc].reverse(), lift(baseArc[0])];
  return {
    body: prism(c, outer, flat([0, 0], 0), [0, 0, height]),
    rim: outlinePath(c, inner, flat([0, 0], height)),
    bed: outlinePath(c, inner, flat([0, 0], bedZ)),
    backCrease: segment(c, [back[0], back[1], height], [back[0], back[1], bedZ]),
    front: `M${front.map(fmt).join(" L")} Z`,
  };
}

function useSvgId(prefix: string) {
  return `${prefix}${React.useId().replace(/[^\w-]/g, "")}`;
}

function OpenBoxShape({ box, ink }: { box: OpenBox; ink: number }) {
  const clipId = useSvgId("glyph-clip");
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d={box.rim} />
        </clipPath>
      </defs>
      <PrismShape shape={box.body} ink={ink} />
      <g clipPath={`url(#${clipId})`} strokeOpacity={ink * 0.6}>
        <path d={box.bed} />
        <path d={box.backCrease} strokeOpacity={ink * 0.35} />
      </g>
      <path d={box.rim} strokeOpacity={ink} />
    </>
  );
}

/** Mảnh đậm rơi vào chỗ một lần khi hiện: bay vào từ độ lệch `from`, nghiêng hoặc thu nhỏ rồi về đúng chỗ theo lò xo. */
interface DropFrom {
  x: number;
  y: number;
  rotate?: number;
  scale?: number;
  delay?: number;
  stiffness?: number;
  damping?: number;
}

function DropIn({ from, children }: { from: DropFrom; children: React.ReactNode }) {
  const delay = from.delay ?? 0.18;
  return (
    <m.g
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      initial={{ x: from.x, y: from.y, rotate: from.rotate ?? 0, scale: from.scale ?? 1, opacity: 0 }}
      animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
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

/** `box`: khung vuông 96px, nét vẽ giữa khung (bố cục căn giữa); `tight`: vừa khít nét vẽ, cùng tỉ lệ (khối căn trái). */
type GlyphFit = "box" | "tight";

interface GlyphProps {
  className?: string;
  fit?: GlyphFit;
}

function GlyphSvg({
  name,
  bounds,
  fit = "box",
  className,
  children,
}: GlyphProps & { name: EmptyGlyphName; bounds: Bounds; children: React.ReactNode }) {
  const pad = 0.75;
  const [x, y, w, h] =
    fit === "tight" ? [bounds.minX - pad, bounds.minY - pad, bounds.maxX - bounds.minX + pad * 2, bounds.maxY - bounds.minY + pad * 2] : [0, 0, 56, 56];
  return (
    <svg
      viewBox={[x, y, w, h].map((v) => +v.toFixed(2)).join(" ")}
      width={Math.round(w * TIGHT_SCALE)}
      height={Math.round(h * TIGHT_SCALE)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-slot="empty-state-glyph"
      data-glyph={name}
      className={cn("block shrink-0 overflow-visible text-foreground", fit === "box" && "size-24", className)}
    >
      {children}
    </svg>
  );
}

/* Ba tấm xếp chồng trên nền viền đứt: "Đã đọc hết" tấm trên cùng rơi đúng chỗ, "Lỗi tải" tấm trên cùng rơi lệch. */
const stack = (askew: boolean) =>
  place((c) => {
    const plate = (z: number, center: Vec2 = [0, 0], yaw = 0) => prism(c, rrect(21, 21, 4.5), flat(center, z, yaw), [0, 0, 2.5]);
    return {
      floor: outlinePath(c, rrect(29, 29, 6), flat([0, 0], 0)),
      base: [plate(4), plate(12)],
      top: askew ? plate(20, [2.5, -1.5], 17) : plate(20),
    };
  });
const STACK = stack(false);
const STACK_ASKEW = stack(true);

function StackGlyph({ askew, ...props }: GlyphProps & { askew?: boolean }) {
  const shape = askew ? STACK_ASKEW : STACK;
  return (
    <GlyphSvg name={askew ? "load-error" : "all-done"} bounds={shape.bounds} {...props}>
      <path d={shape.floor} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      {shape.base.map((plate, index) => (
        <PrismShape key={index} shape={plate} ink={INK.base} />
      ))}
      <DropIn from={askew ? { x: -3, y: -11, rotate: 12, stiffness: 320, damping: 14 } : { x: 4, y: -10, rotate: -14 }}>
        <PrismShape shape={shape.top} ink={INK.piece} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Khay thư để mở hạ xuống nền viền đứt; lòng khay thấy đáy và góc trong phía sau. */
const TRAY = place((c) => ({
  floor: outlinePath(c, rrect(36, 30, 8), flat([0, 0], 0)),
  box: openBox(c, 30, 24, 5, 2, 6.5, 1.5),
}));

function TrayGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="inbox" bounds={TRAY.bounds} {...props}>
      <path d={TRAY.floor} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      <DropIn from={{ x: 0, y: -9, rotate: -8 }}>
        <OpenBoxShape box={TRAY.box} ink={INK.piece} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Hộp lưu trữ có khe tay cầm ở mặt trái; nắp đậy rơi xuống. */
const BOX = place((c) => ({
  floor: outlinePath(c, rrect(32, 32, 7), flat([0, 0], 0)),
  body: prism(c, rrect(24, 24, 3.5), flat([0, 0], 0), [0, 0, 11]),
  slot: outlinePath(c, rrect(9, 2.6, 1.3), wallY(12, [0, 6])),
  lid: prism(c, rrect(27, 27, 4.5), flat([0, 0], 11), [0, 0, 3.5]),
}));

function ArchiveGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="archive" bounds={BOX.bounds} {...props}>
      <path d={BOX.floor} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      <PrismShape shape={BOX.body} ink={INK.base} />
      <path d={BOX.slot} strokeOpacity={INK.base} />
      <DropIn from={{ x: 3, y: -10, rotate: -12 }}>
        <PrismShape shape={BOX.lid} ink={INK.piece} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Hai thẻ danh sách nằm trên mặt phẳng; con trỏ lướt vào chọn thẻ trước. */
const LIST = place((c) => {
  const thickness = 1.75;
  const tip = c.project([3.5, 7.5, thickness]);
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
    rows: [-6.5, 6.5].map((cy) => ({
      shape: prism(c, rrect(28, 10, 3), flat([0, cy], 0), [0, 0, thickness]),
      dot: flatCircle(c, [-9.5, cy, thickness], 1.8),
      line: segment(c, [-5.5, cy, thickness], [9, cy, thickness]),
    })),
    cursor: `M${arrow.map(([x, y]) => fmt(c.track([tip[0] + x, tip[1] + y]))).join(" L")} Z`,
  };
});

function ListSelectGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="inbox-select" bounds={LIST.bounds} {...props}>
      {LIST.rows.map((row, index) => (
        <g key={index}>
          <PrismShape shape={row.shape} ink={INK.base} />
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
const LENS = place((c) => {
  const center: Vec3 = [-2.5, -3.5, 12];
  const [outerR, innerR, thickness] = [12.5, 10.3, 1.5];
  const dir: Vec2 = [-0.15, 1];
  const len = Math.hypot(dir[0], dir[1]);
  const u: Vec2 = [dir[0] / len, dir[1] / len];
  const handleLength = 11.5;
  const reach = outerR - 1 + handleLength / 2;
  const outer = flatCircle(c, center, outerR);
  const under = c.at([center[0], center[1], 0]);
  return {
    tiles: [
      [-6.75, -6.75],
      [-6.75, 6.75],
      [6.75, -6.75],
      [6.75, 6.75],
    ].map(([cx, cy]) => prism(c, rrect(11, 11, 2.4), flat([cx, cy], 0), [0, 0, 1.5])),
    handle: prism(
      c,
      rrect(handleLength, 3, 1.5),
      flat([center[0] + u[0] * reach, center[1] + u[1] * reach], center[2] - thickness, (Math.atan2(u[1], u[0]) * 180) / Math.PI),
      [0, 0, thickness],
    ),
    outer,
    outerBottom: { ...outer, cy: outer.cy + thickness },
    inner: flatCircle(c, center, innerR),
    innerBottom: flatCircle(c, [center[0], center[1], center[2] - thickness], innerR),
    body: `M${fmt([outer.cx - outer.rx, outer.cy])} L${fmt([outer.cx + outer.rx, outer.cy])} L${fmt([outer.cx + outer.rx, outer.cy + thickness])} L${fmt([outer.cx - outer.rx, outer.cy + thickness])} Z`,
    edges: `M${fmt([outer.cx - outer.rx, outer.cy])} l0 ${thickness} M${fmt([outer.cx + outer.rx, outer.cy])} l0 ${thickness}`,
    magnify: (dx: number, dy: number, scale = 1.6) =>
      `translate(${(outer.cx - scale * (under[0] + dx)).toFixed(2)} ${(outer.cy - scale * (under[1] + dy)).toFixed(2)}) scale(${scale})`,
  };
});

function Tiles({ ink }: { ink: number }) {
  return LENS.tiles.map((shape, index) => <PrismShape key={index} shape={shape} ink={ink} />);
}

function MagnifierGlyph(props: GlyphProps) {
  const clipId = useSvgId("glyph-clip");
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
    <GlyphSvg name="no-results" bounds={LENS.bounds} {...props}>
      <defs>
        <clipPath id={clipId}>
          <ellipse {...LENS.inner} />
        </clipPath>
      </defs>
      <Tiles ink={INK.base} />
      <g ref={lensRef}>
        <PrismShape shape={LENS.handle} ink={INK.piece} />
        <g strokeOpacity={INK.piece}>
          <ellipse {...LENS.outerBottom} fill="var(--card)" />
          <path d={LENS.body} fill="var(--card)" stroke="none" />
          <ellipse {...LENS.outer} fill="var(--card)" stroke="none" />
          <path d={LENS.edges} />
          <g clipPath={`url(#${clipId})`}>
            <g ref={zoomRef} transform={LENS.magnify(0, 0)}>
              <Tiles ink={INK.base * 0.8} />
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

/* Bảng việc có kẹp và ba dòng việc; dấu tích của dòng đầu bật vào ô. */
const BOARD = place((c) => {
  const z = 2.5;
  const rows = [-6, 1, 8];
  const [boxX, checkRow] = [-8, rows[0]];
  return {
    board: prism(c, rrect(26, 32, 3), flat([0, 0], 0), [0, 0, z]),
    clip: prism(c, rrect(10, 4, 1.4), flat([0, -15.5], z), [0, 0, 1.8]),
    boxes: rows.map((y) => outlinePath(c, rrect(4.2, 4.2, 1), flat([boxX, y], z))).join(" "),
    done: segment(c, [-3.5, rows[0], z], [8, rows[0], z]),
    todo: [segment(c, [-3.5, rows[1], z], [8, rows[1], z]), segment(c, [-3.5, rows[2], z], [4, rows[2], z])].join(" "),
    check: polyline(c, [
      [boxX - 2, checkRow + 0.2, z],
      [boxX - 0.5, checkRow + 1.9, z],
      [boxX + 2.8, checkRow - 2.4, z],
    ]),
  };
});

function TasksGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="tasks" bounds={BOARD.bounds} {...props}>
      <PrismShape shape={BOARD.board} ink={INK.base} />
      <path d={BOARD.boxes} strokeOpacity={INK.base} />
      <path d={BOARD.done} strokeOpacity={INK.base * 0.5} />
      <path d={BOARD.todo} strokeOpacity={INK.base * 0.8} />
      <PrismShape shape={BOARD.clip} ink={INK.base} />
      <DropIn from={{ x: 0, y: -2, scale: 0.3, delay: 0.3, stiffness: 420, damping: 18 }}>
        <path d={BOARD.check} strokeOpacity={INK.piece} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Đồng hồ báo thức đứng: kim phút quay gần một vòng rồi dừng ở số 12 (đã quá giờ). */
const CLOCK = place((c) => {
  const [R, depth, lift] = [12.5, 5.5, 3];
  const zc = R + lift;
  const polar = (radius: number, deg: number): Vec2 => [radius * Math.sin(rad(deg)), radius * Math.cos(rad(deg))];
  const face = wallY(depth / 2, [0, zc]);
  const onFace = (p: Vec2) => face(p[0], p[1]);
  const hand = (deg: number, length: number, project: (p: Vec3) => Vec2) =>
    `M${fmt(project(onFace([0, 0])))} L${fmt(project(onFace(polar(length, deg))))}`;
  const ticks = Array.from({ length: 12 }, (_, i) =>
    segment(c, onFace(polar(i % 3 === 0 ? R - 4 : R - 3, i * 30)), onFace(polar(R - 2, i * 30))),
  ).join(" ");
  hand(360, 8.5, c.project);
  return {
    floor: outlinePath(c, rrect(30, 15, 5), flat([0, 0], 0)),
    bells: [-40, 40].map((deg) => {
      const [a, b] = polar(R + 0.6, deg);
      return prism(c, circle(3.6), wallY(-depth / 2 + 1, [a, zc + b]), [0, depth - 2, 0], false);
    }),
    feet: [-6.5, 6.5].map((x) => prism(c, rrect(3.2, 3.2, 1.1), flat([x, 0], 0), [0, 0, lift + 1])),
    body: prism(c, circle(R), wallY(-depth / 2, [0, zc]), [0, depth, 0], false),
    rim: outlinePath(c, circle(R - 1.4), face),
    ticks,
    hourHand: hand(120, 5.5, c.project),
    minuteHand: (deg: number) => hand(deg, 8.5, c.at),
    cap: outlinePath(c, circle(0.9), face),
  };
});
const CLOCK_SWEEP = { from: 60, to: 360, delay: 0.25, duration: 1.4 };

function ClockGlyph(props: GlyphProps) {
  const reduceMotion = useReducedMotion();
  const handRef = React.useRef<SVGPathElement>(null);
  const done = React.useRef(false);

  // Kim phút quay 300° chậm dần (1,4 giây) một lần; giảm chuyển động thì đặt ngay vị trí cuối
  useAnimationFrame((time) => {
    if (done.current || !handRef.current) return;
    const progress = reduceMotion ? 1 : Math.min(1, Math.max(0, (time / 1000 - CLOCK_SWEEP.delay) / CLOCK_SWEEP.duration));
    const eased = 1 - (1 - progress) ** 3;
    handRef.current.setAttribute("d", CLOCK.minuteHand(CLOCK_SWEEP.from + (CLOCK_SWEEP.to - CLOCK_SWEEP.from) * eased));
    if (progress >= 1) done.current = true;
  });

  return (
    <GlyphSvg name="overdue" bounds={CLOCK.bounds} {...props}>
      <path d={CLOCK.floor} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      {CLOCK.feet.map((foot, index) => (
        <PrismShape key={`foot${index}`} shape={foot} ink={INK.base} />
      ))}
      {CLOCK.bells.map((bell, index) => (
        <PrismShape key={`bell${index}`} shape={bell} ink={INK.base} />
      ))}
      <PrismShape shape={CLOCK.body} ink={INK.base} />
      <path d={CLOCK.rim} strokeOpacity={INK.base * 0.6} />
      <path d={CLOCK.ticks} strokeOpacity={INK.base * 0.8} />
      <path d={CLOCK.hourHand} strokeOpacity={INK.base} />
      <path ref={handRef} d={CLOCK.minuteHand(CLOCK_SWEEP.from)} strokeOpacity={INK.piece} />
      <path d={CLOCK.cap} fill="var(--card)" strokeOpacity={INK.piece} />
    </GlyphSvg>
  );
}

/* Văn bản đến: tờ văn bản hạ xuống khay để mở. */
const DOC_IN = place((c) => {
  const sheetZ = 9.5;
  const top = sheetZ + 1;
  return {
    floor: outlinePath(c, rrect(36, 30, 8), flat([0, 0], 0)),
    box: openBox(c, 30, 24, 5, 2, 6, 1.2),
    sheet: prism(c, rrect(19, 14, 1.6), flat([0, 0], sheetZ), [0, 0, 1]),
    lines: [
      segment(c, [-6, -3.5, top], [6, -3.5, top]),
      segment(c, [-6, 0, top], [6, 0, top]),
      segment(c, [-6, 3.5, top], [2, 3.5, top]),
    ].join(" "),
  };
});

function DocInGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="doc-in" bounds={DOC_IN.bounds} {...props}>
      <path d={DOC_IN.floor} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      <OpenBoxShape box={DOC_IN.box} ink={INK.base} />
      <DropIn from={{ x: -4, y: -10, rotate: -10 }}>
        <PrismShape shape={DOC_IN.sheet} ink={INK.piece} />
        <path d={DOC_IN.lines} strokeOpacity={INK.piece * 0.6} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Văn bản đi: phong bì bay lên về phía sau bên phải, để lại hai vệt viền đứt. */
const DOC_OUT = place((c) => {
  const footprint = rrect(24, 16, 2);
  const at: Vec2 = [0, -7];
  const z = 8;
  const top = z + 1.5;
  return {
    trail: [outlinePath(c, footprint, flat([0, 7], 0)), outlinePath(c, footprint, flat([0, 0], z / 2))],
    envelope: prism(c, footprint, flat(at, z), [0, 0, 1.5]),
    flap: polyline(c, [
      [-10.5, at[1] - 6.5, top],
      [0, at[1] + 1.5, top],
      [10.5, at[1] - 6.5, top],
    ]),
  };
});

function DocOutGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="doc-out" bounds={DOC_OUT.bounds} {...props}>
      <path d={DOC_OUT.trail[0]} strokeOpacity={INK.floor * 0.7} strokeDasharray={DASH} />
      <path d={DOC_OUT.trail[1]} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      <DropIn from={{ x: -9, y: 5, rotate: 6, stiffness: 200, damping: 20 }}>
        <PrismShape shape={DOC_OUT.envelope} ink={INK.piece} />
        <path d={DOC_OUT.flap} strokeOpacity={INK.piece * 0.6} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Tờ trình: tờ giấy có chữ ký; cây bút đặt xuống cạnh chữ ký. */
const SUBMISSION = place((c) => {
  const z = 1.2;
  const [radius, length, coneLength] = [1.7, 16, 3.4];
  const dir: Vec2 = [0.62, -0.78];
  const len = Math.hypot(dir[0], dir[1]);
  const u: Vec3 = [dir[0] / len, dir[1] / len, 0];
  const normal: Vec3 = [-u[1], u[0], 0];
  const tip: Vec3 = [9.5, 9.6, z + 0.4];
  const front: Vec3 = [tip[0] - u[0] * coneLength, tip[1] - u[1] * coneLength, z + radius];
  const back: Vec3 = [front[0] - u[0] * length, front[1] - u[1] * length, front[2]];
  const ring = (center: Vec3): Plane => (a, b) => [center[0] + a * normal[0], center[1] + a * normal[1], center[2] + b];
  // Mũi bút: tam giác từ hai điểm tiếp tuyến của vòng đầu bút tới đầu ngòi
  const e = c.vec(u);
  const rim = outlineSamples(circle(radius)).map(([a, b]) => c.at(ring(front)(a, b)));
  const side = (p: Vec2) => -p[0] * e[1] + p[1] * e[0];
  const [left, right] = [rim[argBest(rim, (p) => -side(p))], rim[argBest(rim, side)]];
  const nib = c.project(tip);
  return {
    sheet: prism(c, rrect(22, 28, 1.6), flat([0, 0], 0), [0, 0, z]),
    lines: [
      segment(c, [-7, -9, z], [7, -9, z]),
      segment(c, [-7, -5, z], [7, -5, z]),
      segment(c, [-7, -1, z], [3, -1, z]),
    ].join(" "),
    signature: polyline(
      c,
      Array.from({ length: 14 }, (_, i): Vec3 => [1 + i * 0.6, 8 + Math.sin(i * 1.25) * 1.1 - i * 0.05, z]),
    ),
    pen: prism(c, circle(radius), ring(back), [u[0] * length, u[1] * length, 0], false),
    nib: `M${fmt(left)} L${fmt(nib)} L${fmt(right)}`,
  };
});

function SubmissionGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="submission" bounds={SUBMISSION.bounds} {...props}>
      <PrismShape shape={SUBMISSION.sheet} ink={INK.base} />
      <path d={SUBMISSION.lines} strokeOpacity={INK.base * 0.8} />
      <path d={SUBMISSION.signature} strokeOpacity={INK.base} />
      <DropIn from={{ x: 5, y: -9, rotate: 14, delay: 0.22 }}>
        <PrismShape shape={SUBMISSION.pen} ink={INK.piece} />
        <path d={`${SUBMISSION.nib} Z`} fill="var(--card)" stroke="none" />
        <path d={SUBMISSION.nib} strokeOpacity={INK.piece} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Hồ sơ: các bìa hồ sơ có tab đứng trong hộp; bìa trước cùng thả vào hộp. */
const DOSSIER = place((c) => {
  const folder = (x: number, tab: number) =>
    prism(
      c,
      roundedPolygon(
        [
          [-8.5, 1.5],
          [8.5, 1.5],
          [8.5, 13.5],
          [tab + 6, 13.5],
          [tab + 5, 15.5],
          [tab + 1, 15.5],
          [tab, 13.5],
          [-8.5, 13.5],
        ],
        [1, 1, 1.2, 0.6, 0.8, 0.8, 0.6, 1.2],
      ),
      wallX(x, [0, 0]),
      [1, 0, 0],
    );
  return {
    floor: outlinePath(c, rrect(26, 30, 7), flat([0, 0], 0)),
    box: openBox(c, 18, 22, 3, 1.6, 8, 1.2),
    folders: [folder(-5, -7.5), folder(-0.5, -3), folder(4, 1.5)],
  };
});

function DossierGlyph(props: GlyphProps) {
  const maskId = useSvgId("glyph-mask");
  const [back, middle, front] = DOSSIER.folders;
  return (
    <GlyphSvg name="dossier" bounds={DOSSIER.bounds} {...props}>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-20" y="-20" width="96" height="96">
          <rect x="-20" y="-20" width="96" height="96" fill="white" stroke="none" />
          <path d={DOSSIER.box.front} fill="black" stroke="none" />
        </mask>
      </defs>
      <path d={DOSSIER.floor} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      <OpenBoxShape box={DOSSIER.box} ink={INK.base} />
      <g mask={`url(#${maskId})`}>
        <PrismShape shape={back} ink={INK.base} />
        <PrismShape shape={middle} ink={INK.base} />
        <DropIn from={{ x: 0, y: -12, rotate: 0, delay: 0.22, stiffness: 240, damping: 18 }}>
          <PrismShape shape={front} ink={INK.piece} />
        </DropIn>
      </g>
    </GlyphSvg>
  );
}

/* Yêu cầu phối hợp: hai đơn vị (khối có cửa quay vào nhau), phong thư nhỏ đi trên đường nối. */
const UNITS = place((c) => {
  const size = 11;
  const [a, b]: Vec2[] = [
    [-10, 10],
    [10, -10],
  ];
  const cube = ([cx, cy]: Vec2) => prism(c, rrect(size, size, 2.4), flat([cx, cy], 0), [0, 0, 12]);
  const token: Vec2 = [1.5, -1.5];
  const z = 3.5;
  return {
    path: segment(c, [a[0] + 6, a[1] - 6, 0], [b[0] - 6, b[1] + 6, 0]),
    cubes: [cube(a), cube(b)],
    doors: [
      outlinePath(c, rrect(3.4, 5.6, 1.1), wallX(a[0] + size / 2, [a[1], 3])),
      outlinePath(c, rrect(3.4, 5.6, 1.1), wallY(b[1] + size / 2, [b[0], 3])),
    ].join(" "),
    token: prism(c, rrect(9, 6, 1.3), flat(token, z), [0, 0, 1.3]),
    flap: polyline(c, [
      [token[0] - 3.7, token[1] - 2.2, z + 1.3],
      [token[0], token[1] + 0.7, z + 1.3],
      [token[0] + 3.7, token[1] - 2.2, z + 1.3],
    ]),
  };
});

function UnitRequestGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="unit-request" bounds={UNITS.bounds} {...props}>
      <path d={UNITS.path} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      {UNITS.cubes.map((cube, index) => (
        <PrismShape key={index} shape={cube} ink={INK.base} />
      ))}
      <path d={UNITS.doors} strokeOpacity={INK.base} />
      <DropIn from={{ x: -11, y: 0, rotate: 0, delay: 0.22, stiffness: 180, damping: 20 }}>
        <PrismShape shape={UNITS.token} ink={INK.piece} />
        <path d={UNITS.flap} strokeOpacity={INK.piece * 0.6} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Mẫu và lặp lại: bản mẫu viền đứt, bản sao nét đậm nhấc ra phía trước. */
const TEMPLATES = place((c) => {
  const sheet = rrect(20, 24, 2);
  const lines = (cx: number, cy: number, z: number) =>
    [
      segment(c, [cx - 6, cy - 6, z], [cx + 6, cy - 6, z]),
      segment(c, [cx - 6, cy - 2.5, z], [cx + 6, cy - 2.5, z]),
      segment(c, [cx - 6, cy + 1, z], [cx + 2, cy + 1, z]),
    ].join(" ");
  return {
    ghost: prism(c, sheet, flat([-5, -5], 0), [0, 0, 1.4]),
    ghostLines: lines(-5, -5, 1.4),
    copy: prism(c, sheet, flat([5, 5], 4.5), [0, 0, 1.4]),
    copyLines: lines(5, 5, 5.9),
  };
});

function TemplatesGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="templates" bounds={TEMPLATES.bounds} {...props}>
      <PrismShape shape={TEMPLATES.ghost} ink={INK.base} dash={DASH} />
      <path d={TEMPLATES.ghostLines} strokeOpacity={INK.base * 0.7} strokeDasharray={DASH} />
      <DropIn from={{ x: 0, y: -9, rotate: -6, delay: 0.22 }}>
        <PrismShape shape={TEMPLATES.copy} ink={INK.piece} />
        <path d={TEMPLATES.copyLines} strokeOpacity={INK.piece * 0.6} />
      </DropIn>
    </GlyphSvg>
  );
}

/* Lịch để bàn đứng: tờ lịch nét đậm trượt xuống trước khối lịch, có vòng gáy và lưới ngày. */
const CALENDAR = place((c) => {
  const [w, h, depth] = [24, 21, 5];
  const [pw, ph, drop] = [w - 2, h - 3, 0.8];
  const pageCenter: Vec2 = [0, h / 2 - drop];
  const face = wallY(depth / 2 + 1, pageCenter);
  const dates = Array.from({ length: 12 }, (_, i) => {
    const [row, col] = [Math.floor(i / 4), i % 4];
    return outlinePath(c, circle(0.7), (a, b) => face(-6.6 + col * 4.4 + a, 1.6 - row * 4 + b));
  });
  return {
    floor: outlinePath(c, rrect(30, 13, 5), flat([0, 0], 0)),
    block: prism(c, rrect(w, h, 3), wallY(-depth / 2, [0, h / 2]), [0, depth, 0]),
    page: prism(c, rrect(pw, ph, 2.4), wallY(depth / 2, pageCenter), [0, 1, 0]),
    header: segment(c, face(-pw / 2 + 1.6, ph / 2 - 4.6), face(pw / 2 - 1.6, ph / 2 - 4.6)),
    dates: dates.join(" "),
    today: outlinePath(c, circle(1.9), (a, b) => face(-6.6 + 2 * 4.4 + a, 1.6 - 4 + b)),
    rings: [-6, 6].map((a) => outlinePath(c, rrect(1.8, 4.8, 0.9), wallY(depth / 2 + 1.2, [a, h - 0.6]))).join(" "),
  };
});

function CalendarGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="calendar" bounds={CALENDAR.bounds} {...props}>
      <path d={CALENDAR.floor} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      <PrismShape shape={CALENDAR.block} ink={INK.base} />
      <DropIn from={{ x: 0, y: -10, rotate: 0, delay: 0.22 }}>
        <PrismShape shape={CALENDAR.page} ink={INK.piece} />
        <path d={CALENDAR.header} strokeOpacity={INK.piece * 0.6} />
        <path d={CALENDAR.dates} strokeOpacity={INK.piece * 0.5} />
        <path d={CALENDAR.today} strokeOpacity={INK.piece} />
      </DropIn>
      <path d={CALENDAR.rings} fill="var(--card)" strokeOpacity={INK.base} />
    </GlyphSvg>
  );
}

/* Cơ cấu & Danh bạ: người phụ trách (quân cờ lớn, nét đậm) nối với ba người qua đường viền đứt trên nền. */
const PEOPLE = place((c) => {
  const pawn = (center: Vec2, scale = 1) => {
    const [r, height, head] = [3.3 * scale, 7 * scale, 2.9 * scale];
    const [hx, hy] = c.project([center[0], center[1], height + head * 0.85]);
    c.track([hx - head, hy - head]);
    c.track([hx + head, hy + head]);
    return {
      base: prism(c, circle(r + 0.9), flat(center, 0), [0, 0, 1], false),
      body: prism(c, circle(r), flat(center, 1), [0, 0, height - 1], false),
      head: { cx: hx, cy: hy, r: head },
    };
  };
  const lead: Vec2 = [-9.5, -9.5];
  const members: Vec2[] = [
    [-11, 8],
    [8, -11],
    [8, 8],
  ];
  return {
    links: members.map((p) => segment(c, [lead[0], lead[1], 0], [p[0], p[1], 0])).join(" "),
    lead: pawn(lead, 1.2),
    members: members.map((p) => pawn(p)),
  };
});

function Pawn({ pawn, ink }: { pawn: (typeof PEOPLE)["lead"]; ink: number }) {
  return (
    <>
      <PrismShape shape={pawn.base} ink={ink} />
      <PrismShape shape={pawn.body} ink={ink} />
      <circle {...pawn.head} fill="var(--card)" strokeOpacity={ink} />
    </>
  );
}

function DirectoryGlyph(props: GlyphProps) {
  return (
    <GlyphSvg name="directory" bounds={PEOPLE.bounds} {...props}>
      <path d={PEOPLE.links} strokeOpacity={INK.floor} strokeDasharray={DASH} />
      <DropIn from={{ x: 0, y: -10, rotate: 0, delay: 0.22 }}>
        <Pawn pawn={PEOPLE.lead} ink={INK.piece} />
      </DropIn>
      {PEOPLE.members.map((pawn, index) => (
        <Pawn key={index} pawn={pawn} ink={INK.base} />
      ))}
    </GlyphSvg>
  );
}

export function EmptyGlyph({ name, ...props }: GlyphProps & { name: EmptyGlyphName }) {
  switch (name) {
    case "no-results":
      return <MagnifierGlyph {...props} />;
    case "all-done":
      return <StackGlyph {...props} />;
    case "load-error":
      return <StackGlyph askew {...props} />;
    case "inbox":
      return <TrayGlyph {...props} />;
    case "archive":
      return <ArchiveGlyph {...props} />;
    case "inbox-select":
      return <ListSelectGlyph {...props} />;
    case "tasks":
      return <TasksGlyph {...props} />;
    case "overdue":
      return <ClockGlyph {...props} />;
    case "doc-in":
      return <DocInGlyph {...props} />;
    case "doc-out":
      return <DocOutGlyph {...props} />;
    case "submission":
      return <SubmissionGlyph {...props} />;
    case "dossier":
      return <DossierGlyph {...props} />;
    case "unit-request":
      return <UnitRequestGlyph {...props} />;
    case "templates":
      return <TemplatesGlyph {...props} />;
    case "calendar":
      return <CalendarGlyph {...props} />;
    case "directory":
      return <DirectoryGlyph {...props} />;
  }
}
