import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { OverviewView } from "@/components/overview/overview-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tổng quan" };

interface RootPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

const ICT = "Asia/Ho_Chi_Minh";

/** Lời chào theo giờ Việt Nam lúc mở trang (tính ở máy chủ để HTML máy chủ và máy khách khớp nhau). */
function greetingFor(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: ICT }).format(now));
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 13) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** Trang Tổng quan. Đường dẫn cũ `/?zone=…` vẫn chuyển tới trang tương ứng. */
export default async function RootPage({ searchParams }: RootPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const session = await getWebSession();

  if (!session) {
    redirect("/login");
  }

  const zoneParam = resolvedParams?.zone;
  if (typeof zoneParam === "string" && zoneParam) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedParams)) {
      if (key !== "zone" && typeof value === "string") {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    const query = qs ? `?${qs}` : "";
    if (zoneParam === "calendar") redirect(`/calendar${query}`);
    if (zoneParam === "org") redirect(`/org${query}`);
    if (zoneParam === "documents") redirect(`/documents${query}`);
    redirect(`/tasks${query}`);
  }

  const now = new Date();
  const todayLabel = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: ICT }).format(now);

  return <OverviewView greeting={greetingFor(now)} userName={session.name} todayLabel={todayLabel} />;
}
