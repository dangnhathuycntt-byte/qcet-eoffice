"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

// Roles labels mapping
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Ban Giám hiệu",
  MANAGER: "Trưởng đơn vị",
  STAFF: "Chuyên viên",
  CLERICAL: "Văn thư",
  TEACHER: "Giảng viên",
};

export function OnboardingFlow() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);

  // Touch gesture support for mobile swiping
  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);

  // If not authenticated and not loading, redirect to login
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleFinish = React.useCallback(async () => {
    try {
      localStorage.setItem("qcet_onboarding_completed", "true");
      await fetch("/api/auth/onboarding", { method: "POST" });
    } catch {
      // Ignore network/storage errors in private modes
    }
    router.replace("/tasks");
  }, [router]);

  const handleNext = () => {
    if (step < 4) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Only swipe if horizontal move is significant and larger than vertical
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0 && step < 4) {
        handleNext();
      } else if (deltaX > 0 && step > 1) {
        handlePrev();
      }
    }
  };

  const userName = user?.name || "Nguyễn Văn An";
  const userEmail = user?.email || "an.nv@cdktcnqn.edu.vn";
  const userUnit = user?.department || "Phòng Đào tạo";
  const userRole = user?.roleLabel || (user?.role ? (ROLE_LABELS[user.role] || user.role) : "Chuyên viên");
  const userInitial = userName.trim().split(" ").pop()?.charAt(0).toUpperCase() || "A";
  const firstName = userName.trim().split(" ").pop() || "bạn";

  return (
    <main
      className="relative flex min-h-[100dvh] w-full flex-col justify-between overflow-x-hidden bg-[#F2F4F7] font-sans text-[#1A1D23] select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Header / Progress indicators */}
      <header className="relative z-10 flex w-full items-center justify-between px-6 pt-7 sm:px-10 sm:pt-11">
        {step < 4 ? (
          <>
            {/* Step progress pills */}
            <div className="mx-auto flex items-center gap-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <span
                  className={cn(
                    "h-[3px] w-[34px] rounded-[2px] transition-colors duration-200",
                    step >= 1 ? "bg-[#1A1D23]" : "bg-[#C9CDD3]"
                  )}
                />
                <span
                  className={cn(
                    "h-[3px] w-[34px] rounded-[2px] transition-colors duration-200",
                    step >= 2 ? "bg-[#1A1D23]" : "bg-[#C9CDD3]"
                  )}
                />
                <span
                  className={cn(
                    "h-[3px] w-[34px] rounded-[2px] transition-colors duration-200",
                    step >= 3 ? "bg-[#1A1D23]" : "bg-[#C9CDD3]"
                  )}
                />
              </div>
              <span className="text-[13px] tabular-nums text-[#5F6671]">
                {step}/3
              </span>
            </div>

            {/* Desktop Skip Button */}
            <button
              type="button"
              onClick={handleFinish}
              className="absolute right-6 top-7 hidden h-9 items-center rounded-xl bg-white px-4 text-sm font-medium text-[#1A1D23] shadow-[0_0_0_1px_#EAEDF1,0_8px_24px_rgba(26,29,35,0.06)] hover:bg-[#FAFBFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0058A0] sm:inline-flex cursor-pointer transition-colors"
            >
              Bỏ qua
            </button>
          </>
        ) : (
          <div className="h-9 w-full" />
        )}
      </header>

      {/* Main Content Areas based on current step */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-6 sm:px-10">
        {/* STEP 1: XÁC NHẬN THÔNG TIN */}
        {step === 1 && (
          <div className="flex w-full max-w-[520px] flex-col items-center animate-in fade-in duration-200">
            <h1 className="text-center text-3xl font-bold tracking-[-0.025em] text-[#1A1D23] sm:text-[40px] sm:leading-[1.15]">
              Xác nhận thông tin của bạn
            </h1>
            <p className="mt-3 text-center text-base text-[#5F6671] sm:text-[17px]">
              Quản trị đã thiết lập sẵn. Bạn chỉ cần kiểm tra.
            </p>

            {/* User Profile Card */}
            <div className="mt-8 w-full rounded-2xl bg-white p-6 shadow-[0_0_0_1px_#EAEDF1,0_8px_24px_rgba(26,29,35,0.06)] sm:p-8">
              <div className="flex items-center gap-3.5">
                <span className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-[#B9C7D6] text-[22px] font-semibold text-[#1A1D23]">
                  {userInitial}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold leading-relaxed text-[#1A1D23]">
                    {userName}
                  </span>
                  <span className="block truncate text-[15px] text-[#5F6671]">
                    {userEmail}
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-[#EAEDF1]">
                <div className="flex items-center justify-between border-b border-[#EAEDF1] py-3.5 text-base">
                  <span className="text-[#5F6671]">Đơn vị</span>
                  <span className="font-medium text-[#1A1D23]">{userUnit}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#EAEDF1] py-3.5 text-base">
                  <span className="text-[#5F6671]">Vai trò</span>
                  <span className="font-medium text-[#1A1D23]">{userRole}</span>
                </div>
                <div className="flex items-center justify-between py-3.5 text-base">
                  <span className="text-[#5F6671]">Người quản lý</span>
                  <span className="font-medium text-[#1A1D23]">Trần Văn Bình</span>
                </div>
              </div>

              <div className="mt-2 text-sm text-[#5F6671]">
                Chưa đúng?{" "}
                <a
                  href="mailto:hotro@cdktcnqn.edu.vn"
                  className="text-[#1A1D23] underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0058A0]"
                >
                  Báo quản trị
                </a>
              </div>
            </div>

            {/* Desktop Action Button */}
            <div className="mt-8 hidden w-full sm:block">
              <button
                type="button"
                onClick={handleNext}
                className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[#25282F] text-base font-medium text-[#FAFAFA] hover:bg-[#3A3D44] active:bg-[#181A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0058A0] cursor-pointer transition-colors"
              >
                Xác nhận
              </button>
              <div className="mt-4 text-center text-[15px] text-[#5F6671]">
                Không phải bạn?{" "}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-[#1A1D23] underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0058A0] cursor-pointer"
                >
                  Đăng xuất
                </button>
              </div>
            </div>

            {/* Mobile swipe hint */}
            <div className="mt-8 block text-center text-sm text-[#5F6671] sm:hidden">
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 py-2 text-[#5F6671] hover:text-[#1A1D23]"
              >
                Lướt sang để tiếp tục &rsaquo;
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: VĂN BẢN ĐẾN */}
        {step === 2 && (
          <div className="flex w-full max-w-[640px] flex-col items-center animate-in fade-in duration-200">
            {/* Visual Document Card Comp */}
            <div className="w-[300px] rounded-2xl bg-white p-[22px_22px_20px] shadow-[0_0_0_1px_#EAEDF1,0_8px_24px_rgba(26,29,35,0.06)] flex flex-col">
              <div className="text-[12.5px] text-[#5F6671]">
                Công văn đến · 214/CV-ĐT
              </div>
              <div className="mt-1.5 text-base font-semibold leading-[22px] text-[#1A1D23]">
                Về việc rà soát hồ sơ xét tuyển
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                <div className="h-2 w-full rounded-[4px] bg-[#EAEDF1]" />
                <div className="h-2 w-full rounded-[4px] bg-[#EAEDF1]" />
                <div className="h-2 w-[88%] rounded-[4px] bg-[#EAEDF1]" />
                <div className="h-2 w-full rounded-[4px] bg-[#EAEDF1]" />
                <div className="h-2 w-[54%] rounded-[4px] bg-[#EAEDF1]" />
              </div>
              <div className="mt-8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1D23" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span className="inline-flex h-7 items-center rounded-xl bg-[#F2F4F7] px-3 text-[12.5px] font-medium text-[#1A1D23]">
                    Ký ngay
                  </span>
                </div>
                <span className="text-[12.5px] text-[#5F6671]">Hôm nay</span>
              </div>
            </div>

            {/* Step Heading & Description */}
            <h2 className="mt-8 text-center text-3xl font-bold tracking-[-0.025em] text-[#1A1D23] sm:text-[40px] sm:leading-[1.15]">
              Văn bản đến, ký gọn hơn
            </h2>
            <p className="mt-3 max-w-[480px] text-center text-base text-[#5F6671] sm:text-[17px]">
              Đọc, bút phê và trình ký ngay trên cùng một màn hình.
            </p>

            {/* Desktop Action Button */}
            <div className="mt-8 hidden w-full max-w-[400px] sm:block">
              <button
                type="button"
                onClick={handleNext}
                className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[#25282F] text-base font-medium text-[#FAFAFA] hover:bg-[#3A3D44] active:bg-[#181A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0058A0] cursor-pointer transition-colors"
              >
                Tiếp tục
              </button>
            </div>

            {/* Mobile swipe hint */}
            <div className="mt-8 block text-center text-sm text-[#5F6671] sm:hidden">
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 py-2 text-[#5F6671] hover:text-[#1A1D23]"
              >
                Lướt sang để tiếp tục &rsaquo;
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: NHẮC VIỆC */}
        {step === 3 && (
          <div className="flex w-full max-w-[640px] flex-col items-center animate-in fade-in duration-200">
            {/* Visual Stacking Notification Cards */}
            <div className="relative h-[130px] w-[340px]">
              {/* Foreground Notification Card */}
              <div className="relative z-10 w-[340px] rounded-2xl bg-white p-4 shadow-[0_0_0_1px_#EAEDF1,0_8px_24px_rgba(26,29,35,0.06)]">
                <div className="flex items-center gap-2">
                  <Image
                    src="/design/login-logo.png"
                    alt=""
                    width={24}
                    height={24}
                    className="size-6 rounded-md object-contain"
                  />
                  <span className="text-[13px] text-[#5F6671]">QCET E-Office</span>
                  <span className="flex-1" />
                  <span className="text-[12.5px] text-[#5F6671]">bây giờ</span>
                </div>
                <div className="mt-2.5 text-[15px] font-semibold leading-[22px] text-[#1A1D23]">
                  Việc sắp đến hạn
                </div>
                <div className="mt-0.5 text-sm text-[#5F6671]">
                  Rà soát hồ sơ, hạn 17:00 hôm nay.
                </div>
              </div>

              {/* Second Layer Card */}
              <div className="absolute left-1/2 top-[92px] z-[2] h-10 w-[312px] -translate-x-1/2 rounded-2xl bg-white shadow-[0_0_0_1px_#EAEDF1,0_8px_24px_rgba(26,29,35,0.06)]" />

              {/* Third Layer Card */}
              <div className="absolute left-1/2 top-[104px] z-[1] h-10 w-[284px] -translate-x-1/2 rounded-2xl bg-white shadow-[0_0_0_1px_#EAEDF1,0_8px_24px_rgba(26,29,35,0.06)]" />
            </div>

            {/* Step Heading & Description */}
            <h2 className="mt-12 text-center text-3xl font-bold tracking-[-0.025em] text-[#1A1D23] sm:text-[40px] sm:leading-[1.15]">
              Nhắc việc đúng lúc
            </h2>
            <p className="mt-3 max-w-[480px] text-center text-base text-[#5F6671] sm:text-[17px]">
              Bạn sẽ được hỏi bật nhắc khi có việc đầu tiên sắp đến hạn, không phải bây giờ.
            </p>

            {/* Desktop Action Button */}
            <div className="mt-8 hidden w-full max-w-[400px] sm:block">
              <button
                type="button"
                onClick={handleNext}
                className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[#25282F] text-base font-medium text-[#FAFAFA] hover:bg-[#3A3D44] active:bg-[#181A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0058A0] cursor-pointer transition-colors"
              >
                Tiếp tục
              </button>
            </div>

            {/* Mobile swipe hint */}
            <div className="mt-8 block text-center text-sm text-[#5F6671] sm:hidden">
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 py-2 text-[#5F6671] hover:text-[#1A1D23]"
              >
                Lướt sang để tiếp tục &rsaquo;
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SẴN SÀNG */}
        {step === 4 && (
          <div className="flex w-full max-w-[640px] flex-col items-center animate-in fade-in duration-200">
            {/* Ready Illustration */}
            <div className="relative mb-4 flex items-center justify-center">
              <Image
                src="/design/onboarding-ready-illustration.webp"
                alt="Chào mừng bạn đến với QCET Work"
                width={460}
                height={365}
                priority
                className="max-h-[260px] w-auto object-contain sm:max-h-[340px]"
              />
            </div>

            {/* Final Welcome Heading */}
            <h2 className="text-center text-3xl font-bold tracking-[-0.025em] text-[#1A1D23] sm:text-[40px] sm:leading-[1.15]">
              Xin chào, {firstName}
            </h2>
            <p className="mt-3 text-center text-base text-[#5F6671] sm:text-[17px]">
              1 việc trễ hạn, 2 sắp đến hạn, 1 văn bản chờ ký.
            </p>

            {/* Primary Action */}
            <div className="mt-8 w-full max-w-[400px]">
              <button
                type="button"
                onClick={handleFinish}
                className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[#25282F] text-base font-medium text-[#FAFAFA] hover:bg-[#3A3D44] active:bg-[#181A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0058A0] cursor-pointer transition-colors"
              >
                Mở việc đầu tiên
              </button>
              <div className="mt-4 text-center text-[15px] text-[#5F6671]">
                <button
                  type="button"
                  onClick={() => router.push("/help")}
                  className="text-[#5F6671] hover:text-[#1A1D23] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0058A0] cursor-pointer"
                >
                  Xem hướng dẫn nhanh
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom spacer for balance */}
      <footer className="h-8 w-full" />
    </main>
  );
}
