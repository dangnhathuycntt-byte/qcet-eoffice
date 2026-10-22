import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { LucideProvider } from "lucide-react";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion/motion-provider";
import { AuthProvider } from "@/lib/auth-context";
import { DisplayDensityProvider } from "@/components/density-provider";
import { FeedbackProvider } from "@/components/ui/feedback-layer";
import { ConfirmHost } from "@/components/ui/confirm-host";
import { AppShell } from "@/components/layout/app-shell";
import { PWAServiceWorkerManager } from "@/components/pwa/pwa-service-worker-manager";
import { WebVitalsReporter } from "@/components/telemetry/web-vitals-reporter";
import { parseSidebarCollapsed, SIDEBAR_COLLAPSED_COOKIE } from "@/lib/navigation/sidebar-state";
import { getRuntimeConfig } from "@/lib/server-api";
import { RuntimeFeaturesProvider } from "@/lib/runtime-features";

const fontSans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  display: "swap",
});

import { INSTITUTION_CONFIG } from "@qcet/shared/config/institution";

export const metadata: Metadata = {
  applicationName: `${INSTITUTION_CONFIG.shortName} E-Office`,
  title: {
    default: `${INSTITUTION_CONFIG.shortName} E-Office`,
    template: `%s | ${INSTITUTION_CONFIG.shortName} E-Office`,
  },
  description: `Hệ thống Quản lý và Điều hành Tác nghiệp Điện tử - ${INSTITUTION_CONFIG.officialName} (${INSTITUTION_CONFIG.shortName})`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: `${INSTITUTION_CONFIG.shortName} E-Office`,
  },
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/logo-qcet.png", // apple-touch-icon
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  // Thanh tiêu đề cửa sổ PWA trùng màu sidebar (--gray-1) như Linear; dưới md là topbar di động nền sáng
  themeColor: [
    { media: "(min-width: 768px)", color: "#EFEFF0" },
    { color: "#fbfbfb" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Đọc ở server để sidebar thu gọn đúng ngay lần vẽ đầu (đọc localStorage sau hydrate làm sidebar co lại mỗi lần tải trang)
  const cookieStore = await cookies();
  const initialSidebarCollapsed = parseSidebarCollapsed(cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value) === true;
  // Cờ Trợ lý đọc ở server, cùng nguồn với trang /assistant (cờ và gateway đủ cấu hình): khung trang chừa chỗ thanh dưới
  // ngay lần vẽ đầu (đọc cờ sau hydrate làm mọi trang co lại)
  // Đọc qua GET /api/runtime-config; API lỗi thì coi như tắt Trợ lý (khung trang không chừa thanh dưới)
  const runtimeConfig = await getRuntimeConfig();
  const assistantEnabled = runtimeConfig?.features.assistant ?? false;
  // Model chọn được ở ô soạn của Trợ lý và Agent tạo nhiệm vụ, cùng danh sách máy chủ dùng để kiểm
  const agentModels = runtimeConfig?.agentModels ?? null;

  return (
    <html
      lang="vi"
      className={`light ${fontSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var density = localStorage.getItem('qcet-display-density');
                  if (density === 'compact') {
                    document.documentElement.setAttribute('data-density', 'compact');
                  } else {
                    document.documentElement.setAttribute('data-density', 'comfortable');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full overflow-x-hidden bg-background text-foreground font-sans">
        {/* Nét icon 1,25px cho toàn app, như icon của Linear (đo 19/10/2026: ~1,3px) và bộ icon sidebar; `globals.css` giữ nét
            không co theo cỡ icon. Icon không cần truyền strokeWidth. */}
        <LucideProvider strokeWidth={1.25}>
          <MotionProvider>
            <AuthProvider>
              <DisplayDensityProvider>
                <FeedbackProvider>
                  <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground shadow-lg"
                  >
                    Chuyển đến nội dung chính
                  </a>
                  <RuntimeFeaturesProvider features={runtimeConfig?.features ?? null}>
                    <AppShell initialSidebarCollapsed={initialSidebarCollapsed} assistantEnabled={assistantEnabled} agentModels={agentModels}>
                      {children}
                    </AppShell>
                  </RuntimeFeaturesProvider>
                  <PWAServiceWorkerManager />
                  <WebVitalsReporter />
                  <ConfirmHost />
                </FeedbackProvider>
              </DisplayDensityProvider>
            </AuthProvider>
          </MotionProvider>
        </LucideProvider>
      </body>
    </html>
  );
}
