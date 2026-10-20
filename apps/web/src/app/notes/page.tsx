import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { NotesView } from "@/components/notes/notes-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ghi chú cá nhân",
  description: "Ghi chú riêng của bạn, có thể gắn với cuộc họp hoặc nhiệm vụ",
};

export default async function NotesPage() {
  const session = await getWebSession();

  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent("/notes")}`);
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-80px)] w-full items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <NotesView />
    </Suspense>
  );
}
