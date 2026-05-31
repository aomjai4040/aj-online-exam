"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/admin-config";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;

    const onLoginPage = pathname === "/admin/login";

    if (!user) {
      if (!onLoginPage) {
        console.log("[AdminLayout] → /admin/login (no user)");
        router.replace("/admin/login");
      }
      return;
    }

    if (!isAdmin(user.email)) {
      console.log("[AdminLayout] → / (not admin)");
      signOut().then(() => router.replace("/"));
      return;
    }

    if (onLoginPage) {
      console.log("[AdminLayout] → /admin");
      router.replace("/admin");
    }
  }, [user, loading, pathname, router, signOut]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-[3px] rounded-full animate-spin"
          style={{ borderColor: "#C3E5DE", borderTopColor: "#0B6E65" }} />
      </div>
    );
  }

  return <>{children}</>;
}
