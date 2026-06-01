import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import ThemeProvider from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MindGate — SEO Content Reviewer",
  description: "MindGate giúp chấm điểm bài viết SEO theo 43 tiêu chí + AI proofread + kiểm chứng bài AI.",
  icons: { icon: "/mindgate-logo.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased text-slate-800">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
