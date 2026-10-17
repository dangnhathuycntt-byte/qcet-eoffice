import type { Metadata } from "next";
import { UserDirectoryView } from "@/components/admin/user-directory-view";

export const metadata: Metadata = { title: "Tài khoản và vai trò" };

export default function UserDirectoryPage() {
  return <UserDirectoryView />;
}
