import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Providers } from "@/components/Providers";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "AJ ExamOnline | ระบบข้อสอบออนไลน์",
  description: "ระบบทำข้อสอบและแบบทดสอบออนไลน์ครบครัน เตรียมสอบได้ทุกที่ทุกเวลา",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <body className={prompt.className} suppressHydrationWarning>
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
