"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublishedExams } from "@/lib/firestore";
import type { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { getUserAccess, decideExamAccess, EMPTY_ACCESS, type UserAccess } from "@/lib/access";
import { PRICING } from "@/lib/pricing";
import { BRAND } from "@/lib/subjects";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

// ─── /mock-exam — ข้อสอบเสมือนจริง (exam.isMock) ──────────────────────────────
// ใช้ engine ทำข้อสอบเดิม (/exam/[id]) — หน้านี้เป็นทางเข้า + วิธีใช้ให้เหมือนสนามจริง

export default function MockExamPage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();

  const [mocks,   setMocks]   = useState<Exam[]>([]);
  const [access,  setAccess]  = useState<UserAccess>(EMPTY_ACCESS);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (guard !== "allowed" || !user) return;
    (async () => {
      try {
        const [all, a] = await Promise.all([
          getPublishedExams(),
          getUserAccess(user.uid),
        ]);
        setMocks(all.filter((e) => e.isMock));
        setAccess(a);
      } catch { setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่"); }
      finally { setLoading(false); }
    })();
  }, [guard, user]);

  if (guard !== "allowed") return <AccessGuardSpinner />;

  return (
    <div className="min-h-screen bg-stone-50 pb-28">

      {/* Hero */}
      <section className="px-5 pt-8 pb-6" style={{ backgroundColor: BRAND.primaryDark }}>
        <div className="max-w-lg mx-auto">
          <span className="inline-block text-[12px] font-semibold px-3 py-1 rounded-full mb-3"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#9FE1CB" }}>
            ⏱️ Mock Exam
          </span>
          <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight mb-2 text-white">
            ข้อสอบเสมือนจริง
          </h1>
          <p className="text-[13.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            จับเวลาเหมือนสนามสอบ · ทำให้จบในรอบเดียว · ดูเฉลยละเอียดหลังส่ง
          </p>
        </div>
      </section>

      <div className="max-w-lg mx-auto px-5 py-5 space-y-4">

        {/* วิธีใช้ให้ได้ผล */}
        <div className="rounded-2xl px-4 py-3.5 text-[12.5px] leading-relaxed"
          style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" }}>
          <span className="font-bold">เคล็ดลับ:</span> ทำเหมือนวันสอบจริง —
          หาที่เงียบ ๆ จับเวลาตามกำหนด ไม่เปิดหนังสือ ไม่หยุดพัก
          แล้วคะแนนที่ได้จะบอกระดับความพร้อมจริงของคุณ
        </div>

        {loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-32" style={{ border: "1px solid #EBEBEA" }} />
            ))}
          </div>
        )}

        {error && <p className="text-[13.5px] text-red-500">{error}</p>}

        {!loading && !error && mocks.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px dashed #E0DFDC" }}>
            <div className="text-4xl mb-3">⏱️</div>
            <p className="text-[15px] font-semibold text-gray-800 mb-1">Mock Exam กำลังจะมา</p>
            <p className="text-[13px]" style={{ color: "#A8A8A6" }}>
              ข้อสอบเสมือนจริงชุดแรกจะปรากฏที่นี่เร็ว ๆ นี้
            </p>
          </div>
        )}

        {mocks.map((exam) => {
          const verdict = decideExamAccess(exam, user?.uid ?? null, access);
          const locked  = verdict === "locked";
          return (
            <Link
              key={exam.id}
              href={`/exam/${exam.id}`}
              className="block bg-white rounded-2xl overflow-hidden hover:shadow-md
                         active:scale-[0.99] transition-all"
              style={{ border: "1px solid #EBEBEA" }}
            >
              <div className="h-[3px]" style={{ backgroundColor: locked ? "#D4D4D0" : BRAND.primary }} />
              <div className="p-5">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-[12px] font-bold px-2.5 py-[5px] rounded-full"
                    style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
                    ⏱️ เสมือนจริง
                  </span>
                  {exam.isFree ? (
                    <span className="text-[12px] font-bold px-2.5 py-[5px] rounded-full"
                      style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}>
                      ทดลองฟรี
                    </span>
                  ) : locked ? (
                    <span className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-[5px] rounded-full"
                      style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                      🔒 ล็อก
                    </span>
                  ) : null}
                </div>

                <h3 className="font-bold text-[15.5px] text-gray-900 leading-snug mb-2">
                  {exam.title}
                </h3>

                <div className="flex items-center gap-2 text-[12.5px] mb-4" style={{ color: "#9CA3AF" }}>
                  <span className="font-semibold" style={{ color: "#6B7280" }}>
                    {exam.questionCount} ข้อ
                  </span>
                  {exam.timeLimit > 0 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="font-semibold" style={{ color: "#DC2626" }}>
                        ⏱ จับเวลา {exam.timeLimit} นาที
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 py-3 rounded-xl
                             text-[13.5px] font-semibold"
                  style={locked
                    ? { backgroundColor: "#F3F4F6", color: "#4B5563" }
                    : { backgroundColor: BRAND.primary, color: "white" }}>
                  {locked ? `ปลดล็อกเริ่ม ฿${PRICING.app.price}` : "เริ่มจับเวลาสอบ"}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
