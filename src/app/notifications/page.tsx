"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NotificationsRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams?.toString();
    const destination = q ? `/inbox?${q}` : "/inbox";
    router.replace(destination);
  }, [router, searchParams]);

  return (
    <div className="flex h-[calc(100vh-80px)] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground font-medium">Đang chuyển đến Hộp thư...</p>
      </div>
    </div>
  );
}
