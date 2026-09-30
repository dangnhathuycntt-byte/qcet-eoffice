import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Bắt đầu sử dụng · QCET E-Office",
  description: "Trang hướng dẫn và xác nhận thông tin người dùng lần đầu sử dụng QCET E-Office",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
