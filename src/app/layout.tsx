import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion/motion-provider";
import { AuthProvider } from "@/lib/auth-context";
import { DisplayDensityProvider } from "@/components/density-provider";
import { AppShell } from "@/components/layout/app-shell";
import { PWAServiceWorkerManager } from "@/components/pwa/pwa-service-worker-manager";
import { WebVitalsReporter } from "@/components/telemetry/web-vitals-reporter";

const fontSans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  display: "swap",
});

const fontHeading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
  display: "swap",
});

import { INSTITUTION_CONFIG } from "@/config/institution";

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
  themeColor: "#fbfbfb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`light ${fontSans.variable} ${fontHeading.variable} ${fontMono.variable} h-full antialiased`}
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
        <MotionProvider>
          <AuthProvider>
            <DisplayDensityProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground shadow-lg"
              >
                Chuyển đến nội dung chính
              </a>
              <AppShell>{children}</AppShell>
              <PWAServiceWorkerManager />
              <WebVitalsReporter />
            </DisplayDensityProvider>
          </AuthProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
