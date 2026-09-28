import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { GlobalSearchView } from "@/components/search/global-search-view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Tìm kiếm - QCET E-Office" };
}

export default async function SearchPage() {
  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id
    ? await getSessionFromRequest({ cookies: cookieStore })
    : null;

  const userId = authSession?.user?.id ?? jwtSession?.id;

  if (!userId) {
    redirect("/login?returnTo=/search");
  }

  return <GlobalSearchView />;
}
