"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublishedExams } from "@/lib/firestore";
import BottomNav from "@/components/BottomNav";
import CourseResources from "@/components/CourseResources";
import { BRAND } from "@/lib/subjects";
import { PRICING } from "@/lib/pricing";
import { useAuth } from "@/lib/auth-context";
import { getUserAccess, EMPTY_ACCESS, type UserAccess } from "@/lib/access";

// ─── /packages — แพ็กเกจ + ราคา (Aj ยืนยัน 299/699/+400) ─────────────────────
// การซื้อตอนนี้: ทักแชทแอดมิน → รับรหัส → กรอกที่ /activate
// Phase 3 จะเปลี่ยนปุ่มสั่งซื้อเป็นจ่ายเงินจบในเว็บ (PromptPay + ตรวจสลิป)

function Check({ color = BRAND.primary }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4 flex-shrink-0 mt-0.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function PackagesPage() {
  const { user } = useAuth();
  const [total,     setTotal]     = useState<number | null>(null);
  const [questions, setQuestions] = useState(0);
  const [freeCount, setFreeCount] = useState(0);
  const [access,    setAccess]    = useState<UserAccess>(EMPTY_ACCESS);

  useEffect(() => {
    getPublishedExams()
      .then((all) => {
        setTotal(all.length);
        setQuestions(all.reduce((s, e) => s + (e.questionCount || 0), 0));
        setFreeCount(all.filter((e) => e.isFree).length);
      })
      .catch(() => setTotal(0));
  }, []);

  useEffect(() => {
    if (user) getUserAccess(user.uid).then(setAccess).catch(() => setAccess(EMPTY_ACCESS));
  }, [user]);

  const hasApp  = access.hasAny;               // มีคอร์สอะไรก็ได้ (รวม App Only)
  const hasFull = access.hasFull;              // มีคอร์สเต็ม
  const appOnly = hasApp && !hasFull;          // มีแค่ App Only → เสนออัปเกรด

  const appFeatures = [
    total !== null
      ? `ข้อสอบทั้งหมด ${total} ชุด (${questions.toLocaleString()} ข้อ) พร้อมเฉลยละเอียด`
      : "ข้อสอบทั้งหมดพร้อมเฉลยละเอียดทุกข้อ",
    "Smart Review — ระบบทบทวนข้อที่เคยผิดอัตโนมัติ",
    "Flash Card + MOPH Focus ประเด็นเน้นกระทรวง",
    "ดาวน์โหลดข้อสอบ + เฉลยเป็น PDF ไปปริ๊นอ่านได้",
    "อัปเดตข้อสอบใหม่ต่อเนื่อง",
  ];

  const fullFeatures = [
    "ทุกอย่างใน App Only ครบ",
    "วิดีโอติวสอบครบทุกหัวข้อ",
    "ชีทสรุปเนื้อหา 7 เรื่อง (~500 หน้า) ประกอบการติว",
  ];

  return (
    <div className="min-h-screen bg-stone-50 pb-28">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-5 pt-9 pb-7" style={{ backgroundColor: BRAND.primaryDark }}>
        <div className="max-w-lg mx-auto">
          <h1 className="text-[1.7rem] font-bold leading-tight tracking-tight mb-2 text-white">
            แพ็กเกจ & ราคา
          </h1>
          <p className="text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            เลือกแบบที่เหมาะกับการเตรียมตัวของคุณ · จ่ายครั้งเดียว {PRICING.app.period}
          </p>
        </div>
      </section>

      <section className="max-w-lg mx-auto px-5 py-6 space-y-4">

        {/* ── App Only (แนะนำสำหรับเริ่มต้น) ─────────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ border: `2px solid ${BRAND.primary}` }}>
          <div className="px-5 py-2 text-center text-[12px] font-bold text-white"
            style={{ backgroundColor: BRAND.primary }}>
            ⭐ เริ่มต้นยอดนิยม
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <p className="text-[17px] font-bold text-gray-900">{PRICING.app.name}</p>
                <p className="text-[12.5px]" style={{ color: "#A8A8A6" }}>{PRICING.app.tagline}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[12.5px] line-through" style={{ color: "#C4C4C0" }}>
                  ฿{PRICING.app.compareAt}
                </p>
                <p className="text-[26px] font-extrabold leading-none" style={{ color: BRAND.primary }}>
                  ฿{PRICING.app.price}
                </p>
              </div>
            </div>

            <div className="space-y-2 mt-4 mb-5">
              {appFeatures.map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-[13.5px] text-gray-700">
                  <Check /> <span>{f}</span>
                </div>
              ))}
            </div>

            {hasApp ? (
              <div className="w-full py-3 rounded-xl text-[14px] font-bold text-center"
                style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
                ✓ คุณมีสิทธิ์นี้แล้ว
              </div>
            ) : (
              <>
                <Link href="/checkout/app"
                  className="btn-primary w-full py-3.5 text-[15px] flex items-center justify-center gap-2">
                  สั่งซื้อ ฿{PRICING.app.price}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
                <p className="text-center text-[11.5px] mt-2" style={{ color: "#C4C4C0" }}>
                  {PRICING.app.period} · จ่ายผ่านพร้อมเพย์ ปลดล็อกอัตโนมัติทันที
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── คอร์สเต็ม ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <p className="text-[17px] font-bold text-gray-900">{PRICING.full.name}</p>
              <p className="text-[12.5px]" style={{ color: "#A8A8A6" }}>{PRICING.full.tagline}</p>
            </div>
            <p className="text-[26px] font-extrabold leading-none flex-shrink-0 text-gray-900">
              ฿{PRICING.full.price}
            </p>
          </div>

          <div className="space-y-2 mt-4 mb-5">
            {fullFeatures.map((f, i) => (
              <div key={f} className="flex items-start gap-2.5 text-[13.5px]"
                style={{ color: i === 0 ? "#A8A8A6" : "#374151" }}>
                <Check color={i === 0 ? "#A8A8A6" : BRAND.primary} /> <span>{f}</span>
              </div>
            ))}
          </div>

          {hasFull ? (
            <>
              <div className="w-full py-3 rounded-xl text-[14px] font-bold text-center mb-3"
                style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
                ✓ คุณเป็นสมาชิกคอร์สเต็มแล้ว
              </div>
              <CourseResources compact />
            </>
          ) : appOnly ? (
            <Link href="/checkout/upgrade"
              className="btn-primary w-full py-3.5 text-[15px] flex items-center justify-center gap-2">
              อัปเกรดเป็นคอร์สเต็ม จ่ายเพิ่ม ฿{PRICING.upgradePrice}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ) : (
            <Link href="/checkout/full"
              className="btn-secondary w-full py-3.5 text-[15px] flex items-center justify-center gap-2">
              สั่งซื้อคอร์สเต็ม ฿{PRICING.full.price}
            </Link>
          )}
        </div>

        {/* ── Upgrade note (ซ่อนถ้ามีคอร์สเต็มแล้ว) ─────────────────────────── */}
        {!hasFull && (
          <div className="rounded-2xl px-4 py-3.5 flex items-start gap-3"
            style={{ backgroundColor: "#EBF5F3", border: "1px solid #C3E5DE" }}>
            <span className="text-[18px] leading-none mt-0.5">💡</span>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "#0B6E65" }}>
              ซื้อ App Only ไปแล้ว อยากได้วิดีโอ + ชีทสรุปเพิ่มทีหลัง?
              <span className="font-bold"> อัปเกรดได้โดยจ่ายส่วนต่าง ฿{PRICING.upgradePrice} เท่านั้น</span>
              {" "}— ไม่ต้องซื้อใหม่
            </p>
          </div>
        )}

        {/* ── Free trial ──────────────────────────────────────────────────── */}
        {freeCount > 0 && (
          <Link href="/free"
            className="block rounded-2xl p-5 bg-white hover:shadow-md active:scale-[0.99] transition-all"
            style={{ border: "1px dashed #C3E5DE" }}>
            <div className="flex items-center gap-3">
              <div className="text-2xl">🎁</div>
              <div className="flex-1">
                <p className="text-[14px] font-bold" style={{ color: "#0B6E65" }}>
                  ยังไม่แน่ใจ? ทดลองทำฟรี {freeCount} ชุดก่อน
                </p>
                <p className="text-[12px]" style={{ color: "#A8A8A6" }}>ไม่มีค่าใช้จ่าย ไม่ต้องกรอกบัตร</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        )}

        {/* ── Activate code ───────────────────────────────────────────────── */}
        <Link href="/activate"
          className="block rounded-2xl p-5 bg-white hover:shadow-md active:scale-[0.99] transition-all"
          style={{ border: "1px solid #EBEBEA" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#EBF5F3" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65" strokeWidth="1.75"
                strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-gray-900">มีรหัสเปิดใช้งานแล้ว?</p>
              <p className="text-[12px]" style={{ color: "#A8A8A6" }}>กรอกรหัสเพื่อปลดล็อกได้เลย</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#D4D4D0"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>

        <p className="text-center text-[11.5px] pt-1" style={{ color: "#C4C4C0" }}>
          ขั้นตอนซื้อ: ทักแชทแอดมิน → ชำระเงิน → รับรหัส → กรอกรหัสในแอป
          <br />
          (ระบบชำระเงินในเว็บกำลังพัฒนา เร็ว ๆ นี้)
        </p>
      </section>

      <BottomNav />
    </div>
  );
}
