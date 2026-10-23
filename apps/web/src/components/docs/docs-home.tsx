import Link from "next/link";
import { DOC_GROUPS } from "./docs-lib";
import { DocIcon } from "./docs-shell";

/** Trang chủ tài liệu kiểu linear.app/docs: tiêu đề lớn, rồi từng nhóm là một lưới thẻ (ô minh họa có icon + tên + mô tả). */
export function DocsHome() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-12 md:px-10 md:pt-16">
      <h1 className="text-docs-display font-semibold tracking-tight text-foreground max-md:text-docs-title">Tài liệu QCET E-Office</h1>
      <p className="mt-3 max-w-2xl text-docs text-muted-foreground text-pretty">
        Hướng dẫn sử dụng hệ thống điều hành văn bản và nhiệm vụ của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn: từ đăng nhập, giao và theo
        dõi nhiệm vụ đến tiếp nhận, ban hành và lưu trữ văn bản.
      </p>

      {DOC_GROUPS.map((group) => (
        <section key={group.key} aria-labelledby={`nhom-${group.key}`} className="mt-14">
          <h2 id={`nhom-${group.key}`} className="text-xl font-semibold tracking-tight text-foreground">
            {group.title}
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.pages.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/docs/${page.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/60 bg-foreground/[0.02] outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden className="flex h-28 items-start border-b border-border/60 p-4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-background shadow-low ring-1 ring-border/60">
                      <DocIcon name={page.icon} className="size-4.5 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col gap-1 p-4">
                    <span className="text-docs font-medium text-foreground">{page.title}</span>
                    <span className="line-clamp-3 text-sm text-muted-foreground">{page.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
