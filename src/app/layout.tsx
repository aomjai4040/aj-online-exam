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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AJ Exam",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#00BFA5" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={prompt.className} suppressHydrationWarning>
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }`,
          }}
        />
      </body>
    </html>
  );
}
