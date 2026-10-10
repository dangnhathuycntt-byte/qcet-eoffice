import type { Metadata } from "next";
import { DisposedDossiersView } from "@/components/admin/disposed-dossiers-view";

export const metadata: Metadata = { title: "Hồ sơ chờ xóa hẳn" };

export default function DisposedDossiersPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-base font-semibold text-foreground">Hồ sơ chờ xóa hẳn</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Hồ sơ đã có quyết định hủy và biên bản. Xóa hẳn chỉ xóa hồ sơ, các mục và tệp không còn nơi nào khác dùng; văn bản trong hồ sơ được giữ nguyên.
      </p>
      <DisposedDossiersView className="mt-4" />
    </main>
  );
}
