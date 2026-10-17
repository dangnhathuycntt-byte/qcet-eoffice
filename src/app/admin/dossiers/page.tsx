import type { Metadata } from "next";
import { DisposedDossiersView } from "@/components/admin/disposed-dossiers-view";

export const metadata: Metadata = { title: "Hồ sơ chờ xóa hẳn" };

export default function DisposedDossiersPage() {
  return <DisposedDossiersView />;
}
