import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { GlobalSearchView } from "@/components/search/global-search-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tìm kiếm" };

export default async function SearchPage() {
  const session = await getWebSession();

  if (!session) {
    redirect("/login?returnTo=/search");
  }

  return <GlobalSearchView />;
}
