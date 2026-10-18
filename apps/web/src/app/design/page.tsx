import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DesignShowcase } from "./design-showcase";

export const metadata: Metadata = { title: "Design" };

/**
 * Trang bảng mẫu thành phần, chỉ dành cho người làm sản phẩm.
 * Mọi thứ hiển thị ở đây là component thật trong src/components/ui và tasks;
 * sửa component thì trang này và các trang thật đổi theo.
 */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignShowcase />;
}
