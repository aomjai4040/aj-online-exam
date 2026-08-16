"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublishedExams } from "@/lib/firestore";
import type { Exam } from "@/lib/types";
import BottomNav from "@/components/BottomNav";

// ─── Landing page สำหรับลิงก์โฆษณา "ทดลองทำฟรี" ───────────────────────────────
// public — ไม่ต้อง login เพื่อดู (ตัวข้อสอบเองจะขอ login ตอนกดเข้าทำ)

const SUBJECT_COLOR: Record<string, string> = {
  ระบาดวิทยา: "#3B82F6", อนามัยสิ่งแวดล้อม: "#10B981", กฎหมาย: "#F97316",
  บริหารสาธารณสุข: "#8B5CF6", ชีวสถิติ: "#0D9488", "นโยบาย สป.สธ.": "#EF4444",
};
function sc(s: string) { return SUBJECT_COLOR[s] ?? "#0B6E65"; }

export default function FreePage() {
  const [freeExams, setFreeExams] = useState<Exam[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    getPublishedExams()
      .then((all) => setFreeExams(all.filter((e) => e.isFree)))
      .catch(() => setFreeExams([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      {/* Hero */}
      <section className="px-5 pt-10 pb-8"
        style={{ background: "linear-gradient(160deg, #0B6E65 0%, #0d9488 60%, #134e4a 100%)" }}>
        <div className="max-w-lg md:max-w-3xl mx-auto">
          <span className="inline-block text-[12px] font-bold tracking-widest uppercase
            px-3 py-1 rounded-full mb-4"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "white" }}>
            🎁 ทดลองทำฟรี
          </span>
          <h1 className="text-[1.9rem] font-bold leading-tight tracking-tight mb-3 text-white">
            ลองทำข้อสอบฟรี
            <br />
            <span style={{ color: "#A7F3D0" }}>ก่อนตัดสินใจสมัคร</span>
          </h1>
          <p className="text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            เตรียมสอบนักวิชาการสาธารณสุข สป.สธ. · เฉลยละเอียดทุกข้อ
            <br />
            ไม่ต้องจ่ายเงิน แค่เข้าสู่ระบบด้วย Google
          </p>
        </div>
      </section>

      {/* Free exam list */}
      <section className="max-w-lg md:max-w-3xl mx-auto px-5 py-6">
        <p className="text-[12px] font-bold tracking-widest uppercase mb-4" style={{ color: "#A8A8A6" }}>
          ชุดข้อสอบทดลองฟรี
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-elev p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded-full w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded-full w-1/3" />
              </div>
            ))}
          </div>
        ) : freeExams.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px dashed #E0DFDC" }}>
            <div className="text-3xl mb-2">🎁</div>
            <p className="text-[14px] font-semibold text-gray-800 mb-1">กำลังเตรียมชุดทดลองฟรี</p>
            <p className="text-[12px]" style={{ color: "#A8A8A6" }}>เร็ว ๆ นี้ · ดูคลังข้อสอบทั้งหมดได้ที่ปุ่มด้านล่าง</p>
          </div>
        ) : (
          <div className="space-y-3">
            {freeExams.map((exam) => (
              <Link
                key={exam.id}
                href={`/exam/${exam.id}`}
                className="block bg-white rounded-2xl overflow-hidden hover:shadow-md active:scale-[0.99] transition-all"
                style={{ border: "1px solid #C3E5DE" }}
              >
                <div className="h-[3px]" style={{ backgroundColor: sc(exam.subject) }} />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[12px] font-bold px-2.5 py-[5px] rounded-full"
                      style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}>
                      ทดลองฟรี
                    </span>
                    <span className="text-[12px]" style={{ color: "#A8A8A6" }}>{exam.subject}</span>
                  </div>
                  <h3 className="font-bold text-[15px] text-gray-900 leading-snug mb-1">{exam.title}</h3>
                  <p className="text-[12px] mb-4" style={{ color: "#A8A8A6" }}>
                    {exam.questionCount} ข้อ{exam.timeLimit > 0 && ` · ${exam.timeLimit} นาที`}
                  </p>
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13.5px] font-semibold text-white"
                    style={{ backgroundColor: "#0B6E65" }}>
                    เริ่มทำฟรี
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Upsell */}
        <div className="mt-6 rounded-2xl p-5 text-center"
          style={{ backgroundColor: "#EBF5F3", border: "1px solid #C3E5DE" }}>
          <p className="text-[14px] font-bold mb-1" style={{ color: "#0B6E65" }}>อยากได้ครบทุกชุด?</p>
          <p className="text-[12px] mb-4" style={{ color: "#5DA89F" }}>
            ปลดล็อกคลังข้อสอบเต็ม พร้อมเฉลยละเอียดทุกข้อ
          </p>
          <Link href="/packages" className="btn-primary inline-block px-6 py-2.5 text-[13.5px]">
            ดูแพ็กเกจทั้งหมด →
          </Link>
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
