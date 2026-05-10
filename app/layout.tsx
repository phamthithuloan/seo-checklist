import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SEO Content Checklist Reviewer",
  description: "Phân tích bài viết SEO theo checklist rule-based.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased text-slate-800">
        {children}
      </body>
    </html>
  );
}
