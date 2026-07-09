"use client";
/**
 * auth-context.tsx — Single source of truth for Firebase Auth
 *
 * Design principles:
 * 1. getRedirectResult is called ONCE at module load (before React mounts).
 *    This avoids React Strict Mode's double-invoke calling it twice.
 * 2. onAuthStateChanged is subscribed AFTER redirect is processed.
 *    This prevents the null flicker when returning from signInWithRedirect.
 * 3. loading stays true until auth state is definitively known.
 * 4. signIn handles popup (desktop/iPad) or redirect (Android only).
 * 5. All pages read state via useAuth() only.
 */

import {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
import {
  User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut          as fbSignOut,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

// ─── Module-level redirect processing ────────────────────────────────────────
//
// Called ONCE when this module is first imported (before any component mounts).
// React Strict Mode double-invokes effects, but NOT module-level code.
// This guarantees getRedirectResult is called exactly once per page load.
//
const _redirectPromise: Promise<User | null> =
  typeof window === "undefined"
    ? Promise.resolve(null)          // SSR — skip
    : getRedirectResult(auth)
        .then(r => r?.user ?? null)
        .catch(err => {
          console.error("[Auth] getRedirectResult failed:", err?.code, err?.message);
          return null;
        });

// ─── Redirect detection ───────────────────────────────────────────────────────
// หลังแก้ authDomain เป็นโดเมนเดียวกับเว็บ (first-party, ดู firebase.ts +
// rewrite ใน next.config.ts) → signInWithRedirect ใช้ได้ทุก browser รวมถึง
// iOS Safari และ LINE/Facebook in-app browser
//
// กลยุทธ์: มือถือ + in-app browser → redirect (popup โดนบล็อกบ่อย)
//          desktop → popup (UX ดีกว่า ไม่เสีย state ของหน้า)
//          localhost → popup เท่านั้น (authDomain ยังเป็น firebaseapp.com)

function shouldUseRedirect(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;

  const ua = navigator.userAgent;
  const isInApp  = /Line\/|FBAN|FBAV|Instagram|Messenger|wv|WebView/i.test(ua);
  const isMobile = /Android|iPhone|iPod/i.test(ua)
    // iPadOS 13+ รายงานตัวเองเป็น Macintosh แต่มี touch
    || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    || /iPad/i.test(ua);
  return isInApp || isMobile;
}

// ─── Google provider ──────────────────────────────────────────────────────────

const GOOGLE = new GoogleAuthProvider();

// ─── Context type ─────────────────────────────────────────────────────────────

interface AuthCtx {
  user:    User | null;
  loading: boolean;        // true while Firebase is resolving auth state
  signIn:  () => Promise<void>;
  signOut: () => Promise<void>;
  // Backward-compat alias used by Navbar / home page
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true,
  signIn:           async () => {},
  signOut:          async () => {},
  signInWithGoogle: async () => {},
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function persistUser(user: User): Promise<void> {
  try {
    await setDoc(doc(db, "users", user.uid), {
      displayName: user.displayName ?? "",
      email:       user.email       ?? "",
      photoURL:    user.photoURL    ?? "",
      lastSeenAt:  serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn("[Auth] persistUser failed (non-fatal):", e);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled  = false;
    let unsubscribe: (() => void) | undefined;

    // Wait for redirect result (resolves instantly if no redirect pending)
    _redirectPromise.then(redirectUser => {
      if (redirectUser) {
        console.log("[Auth] redirect user:", redirectUser.email);
        persistUser(redirectUser); // background write, don't block auth
      }

      if (cancelled) return;

      // Subscribe AFTER redirect is processed → first fire is the correct state
      unsubscribe = onAuthStateChanged(auth, u => {
        if (cancelled) return;
        console.log("[Auth] state →", u?.email ?? "null");
        setUser(u);
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // signIn: redirect for Android, popup for everything else.
  // After popup we explicitly set state — iOS Safari's cross-tab IndexedDB
  // sync is unreliable, so we cannot rely on onAuthStateChanged alone.
  const signIn = useCallback(async () => {
    if (shouldUseRedirect()) {
      console.log("[Auth] signIn → redirect");
      await signInWithRedirect(auth, GOOGLE);
      return;
    }
    console.log("[Auth] signIn → popup");
    try {
      const cred = await signInWithPopup(auth, GOOGLE);
      persistUser(cred.user);
      setUser(cred.user);
      setLoading(false);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      // popup ถูกบล็อกหรือ environment ไม่รองรับ → ลอง redirect แทน
      if (code === "auth/popup-blocked"
        || code === "auth/operation-not-supported-in-this-environment") {
        console.warn("[Auth] popup failed (", code, ") → fallback to redirect");
        await signInWithRedirect(auth, GOOGLE);
        return;
      }
      throw e; // ปล่อยให้หน้า login แสดง error ตามเดิม
    }
  }, [setUser, setLoading]);

  const signOut = useCallback(() => fbSignOut(auth), []);

  return (
    <AuthContext.Provider value={{
      user, loading,
      signIn,
      signOut,
      signInWithGoogle: signIn, // backward-compat for Navbar/home page
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() { return useContext(AuthContext); }
