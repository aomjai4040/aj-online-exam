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
  metadataBase: new URL("https://aj-exam-online.vercel.app"),
  title: "AJ ExamOnline | คลังข้อสอบนักวิชาการสาธารณสุข",
  description: "แนวข้อสอบนักวิชาการสาธารณสุข สป.สธ. พร้อมเฉลยละเอียดทุกข้อ ทดลองทำฟรี ฝึกได้ทุกวันบนมือถือ",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "AJ ExamOnline | คลังข้อสอบนักวิชาการสาธารณสุข",
    description: "แนวข้อสอบพร้อมเฉลยละเอียดทุกข้อ ทดลองทำฟรี ฝึกได้ทุกวันบนมือถือ",
    url: "https://aj-exam-online.vercel.app",
    siteName: "AJ ExamOnline",
    locale: "th_TH",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "AJ ExamOnline" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AJ ExamOnline | คลังข้อสอบนักวิชาการสาธารณสุข",
    description: "แนวข้อสอบพร้อมเฉลยละเอียดทุกข้อ ทดลองทำฟรี",
    images: ["/og.png"],
  },
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
        <meta name="theme-color" content="#0B6E65" />
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
