"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { checkUserHasAnyAccess } from "@/lib/activation";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";

// ─── Destination resolver ─────────────────────────────────────────────────────

async function resolveAfterLogin(uid: string, from: string): Promise<string> {
  // Don't send users back to /login (loop) or /activate (defeats purpose)
  const safePaths = ["/exams", "/dashboard", "/exam/", "/result/", "/activate"];
  const dest = safePaths.some(p => from.startsWith(p)) ? from : "/dashboard";
  try {
    const hasAccess = await checkUserHasAnyAccess(uid);
    return hasAccess ? dest : "/activate";
  } catch {
    return "/activate";
  }
}

// ─── Button helpers ───────────────────────────────────────────────────────────

const BASE: React.CSSProperties = {
  display: "flex", width: "100%", alignItems: "center",
  justifyContent: "center", gap: 10,
  padding: "14px 20px", borderRadius: 16,
  fontSize: 14, fontWeight: 600, touchAction: "manipulation",
  WebkitUserSelect: "none", userSelect: "none", boxSizing: "border-box",
};

// ─── Inner component (needs useSearchParams → must be inside Suspense) ────────

function LoginInner() {
  const { user, loading, signIn } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get("from") ?? "/dashboard";

  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  // ── Redirect when user becomes known ────────────────────────────────────────
  useEffect(() => {
    if (loading || !user) return;
    console.log("[Login] user ready →", user.email, "resolving destination...");
    resolveAfterLogin(user.uid, from).then(dest => {
      console.log("[Login] → router.replace:", dest);
      router.replace(dest);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  // ── Loading / redirecting ────────────────────────────────────────────────────
  if (loading || user) return <AccessGuardSpinner />;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleSignIn() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn();
      // popup: onAuthStateChanged fires → useEffect above redirects
      // redirect: page navigates away — no more code runs here
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
      }
      setBusy(false);
    }
  }

  async function handleActivate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn();
      // After popup: user is set → useEffect resolves to /activate via DEST or no course
      // After redirect: page reloads at /login → user set → resolveAfterLogin → /activate
      //   (because new user has no courses yet)
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
      }
      setBusy(false);
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh", backgroundColor: "#F5F5F3",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "48px 20px",
    }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: 24, width: "100%",
        maxWidth: 380, padding: "32px 28px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #EBEBEA",
      }}>
        {/* Logo */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom: 28 }}>
          <div style={{ width:56, height:56, borderRadius:16, backgroundColor:"#0B6E65",
            display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ width:28, height:28, pointerEvents:"none" }}>
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, color:"#111110", margin:0 }}>
            AJ <span style={{ color:"#0B6E65" }}>ExamOnline</span>
          </h1>
          <p style={{ fontSize:13, color:"#A8A8A6", marginTop:6, textAlign:"center" }}>
            เข้าสู่ระบบเพื่อเริ่มทำข้อสอบ
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ backgroundColor:"#FEF2F2", borderRadius:12, padding:"12px 16px",
            marginBottom:16, fontSize:13, fontWeight:500, color:"#DC2626" }}>
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          style={{ ...BASE, backgroundColor:"#fff", color:"#1F2937",
            border:"1px solid #E0DFDC", boxShadow:"0 1px 4px rgba(0,0,0,0.08)",
            opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}
        >
          {busy ? (
            <span style={{ width:20, height:20, flexShrink:0, borderRadius:"50%",
              border:"2px solid #D1D5DB", borderTop:"2px solid #374151",
              animation:"lspin .8s linear infinite", display:"inline-block" }} />
          ) : (
            <svg viewBox="0 0 24 24" style={{ width:20, height:20, flexShrink:0, pointerEvents:"none" }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          <span style={{ pointerEvents:"none" }}>
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบด้วย Google"}
          </span>
        </button>

        {/* Divider */}
        <div style={{ display:"flex", alignItems:"center", gap:12, margin:"18px 0" }}>
          <div style={{ flex:1, height:1, backgroundColor:"#F3F2F0" }} />
          <span style={{ fontSize:11, color:"#C4C4C0" }}>หรือ</span>
          <div style={{ flex:1, height:1, backgroundColor:"#F3F2F0" }} />
        </div>

        {/* Activate code */}
        <button
          type="button"
          onClick={handleActivate}
          disabled={busy}
          style={{ ...BASE, backgroundColor:"transparent", color:"#0B6E65",
            border:"1.5px solid #0B6E65",
            opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ width:18, height:18, flexShrink:0, pointerEvents:"none" }}>
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          <span style={{ pointerEvents:"none" }}>กรอกรหัสเปิดใช้งานคอร์ส</span>
        </button>

        <p style={{ fontSize:11.5, color:"#A8A8A6", textAlign:"center", marginTop:10 }}>
          ต้อง login ก่อน จึงกรอก Activation Code ได้
        </p>
      </div>

      <Link href="/"
        style={{ marginTop:24, fontSize:12.5, fontWeight:500, color:"#A8A8A6", textDecoration:"none" }}>
        ← กลับหน้าหลัก
      </Link>

      <style>{`@keyframes lspin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AccessGuardSpinner />}>
      <LoginInner />
    </Suspense>
  );
}
