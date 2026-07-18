"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getPublishedExams } from "@/lib/firestore";
import type { Exam } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/auth-context";
import { subjectColor as dotColor, BRAND } from "@/lib/subjects";
import { getSubjectShort, isMockExam } from "@/lib/types";
import { PRICING } from "@/lib/pricing";
import { daysToExam, COUNTDOWN_LABEL } from "@/lib/exam-config";
import { getRecentResults } from "@/lib/user-firestore";
import { pickGreeting, type Greeting } from "@/lib/greeting";
import TodayPlanCard from "@/components/TodayPlanCard";

// ─── Helpers ─────────────────────────────────────────────────────────────────


function isNewExam(exam: Exam): boolean {
  if (!exam.createdAt) return false;
  return Date.now() - exam.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Latest-exam card in the horizontal carousel */
function LatestCard({ exam }: { exam: Exam }) {
  const color = dotColor(exam.subject);
  const isNew = isNewExam(exam);
  return (
    <Link
      href={`/exam/${exam.id}`}
      className="flex-shrink-0 w-[172px] bg-white rounded-2xl p-4
                 flex flex-col hover:bg-stone-50 active:scale-[0.97]
                 transition-all duration-150"
      style={{ border: "1px solid #EBEBEA" }}
    >
      {/* Subject accent bar */}
      <div className="w-8 h-[3px] rounded-full mb-4" style={{ backgroundColor: color }} />

      <p className="font-semibold text-[16px] text-gray-900 leading-snug line-clamp-2 flex-1 mb-3">
        {exam.title}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <span className="text-[14px]" style={{ color: "#A8A8A6" }}>
          {exam.questionCount}&nbsp;ข้อ
        </span>
        {isNew ? (
          <span
            className="text-[12px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
          >
            ใหม่
          </span>
        ) : (
          <span className="text-[14px]" style={{ color }}>
            {getSubjectShort(exam.subject)}
          </span>
        )}
      </div>
    </Link>
  );
}

/** Skeleton for LatestCard */
function LatestSkeleton() {
  return (
    <div
      className="flex-shrink-0 w-[158px] bg-white rounded-2xl p-4 animate-pulse"
      style={{ border: "1px solid #EBEBEA" }}
    >
      <div className="w-7 h-[3px] rounded-full bg-gray-100 mb-3.5" />
      <div className="h-3.5 bg-gray-100 rounded-full w-full mb-1.5" />
      <div className="h-3.5 bg-gray-100 rounded-full w-4/5 mb-4" />
      <div className="flex justify-between">
        <div className="h-2.5 w-10 bg-gray-100 rounded-full" />
        <div className="h-2.5 w-8 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, signInWithGoogle } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const [planShown, setPlanShown] = useState(false); // สมาชิกเห็นแผน → ซ่อนการ์ด Daily Quiz เดี่ยว (ซ้ำ)

  useEffect(() => {
    getPublishedExams()
      // Mock Exam มีเมนูของตัวเอง — ไม่ปนในคลังปกติ
      .then((all) => setExams(all.filter((e) => !isMockExam(e))))
      .finally(() => setLoading(false));
    // จำนวนผู้ใช้ (social proof) — จาก server, cache 1 ชม.
    fetch("/api/stats").then((r) => r.json()).then((d) => setUserCount(d.users ?? null)).catch(() => {});
  }, []);

  // การ์ดต้อนรับตามพฤติกรรม — ดูจากวันล่าสุดที่ทำข้อสอบ (อ่าน 1 รายการ)
  useEffect(() => {
    if (!user) { setGreeting(null); return; }
    getRecentResults(user.uid, 1)
      .then((rs) => {
        let daysSince: number | null = null;
        if (rs[0]?.doneAt) {
          const a = new Date();               a.setHours(0, 0, 0, 0);
          const b = new Date(rs[0].doneAt);   b.setHours(0, 0, 0, 0);
          daysSince = Math.round((a.getTime() - b.getTime()) / 86_400_000);
        }
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
        setGreeting(pickGreeting(user.uid, today, daysSince));
      })
      .catch(() => setGreeting(null));
  }, [user]);

  const latestExams = exams.slice(0, 5);
  const dLeft = daysToExam();

  // ตัวเลขความน่าเชื่อถือใน hero — คำนวณจากข้อมูลจริง
  const totalQuestions = exams.reduce((s, e) => s + (e.questionCount || 0), 0);
  const subjectCount   = new Set(exams.map((e) => e.subject)).size;
  // ปัดจำนวนผู้ใช้ลงหลักสิบเพื่อ social proof ("700+ คน" ดูน่าเชื่อกว่าเลขเป๊ะ)
  // ถ้านับไม่ได้ (quota/พัง) → null → ตกกลับไปโชว์ "หมวดวิชา" แทน
  const roundedUsers = userCount && userCount > 0 ? Math.max(10, Math.floor(userCount / 10) * 10) : null;

  return (
    <div className="min-h-screen bg-stone-50 font-sans pb-28">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-md"
        style={{ borderBottom: "1px solid #EBEBEA" }}
      >
        <div className="max-w-lg md:max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#0B6E65" }}
            >
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
                <div
                  className="w-full h-full flex items-center justify-center text-white text-[13px] font-bold"
                  style={{ backgroundColor: "#0B6E65" }}
                >
                  {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
                </div>
              )}
            </Link>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-[12.5px] font-semibold px-2.5 py-1.5 rounded-xl border transition-all"
              style={{ borderColor: "#E0DFDC", color: "#374151" }}
            >
              เข้าสู่ระบบ
            </button>
          )}
        </div>
      </header>

      {/* ── Hero (สีเรียบเข้ม เน้นข้อเสนอ) ─────────────────────────────────── */}
      <section className="px-5 pt-9 pb-7" style={{ backgroundColor: BRAND.primaryDark }}>
        <div className="max-w-lg md:max-w-4xl mx-auto">
          <span
            className="inline-block text-[12px] font-semibold px-3 py-1 rounded-full mb-4"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#9FE1CB" }}
          >
            สนามสอบ สป.สธ.
          </span>
          <h1 className="text-[1.9rem] font-bold leading-[1.25] tracking-tight mb-2 text-white">
            เตรียมพร้อมสอบ
            <br />
            <span style={{ color: "#9FE1CB" }}>นักวิชาการสาธารณสุข</span>
          </h1>
          <p className="text-[14px] leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.65)" }}>
            แนวข้อสอบพร้อมเฉลยละเอียดทุกข้อ · ฝึกทำได้ทุกวัน
          </p>

          {/* นับถอยหลัง — เลขเด่น */}
          {dLeft >= 0 && (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-5"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <div className="flex items-baseline gap-1.5 flex-shrink-0">
                <span className="text-[34px] font-extrabold leading-none" style={{ color: "#FBBF24" }}>
                  {dLeft}
                </span>
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

          {/* CTA คู่ — ฟรีเด่นสุด */}
          <div className="flex gap-2.5 mb-6 md:max-w-md">
            <Link
              href="/free"
              className="flex-1 text-center font-bold text-[15px] py-3.5 rounded-2xl
                         active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "white", color: BRAND.primaryDark }}
            >
              ทดลองทำฟรี
            </Link>
            <Link
              href="/packages"
              className="flex-1 text-center font-semibold text-[15px] py-3.5 rounded-2xl
                         active:scale-[0.98] transition-transform text-white"
              style={{ border: "1px solid rgba(255,255,255,0.4)" }}
            >
              แพ็กเกจ เริ่ม ฿{PRICING.app.price}
            </Link>
          </div>

          {/* ตัวเลขจริงจากระบบ */}
          <div className="flex pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            {[
              { value: loading ? "…" : totalQuestions.toLocaleString(), label: "ข้อสอบ" },
              { value: loading ? "…" : `${exams.length}`,               label: "ชุดข้อสอบ" },
              roundedUsers != null
                ? { value: `${roundedUsers.toLocaleString()}+`, label: "ผู้เรียน" }
                : { value: loading ? "…" : `${subjectCount}`,   label: "หมวดวิชา" },
            ].map((s, i) => (
              <div
                key={s.label}
                className="flex-1 text-center"
                style={i > 0 ? { borderLeft: "1px solid rgba(255,255,255,0.15)" } : undefined}
              >
                <p className="text-[17px] font-bold text-white leading-tight">{s.value}</p>
                <p className="text-[12px]" style={{ color: "#9FE1CB" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── Feature menu ──────────────────────────────────────────────────── */}
      <section className="max-w-lg md:max-w-4xl mx-auto px-5 py-5">

        {/* ครูอ้อมทักทาย — เฉพาะคน login ที่ "ไม่มี" การ์ดโค้ช (สมาชิกได้คำทักทายในการ์ดโค้ชแล้ว) */}
        {!planShown && greeting && (() => {
          const c = greeting.tone === "scold"
            ? { bg: "#FEF2F2", border: "#FECACA", accent: "#DC2626" }
            : greeting.tone === "nudge"
            ? { bg: "#FEF9EC", border: "#FCD34D", accent: "#B45309" }
            : { bg: "#F5FAF9", border: "#C3E5DE", accent: "#0B6E65" };
          const firstName = (user?.displayName ?? "").split(" ")[0];
          return (
            <div className="rounded-2xl px-4 py-3.5 mb-4 flex items-start gap-3"
              style={{ backgroundColor: c.bg, border: `1.5px solid ${c.border}` }}>
              <span className="text-[20px] leading-none mt-0.5">{greeting.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: c.accent }}>
                  ครูอ้อมทักทาย{firstName ? ` · ${firstName}` : ""}
                </p>
                <p className="text-[13px] leading-relaxed text-gray-800">{greeting.text}</p>
              </div>
            </div>
          );
        })()}

        {/* เริ่มแบบติวเตอร์ (Mock ประเมิน) + แผนของฉันวันนี้ — สมาชิกเท่านั้น */}
        <TodayPlanCard onVisible={setPlanShown} />

        <p className="text-[15px] font-bold tracking-[0.12em] uppercase mb-4" style={{ color: "#A8A8A6" }}>
          เมนูหลัก
        </p>

        {/* Primary banner */}
        <Link
          href="/exams"
          className="flex items-center gap-3.5 w-full rounded-2xl px-5 py-4 mb-3
                     hover:opacity-95 active:scale-[0.98] transition-all duration-150"
          style={{ backgroundColor: BRAND.primary }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold tracking-wider uppercase mb-0.5 text-white/70">
              เริ่มต้นที่นี่
            </p>
            <p className="font-bold text-[20px] text-white leading-none">คลังข้อสอบ</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="white"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0 opacity-70">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        {/* Daily Quiz — วันละ 10 ข้อ เก็บ streak (ซ่อนเมื่อการ์ดแผนแสดง — ในแผนมีข้อนี้แล้ว) */}
        {!planShown && (
        <Link
          href="/daily"
          className="flex items-center gap-3 w-full rounded-2xl px-4 py-3 mb-3
                     active:scale-[0.98] transition-transform bg-white"
          style={{ border: "1.5px solid #FCD34D" }}
        >
          <span className="text-[20px] flex-shrink-0">🔥</span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-gray-900 leading-tight">Daily Quiz วันนี้</p>
            <p className="text-[12px]" style={{ color: "#B45309" }}>10 ข้อเจาะจุดอ่อนของคุณ · เก็บ streak ทุกวัน</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#B45309"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
        )}

        {/* Secondary 2 × 2 — โทนแบรนด์เดียวกันทุกใบ ทุกปุ่มมีปลายทางจริง */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              title: "คอร์สวิดีโอ",
              desc: "ติวครบทุกหัวข้อ",
              href: "/videos",
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              ),
            },
            {
              title: "Flash Card",
              desc: "ทบทวนความรู้",
              href: "/flashcard",
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <rect x="2" y="6" width="18" height="13" rx="2" />
                  <path d="M6 6V4a2 2 0 012-2h12a2 2 0 012 2v11a2 2 0 01-2 2" />
                </svg>
              ),
            },
            {
              title: "Mock Exam",
              desc: "จำลองสอบเสมือนจริง",
              href: "/mock-exam",
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              ),
            },
            {
              title: "Checklist วิดีโอ",
              desc: "ติดตามวิดีโอที่ดู",
              href: "https://jade-fenglisu-32fb47.netlify.app",
              external: true,
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <polyline points="10 9 12 11 16 7" />
                </svg>
              ),
            },
            {
              title: "บันทึกของฉัน",
              desc: "ผลสอบและคะแนน",
              href: "/dashboard",
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ),
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              {...("external" in item && item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="bg-white rounded-2xl px-4 py-4 flex items-center gap-3
                         active:scale-[0.97] transition-all duration-150 hover:bg-stone-50"
              style={{ border: "1px solid #EBEBEA" }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: BRAND.primarySoft }}
              >
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[15px] text-gray-900 leading-tight truncate">
                  {item.title}
                </p>
                <p className="text-[12.5px] mt-0.5 truncate text-gray-500">
                  {item.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Section divider ────────────────────────────────────────────────── */}
      <div className="max-w-lg md:max-w-4xl mx-auto px-5">
        <div className="h-px" style={{ backgroundColor: "#EBEBEA" }} />
      </div>

      {/* ── Latest Exams (horizontal scroll) ──────────────────────────────── */}
      <section className="max-w-lg md:max-w-4xl mx-auto py-5">
        <div className="flex items-center justify-between mb-4 px-5">
          <p className="text-[15px] font-bold tracking-[0.12em] uppercase" style={{ color: "#A8A8A6" }}>
            เพิ่มล่าสุด
          </p>
          <Link
            href="/exams"
            className="text-[15px] font-medium transition-colors"
            style={{ color: "#0B6E65" }}
          >
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 pb-1">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <LatestSkeleton key={i} />)
            : latestExams.length > 0
              ? latestExams.map((exam) => <LatestCard key={exam.id} exam={exam} />)
              : (
                <p className="text-[13px] py-8" style={{ color: "#A8A8A6" }}>
                  ยังไม่มีชุดข้อสอบ
                </p>
              )
          }
        </div>
      </section>

      {/* ── Section divider ────────────────────────────────────────────────── */}
      <div className="max-w-lg md:max-w-4xl mx-auto px-5">
        <div className="h-px" style={{ backgroundColor: "#EBEBEA" }} />
      </div>


      <BottomNav />
    </div>
  );
}
