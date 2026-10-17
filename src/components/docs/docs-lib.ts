import { DOC_GROUPS } from "./docs-content";
import type { DocGroup, DocPage } from "./docs-types";

export { DOC_GROUPS };

/** Id neo của tiêu đề mục: bỏ dấu tiếng Việt, chữ thường, nối bằng gạch ngang (dùng cho mục lục bên phải và liên kết #). */
export function headingId(text: string) {
  return text
    .replace(/\*\*|`/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const ALL_DOCS: { group: DocGroup; page: DocPage }[] = DOC_GROUPS.flatMap((group) =>
  group.pages.map((page) => ({ group, page }))
);

export function findDoc(slug: string) {
  const index = ALL_DOCS.findIndex((entry) => entry.page.slug === slug);
  if (index < 0) return null;
  return { ...ALL_DOCS[index], prev: ALL_DOCS[index - 1] ?? null, next: ALL_DOCS[index + 1] ?? null };
}

/** Các mục h2/h3 của trang, theo thứ tự, cho mục lục "Trên trang này". */
export function docOutline(page: DocPage) {
  return page.blocks.flatMap((block) =>
    block.type === "h2" || block.type === "h3" ? [{ id: headingId(block.text), text: block.text.replace(/\*\*|`/g, ""), level: block.type }] : []
  );
}
