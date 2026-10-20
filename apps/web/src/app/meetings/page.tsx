import * as React from "react";
import type { Metadata } from "next";
import { MeetingListView } from "@/components/meetings/meeting-list-view";

export const metadata: Metadata = { title: "Cuộc họp" };

export default function MeetingsPage() {
  // useSearchParams của danh sách (?bucket=, ?q=) cần Suspense khi dựng sẵn
  return (
    <React.Suspense fallback={null}>
      <MeetingListView />
    </React.Suspense>
  );
}
