"use client";

import * as React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TasksPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?scope=school");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>Đang chuyển hướng tới Quản lý công việc...</span>
      </div>
    </div>
  );
}
