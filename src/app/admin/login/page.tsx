"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/admin-config";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, loading, signIn, signOut } = useAuth();

  const [busy,    setBusy]    = useState(false);
  const [denied,  setDenied]  = useState(false);
  const [error,   setError]   = useState("");

  // Watch auth state — redirect if admin, sign out if not
  useEffect(() => {
    if (loading) return;
    if (!user)   return;

    console.log("[AdminLogin] user:", user.email, "isAdmin:", isAdmin(user.email));

    if (isAdmin(user.email)) {
      router.replace("/admin");
    } else {
      signOut().then(() => {
        setBusy(false);
        setDenied(true);
      });
    }
  }, [user, loading, router, signOut]);

  async function handleSignIn() {
    if (busy) return;
    setBusy(true);
    setDenied(false);
    setError("");
    try {
      await signIn();
      // popup: onAuthStateChanged → useEffect above handles routing
      // redirect: page navigates away
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user") {
        setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
      }
      setBusy(false);
    }
  }

  // Show spinner while Firebase is loading or after successful login (before redirect)
  if (loading || (user && isAdmin(user.email))) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-[3px] rounded-full animate-spin"
          style={{ borderColor: "#C3E5DE", borderTopColor: "#0B6E65" }} />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg"
        style={{ border: "1px solid #EBEBEA" }}>

        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: "#EBF5F3" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1 className="text-[20px] font-bold text-gray-900">Admin Panel</h1>
          <p className="text-[16px] mt-1 text-center" style={{ color: "#4A5568" }}>
            เข้าสู่ระบบด้วยบัญชี Google ที่มีสิทธิ์
          </p>
        </div>

        {denied && (
          <div className="mb-5 rounded-xl px-4 py-3 flex items-start gap-2.5"
            style={{ backgroundColor: "#FEF2F2" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-[16px] font-medium" style={{ color: "#DC2626" }}>
              บัญชีนี้ไม่มีสิทธิ์เข้าถึง Admin Panel
            </p>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl px-4 py-3 text-[16px] font-medium"
            style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          style={{
            display:"flex", width:"100%", alignItems:"center",
            justifyContent:"center", gap:12,
            padding:"12px 20px", borderRadius:16,
            border:"1px solid #E0DFDC", backgroundColor:"#fff",
            color:"#1F2937", fontSize:14, fontWeight:600,
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
            boxShadow:"0 1px 4px rgba(0,0,0,0.06)", touchAction:"manipulation",
          }}
        >
          {busy ? (
            <span style={{ width:20, height:20, flexShrink:0, borderRadius:"50%",
              border:"2px solid #D1D5DB", borderTop:"2px solid #374151",
              animation:"aspin .8s linear infinite", display:"inline-block" }} />
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

        <p className="text-center text-[17px] mt-5" style={{ color: "#5A6478" }}>
          เฉพาะบัญชีที่ได้รับสิทธิ์เท่านั้น
        </p>
        <style>{`@keyframes aspin { to { transform:rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
