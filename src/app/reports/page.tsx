import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { ReportsOverviewView } from "@/components/reports/reports-overview-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Báo cáo thống kê" };

export default async function ReportsPage() {
  const session = await getWebSession();

  if (!session) {
    redirect("/login?returnTo=/reports");
  }

  return <ReportsOverviewView />;
}
