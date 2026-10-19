import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { InboxView } from "@/components/inbox/inbox-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hộp thư | QCET E-Office",
  description: "Hộp thư thông báo điều hành và nhắc việc giao dịch",
};

export default async function InboxPage() {
  const session = await getWebSession();

  if (!session) {
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
