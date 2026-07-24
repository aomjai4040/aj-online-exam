"use client";
/**
 * /final-review — ติวโค้งสุดท้าย (ทบทวนรอบ 2) 1–14 ส.ค. 2569
 *
 * ตอนนี้เป็นหน้า teaser "เร็ว ๆ นี้" + ให้กำลังใจเรียนให้จบรอบแรก
 * เปิดสาธารณะ (ไม่ต้อง login) — คนยังไม่ซื้อคอร์สเห็นได้ เผื่อสนใจสมัคร
 */
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { PRICING } from "@/lib/pricing";

const ACCENT = "#0B6E65";
const LINE   = "#ECEBE9";
const MUTED  = "#A8A29E";

export default function FinalReviewPage() {
  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAFAF9" }}>
      <div className="max-w-lg mx-auto px-5 pt-12">

        <div className="bg-white rounded-[28px] p-8 text-center"
          style={{ border: `1px solid ${LINE}`,
                   boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.05)" }}>

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ backgroundColor: "#EBF5F3" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT}
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
            </svg>
          </div>

          <span className="inline-block text-[12px] font-bold px-3 py-1 rounded-full mb-3"
            style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
            เร็ว ๆ นี้
          </span>

          <h1 className="text-[22px] font-extrabold text-gray-900 leading-snug mb-1.5">
            ติวโค้งสุดท้าย
          </h1>
          <p className="text-[14px] font-semibold mb-4" style={{ color: ACCENT }}>
            ทบทวนรอบ 2 · วันที่ 1–14 สิงหาคม 2569
          </p>

          <p className="text-[14px] leading-relaxed mb-6 max-w-xs mx-auto" style={{ color: "#57534E" }}>
            ช่วง 2 สัปดาห์สุดท้ายก่อนสอบ (15 ส.ค.)
            เราจะกลับมาไล่ทบทวนจุดสำคัญด้วยกันแบบเข้มข้น
            <br /><br />
            ระหว่างนี้ตั้งใจเรียนเนื้อหาและฝึกข้อสอบให้ครบรอบแรกนะคะ
            เรียนจบก่อน ทวนรอบสองจะยิ่งแม่น 💪
            แล้วมาเจอกันโค้งสุดท้ายค่ะ
          </p>

          <div className="space-y-2.5">
            <Link href="/exams"
              className="block w-full py-3.5 rounded-2xl font-bold text-[15px] text-white
                         transition-transform active:scale-[0.98]"
              style={{ backgroundColor: ACCENT }}>
              ไปฝึกทำข้อสอบต่อ
            </Link>
            <Link href="/packages"
              className="block w-full py-3.5 rounded-2xl font-semibold text-[15px] bg-white
                         transition-transform active:scale-[0.98]"
              style={{ border: `1px solid ${LINE}`, color: "#44403C" }}>
              ยังไม่มีคอร์ส? ดูแพ็กเกจ เริ่ม ฿{PRICING.app.price}
            </Link>
            <Link href="/" className="block text-[13px] pt-1" style={{ color: MUTED }}>
              ← กลับหน้าหลัก
            </Link>
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}
