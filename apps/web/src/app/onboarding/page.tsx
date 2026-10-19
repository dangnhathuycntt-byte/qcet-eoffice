import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bắt đầu sử dụng · QCET E-Office",
  description: "Chuyển hướng đến danh sách nhiệm vụ QCET E-Office",
};

export default function OnboardingPage() {
  redirect("/tasks");
}
