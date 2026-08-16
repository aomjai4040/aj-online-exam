"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublishedExams } from "@/lib/firestore";
import BottomNav from "@/components/BottomNav";
import CourseResources from "@/components/CourseResources";
import SampleVideoTeaser from "@/components/SampleVideoTeaser";
import { BRAND } from "@/lib/subjects";
import { PRICING, dcdCurrentPrice } from "@/lib/pricing";
import { useAuth } from "@/lib/auth-context";
import { getUserAccess, EMPTY_ACCESS, type UserAccess } from "@/lib/access";
import { daysToExam, daysToDcdExam, daysToDcdApplyClose } from "@/lib/exam-config";

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

  const hasApp    = access.hasAny;                          // มีคอร์สอะไรก็ได้
  const hasReview = access.hasReview;                       // มีแพ็กติวทบทวน 499
  const hasFull   = access.hasFull;                         // มีคอร์สเต็ม
  const appOnly   = hasApp && !hasFull && !hasReview;       // มีแค่ App Only → เสนออัปเกรด

  const appFeatures = [
    total !== null
      ? `ข้อสอบแยกรายหัวข้อ + ข้อสอบเสมือนจริง พร้อมเฉลย — อัปเพิ่มเรื่อยๆ จนถึงวันสอบ (ตอนนี้ ${questions.toLocaleString()} ข้อ · อาจถึง ~2,000)`
      : "ข้อสอบแยกรายหัวข้อ + ข้อสอบเสมือนจริง พร้อมเฉลย — อัปเพิ่มเรื่อยๆ จนถึงวันสอบ (อาจถึง ~2,000 ข้อ)",
    "Mock Exam จำลองสนามจริง พร้อมจับเวลา",
    "ระบบประเมินความพร้อมรายบุคคล",
    "Smart Review — ระบบทบทวนข้อที่เคยผิดอัตโนมัติ",
    "Flash Card + เกมทบทวน",
    "ดาวน์โหลดข้อสอบ + เฉลยเป็น PDF ไปปริ๊นอ่านได้",
  ];

  const fullFeatures = [
    "ทุกอย่างในแพ็กติวเข้ม 14 วัน ครบ",
    "คลิปสอนละเอียดครบทุกบท 65 คลิป รวม 47 ชั่วโมง",
    "คู่มือฉบับละเอียด 395 หน้า (เป็นไฟล์ PDF)",
    "กลุ่ม LINE ถามพี่อ้อมได้ตลอดช่วงติว 14 วัน",
  ];

  return (
    <div className="min-h-screen bg-stone-50 pb-28">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-5 pt-9 pb-7" style={{ backgroundColor: BRAND.primaryDark }}>
        <div className="max-w-lg md:max-w-4xl mx-auto">
          <h1 className="text-[1.7rem] font-bold leading-tight tracking-tight mb-2 text-white">
            แพ็กเกจ & ราคา
          </h1>
          <p className="text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            เลือกแบบที่เหมาะกับการเตรียมตัวของคุณ · จ่ายครั้งเดียว {PRICING.app.period}
          </p>

          {/* urgency — วันสอบประกาศแล้ว นับถอยหลังจริง (ซ่อนเมื่อมีคอร์สเต็มแล้ว/เลยวันสอบ) */}
          {!hasFull && daysToExam() > 0 && (
            <div className="mt-3.5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
              style={{ backgroundColor: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.22)" }}>
              <span className="text-[13px]">⏳</span>
              <span className="text-[13px] font-semibold text-white">
                สอบจริง 15 ส.ค. — เหลืออีก{" "}
                <span style={{ color: "#FCD34D" }}>{daysToExam()}</span> วัน · เริ่มวันนี้ยังทัน
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="max-w-lg md:max-w-4xl mx-auto px-5 py-6 space-y-4">

        {/* ── สนามกรมควบคุมโรค — สนามที่กำลังเปิดรับสมัคร วางไว้บนสุด ─────── */}
        {!access.hasDcd && daysToDcdExam() >= 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid #0B6E65" }}>
            <div className="px-5 py-4" style={{ backgroundColor: "#0B4F48" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#FBBF24", color: "#7C2D12" }}>
                  สนามใหม่ · เปิดรับสมัครแล้ว
                </span>
              </div>
              <p className="text-[19px] font-bold text-white leading-tight">{PRICING.dcd.name}</p>
              <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.72)" }}>
                {PRICING.dcd.tagline}
              </p>
            </div>

            <div className="bg-white px-5 py-4">
              <div className="rounded-xl px-3.5 py-2.5 mb-3.5 text-[12.5px] leading-relaxed"
                style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" }}>
                <span className="font-bold">รับสมัครสอบ:</span> 17 ส.ค. – 4 ก.ย. ที่ ddc.thaijobjob.com
                {daysToDcdApplyClose() >= 0 && (
                  <> (เหลืออีก {daysToDcdApplyClose()} วัน)</>
                )} · <span className="font-bold">วันสอบข้อเขียน รอประกาศ</span>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                {dcdCurrentPrice().isLaunch && (
                  <span className="text-[15px] line-through" style={{ color: "#C4C4C0" }}>
                    ฿{PRICING.dcd.price}
                  </span>
                )}
                <span className="text-[30px] font-extrabold" style={{ color: BRAND.primary }}>
                  ฿{dcdCurrentPrice().amount}
                </span>
                <span className="text-[12.5px]" style={{ color: "#A8A8A6" }}>
                  {PRICING.dcd.period}
                </span>
              </div>
              {dcdCurrentPrice().isLaunch && (
                <p className="text-[12.5px] font-semibold mb-3" style={{ color: "#B45309" }}>
                  🔥 โปรเปิดตัว ฿{PRICING.dcd.launchPrice} ถึง 31 ส.ค. เท่านั้น —
                  น้องคอร์ส สป.สธ. ใช้โค้ดแบบประเมินลดอีก ฿100 เหลือ ฿{PRICING.dcd.launchPrice - 100}
                </p>
              )}

              <ul className="space-y-2 mb-4">
                {[
                  "คอร์สวิดีโอ + คลังข้อสอบ ทำใหม่เจาะจงสนามกรมควบคุมโรค (ทยอยเพิ่มถึงวันสอบ)",
                  "Mock Exam จำลองสนามจริง จับเวลา + เกมทบทวน",
                  "Daily Quiz เจาะจุดอ่อนรายคน ชุดใหม่ทุกวัน",
                  "กลุ่ม LINE เฉพาะคอร์ส — สมัครแล้วกดเข้าจากในแอปได้เลย",
                  "ตารางติวปรับให้ทันทีเมื่อกรมประกาศวันสอบ",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-gray-700">
                    <Check /> <span>{t}</span>
                  </li>
                ))}
              </ul>

              <Link href="/checkout/dcd"
                className="btn-primary w-full py-3.5 text-[15px] block text-center">
                สมัครคอร์สกรมควบคุมโรค ฿{dcdCurrentPrice().amount}
              </Link>
              <p className="text-[12px] text-center mt-2" style={{ color: "#A8A8A6" }}>
                มีโค้ดส่วนลดจากการทำแบบประเมิน ใช้ได้ในหน้าถัดไป
              </p>
            </div>
          </div>
        )}

        {/* ── คลิปตัวอย่างฟรี (เฉพาะคนที่ยังไม่ใช่คอร์สเต็ม) ───────────────── */}
        {!hasFull && <SampleVideoTeaser />}

        <p className="text-[12px] font-bold uppercase tracking-widest pt-2" style={{ color: "#A8A8A6" }}>
          สนาม สป.สธ. 2569
        </p>

        {/* แพ็กเกจ 3 ใบ — จอกว้าง (≥md) วางเคียงกัน */}
        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-4 md:items-start">

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

        {/* ── แพ็กติวทบทวน 499 (ใหม่ — ช่วงโค้งสุดท้าย) ────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "2px solid #F59E0B" }}>
          <div className="px-5 py-2 text-center text-[12px] font-bold"
            style={{ backgroundColor: "#F59E0B", color: "#412402" }}>
            🔥 ใหม่! สำหรับติวโค้งสุดท้าย
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <p className="text-[17px] font-bold text-gray-900">{PRICING.review.name}</p>
                <p className="text-[12.5px]" style={{ color: "#A8A8A6" }}>{PRICING.review.tagline}</p>
              </div>
              <p className="text-[26px] font-extrabold leading-none flex-shrink-0" style={{ color: "#B45309" }}>
                ฿{PRICING.review.price}
              </p>
            </div>

            <div className="space-y-2 mt-4 mb-5">
              {[
                "ทุกอย่างใน App Only ครบ",
                "ตารางติวเข้ม 14 วัน ปรับตามจุดอ่อนรายคน (1–14 ส.ค. 69)",
                "คลิปติวสรุปตามแผน ชุดใหม่จากพี่อ้อม",
                "เอกสารประกอบการติวโค้งสุดท้าย 14 วัน (PDF)",
                "ข้อสอบฝึกตามเรื่องที่ทบทวน",
              ].map((f, i) => (
                <div key={f} className="flex items-start gap-2.5 text-[13.5px]"
                  style={{ color: i === 0 ? "#A8A8A6" : "#374151" }}>
                  <Check color={i === 0 ? "#A8A8A6" : "#B45309"} /> <span>{f}</span>
                </div>
              ))}
              <div className="flex items-start gap-2.5 text-[13.5px]" style={{ color: "#C4C4C0" }}>
                <span className="w-4 flex-shrink-0 text-center font-bold mt-0.5">✕</span>
                <span>ไม่มีกลุ่ม LINE ถาม-ตอบ (มีในคอร์สเต็ม)</span>
              </div>
            </div>

            {hasFull ? (
              <div className="w-full py-3 rounded-xl text-[14px] font-bold text-center"
                style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
                ✓ สิทธิ์นี้รวมอยู่ในคอร์สเต็มของคุณแล้ว
              </div>
            ) : hasReview ? (
              <div className="w-full py-3 rounded-xl text-[14px] font-bold text-center"
                style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
                ✓ คุณมีแพ็กนี้แล้ว
              </div>
            ) : appOnly ? (
              <Link href="/checkout/up-review"
                className="w-full py-3.5 text-[15px] font-bold rounded-xl flex items-center justify-center gap-2 text-white"
                style={{ backgroundColor: "#B45309" }}>
                อัปเกรด จ่ายเพิ่ม ฿{PRICING.upToReviewPrice}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ) : (
              <>
                <Link href="/checkout/review"
                  className="w-full py-3.5 text-[15px] font-bold rounded-xl flex items-center justify-center gap-2 text-white"
                  style={{ backgroundColor: "#B45309" }}>
                  สั่งซื้อ ฿{PRICING.review.price}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
                <p className="text-center text-[11.5px] mt-2" style={{ color: "#C4C4C0" }}>
                  {PRICING.review.period} · จ่ายผ่านพร้อมเพย์ ปลดล็อกอัตโนมัติทันที
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── คอร์สเต็ม ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "2px solid #7C3AED" }}>
          <div className="px-5 py-2 text-center text-[12px] font-bold text-white"
            style={{ backgroundColor: "#7C3AED" }}>
            👑 จัดเต็ม ครบทุกอย่าง
          </div>
          <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <p className="text-[17px] font-bold text-gray-900">{PRICING.full.name}</p>
              <p className="text-[12.5px]" style={{ color: "#A8A8A6" }}>{PRICING.full.tagline}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[26px] font-extrabold leading-none" style={{ color: "#7C3AED" }}>
                ฿{PRICING.full.price}
              </p>
              <p className="text-[11px] mt-1 font-semibold" style={{ color: "#7C3AED" }}>
                เพิ่มจากติวเข้มแค่ ฿{PRICING.reviewToFullPrice}
              </p>
            </div>
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
            <div className="w-full py-3 rounded-xl text-[14px] font-bold text-center"
              style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
              ✓ คุณเป็นสมาชิกคอร์สเต็มแล้ว
            </div>
          ) : hasReview ? (
            <Link href="/checkout/up-full2"
              className="btn-primary w-full py-3.5 text-[15px] flex items-center justify-center gap-2">
              อัปเกรดเป็นคอร์สเต็ม จ่ายเพิ่ม ฿{PRICING.reviewToFullPrice}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
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

          {/* สิทธิพิเศษ: ชีทสรุป + กลุ่ม LINE — โชว์ทุกคน (ล็อกถ้ายังไม่ใช่คอร์สเต็ม) */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid #F3F2F0" }}>
            <CourseResources compact hideCta lock={hasFull ? undefined : (appOnly || hasReview) ? "upgrade" : "full"} />
          </div>
          </div>
        </div>

        </div>{/* /แพ็กเกจ 2 ใบ */}

        {/* ── Upgrade note (ซ่อนถ้ามีคอร์สเต็มแล้ว) ─────────────────────────── */}
        {!hasFull && (
          <div className="rounded-2xl px-4 py-3.5 flex items-start gap-3"
            style={{ backgroundColor: "#EBF5F3", border: "1px solid #C3E5DE" }}>
            <span className="text-[18px] leading-none mt-0.5">💡</span>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "#0B6E65" }}>
              <span className="font-bold">อัปเกรดได้ทุกแพ็กภายหลัง จ่ายเฉพาะส่วนต่าง</span>
              {" "}— 299→499 เพิ่ม ฿{PRICING.upToReviewPrice} · 499→699 เพิ่ม ฿{PRICING.reviewToFullPrice} · 299→699 เพิ่ม ฿{PRICING.upgradePrice} (ไม่ต้องซื้อใหม่)
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
          ขั้นตอนซื้อ: กดสั่งซื้อ → สแกน QR พร้อมเพย์ → อัปสลิป → ปลดล็อกอัตโนมัติทันที
          <br />
          มีปัญหาการชำระเงิน? ทัก LINE แอดมินได้ตลอด
        </p>
      </section>

      <BottomNav />
    </div>
  );
}
