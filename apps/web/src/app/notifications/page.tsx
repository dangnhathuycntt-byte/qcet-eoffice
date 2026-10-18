import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { NotificationCenter } from "@/components/notifications/notification-center";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Trung tâm thông báo - QCET E-Office" };
}

export default async function NotificationsPage() {
  const session = await getWebSession();

  if (!session) {
    redirect("/login?returnTo=/notifications");
  }

  return <NotificationCenter />;
}
