"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { tierPlan, type OrderTier } from "@/lib/order-types";
import { BRAND } from "@/lib/subjects";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import CourseResources from "@/components/CourseResources";

// ─── /checkout/[tier] — จ่ายเงินในเว็บ (PromptPay + อัปสลิป → ตรวจอัตโนมัติ) ────

type Phase = "loading" | "qr" | "verifying" | "success" | "error";
const TIERS: OrderTier[] = ["app", "full", "upgrade"];

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result)); // data:image/...;base64,....
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function CheckoutPage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();
  const router   = useRouter();
  const { tier } = useParams<{ tier: string }>();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [phase,   setPhase]   = useState<Phase>("loading");
  const [order,   setOrder]   = useState<{ orderId: string; amount: number; qr: string; courseName: string } | null>(null);
  const [error,   setError]   = useState("");
  const [okName,  setOkName]  = useState("");

  const validTier = TIERS.includes(tier as OrderTier);
  const plan = validTier ? tierPlan(tier as OrderTier) : null;

  // สร้างออเดอร์ + QR
  useEffect(() => {
    if (guard !== "allowed" || !user || !validTier) return;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tier }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "สร้างคำสั่งซื้อไม่สำเร็จ"); setPhase("error"); return; }
        setOrder(data);
        setPhase("qr");
      } catch { setError("สร้างคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่"); setPhase("error"); }
    })();
  }, [guard, user, tier, validTier]);

  async function handleSlip(file: File) {
    if (!user || !order) return;
    setPhase("verifying");
    setError("");
    try {
      const slip  = await fileToBase64(file);
      const token = await user.getIdToken();
      const res = await fetch("/api/submit-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.orderId, slip }),
      });
      const data = await res.json();
      if (data.ok) { setOkName(data.courseName); setPhase("success"); }
      else { setError(data.reason ?? "ตรวจสลิปไม่ผ่าน"); setPhase("qr"); }
    } catch { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); setPhase("qr"); }
  }

  if (guard !== "allowed") return <AccessGuardSpinner />;

  if (!validTier) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-[15px] font-semibold text-gray-800">ไม่พบแพ็กเกจนี้</p>
        <Link href="/packages" className="btn-primary text-sm px-6 py-2.5">← ดูแพ็กเกจ</Link>
      </div>
    );
  }

  // ── สำเร็จ ────────────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: "#EBF5F3" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-gray-900 mb-2">ชำระเงินสำเร็จ!</h1>
        <p className="text-[14px] mb-1" style={{ color: "#A8A8A6" }}>ปลดล็อกเรียบร้อยแล้ว</p>
        <p className="text-[16px] font-bold mb-6" style={{ color: BRAND.primary }}>{okName}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {tier !== "app" ? (
            <>
              <button onClick={() => router.push("/videos")}
                className="btn-primary w-full py-3 text-[14px]">ไปดูคอร์สวิดีโอ</button>
              <button onClick={() => router.push("/exams")}
                className="btn-secondary w-full py-3 text-[14px]">ทำข้อสอบ</button>
              {/* ชีทสรุป + กลุ่ม LINE สำหรับคอร์สเต็ม */}
              <div className="pt-2"><CourseResources compact /></div>
            </>
          ) : (
            <button onClick={() => router.push("/exams")}
              className="btn-primary w-full py-3 text-[14px]">เริ่มทำข้อสอบเลย</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <Link href="/packages" className="inline-flex items-center gap-1.5 text-[13px] mb-6"
          style={{ color: "#A8A8A6" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          แพ็กเกจ
        </Link>

        <h1 className="text-[20px] font-bold text-gray-900 mb-1">ชำระเงิน</h1>
        <p className="text-[13.5px] mb-6" style={{ color: "#A8A8A6" }}>
          {plan!.courseName} · <span className="font-bold" style={{ color: BRAND.primary }}>฿{plan!.amount}</span>
        </p>

        {(phase === "loading") && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "#D0EDE9", borderTopColor: BRAND.primary }} />
            <p className="text-[13px]" style={{ color: "#A8A8A6" }}>กำลังสร้าง QR...</p>
          </div>
        )}

        {phase === "error" && (
          <div className="text-center py-16">
            <p className="text-[15px] font-semibold text-gray-800 mb-4">{error}</p>
            <button onClick={() => location.reload()} className="btn-primary text-sm px-6 py-2.5">ลองใหม่</button>
          </div>
        )}

        {order && (phase === "qr" || phase === "verifying") && (
          <>
            {/* QR */}
            <div className="bg-white rounded-2xl p-6 text-center mb-4" style={{ border: "1px solid #EBEBEA" }}>
              <p className="text-[13px] font-semibold mb-3" style={{ color: "#0B6E65" }}>
                สแกนจ่ายด้วยแอปธนาคาร (พร้อมเพย์)
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.qr} alt="PromptPay QR" width={240} height={240}
                className="mx-auto rounded-xl" style={{ border: "1px solid #F3F2F0" }} />
              <p className="text-[26px] font-extrabold mt-3" style={{ color: BRAND.primary }}>
                ฿{order.amount}
              </p>
              <p className="text-[12px] mt-1" style={{ color: "#A8A8A6" }}>
                ยอดเงินถูกฝังใน QR แล้ว — สแกนแล้วโอนได้เลย
              </p>
            </div>

            {/* ขั้นตอน */}
            <div className="rounded-2xl px-4 py-3.5 mb-4 text-[12.5px] leading-relaxed"
              style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" }}>
              <span className="font-bold">ขั้นตอน:</span> ① สแกน QR จ่ายเงิน → ② บันทึกภาพสลิป →
              ③ กดปุ่มด้านล่างเพื่ออัปสลิป — ระบบตรวจอัตโนมัติและปลดล็อกทันที
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 mb-4 text-[13px] font-medium"
                style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                {error}
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSlip(f); }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={phase === "verifying"}
              className="btn-primary w-full py-3.5 text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {phase === "verifying" ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  กำลังตรวจสลิป…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                    strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  อัปโหลดสลิป → ตรวจอัตโนมัติ
                </>
              )}
            </button>

            <p className="text-center text-[11.5px] mt-4" style={{ color: "#C4C4C0" }}>
              จ่ายไม่สำเร็จ? ทัก LINE แอดมินได้ที่หน้าแพ็กเกจ
            </p>
          </>
        )}
      </div>
    </div>
  );
}
