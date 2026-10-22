import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/server-api";
import { DossierRegistryView } from "@/components/dossiers/dossier-registry-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hồ sơ công việc",
  description:
    "Quản lý hồ sơ công việc, lưu trữ cơ quan theo Nghị định 30/2020/NĐ-CP - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
};

export default async function DossiersPage() {
  const session = await getWebSession();

  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent("/dossiers")}`);
  }

  // Khung thẻ do `DossierRegistryView` dựng (`WorkspacePageCard`); đang tải thì bảng tự hiện hàng giữ chỗ
  return <DossierRegistryView />;
}
