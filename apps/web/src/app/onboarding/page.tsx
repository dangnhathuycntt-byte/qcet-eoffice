import type { Metadata } from "next";
import { getRuntimeConfig } from "@/lib/server-api";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Bắt đầu sử dụng · QCET E-Office",
  description: "Xác nhận hồ sơ và thiết lập cách Trợ lý làm việc cùng bạn",
};

export default async function OnboardingPage() {
  // Cờ Trợ lý đọc ở server, cùng nguồn với trang /assistant: tắt thì onboarding chỉ còn bước hồ sơ
  const assistantEnabled = (await getRuntimeConfig())?.features.assistant ?? false;
  return <OnboardingFlow assistantEnabled={assistantEnabled} />;
}
