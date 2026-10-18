"use client";

import * as React from "react";
import { isAllowedDocxHref } from "@/lib/documents/docx-links";

/** Lớp CSS gốc cho nội dung docx-preview (mọi lớp sinh ra đều có tiền tố này). */
const DOCX_CLASS = "qcet-docx";

// Khung trang của docx-preview có nền xám và lề riêng; nền và lề đã do trình xem cung cấp
const WRAPPER_CSS = `.${DOCX_CLASS}-wrapper{background:transparent!important;padding:0!important;display:flex;flex-direction:column;align-items:center;gap:12px}
.${DOCX_CLASS}-wrapper>section.${DOCX_CLASS}{margin:0!important;box-shadow:0 0 0 1px var(--border),0 1px 2px rgb(0 0 0/0.04)}`;

export interface DocxDocumentCanvasProps {
  fileUrl: string;
  /** Tỉ lệ so với độ rộng khung (1 = vừa khung), giống trình xem PDF. */
  zoom: number;
}

function describeLoadError(status?: number): string {
  if (status === 401 || status === 403) return "Bạn không có quyền xem tệp này.";
  if (status === 404) return "Không tìm thấy tệp trên máy chủ.";
  return "Không thể hiển thị tệp Word này. Hãy tải về để xem.";
}

/** Bỏ đích liên kết không an toàn, liên kết ngoài mở tab mới. */
function sanitizeLinks(root: HTMLElement) {
  root.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href");
    if (!isAllowedDocxHref(href)) {
      link.removeAttribute("href");
      return;
    }
    if (!href!.startsWith("#")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
}

/**
 * Bảng căn giữa (`jc=center`) rộng hơn vùng chữ: Word căn theo tâm vùng chữ nên bảng lấn đều sang hai lề trang;
 * trình duyệt bỏ `margin: auto` khi bảng tràn nên phần dư dồn hết sang phải và bị trang (overflow hidden) cắt mất.
 * Đặt lề âm bằng nhau hai bên. Đo bằng giá trị CSS tính toán (không chịu ảnh hưởng `zoom` của khung).
 */
function centerWideTables(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    if (table.style.marginLeft !== "auto" || table.style.marginRight !== "auto" || !table.parentElement) return;
    const tableWidth = parseFloat(getComputedStyle(table).width);
    const boxWidth = parseFloat(getComputedStyle(table.parentElement).width);
    if (!(tableWidth > boxWidth + 0.5)) return;
    const offset = `${(boxWidth - tableWidth) / 2}px`;
    table.style.marginLeft = offset;
    table.style.marginRight = offset;
  });
}

/**
 * Dựng tệp Word (.docx) thành HTML ngay trong trình duyệt bằng docx-preview (tải khi cần).
 * Bố cục gần với Word nhưng không tuyệt đối (ngắt trang theo dấu ngắt trong tệp). Không dựng phần
 * HTML nhúng (altChunk, sẽ thành iframe không sandbox) và lọc liên kết không an toàn.
 * 100% = vừa chiều rộng khung, như PDF.
 */
export default function DocxDocumentCanvas({ fileUrl, zoom }: DocxDocumentCanvasProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const styleRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [fit, setFit] = React.useState(1);

  React.useEffect(() => {
    const body = bodyRef.current;
    const style = styleRef.current;
    if (!body || !style) return;
    const controller = new AbortController();
    let cancelled = false;
    setStatus("loading");
    setError(null);
    (async () => {
      try {
        const res = await fetch(fileUrl, { credentials: "include", signal: controller.signal });
        if (!res.ok) throw Object.assign(new Error("load"), { status: res.status });
        const data = await res.arrayBuffer();
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        body.innerHTML = "";
        style.innerHTML = "";
        await renderAsync(data, body, style, {
          className: DOCX_CLASS,
          inWrapper: true,
          ignoreLastRenderedPageBreak: false,
          renderAltChunks: false,
          renderComments: false,
          renderChanges: false,
        });
        if (cancelled) return;
        sanitizeLinks(body);
        setStatus("ready");
      } catch (err) {
        if (cancelled || (err as { name?: string })?.name === "AbortError") return;
        setError(describeLoadError((err as { status?: number })?.status));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      body.innerHTML = "";
      style.innerHTML = "";
    };
  }, [fileUrl, attempt]);

  // Chỉ đo được khi nội dung đã hiện (trước khi vẽ để không thấy bảng nhảy)
  React.useLayoutEffect(() => {
    if (status === "ready" && bodyRef.current) centerWideTables(bodyRef.current);
  }, [status]);

  // Vừa chiều rộng: thu trang (thường A4 ~794px) theo khung; không phóng to quá cỡ thật
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || status !== "ready" || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const page = bodyRef.current?.querySelector<HTMLElement>(`section.${DOCX_CLASS}`);
      if (!page) return;
      // Bề rộng CSS của trang (không chịu ảnh hưởng `zoom` đang áp dụng)
      const cs = getComputedStyle(page);
      const px = (value: string) => parseFloat(value) || 0;
      const width =
        cs.boxSizing === "border-box"
          ? px(cs.width)
          : px(cs.width) + px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
      if (width > 0) setFit(Math.min(1, host.clientWidth / width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [status]);

  return (
    <div ref={hostRef} className="w-full min-w-0" data-slot="docx-canvas" data-status={status}>
      <style>{WRAPPER_CSS}</style>
      <div ref={styleRef} hidden />
      {status === "loading" ? (
        <p role="status" className="py-10 text-center text-xs text-muted-foreground">
          Đang mở tệp Word…
        </p>
      ) : null}
      {status === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-compact text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="h-7 cursor-pointer rounded-md border border-border px-2.5 text-xs text-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Thử lại
          </button>
        </div>
      ) : null}
      <div ref={bodyRef} hidden={status !== "ready"} style={{ zoom: fit * zoom }} />
    </div>
  );
}
