import { Suspense } from "react";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { InboxView } from "@/components/inbox/inbox-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hộp thư | QCET E-Office",
  description: "Hộp thư thông báo điều hành và nhắc việc giao dịch",
};

export default async function InboxPage() {
  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id
    ? await getSessionFromRequest({ cookies: cookieStore })
    : null;

  const userId = authSession?.user?.id ?? jwtSession?.id;

  if (!userId) {
    redirect(`/login?returnTo=${encodeURIComponent("/inbox")}`);
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-80px)] w-full items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <InboxView />
    </Suspense>
  );
}
