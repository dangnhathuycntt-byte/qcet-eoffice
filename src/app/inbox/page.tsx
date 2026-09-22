import { Metadata } from "next";
import { Suspense } from "react";
import { InboxView } from "@/components/inbox/inbox-view";

export const metadata: Metadata = {
  title: "Hộp thư | QCET E-Office",
  description: "Hộp thư thông báo điều hành và nhắc việc giao dịch",
};

export default function InboxPage() {
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
