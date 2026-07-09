"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublishedExams } from "@/lib/firestore";
import type { Exam } from "@/lib/types";
import BottomNav from "@/components/BottomNav";

// ─── /packages — placeholder catalog (Phase 2 จะทำ collection packages เต็ม) ────
// ตอนนี้: แสดงภาพรวมคลังข้อสอบ + ช่องทางปลดล็อก (กรอกรหัส) กันลิงก์ตายจากหน้า lock
// เมื่อทำระบบจ่ายเงินเสร็จ หน้านี้จะกลายเป็นแคตตาล็อกแพ็กเกจ + ปุ่มสั่งซื้อจริง

export default function PackagesPage() {
  const [total,    setTotal]    = useState<number | null>(null);
  const [freeCount, setFreeCount] = useState(0);

  useEffect(() => {
    getPublishedExams()
      .then((all) => { setTotal(all.length); setFreeCount(all.filter((e) => e.isFree).length); })
      .catch(() => setTotal(0));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      {/* Hero */}
      <section className="px-5 pt-10 pb-8"
        style={{ background: "linear-gradient(160deg, #0B6E65 0%, #0d9488 60%, #134e4a 100%)" }}>
        <div className="max-w-lg mx-auto">
          <h1 className="text-[1.8rem] font-bold leading-tight tracking-tight mb-3 text-white">
            แพ็กเกจข้อสอบ
          </h1>
          <p className="text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            ปลดล็อกคลังข้อสอบเต็ม พร้อมเฉลยละเอียดทุกข้อ
            {total !== null && ` · มีข้อสอบ ${total} ชุดในระบบ`}
          </p>
        </div>
      </section>

      <section className="max-w-lg mx-auto px-5 py-6 space-y-4">
        {/* Coming soon notice */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <p className="text-[14px] font-bold mb-1" style={{ color: "#92400E" }}>
            🛒 ระบบสั่งซื้อในเว็บกำลังพัฒนา
          </p>
          <p className="text-[12.5px] leading-relaxed" style={{ color: "#B45309" }}>
            เร็ว ๆ นี้จะสามารถซื้อและชำระเงินได้ในเว็บทันที
            ระหว่างนี้หากมีรหัสเปิดใช้งาน กรอกได้เลยด้านล่าง
          </p>
        </div>

        {/* Free trial */}
        {freeCount > 0 && (
          <Link href="/free"
            className="block rounded-2xl p-5 hover:shadow-md active:scale-[0.99] transition-all"
            style={{ backgroundColor: "#EBF5F3", border: "1px solid #C3E5DE" }}>
            <div className="flex items-center gap-3">
              <div className="text-2xl">🎁</div>
              <div className="flex-1">
                <p className="text-[14px] font-bold" style={{ color: "#0B6E65" }}>
                  ทดลองทำฟรี {freeCount} ชุด
                </p>
                <p className="text-[12px]" style={{ color: "#5DA89F" }}>ลองก่อนตัดสินใจ ไม่มีค่าใช้จ่าย</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        )}

        {/* Activate code */}
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
              <p className="text-[12px]" style={{ color: "#A8A8A6" }}>กรอกรหัสเพื่อปลดล็อกคอร์ส</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#D4D4D0"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>

        {/* Contact admin */}
        <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer"
          className="block rounded-2xl p-5 bg-white hover:shadow-md active:scale-[0.99] transition-all"
          style={{ border: "1px solid #EBEBEA" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#EFF6FF" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.75"
                strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-gray-900">สอบถาม / สั่งซื้อกับแอดมิน</p>
              <p className="text-[12px]" style={{ color: "#A8A8A6" }}>ทักแชทเพื่อรับรหัสเปิดใช้งาน</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#D4D4D0"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </a>
      </section>

      <BottomNav />
    </div>
  );
}
