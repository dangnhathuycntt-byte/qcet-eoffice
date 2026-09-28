import * as React from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { DossierRegistryView } from "@/components/dossiers/dossier-registry-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hồ sơ công việc - QCET E-Office",
  description:
    "Quản lý hồ sơ công việc, lưu trữ cơ quan theo Nghị định 30/2020/NĐ-CP - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
};

export default async function DossiersPage() {
  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id
    ? await getSessionFromRequest({ cookies: cookieStore })
    : null;

  const userId = authSession?.user?.id ?? jwtSession?.id;

  if (!userId) {
    redirect(`/login?returnTo=${encodeURIComponent("/dossiers")}`);
  }

  return (
    <div className="w-full space-y-4">
      <React.Suspense
        fallback={
          <div className="max-w-[1440px] w-full mx-auto p-6 space-y-4 animate-pulse">
            <div className="h-10 bg-muted/60 rounded-xl w-1/3" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 bg-muted/40 rounded-2xl" />
              <div className="h-24 bg-muted/40 rounded-2xl" />
              <div className="h-24 bg-muted/40 rounded-2xl" />
              <div className="h-24 bg-muted/40 rounded-2xl" />
            </div>
            <div className="h-64 bg-muted/30 rounded-2xl w-full" />
          </div>
        }
      >
        <DossierRegistryView />
      </React.Suspense>
    </div>
  );
}
