import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";

export const dynamic = "force-dynamic";

interface RootPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * `/` không còn trang riêng (bỏ Tổng quan 19/10/2026): chuyển tới Nhiệm vụ, trùng trang mặc định sau đăng nhập.
 * Đường dẫn cũ `/?zone=…` vẫn chuyển tới trang tương ứng.
 */
export default async function RootPage({ searchParams }: RootPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const session = await getWebSession();

  if (!session) {
    redirect("/login");
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (key !== "zone" && typeof value === "string") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  const query = qs ? `?${qs}` : "";

  const zoneParam = resolvedParams?.zone;
  if (zoneParam === "calendar") redirect(`/meetings${query}`);
  if (zoneParam === "org") redirect(`/org${query}`);
  if (zoneParam === "documents") redirect(`/documents${query}`);
  redirect(`/tasks${query}`);
}
