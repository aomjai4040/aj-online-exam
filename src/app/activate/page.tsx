"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { activateCode, type ActivationError } from "@/lib/activation";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

// ─── Error messages ───────────────────────────────────────────────────────────

const ERROR_MSG: Record<ActivationError, string> = {
  INVALID_CODE:      "ไม่พบ Code นี้ในระบบ กรุณาตรวจสอบตัวพิมพ์ใหม่",
  INACTIVE:          "Code นี้ถูกปิดการใช้งานชั่วคราว",
  EXPIRED:           "Code นี้หมดอายุแล้ว",
  MAX_USES:          "Code นี้ถูกใช้งานครบจำนวนแล้ว",
  ALREADY_ACTIVATED: "คุณเปิดใช้คอร์สนี้ไปแล้ว",
  UNKNOWN:           "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
};

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessView({ courseName }: { courseName: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-5 py-16 text-center">
      {/* Checkmark */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: "#EBF5F3" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="text-[22px] font-bold text-gray-900 mb-2">เปิดใช้งานสำเร็จ!</h1>
      <p className="text-[14px] leading-relaxed mb-1" style={{ color: "#A8A8A6" }}>
        คุณได้รับสิทธิ์เข้าถึงคอร์ส
      </p>
      <p className="text-[16px] font-bold mb-8" style={{ color: "#0B6E65" }}>
        {courseName}
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white"
          style={{ backgroundColor: "#0B6E65" }}
        >
          ไปที่ Dashboard
        </button>
        <Link
          href="/exams"
          className="w-full py-3 rounded-2xl font-semibold text-[14px] text-center border"
          style={{ borderColor: "#E0DFDC", color: "#374151" }}
        >
          ดูคลังข้อสอบ
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivatePage() {
  const guard = useLoginGuard();
  const { user } = useAuth();
  const [code,    setCode]    = useState("");
  const [status,  setStatus]  = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error,   setError]   = useState<ActivationError | null>(null);
  const [success, setSuccess] = useState<{ courseId: string; courseName: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !code.trim()) return;

    setStatus("loading");
    setError(null);

    const result = await activateCode(user.uid, user.email ?? "", code);

    if (result.success) {
      setSuccess({ courseId: result.courseId!, courseName: result.courseName! });
      setStatus("success");
    } else {
      setError(result.error ?? "UNKNOWN");
      setStatus("error");
    }
  }

  if (guard !== "allowed") return <AccessGuardSpinner />;

  return (
    <div className="min-h-screen bg-stone-50 pb-28 flex flex-col">

      {/* Main */}
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
        {status === "success" && success ? (
          <SuccessView courseName={success.courseName} />
        ) : (
          <div className="px-5 pt-10 pb-6">

            {/* Icon */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ backgroundColor: "#EBF5F3" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>

            <h1 className="text-[24px] font-bold text-gray-900 mb-1">กรอก Activation Code</h1>
            <p className="text-[13px] leading-relaxed mb-8" style={{ color: "#A8A8A6" }}>
              ใส่ Code ที่ได้รับเพื่อเปิดใช้งานคอร์สของคุณ
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Code input */}
              <div>
                <label className="block text-[12.5px] font-semibold text-gray-600 mb-2">
                  Activation Code
                </label>
                <input
                  className="w-full rounded-2xl px-5 py-4 text-[20px] font-bold font-mono
                             uppercase tracking-[0.2em] text-center focus:outline-none transition-all"
                  style={{
                    border:      status === "error" ? "1.5px solid #DC2626" : "1.5px solid #E0DFDC",
                    boxShadow:   status === "error" ? "0 0 0 3px rgba(220,38,38,0.1)" : "none",
                    backgroundColor: "white",
                    color: "#111110",
                    letterSpacing: "0.25em",
                  }}
                  onFocus={(e) => {
                    if (status !== "error") {
                      e.currentTarget.style.border = "1.5px solid #0B6E65";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,110,101,0.12)";
                    }
                  }}
                  onBlur={(e) => {
                    if (status !== "error") {
                      e.currentTarget.style.border = "1.5px solid #E0DFDC";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                  placeholder="XXXX-XXXX"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    if (status === "error") { setStatus("idle"); setError(null); }
                  }}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={32}
                />

                {/* Error message */}
                {status === "error" && error && (
                  <div
                    className="mt-3 rounded-xl px-4 py-3 flex items-start gap-2.5"
                    style={{ backgroundColor: "#FEF2F2" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="w-4 h-4 flex-shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-[13px] font-medium" style={{ color: "#DC2626" }}>
                      {ERROR_MSG[error]}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={status === "loading" || !code.trim()}
                className="w-full py-4 rounded-2xl font-bold text-[15px] text-white
                           transition-all disabled:opacity-50 active:scale-[0.98]"
                style={{ backgroundColor: "#0B6E65" }}
              >
                {status === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังตรวจสอบ…
                  </span>
                ) : "เปิดใช้งาน"}
              </button>
            </form>

            {/* Help */}
            <div className="mt-8 p-4 rounded-2xl" style={{ backgroundColor: "#F5F5F3" }}>
              <p className="text-[12px] font-semibold text-gray-700 mb-1.5">ไม่มี Code?</p>
              <p className="text-[12px] leading-relaxed" style={{ color: "#A8A8A6" }}>
                Code จะได้รับหลังจากสมัครคอร์สกับ AJ ExamOnline
                ติดต่อสอบถามได้ที่ Line หรือ Facebook
              </p>
            </div>

            <div className="mt-4 text-center">
              <Link href="/dashboard" className="text-[12.5px] font-medium" style={{ color: "#A8A8A6" }}>
                ← กลับไป Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
