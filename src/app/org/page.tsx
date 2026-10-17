import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { OrgDirectoryView } from "@/components/org/org-directory-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cơ cấu & Danh bạ" };

export default async function OrgPage() {
  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id
    ? await getSessionFromRequest({ cookies: cookieStore })
    : null;

  const userId = authSession?.user?.id ?? jwtSession?.id;

  if (!userId) {
    redirect("/login?returnTo=/org");
  }

  return <OrgDirectoryView />;
}
