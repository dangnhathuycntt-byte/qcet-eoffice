import type { Metadata } from "next";
import { AuditLogView } from "@/components/admin/audit-log-view";

export const metadata: Metadata = { title: "Nhật ký hệ thống" };

export default function AuditLogPage() {
  return <AuditLogView />;
}
