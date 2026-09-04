import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { Navigation } from "@/components/navigation";

const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "QCET E-Office",
  title: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn - Hệ thống Quản trị & Điều hành Văn phòng Điện tử (E-Office)",
  description:
    "Hệ thống Quản trị & Điều hành Văn phòng Điện tử - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFBFB" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0C0E" },
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
    <html
      lang="vi"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full overflow-x-hidden bg-background text-foreground font-sans">
        <AuthProvider>
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
              className="min-h-[100dvh] py-6 md:py-8"
              tabIndex={-1}
            >
              <div className="max-w-[1440px] w-full mx-auto px-3.5 sm:px-6">{children}</div>
            </main>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
