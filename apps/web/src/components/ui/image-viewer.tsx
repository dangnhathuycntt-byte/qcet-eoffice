"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DialogBackdrop, DialogClose, DialogPopup, DialogPortal, DialogRoot, DialogTitle } from "@/components/ui/dialog";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";

/**
 * Trình xem ảnh toàn màn hình (người dùng yêu cầu 21/10/2026 "nhấn vào thì hiện ảnh to ra cho toàn bộ mọi chỗ có hình
 * ảnh", gửi ảnh trình xem của Google Keep): nền tối, thanh trên có Đóng, tên ảnh, số thứ tự và Tải về; thanh thu phóng
 * dạng viên ở đáy (−, phần trăm so với vừa màn hình, +); nhiều ảnh thì có nút trước/sau, ←/→, vuốt ngang trên điện thoại.
 *
 * Plate có `openImagePreview` nhưng gắn với `ImagePlugin` của Plate và một editor; khối ảnh của QCET là plugin riêng và ảnh
 * đính kèm của Trợ lý không nằm trong editor, nên dùng chung một trình xem tự viết cho mọi nơi.
 *
 * Cách dùng: bọc ảnh bằng `ImageViewerTrigger`; gắn `data-image-viewer-group` lên khối chứa (editor, một tin nhắn) để các
 * ảnh trong khối đó xem nối tiếp theo thứ tự trên trang.
 */

export interface ViewerImage {
  src: string;
  /** Chú thích hoặc tên tệp: tiêu đề của trình xem và tên tệp khi tải về. */
  title: string;
}

type Size = { width: number; height: number };

export const IMAGE_ZOOM_STEP = 1.5;
export const IMAGE_ZOOM_MAX = 4;
/** Đệm ngang quanh ảnh khi vừa màn hình: chừa chỗ cho nút trước/sau từ 640px; khớp `px-3 sm:px-16` của khung ảnh. */
const STAGE_PAD_X = { phone: 12, wide: 64 };
const STAGE_PAD_Y = 8;

export const clampImageZoom = (zoom: number) => Math.min(IMAGE_ZOOM_MAX, Math.max(1, zoom));

/** Một nấc phóng to/thu nhỏ (nhân/chia 1,5), trong khoảng vừa màn hình (1) tới 4 lần. */
export function stepImageZoom(zoom: number, direction: 1 | -1): number {
  const next = clampImageZoom(direction > 0 ? zoom * IMAGE_ZOOM_STEP : zoom / IMAGE_ZOOM_STEP);
  return Math.abs(next - 1) < 0.01 ? 1 : next;
}

/** Tỉ lệ để ảnh vừa khung; ảnh nhỏ hơn khung giữ cỡ thật, không phóng mờ. */
export function fitImageScale(natural: Size, box: Size): number {
  if (natural.width <= 0 || natural.height <= 0 || box.width <= 0 || box.height <= 0) return 1;
  return Math.min(1, box.width / natural.width, box.height / natural.height);
}

/** Tên tệp khi tải về: tên ảnh nếu đã có đuôi, không thì tên ở cuối đường dẫn, cuối cùng là "hinh-anh". */
export function imageDownloadName(image: ViewerImage): string {
  if (/\.[a-z0-9]{2,5}$/i.test(image.title)) return image.title;
  if (!image.src.startsWith("data:") && !image.src.startsWith("blob:")) {
    const last = image.src.split(/[?#]/)[0].split("/").pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last);
  }
  return "hinh-anh";
}

const TRIGGER_SELECTOR = "[data-image-viewer-src]";

/** Các ảnh cùng khối `data-image-viewer-group` với ảnh vừa bấm, theo thứ tự trên trang. */
function collectGroupImages(trigger: HTMLElement): { images: ViewerImage[]; index: number } {
  const root = trigger.closest("[data-image-viewer-group]");
  const triggers = (root ? Array.from(root.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR)) : [trigger]).filter(
    (el) => el.dataset.imageViewerSrc
  );
  const list = triggers.includes(trigger) ? triggers : [trigger];
  return {
    images: list.map((el) => ({ src: el.dataset.imageViewerSrc ?? "", title: el.dataset.imageViewerTitle ?? "" })),
    index: Math.max(0, list.indexOf(trigger)),
  };
}

/** Trạng thái mở trình xem; `element` đặt ngay cạnh nơi gọi (cùng cây React để lồng đúng trong hộp thoại đang mở). */
export function useImageViewer() {
  const [state, setState] = React.useState<{ images: ViewerImage[]; index: number; open: boolean; session: number } | null>(null);
  const show = React.useCallback((images: ViewerImage[], index = 0) => {
    if (images.length === 0) return;
    setState((current) => ({
      images,
      index: Math.min(Math.max(0, index), images.length - 1),
      open: true,
      // Mỗi lần mở là một lượt mới: không giữ mức phóng của lần xem trước
      session: (current?.session ?? 0) + 1,
    }));
  }, []);
  const element = state ? (
    <ImageViewer
      key={state.session}
      images={state.images}
      index={state.index}
      open={state.open}
      onIndexChange={(index) => setState((current) => current && { ...current, index })}
      onOpenChange={(open) => setState((current) => current && { ...current, open })}
    />
  ) : null;
  return { show, element };
}

export interface ImageViewerTriggerProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  src: string;
  title: string;
}

/** Vùng bấm quanh một ảnh: bấm (hoặc Enter/Space) mở trình xem từ ảnh này. Con trỏ kính lúp như Google Keep. */
export const ImageViewerTrigger = React.forwardRef<HTMLButtonElement, ImageViewerTriggerProps>(function ImageViewerTrigger(
  { src, title, className, onClick, children, ...props },
  ref
) {
  const viewer = useImageViewer();
  return (
    <>
      <Pressable
        ref={ref}
        data-image-viewer-src={src}
        data-image-viewer-title={title}
        aria-label={`Xem ảnh lớn: ${title}`}
        aria-haspopup="dialog"
        className={cn("block cursor-zoom-in", className)}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          const { images, index } = collectGroupImages(event.currentTarget);
          viewer.show(images, index);
        }}
        {...props}
      >
        {children}
      </Pressable>
      {viewer.element}
    </>
  );
});

// Trình xem nằm trong cây React của nơi mở (editor, khung chat, hộp tạo việc) dù hiển thị ở portal: sự kiện React vẫn nổi
// lên các tổ tiên đó (bấm vào nền trang nhiệm vụ đưa con trỏ vào editor, dán, thả tệp…). Chặn tại trình xem.
const stop = (event: React.SyntheticEvent) => event.stopPropagation();
const ISOLATE = {
  onClick: stop,
  onDoubleClick: stop,
  onMouseDown: stop,
  onMouseUp: stop,
  onPointerDown: stop,
  onPointerUp: stop,
  onContextMenu: stop,
  onKeyUp: stop,
  onFocus: stop,
  onBlur: stop,
  onPaste: stop,
  onCopy: stop,
  onDragOver: stop,
  onDrop: stop,
  onWheel: stop,
};

export interface ImageViewerProps {
  images: ViewerImage[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
}

export function ImageViewer({ images, index, open, onOpenChange, onIndexChange }: ImageViewerProps) {
  const count = images.length;
  const current = Math.min(Math.max(0, index), count - 1);
  const image = images[current];
  const src = image?.src ?? "";

  // Trạng thái gắn với ảnh đang xem (khóa theo src): đổi ảnh thì về vừa màn hình và chờ tải, không cần effect đặt lại
  const [loaded, setLoaded] = React.useState<{ src: string; natural: Size } | null>(null);
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const [zoomState, setZoomState] = React.useState<{ src: string; zoom: number }>({ src, zoom: 1 });
  const natural = loaded?.src === src ? loaded.natural : null;
  const status = natural ? "ready" : failedSrc === src ? "error" : "loading";
  const zoom = zoomState.src === src ? zoomState.zoom : 1;
  const zoomed = zoom > 1;

  const [stage, setStage] = React.useState<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<Size>({ width: 0, height: 0 });
  const [dragging, setDragging] = React.useState(false);

  // Khung ảnh đo bằng offset (gồm thanh cuộn) để thanh cuộn xuất hiện khi phóng to không làm đổi tỉ lệ vừa màn hình
  React.useEffect(() => {
    if (!stage) return;
    const update = () => setBox({ width: stage.offsetWidth, height: stage.offsetHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  const padX = box.width >= 640 ? STAGE_PAD_X.wide : STAGE_PAD_X.phone;
  const fit = natural ? fitImageScale(natural, { width: box.width - 2 * padX, height: box.height - 2 * STAGE_PAD_Y }) : 1;
  const display = natural ? { width: Math.round(natural.width * fit * zoom), height: Math.round(natural.height * fit * zoom) } : null;

  // Phóng quanh một điểm (con trỏ, chỗ chạm) hoặc giữa khung: giữ điểm đó đứng yên sau khi đổi cỡ
  const anchorRef = React.useRef<{ fx: number; fy: number; px: number; py: number } | null>(null);
  const applyZoom = (next: number, point?: { x: number; y: number }) => {
    const target = clampImageZoom(next);
    if (!natural || Math.abs(target - zoom) < 0.001) return;
    if (stage) {
      const rect = stage.getBoundingClientRect();
      const px = point ? point.x - rect.left : stage.clientWidth / 2;
      const py = point ? point.y - rect.top : stage.clientHeight / 2;
      anchorRef.current = { fx: (stage.scrollLeft + px) / stage.scrollWidth, fy: (stage.scrollTop + py) / stage.scrollHeight, px, py };
    }
    setZoomState({ src, zoom: target });
  };
  const applyZoomRef = React.useRef(applyZoom);
  applyZoomRef.current = applyZoom;
  const zoomRef = React.useRef(zoom);
  zoomRef.current = zoom;

  React.useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !stage) return;
    anchorRef.current = null;
    stage.scrollLeft = anchor.fx * stage.scrollWidth - anchor.px;
    stage.scrollTop = anchor.fy * stage.scrollHeight - anchor.py;
  }, [zoom, stage]);

  // Chụm hai ngón trên bàn di chuột (wheel kèm Ctrl/⌘) phóng ảnh thay vì phóng cả trang; onWheel của React là passive
  React.useEffect(() => {
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      // Bàn di chuột gửi nhiều nấc nhỏ; con lăn chuột một nấc ~100: chặn mỗi lần tối đa khoảng một nấc nút (×1,65)
      const delta = Math.max(-50, Math.min(50, event.deltaY));
      applyZoomRef.current(zoomRef.current * Math.exp(-delta * 0.01), { x: event.clientX, y: event.clientY });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [stage]);

  const go = (delta: 1 | -1) => {
    const next = current + delta;
    if (next >= 0 && next < count) onIndexChange(next);
  };
  const toggleZoom = (point: { x: number; y: number }) => applyZoom(zoomed ? 1 : 2, point);

  // Chuột: kéo để xem phần khác khi đã phóng. Cảm ứng: vuốt ngang khi vừa màn hình để sang ảnh khác, chạm đúp để phóng
  // (khi đã phóng, một ngón kéo là cuộn gốc của trình duyệt)
  const gesture = React.useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean; touch: boolean } | null>(null);
  const lastTap = React.useRef<{ t: number; x: number; y: number } | null>(null);
  const lastPointerTouch = React.useRef(false);
  const suppressClick = React.useRef(false);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    lastPointerTouch.current = event.pointerType !== "mouse";
    if (event.button !== 0 || !stage) return;
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: stage.scrollLeft,
      top: stage.scrollTop,
      moved: false,
      touch: event.pointerType !== "mouse",
    };
    if (!gesture.current.touch && zoomed) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId || !stage) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
    if (!g.touch && zoomed) {
      stage.scrollLeft = g.left - dx;
      stage.scrollTop = g.top - dy;
    }
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    setDragging(false);
    if (!g || g.id !== event.pointerId) return;
    suppressClick.current = g.moved;
    if (!g.touch) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!zoomed && count > 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1);
      suppressClick.current = true;
      return;
    }
    if (g.moved) return;
    const tap = lastTap.current;
    if (tap && event.timeStamp - tap.t < 300 && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 30) {
      lastTap.current = null;
      toggleZoom({ x: event.clientX, y: event.clientY });
      suppressClick.current = true;
      return;
    }
    lastTap.current = { t: event.timeStamp, x: event.clientX, y: event.clientY };
  };
  const onPointerCancel = () => {
    gesture.current = null;
    setDragging(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") go(-1);
    else if (event.key === "ArrowRight") go(1);
    else if (event.key === "+" || event.key === "=") applyZoom(stepImageZoom(zoom, 1));
    else if (event.key === "-" || event.key === "_") applyZoom(stepImageZoom(zoom, -1));
    else if (event.key === "0") applyZoom(1);
    else return;
    event.preventDefault();
  };

  if (!image) return null;

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop
          {...ISOLATE}
          className="fixed inset-0 z-70 bg-scrim-strong transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
        />
        <DialogPopup
          {...ISOLATE}
          onKeyDown={onKeyDown}
          data-slot="image-viewer"
          className="fixed inset-0 z-70 flex flex-col text-white outline-none transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
        >
          <div className="box-content flex h-12 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top,0px)]">
            <DialogClose render={<Button variant="overlay" size="icon-md" aria-label="Đóng" title="Đóng (Esc)" />}>
              <X />
            </DialogClose>
            <DialogTitle className="min-w-0 flex-1 truncate text-compact font-medium text-white/90">{image.title || "Hình ảnh"}</DialogTitle>
            {count > 1 ? (
              <span className="shrink-0 text-xs tabular-nums text-white/60" aria-label={`Ảnh ${current + 1} trên ${count}`}>
                {current + 1} / {count}
              </span>
            ) : null}
            <Button asChild variant="overlay" size="icon-md">
              <a href={src} download={imageDownloadName(image)} target="_blank" rel="noopener noreferrer" aria-label="Tải ảnh về" title="Tải về">
                <Download />
              </a>
            </Button>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={setStage}
              data-slot="image-viewer-stage"
              className={cn(
                "thin-scrollbar absolute inset-0 overscroll-contain",
                zoomed ? "overflow-auto" : "overflow-hidden",
                zoomed && (dragging ? "cursor-grabbing" : "cursor-grab")
              )}
              // Vừa màn hình: mọi cử chỉ về trình xem (vuốt, chạm đúp), không để trình duyệt phóng cả trang. Đã phóng: một ngón
              // kéo là cuộn gốc, vẫn chặn chụm phóng trang
              style={{ touchAction: zoomed ? "pan-x pan-y" : "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              <div
                className="flex min-h-full w-max min-w-full items-center justify-center px-3 py-2 sm:px-16"
                onClick={(event) => {
                  // Bấm vùng trống quanh ảnh (chưa phóng, không phải vừa kéo) thì đóng như Google Keep
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  if (event.target === event.currentTarget && !zoomed) onOpenChange(false);
                }}
              >
                {status === "error" ? (
                  <p role="alert" className="max-w-sm px-6 text-center text-compact text-white/70">
                    Không tải được ảnh. Ảnh có thể đã bị xóa hoặc đang chờ kiểm tra.
                  </p>
                ) : (
                  // Ảnh qua API tệp có kiểm quyền, object URL hoặc data URL nên không qua next/image
                  <img
                    key={src}
                    src={src}
                    alt={image.title || "Hình ảnh"}
                    draggable={false}
                    onLoad={(event) =>
                      setLoaded({ src, natural: { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight } })
                    }
                    onError={() => setFailedSrc(src)}
                    onDoubleClick={(event) => {
                      if (!lastPointerTouch.current) toggleZoom({ x: event.clientX, y: event.clientY });
                    }}
                    className={cn("block max-w-none select-none", status === "ready" ? "rounded-xs" : "invisible absolute size-px")}
                    style={display ? { width: display.width, height: display.height } : undefined}
                  />
                )}
                {status === "loading" ? <Spinner size="md" label="Đang tải ảnh" className="text-white/70" /> : null}
              </div>
            </div>

            {count > 1 ? (
              <>
                <Button
                  variant="overlay"
                  size="icon-md"
                  className="absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-white/10 max-sm:hidden"
                  disabled={current === 0}
                  onClick={() => go(-1)}
                  aria-label="Ảnh trước"
                  title="Ảnh trước (←)"
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <Button
                  variant="overlay"
                  size="icon-md"
                  className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-white/10 max-sm:hidden"
                  disabled={current === count - 1}
                  onClick={() => go(1)}
                  aria-label="Ảnh sau"
                  title="Ảnh sau (→)"
                >
                  <ChevronRight className="size-5" />
                </Button>
              </>
            ) : null}
          </div>

          <div className="box-content flex h-16 shrink-0 items-center justify-center pb-[env(safe-area-inset-bottom,0px)]">
            <div role="group" aria-label="Thu phóng" className="flex items-center gap-0.5 rounded-full bg-white/10 p-1">
              <Button
                variant="overlay"
                size="icon-md"
                className="rounded-full"
                disabled={status !== "ready" || zoom <= 1}
                onClick={() => applyZoom(stepImageZoom(zoom, -1))}
                aria-label="Thu nhỏ"
                title="Thu nhỏ (−)"
              >
                <Minus />
              </Button>
              <Button
                variant="overlay"
                size="sm"
                className="h-8 min-w-14 justify-center rounded-full tabular-nums sm:h-8"
                disabled={status !== "ready" || !zoomed}
                onClick={() => applyZoom(1)}
                aria-label={`Đang ${Math.round(zoom * 100)}%, bấm để vừa màn hình`}
                title="Vừa màn hình (0)"
              >
                {Math.round(zoom * 100)}%
              </Button>
              <Button
                variant="overlay"
                size="icon-md"
                className="rounded-full"
                disabled={status !== "ready" || zoom >= IMAGE_ZOOM_MAX}
                onClick={() => applyZoom(stepImageZoom(zoom, 1))}
                aria-label="Phóng to"
                title="Phóng to (+)"
              >
                <Plus />
              </Button>
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}
