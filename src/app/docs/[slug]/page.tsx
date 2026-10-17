import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/docs-article";
import { ALL_DOCS, findDoc } from "@/components/docs/docs-lib";

export function generateStaticParams() {
  return ALL_DOCS.map(({ page }) => ({ slug: page.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const doc = findDoc(slug);
  return doc ? { title: doc.page.title, description: doc.page.description } : {};
}

export default async function DocArticlePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  if (!findDoc(slug)) notFound();
  return <DocsArticle slug={slug} />;
}
