import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { OrgDirectoryView } from "@/components/org/org-directory-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cơ cấu & Danh bạ" };

export default async function OrgPage() {
  const session = await getWebSession();

  if (!session) {
    redirect("/login?returnTo=/org");
  }

  return <OrgDirectoryView />;
}
