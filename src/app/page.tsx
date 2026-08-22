"use client";
/**
 * หน้าแรก — โครงใหม่ (Aj 2026-08-21): "เลือกคอร์ส" เท่านั้น ไม่มีเมนู
 *
 *   สมาชิกที่มีคอร์ส  → เด้งเข้าหน้าคอร์สล่าสุดที่เปิด (/course/moph | /course/dcd) ทันที
 *                       (ยกเว้นมาด้วย ?pick=1 = ต้องการสลับคอร์ส → โชว์การ์ดให้เลือก)
 *   ยังไม่ซื้อ / ยังไม่ login → hero + การ์ดสนาม (กดการ์ด = ไปหน้าสมัครทันที)
 *
 * เมนูหลัก / การ์ดโค้ช / เพิ่มล่าสุด ย้ายไปอยู่ใน src/app/course/[field]/page.tsx
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getPublishedExams } from "@/lib/firestore";
import type { Exam } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/auth-context";
import { BRAND } from "@/lib/subjects";
import { PRICING } from "@/lib/pricing";
import { getUserAccess } from "@/lib/access";
import { daysToExam, COUNTDOWN_LABEL } from "@/lib/exam-config";
import ExamFieldGrid from "@/components/ExamFieldGrid";
import { courseHref, effectiveField, ownedFields } from "@/lib/active-field";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [heroStats, setHeroStats] = useState({ questions: 0, sets: 0 });
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState<number | null>(null);
  // true = กำลังเช็คว่าต้องเด้งเข้าคอร์สไหม (กันหน้าขายกะพริบก่อน redirect)
  const [deciding, setDeciding] = useState(true);

  // ── สมาชิก → เข้าคอร์สล่าสุดเลย ──
  useEffect(() => {
    if (authLoading) return;
    const pick = new URLSearchParams(window.location.search).get("pick") === "1";
    if (!user || pick) { setDeciding(false); return; }
    let cancelled = false;
    getUserAccess(user.uid)
      .then((a) => {
        if (cancelled) return;
        if (ownedFields(a).length > 0) {
          router.replace(courseHref(effectiveField(a)));
          return; // คง spinner ไว้จนเปลี่ยนหน้า
        }
        setDeciding(false);
      })
      .catch(() => { if (!cancelled) setDeciding(false); });
    return () => { cancelled = true; };
  }, [user, authLoading, router]);

  useEffect(() => {
    getPublishedExams()
      .then((all) => {
        setExams(all);
        setHeroStats({
          questions: all.reduce((s, e) => s + (e.questionCount || 0), 0),
          sets:      all.length,
        });
      })
      .finally(() => setLoading(false));
    fetch("/api/stats").then((r) => r.json()).then((d) => setUserCount(d.users ?? null)).catch(() => {});
  }, []);

  const dLeft = daysToExam();
  const totalQuestions = heroStats.questions;
  const subjectCount   = new Set(exams.map((e) => e.subject)).size;
  const roundedUsers = userCount && userCount > 0 ? Math.max(10, Math.floor(userCount / 10) * 10) : null;

  if (deciding) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5FAF9" }}>
        <span className="w-8 h-8 border-[3px] border-[#C3E5DE] border-t-[#0B6E65] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans pb-28">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md" style={{ borderBottom: "1px solid #EBEBEA" }}>
        <div className="max-w-lg md:max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#0B6E65" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <span className="font-bold text-[15px] text-gray-900 tracking-tight">
              AJ <span style={{ color: "#0B6E65" }}>ExamOnline</span>
            </span>
          </Link>
          {user ? (
            <Link href="/dashboard" className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              {user.photoURL ? (
                <Image src={user.photoURL} alt="" width={32} height={32} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-[13px] font-bold"
                  style={{ backgroundColor: "#0B6E65" }}>
                  {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
                </div>
              )}
            </Link>
          ) : (
            <button onClick={signInWithGoogle}
              className="text-[12.5px] font-semibold px-2.5 py-1.5 rounded-xl border transition-all"
              style={{ borderColor: "#E0DFDC", color: "#374151" }}>
              เข้าสู่ระบบ
            </button>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 pt-9 pb-7"
        style={{ background: "linear-gradient(160deg, #0E5F56 0%, #0B4F48 48%, #083B36 100%)" }}>
        <div aria-hidden className="absolute -top-24 -right-14 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(closest-side, rgba(23,160,143,0.35), transparent)" }} />
        <div aria-hidden className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(closest-side, rgba(251,191,36,0.16), transparent)" }} />
        <div className="relative max-w-lg md:max-w-4xl mx-auto">
          <span className="inline-block text-[12px] font-semibold px-3 py-1 rounded-full mb-4"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#9FE1CB" }}>
            สายสาธารณสุขและสิ่งแวดล้อม
          </span>
          <h1 className="text-[1.9rem] font-bold leading-[1.25] tracking-tight mb-2 text-white">
            เตรียมสอบราชการ
            <br />
            <span style={{ color: "#9FE1CB" }}>สายสาธารณสุข</span>
          </h1>
          <p className="text-[14px] leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.65)" }}>
            ศูนย์รวมทุกสนามสอบ · แนวข้อสอบพร้อมเฉลยละเอียดทุกข้อ · ฝึกทำได้ทุกวัน
          </p>

          {dLeft >= 0 && (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-5"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
              <div className="flex items-baseline gap-1.5 flex-shrink-0">
                <span className="text-[34px] font-extrabold leading-none" style={{ color: "#FBBF24" }}>{dLeft}</span>
                <span className="text-[15px] font-bold text-white">วัน</span>
              </div>
              <div className="w-px h-8" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
              <p className="text-[13px] leading-snug" style={{ color: "rgba(255,255,255,0.85)" }}>
                ก่อน{COUNTDOWN_LABEL}
                <br />
                <span style={{ color: "#9FE1CB" }}>เตรียมตัวให้ทันตั้งแต่วันนี้</span>
              </p>
            </div>
          )}

          <div className="flex gap-2.5 mb-6 md:max-w-md">
            <Link href="/free"
              className="flex-1 text-center font-bold text-[15px] py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "white", color: BRAND.primaryDark }}>
              ทดลองทำฟรี
            </Link>
            <Link href="/packages"
              className="flex-1 text-center font-semibold text-[15px] py-3.5 rounded-2xl active:scale-[0.98] transition-transform text-white"
              style={{ border: "1px solid rgba(255,255,255,0.4)" }}>
              แพ็กเกจ เริ่ม ฿{PRICING.app.price}
            </Link>
          </div>

          <div className="flex pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            {[
              { value: loading ? "…" : totalQuestions.toLocaleString(), label: "ข้อสอบ" },
              { value: loading ? "…" : `${heroStats.sets}`,             label: "ชุดข้อสอบ" },
              roundedUsers != null
                ? { value: `${roundedUsers.toLocaleString()}+`, label: "ผู้เรียน" }
                : { value: loading ? "…" : `${subjectCount}`,   label: "หมวดวิชา" },
            ].map((s, i) => (
              <div key={s.label} className="flex-1 text-center"
                style={i > 0 ? { borderLeft: "1px solid rgba(255,255,255,0.15)" } : undefined}>
                <p className="text-[17px] font-bold text-white leading-tight">{s.value}</p>
                <p className="text-[12px]" style={{ color: "#9FE1CB" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── การ์ดสนาม — มีสิทธิ์ = เข้าหน้าคอร์ส · ยังไม่มี = ไปหน้าสมัคร ── */}
      <ExamFieldGrid />

      {/* เมนูหลัก/เพิ่มล่าสุด ไม่อยู่หน้าแรกแล้ว — อยู่ในหน้าคอร์สของแต่ละสนาม
          (เกมทบทวนยังเข้าได้จากปุ่ม "เกม" แถบล่างสำหรับคนยังไม่ซื้อ) */}

      <BottomNav />
    </div>
  );
}
