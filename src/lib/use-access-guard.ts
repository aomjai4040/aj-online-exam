"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { checkUserHasAnyAccess } from "./activation";

export type GuardState = "checking" | "allowed" | "redirecting";

export function useAccessGuard(): GuardState {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    console.log(`[Guard] ${pathname} loading:${loading} user:${user?.email ?? "null"}`);

    if (loading) return; // auth not ready yet — do not redirect

    if (!user) {
      const to = `/login?from=${encodeURIComponent(pathname)}`;
      console.log(`[Guard] ${pathname} → ${to}`);
      setState("redirecting");
      router.replace(to);
      return;
    }

    let alive = true;
    checkUserHasAnyAccess(user.uid)
      .then(ok => {
        if (!alive) return;
        if (ok) {
          setState("allowed");
        } else {
          console.log(`[Guard] ${pathname} → /activate (no course)`);
          setState("redirecting");
          router.replace("/activate");
        }
      })
      .catch(() => {
        if (!alive) return;
        console.warn(`[Guard] checkAccess failed — sending to /activate`);
        setState("redirecting");
        router.replace("/activate");
      });

    return () => { alive = false; };
  }, [user, loading, router, pathname]);

  return state;
}
