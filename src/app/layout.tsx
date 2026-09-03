import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navigation } from "@/components/navigation";

export const metadata: Metadata = {
  applicationName: "QCET E-Office",
  title: {
    default: "QCET E-Office - Văn phòng Điện tử",
    template: "%s | QCET E-Office",
  },
  description:
    "Hệ thống Quản trị & Điều hành Văn phòng Điện tử - Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ (QCET)",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F9F8F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0D0C" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full scroll-smooth antialiased" suppressHydrationWarning>
      <body className="min-h-full overflow-x-hidden bg-background text-foreground font-sans">
        <ThemeProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground shadow-lg"
          >
            Chuyển đến nội dung chính
          </a>
          <Navigation />
          <main
            id="main-content"
            className="min-h-screen pt-16 pb-20 md:pt-20 md:pb-12"
            tabIndex={-1}
          >
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
