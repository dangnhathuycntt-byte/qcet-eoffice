import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { DisplayDensityProvider } from "@/components/density-provider";
import { AppShell } from "@/components/layout/app-shell";

const fontSans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  display: "swap",
});

const fontHeading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "QCET E-Office",
  title: {
    default: "QCET E-Office",
    template: "%s | QCET E-Office",
  },
  description:
    "Hệ thống Quản trị & Điều hành Văn phòng Điện tử - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QCET E-Office",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    shortcut: "/icons/icon-192x192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#fbfbfb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
    >
      <head>
        <link rel="apple-touch-icon" href="/logo-qcet.png" />
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
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function(err) {
                      console.error('ServiceWorker registration failed:', err);
                    });
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full overflow-x-hidden bg-background text-foreground font-sans">
        <AuthProvider>
          <DisplayDensityProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground shadow-lg"
            >
              Chuyển đến nội dung chính
            </a>
            <AppShell>{children}</AppShell>
          </DisplayDensityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
