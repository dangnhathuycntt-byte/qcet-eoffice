"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { docOutline, findDoc, headingId } from "./docs-lib";
import type { DocBlock } from "./docs-types";

/** `**đậm**` (nhãn giao diện) và `mã` (phím, đường dẫn) trong một dòng chữ. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") ? (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : part.startsWith("`") ? (
          <code key={index} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-foreground">
            {part.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 id={headingId(block.text)} className="mt-14 scroll-mt-24 text-2xl font-semibold tracking-tight text-foreground">
          <Inline text={block.text} />
        </h2>
      );
    case "h3":
      return (
        <h3 id={headingId(block.text)} className="mt-10 scroll-mt-24 text-xl font-semibold tracking-tight text-foreground">
          <Inline text={block.text} />
        </h3>
      );
    case "p":
      return (
        <p className="mt-4 text-docs text-foreground/80 text-pretty">
          <Inline text={block.text} />
        </p>
      );
    case "ul":
    case "ol": {
      const List = block.type;
      return (
        <List className={cn("mt-4 space-y-2 pl-6 text-docs text-foreground/80 marker:text-muted-foreground", block.type === "ul" ? "list-disc" : "list-decimal")}>
          {block.items.map((item, index) => (
            <li key={index} className="pl-1">
              <Inline text={item} />
            </li>
          ))}
        </List>
      );
    }
    case "callout": {
      const Icon = block.tone === "warning" ? TriangleAlert : Info;
      return (
        <div className={cn("mt-6 flex gap-3 rounded-lg px-4 py-3 text-docs", block.tone === "warning" ? "bg-warning/10" : "bg-muted")}>
          <Icon aria-hidden className={cn("mt-1 size-4 shrink-0", block.tone === "warning" ? "text-warning" : "text-muted-foreground")} />
          <p className="text-foreground/80">
            <Inline text={block.text} />
          </p>
        </div>
      );
    }
  }
}

/** Mục đang đọc: tiêu đề cuối cùng đã cuộn qua mép trên (dưới header 64px). */
function useActiveHeading(ids: string[]) {
  const [active, setActive] = React.useState<string | null>(ids[0] ?? null);
  React.useEffect(() => {
    if (ids.length === 0) return;
    const update = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 160) current = id;
      }
      // Cuộn tới cuối trang thì sáng mục cuối (mục ngắn không bao giờ chạm mép trên)
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = ids[ids.length - 1];
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids]);
  return active;
}

/** Trang bài viết kiểu linear.app/docs: cột chữ 650px, mục lục "Trên trang này" dính bên phải, trang trước/sau ở cuối. */
export function DocsArticle({ slug }: { slug: string }) {
  const doc = findDoc(slug);
  const outline = React.useMemo(() => (doc ? docOutline(doc.page) : []), [doc]);
  const ids = React.useMemo(() => outline.map((h) => h.id), [outline]);
  const active = useActiveHeading(ids);
  if (!doc) return null;
  const { page, group, prev, next } = doc;

  return (
    <div className="mx-auto flex max-w-6xl justify-center gap-16 px-4 pb-24 pt-12 md:px-10 md:pt-16">
      <article className="w-full min-w-0 max-w-[650px]">
        <p className="text-sm font-medium text-muted-foreground">{group.title}</p>
        <h1 className="mt-2 text-docs-title font-semibold tracking-tight text-foreground">{page.title}</h1>
        <p className="mt-4 text-docs text-foreground/80 text-pretty">{page.description}</p>
        {page.blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}

        <nav aria-label="Trang trước và sau" className="mt-16 grid gap-4 border-t border-border/70 pt-8 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/docs/${prev.page.slug}`}
              className="flex flex-col gap-1 rounded-lg border border-border/60 p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowLeft className="size-3.5" /> Trang trước
              </span>
              <span className="text-sm font-medium text-foreground">{prev.page.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/docs/${next.page.slug}`}
              className="flex flex-col items-end gap-1 rounded-lg border border-border/60 p-4 text-right outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Trang sau <ArrowRight className="size-3.5" />
              </span>
              <span className="text-sm font-medium text-foreground">{next.page.title}</span>
            </Link>
          ) : null}
        </nav>
      </article>

      {outline.length > 0 ? (
        <aside className="sticky top-28 hidden h-fit w-56 shrink-0 xl:block">
          <p className="text-compact font-medium text-foreground">Trên trang này</p>
          <ul className="mt-3 border-l-2 border-border/70">
            {outline.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  aria-current={active === heading.id ? "location" : undefined}
                  className={cn(
                    "-ml-0.5 block border-l-2 py-1 text-compact outline-none transition-colors focus-visible:text-foreground",
                    heading.level === "h3" ? "pl-6" : "pl-3",
                    active === heading.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
