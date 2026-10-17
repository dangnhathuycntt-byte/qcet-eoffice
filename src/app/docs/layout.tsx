import type { Metadata } from "next";
import { DocsShell } from "@/components/docs/docs-shell";

export const metadata: Metadata = {
  title: { absolute: "Tài liệu hướng dẫn · QCET E-Office", template: "%s · Tài liệu QCET E-Office" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
