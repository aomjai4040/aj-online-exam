"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";

export type GuardState = "checking" | "allowed" | "redirecting";

export function useLoginGuard(): GuardState {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    console.log(`[LoginGuard] ${pathname} loading:${loading} user:${user?.email ?? "null"}`);

    if (loading) return;

    if (!user) {
      const to = `/login?from=${encodeURIComponent(pathname)}`;
      console.log(`[LoginGuard] ${pathname} → ${to}`);
      setState("redirecting");
      router.replace(to);
      return;
    }

    setState("allowed");
  }, [user, loading, router, pathname]);

  return state;
}
