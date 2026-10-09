"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
  buildPageOffsets,
  clampPage,
  computeRenderWindow,
  currentPageAt,
  layoutPageHeights,
  pageRatioAt,
  scrollOffsetForPage,
  type PageSize,
} from "@/lib/documents/pdf-layout";
import { findHits, highlightItemHtml, toSearchQuery, type TextHit } from "@/lib/documents/pdf-text-index";

// Worker phải khai báo cùng module với <Document> (theo tài liệu react-pdf).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** Điều khiển từ ngoài (dynamic import không chuyển ref được nên dùng object này). */
export interface PdfCanvasController {
  /** Cuộn tới trang `page` (1-based), cộng `ratio` phần trang. */
  scrollToPage: (page: number, ratio?: number) => void;
}

export interface PdfPosition {
  page: number;
  ratio: number;
}

export interface PdfDocumentCanvasProps {
  fileUrl: string;
  /** Tỉ lệ so với độ rộng khung (1 = vừa khung). */
  zoom: number;
  onPageCount?: (count: number) => void;
  /** Trang đang đọc và phần trang đã cuộn qua; gọi khi đổi trang hoặc dừng cuộn. */
  onPositionChange?: (position: PdfPosition) => void;
  /** Vị trí khôi phục khi mở tệp (chỉ áp dụng trước khi người dùng tự cuộn). */
  initialPosition?: PdfPosition;
  controllerRef?: React.MutableRefObject<PdfCanvasController | null>;
  /** Từ khóa tìm trong tệp (từ 2 ký tự); bỏ trống thì không tô sáng. */
  searchQuery?: string;
  /** Kết quả đang chọn (0-based) trong danh sách kết quả; tự cuộn tới đó. */
  activeMatch?: number;
  onSearchTotal?: (total: number) => void;
  /** Số trang quanh khung nhìn vẫn được dựng. */
  overscan?: number;
}

/** Thông báo lỗi dễ hiểu từ lỗi tải của pdf.js (có `status` khi máy chủ từ chối). */
function describeLoadError(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401 || status === 403) return "Bạn không có quyền xem tệp này.";
  if (status === 404) return "Không tìm thấy tệp trên máy chủ.";
  if ((error as { name?: string } | null)?.name === "InvalidPDFException") return "Tệp không phải PDF hợp lệ.";
  return "Không thể hiển thị tệp. Hãy tải về để xem.";
}

/**
 * Vùng cuộn dọc gần nhất của phần tử (hoặc null = cuộn theo cửa sổ).
 * Phần tử đánh dấu `data-pdf-no-scroll` (khung chỉ cuộn ngang, cao theo nội dung) bị bỏ qua:
 * `overflow-x: auto` làm overflow-y tính ra `auto` nhưng nó không bao giờ là vùng cuộn dọc.
 */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    // body/html: cuộn theo cửa sổ (overflow-x của body làm overflow-y tính ra auto nhưng không phải vùng cuộn)
    if (node === document.body || node === document.documentElement) return null;
    if (node.hasAttribute("data-pdf-no-scroll")) continue;
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * Hiển thị PDF bằng pdf.js lên canvas: tải tệp bằng fetch cùng origin (kèm cookie),
 * không phụ thuộc iframe nên không bị `X-Frame-Options: DENY` của route tệp chặn.
 * Chỉ dựng các trang quanh khung nhìn; trang khác là khung giữ chỗ đúng kích thước từng trang.
 */
export default function PdfDocumentCanvas({
  fileUrl,
  zoom,
  onPageCount,
  onPositionChange,
  initialPosition,
  controllerRef,
  searchQuery = "",
  activeMatch = 0,
  onSearchTotal,
  overscan = 2,
}: PdfDocumentCanvasProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [pdf, setPdf] = React.useState<PDFDocumentProxy | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [sizes, setSizes] = React.useState<Array<PageSize | undefined>>([]);
  const [view, setView] = React.useState({ scrollTop: 0, height: 800 });
  const [hits, setHits] = React.useState<TextHit[]>([]);

  const query = toSearchQuery(searchQuery);
  const onSearchTotalRef = React.useRef(onSearchTotal);
  onSearchTotalRef.current = onSearchTotal;
  const onPositionRef = React.useRef(onPositionChange);
  onPositionRef.current = onPositionChange;
  const initialRef = React.useRef(initialPosition);
  initialRef.current = initialPosition;
  const textPages = React.useRef<Array<string[] | undefined>>([]);
  const textIndexPromise = React.useRef<Promise<void> | null>(null);

  const pageCount = pdf?.numPages ?? 0;
  const pageWidth = width > 0 ? Math.max(200, Math.floor(width * zoom)) : 0;
  const fallbackSize = sizes.find(Boolean);
  const heights = React.useMemo(
    () => layoutPageHeights(Array.from({ length: pageCount }, (_, i) => sizes[i]), pageWidth || 1, fallbackSize),
    [pageCount, sizes, pageWidth, fallbackSize],
  );
  const offsets = React.useMemo(() => buildPageOffsets(heights), [heights]);
  const renderWindow = React.useMemo(
    () => computeRenderWindow(offsets, heights, view.scrollTop, view.height, overscan),
    [offsets, heights, view, overscan],
  );

  // --- Đo độ rộng khung (pane kéo được) ---
  React.useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // --- Kích thước từng trang: nạp dần theo lô để không chặn giao diện ---
  React.useEffect(() => {
    setSizes([]);
    textPages.current = [];
    textIndexPromise.current = null;
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const total = pdf.numPages;
      for (let start = 1; start <= total && !cancelled; start += 24) {
        const batch: Array<PageSize | undefined> = [];
        for (let n = start; n < start + 24 && n <= total; n++) {
          const viewport = (await pdf.getPage(n)).getViewport({ scale: 1 });
          batch[n - start] = { width: viewport.width, height: viewport.height };
        }
        if (cancelled) return;
        setSizes((prev) => {
          const next = prev.slice();
          batch.forEach((size, i) => (next[start - 1 + i] = size));
          return next;
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  // --- Vùng cuộn: theo dõi cuộn để biết trang nào cần dựng và trang đang đọc ---
  const restored = React.useRef<"none" | "first" | "final">("none");
  const scrollParentRef = React.useRef<HTMLElement | null>(null);
  const userScrolled = React.useRef(false);
  const lastReported = React.useRef<PdfPosition | null>(null);

  const readViewport = React.useCallback(() => {
    const host = hostRef.current;
    if (!host) return null;
    const parent = scrollParentRef.current;
    const hostRect = host.getBoundingClientRect();
    const parentTop = parent ? parent.getBoundingClientRect().top : 0;
    const height = parent ? parent.clientHeight : window.innerHeight;
    return { scrollTop: Math.max(0, parentTop - hostRect.top), height, hostTopInParent: hostRect.top - parentTop };
  }, []);

  const heightsRef = React.useRef(heights);
  heightsRef.current = heights;
  const offsetsRef = React.useRef(offsets);
  offsetsRef.current = offsets;

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const refreshParent = () => {
      scrollParentRef.current = findScrollParent(host);
    };
    refreshParent();
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      frame = 0;
      const metrics = readViewport();
      if (!metrics) return;
      setView((prev) =>
        Math.abs(prev.scrollTop - metrics.scrollTop) < 1 && prev.height === metrics.height
          ? prev
          : { scrollTop: metrics.scrollTop, height: metrics.height },
      );
      const hs = heightsRef.current;
      if (hs.length === 0) return;
      // Đang chờ khôi phục vị trí cũ: chưa báo vị trí để khỏi ghi đè bằng "trang 1"
      if (initialRef.current && !userScrolled.current && restored.current !== "final") return;
      const page = currentPageAt(offsetsRef.current, hs, metrics.scrollTop, metrics.height);
      const ratio = pageRatioAt(offsetsRef.current, hs, page, metrics.scrollTop);
      const last = lastReported.current;
      if (!last || last.page !== page) {
        lastReported.current = { page, ratio };
        onPositionRef.current?.({ page, ratio });
      } else {
        // Cùng trang: chỉ ghi phần trang khi dừng cuộn để khỏi báo liên tục
        clearTimeout(settle);
        settle = setTimeout(() => {
          lastReported.current = { page, ratio };
          onPositionRef.current?.({ page, ratio });
        }, 200);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onLayoutChange = () => {
      refreshParent();
      schedule();
    };
    const markUser = () => {
      userScrolled.current = true;
    };
    // Sự kiện cuộn không nổi bọt: nghe ở pha capture để bắt được mọi vùng cuộn (kể cả khi vào toàn màn hình)
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("wheel", markUser, { passive: true, capture: true });
    window.addEventListener("touchstart", markUser, { passive: true, capture: true });
    window.addEventListener("keydown", markUser, true);
    window.addEventListener("resize", onLayoutChange);
    document.addEventListener("fullscreenchange", onLayoutChange);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("wheel", markUser, true);
      window.removeEventListener("touchstart", markUser, true);
      window.removeEventListener("keydown", markUser, true);
      window.removeEventListener("resize", onLayoutChange);
      document.removeEventListener("fullscreenchange", onLayoutChange);
    };
  }, [readViewport, pdf]);

  // Layout đổi (đo xong kích thước trang, đổi zoom, đổi độ rộng) thì tính lại khung nhìn
  React.useEffect(() => {
    const metrics = readViewport();
    if (metrics) setView({ scrollTop: metrics.scrollTop, height: metrics.height });
  }, [readViewport, offsets]);

  // --- Cuộn tới trang ---
  const scrollToPage = React.useCallback(
    (page: number, ratio = 0) => {
      const metrics = readViewport();
      if (!metrics || heights.length === 0) return;
      const offset = scrollOffsetForPage(offsets, heights, clampPage(page, heights.length), ratio);
      const parent = scrollParentRef.current;
      // hostTopInParent: khoảng từ mép trên vùng cuộn tới đầu danh sách trang (âm khi đã cuộn quá)
      const delta = offset + metrics.hostTopInParent;
      if (parent) parent.scrollTop += delta;
      else window.scrollBy({ top: delta });
    },
    [readViewport, heights, offsets],
  );
  React.useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = { scrollToPage };
    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef, scrollToPage]);

  // Khôi phục vị trí đã đọc: áp dụng khi có bố cục và áp lại một lần khi đo xong kích thước thật, nếu chưa tự cuộn
  const sizesComplete = pageCount > 0 && sizes.filter(Boolean).length >= pageCount;
  React.useEffect(() => {
    restored.current = "none";
    userScrolled.current = false;
    lastReported.current = null;
  }, [fileUrl]);
  React.useEffect(() => {
    if (!initialPosition || pageCount === 0 || pageWidth === 0 || userScrolled.current) return;
    const stage = sizesComplete ? "final" : "first";
    if (restored.current === "final" || restored.current === stage) return;
    restored.current = stage;
    const atStart = initialPosition.page <= 1 && initialPosition.ratio === 0;
    // Mở tệp từ đầu: chỉ kéo về đầu tệp nếu đầu tệp đang nằm trên mép khung nhìn
    if (!atStart || (readViewport()?.hostTopInParent ?? 0) < 0) scrollToPage(initialPosition.page, initialPosition.ratio);
  }, [initialPosition, pageCount, pageWidth, sizesComplete, scrollToPage, readViewport]);

  // --- Tìm kiếm trên chỉ mục văn bản (không phụ thuộc trang đã dựng) ---
  React.useEffect(() => {
    if (!pdf || !query) {
      setHits([]);
      onSearchTotalRef.current?.(0);
      return;
    }
    let cancelled = false;
    const ensureIndex = () => {
      if (!textIndexPromise.current) {
        textIndexPromise.current = (async () => {
          for (let n = 1; n <= pdf.numPages; n++) {
            if (textPages.current[n - 1]) continue;
            const content = await (await pdf.getPage(n)).getTextContent();
            textPages.current[n - 1] = content.items.map((entry) => ("str" in entry ? entry.str : ""));
          }
        })();
        textIndexPromise.current.catch(() => {
          textIndexPromise.current = null;
        });
      }
      return textIndexPromise.current;
    };
    ensureIndex()
      .then(() => {
        if (cancelled) return;
        const found = findHits(textPages.current, query);
        setHits(found);
        onSearchTotalRef.current?.(found.length);
      })
      .catch(() => {
        if (!cancelled) onSearchTotalRef.current?.(0);
      });
    return () => {
      cancelled = true;
    };
  }, [pdf, query]);

  const active = hits[activeMatch];
  const renderText = React.useMemo(() => {
    if (!query || hits.length === 0) return undefined;
    return ({ str, pageNumber, itemIndex }: { str: string; pageNumber: number; itemIndex: number }) => {
      const nth = active && active.page === pageNumber && active.item === itemIndex ? active.nth : null;
      return highlightItemHtml(str, query, nth);
    };
  }, [query, hits.length, active]);

  // Cuộn tới kết quả đang chọn: trước hết tới trang (để trang được dựng), rồi chờ thẻ <mark> xuất hiện
  React.useEffect(() => {
    if (!active) return;
    scrollToPage(active.page, 0);
    let tries = 0;
    const timer = setInterval(() => {
      const mark = hostRef.current?.querySelector<HTMLElement>('mark[data-active="1"]');
      if (mark) {
        mark.scrollIntoView({ block: "center", inline: "nearest" });
        clearInterval(timer);
      } else if (++tries > 15) {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
    // scrollToPage đổi theo bố cục; chỉ chạy lại khi đổi kết quả
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const file = React.useMemo(() => ({ url: fileUrl, withCredentials: true }), [fileUrl]);

  return (
    <div ref={hostRef} className="w-full min-w-0" data-slot="pdf-canvas" data-page-count={pageCount || undefined}>
      {loadError ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-compact text-muted-foreground">{loadError}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                setAttempt((n) => n + 1);
              }}
              className="h-7 cursor-pointer rounded-md border border-border px-2.5 text-xs text-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Thử lại
            </button>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-xs text-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Tải về
            </a>
          </div>
        </div>
      ) : (
        <Document
          key={attempt}
          file={file}
          // Không dùng Suspense: lỗi tải (403/404) hiện trong khung xem, không làm sập trang qua error boundary
          suspense={false}
          onLoadSuccess={(loaded) => {
            setPdf(loaded);
            setLoadError(null);
            onPageCount?.(loaded.numPages);
          }}
          loading={<p role="status" className="py-10 text-center text-xs text-muted-foreground">Đang tải tệp…</p>}
          error={null}
          onLoadError={(error) => {
            setPdf(null);
            setLoadError(describeLoadError(error));
          }}
          className="flex flex-col items-center gap-3"
        >
          {pageWidth
            ? heights.map((height, index) => {
                const inWindow = index >= renderWindow.first && index <= renderWindow.last;
                return (
                  <div
                    key={index}
                    data-page-number={index + 1}
                    data-rendered={inWindow ? "true" : "false"}
                    style={{ height, width: pageWidth }}
                    className="shrink-0 overflow-hidden rounded-sm bg-card shadow-xs"
                  >
                    {inWindow ? (
                      <Page
                        pageNumber={index + 1}
                        width={pageWidth}
                        customTextRenderer={renderText}
                        loading={<div style={{ width: pageWidth, height }} />}
                      />
                    ) : null}
                  </div>
                );
              })
            : null}
        </Document>
      )}
    </div>
  );
}
