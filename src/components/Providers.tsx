"use client";
// Client-only wrapper so layout.tsx (server component) can use AuthProvider
import { AuthProvider } from "@/lib/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
