import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { WorkbenchRouter } from "@/components/dashboard/workbench-router";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bàn làm việc - QCET E-Office",
  description:
    "Bàn làm việc điều hành - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
};

export default async function DashboardPage() {
  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id
    ? await getSessionFromRequest({ cookies: cookieStore })
    : null;

  const userId = authSession?.user?.id ?? jwtSession?.id;
  if (!userId) {
    redirect("/login?returnTo=/dashboard");
  }

  const userRole =
    (authSession?.user as any)?.role ?? jwtSession?.role ?? "CHUYEN_VIEN";
  const userName =
    authSession?.user?.name ?? jwtSession?.name ?? "Người dùng";

  return (
    <WorkbenchRouter
      userId={userId}
      userRole={userRole}
      userName={userName}
    />
  );
}
