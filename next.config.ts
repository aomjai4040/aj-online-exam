import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
  // Proxy Firebase Auth handler ผ่านโดเมนของเราเอง (first-party)
  // แก้ปัญหา signInWithRedirect พังบน iOS Safari / LINE in-app browser
  // เพราะ ITP บล็อก storage ข้ามโดเมนเมื่อ authDomain เป็น firebaseapp.com
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://aj-online-exam.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://aj-online-exam.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
