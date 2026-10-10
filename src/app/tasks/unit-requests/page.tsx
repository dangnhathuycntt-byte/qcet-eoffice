import * as React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { UnitRequestInbox } from "@/components/tasks/unit-request-inbox";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Yêu cầu phối hợp" };

export default async function UnitRequestsPage() {
  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });
  if (!session) redirect(`/login?returnTo=${encodeURIComponent("/tasks/unit-requests")}`);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-base font-semibold text-foreground">Yêu cầu phối hợp từ đơn vị khác</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Cử người của đơn vị mình làm người phối hợp hoặc từ chối kèm lý do. Chỉ trưởng đơn vị được yêu cầu mới trả lời.
      </p>
      <UnitRequestInbox className="mt-4" />
    </main>
  );
}
