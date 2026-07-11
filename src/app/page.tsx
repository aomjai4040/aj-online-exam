"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getPublishedExams } from "@/lib/firestore";
import type { Exam } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/auth-context";
import { subjectColor as dotColor, BRAND } from "@/lib/subjects";
import { getSubjectShort } from "@/lib/types";
import { PRICING } from "@/lib/pricing";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function thaiDate(): string {
  const d = new Date();
  const m = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear() + 543}`;
}

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
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ทั้งหมด");
  const today = thaiDate();

  useEffect(() => {
    getPublishedExams().then(setExams).finally(() => setLoading(false));
  }, []);

  // ข้อสอบประจำวัน — หมุนตามวันที่จริง (ทุกคนเห็นชุดเดียวกันตลอดวันนั้น)
  const dayIndex     = Math.floor(Date.now() / 86_400_000);
  const featuredExam = exams.length > 0 ? exams[dayIndex % exams.length] : null;
  const latestExams  = exams.slice(0, 5);

  // ตัวเลขความน่าเชื่อถือใน hero — คำนวณจากข้อมูลจริง
  const totalQuestions = exams.reduce((s, e) => s + (e.questionCount || 0), 0);
  const subjectCount   = new Set(exams.map((e) => e.subject)).size;

  // chips ตัวกรองหมวด — สร้างจากหมวดที่มีข้อสอบจริงเท่านั้น (กันกดแล้วว่าง)
  const subjectChips = ["ทั้งหมด", ...Array.from(new Set(exams.map((e) => e.subject))).sort()];

  const filtered = exams.filter((e) => {
    const q = search.toLowerCase().trim();
    const bySubject = selectedSubject === "ทั้งหมด" || e.subject === selectedSubject;
    const bySearch  = !q || e.title.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q);
    return bySubject && bySearch;
  });

  const isFiltering = search !== "" || selectedSubject !== "ทั้งหมด";

  return (
    <div className="min-h-screen bg-stone-50 font-sans pb-28">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-md"
        style={{ borderBottom: "1px solid #EBEBEA" }}
      >
        <div className="max-w-lg mx-auto px-5 h-14 flex items-center justify-between">
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
        <div className="max-w-lg mx-auto">
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
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.65)" }}>
            แนวข้อสอบพร้อมเฉลยละเอียดทุกข้อ · ฝึกทำได้ทุกวัน
          </p>

          {/* CTA คู่ — ฟรีเด่นสุด */}
          <div className="flex gap-2.5 mb-6">
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
              { value: loading ? "…" : `${subjectCount}`,               label: "หมวดวิชา" },
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

      {/* ── Daily Quiz card ────────────────────────────────────────────────── */}
      <section className="max-w-lg mx-auto px-5 py-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-bold tracking-[0.12em] uppercase" style={{ color: "#A8A8A6" }}>
            ข้อสอบประจำวัน
          </p>
          <p className="text-[14px]" style={{ color: "#A8A8A6" }}>{today}</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-4 animate-pulse" style={{ border: "1px solid #EBEBEA", borderLeft: "3px solid #E0DFDC" }}>
            <div className="flex gap-4 items-center">
              <div className="flex-1 space-y-2">
                <div className="h-2.5 bg-gray-100 rounded-full w-1/3" />
                <div className="h-4 bg-gray-100 rounded-full w-4/5" />
                <div className="h-3 bg-gray-100 rounded-full w-1/2" />
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
            </div>
          </div>
        ) : featuredExam ? (
          <Link
            href={`/exam/${featuredExam.id}`}
            className="flex items-center gap-4 bg-white rounded-2xl p-4
                       hover:bg-stone-50 active:scale-[0.98] transition-all duration-150"
            style={{ border: "1px solid #EBEBEA", borderLeft: "3px solid #0B6E65" }}
          >
            <div className="flex-1 min-w-0">
              {/* Subject */}
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: dotColor(featuredExam.subject) }}
                >
                  {featuredExam.subject}
                </span>
              </div>
              <p className="font-bold text-[18px] text-gray-900 leading-snug line-clamp-2">
                {featuredExam.title}
              </p>
              <p className="text-[15px] mt-1" style={{ color: "#A8A8A6" }}>
                {featuredExam.questionCount} ข้อ
                {featuredExam.timeLimit > 0 && ` · ${featuredExam.timeLimit} นาที`}
              </p>
            </div>
            {/* CTA circle */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#0B6E65" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        ) : (
          <div
            className="rounded-2xl p-4 text-center"
            style={{ border: "1px dashed #E0DFDC", color: "#A8A8A6" }}
          >
            <p className="text-[13px]">ยังไม่มีข้อสอบในระบบ</p>
          </div>
        )}
      </section>

      {/* ── Section divider ────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5">
        <div className="h-px" style={{ backgroundColor: "#EBEBEA" }} />
      </div>

      {/* ── Feature menu ──────────────────────────────────────────────────── */}
      <section className="max-w-lg mx-auto px-5 py-5">
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

        {/* Secondary 2 × 2 — โทนแบรนด์เดียวกันทุกใบ ทุกปุ่มมีปลายทางจริง */}
        <div className="grid grid-cols-2 gap-3">
          {[
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
              title: "MOPH Focus",
              desc: "ประเด็นเน้นกระทรวง",
              href: "/moph-focus",
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
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
      <div className="max-w-lg mx-auto px-5">
        <div className="h-px" style={{ backgroundColor: "#EBEBEA" }} />
      </div>

      {/* ── Latest Exams (horizontal scroll) ──────────────────────────────── */}
      <section className="max-w-lg mx-auto py-5">
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
      <div className="max-w-lg mx-auto px-5">
        <div className="h-px" style={{ backgroundColor: "#EBEBEA" }} />
      </div>

      {/* ── All Exams list ────────────────────────────────────────────────── */}
      <section className="max-w-lg mx-auto px-5 py-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[12px] font-bold tracking-[0.12em] uppercase" style={{ color: "#A8A8A6" }}>
            ชุดข้อสอบทั้งหมด
          </p>
          {isFiltering && !loading && (
            <button
              onClick={() => { setSearch(""); setSelectedSubject("ทั้งหมด"); }}
              className="text-[12.5px] font-medium transition-colors"
              style={{ color: "#A8A8A6" }}
            >
              ล้างตัวกรอง ×
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg
            viewBox="0 0 24 24" fill="none" stroke="#C4C4C0"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            className="w-[16px] h-[16px] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="w-full bg-white rounded-2xl pl-10 pr-9 py-3 text-[15px]
                       text-gray-900 placeholder-gray-400 focus:outline-none transition-all"
            style={{ border: "1px solid #E0DFDC" }}
            onFocus={(e) => { e.currentTarget.style.border = `1.5px solid ${BRAND.primary}`; }}
            onBlur={(e) => { e.currentTarget.style.border = "1px solid #E0DFDC"; }}
            placeholder="ค้นหาชุดข้อสอบ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full
                         bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Subject chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
          {subjectChips.map((chip) => {
            const active = selectedSubject === chip;
            return (
              <button
                key={chip}
                onClick={() => setSelectedSubject(chip)}
                className="flex-shrink-0 text-[13.5px] font-medium px-3.5 py-1.5 rounded-full
                           transition-all duration-150 whitespace-nowrap"
                style={{
                  backgroundColor: active ? BRAND.primary : "white",
                  color:           active ? "white" : "#6B6B6A",
                  border:          active ? `1px solid ${BRAND.primary}` : "1px solid #E0DFDC",
                }}
              >
                {chip === "ทั้งหมด" ? chip : getSubjectShort(chip)}
              </button>
            );
          })}
        </div>

        {/* Count note */}
        {!loading && (
          <p className="text-[12px] mb-3" style={{ color: "#C4C4C0" }}>
            {isFiltering
              ? `${filtered.length} จาก ${exams.length} ชุด`
              : `ทั้งหมด ${exams.length} ชุด`}
          </p>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="divide-y" style={{ borderColor: "#F3F2F0" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 py-[18px] animate-pulse">
                <div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded-full w-1/3" />
                </div>
                <div className="h-2.5 w-10 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-14 text-center">
            <p className="text-[14px] font-semibold text-gray-700 mb-1.5">
              {isFiltering ? "ไม่พบชุดข้อสอบ" : "ยังไม่มีชุดข้อสอบ"}
            </p>
            <p className="text-[12px] mb-5" style={{ color: "#A8A8A6" }}>
              {isFiltering ? "ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น" : "ชุดข้อสอบจะปรากฏที่นี่เมื่อมีการเพิ่มข้อมูล"}
            </p>
            {isFiltering && (
              <button
                onClick={() => { setSearch(""); setSelectedSubject("ทั้งหมด"); }}
                className="text-[13px] font-medium"
                style={{ color: "#0B6E65" }}
              >
                ล้างการค้นหา
              </button>
            )}
          </div>
        )}

        {/* Rows */}
        {!loading && filtered.length > 0 && (
          <div className="divide-y" style={{ borderColor: "#F3F2F0" }}>
            {filtered.map((exam, idx) => (
              <Link
                key={exam.id}
                href={`/exam/${exam.id}`}
                className="flex items-center gap-4 py-[17px] -mx-2 px-2 rounded-xl
                           hover:bg-white active:bg-[#EEF7F5] transition-colors duration-100"
              >
                {/* Index number */}
                <span
                  className="text-[12px] font-medium w-5 text-right flex-shrink-0"
                  style={{ color: "#D4D4D0" }}
                >
                  {idx + 1}
                </span>

                {/* Subject dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor(exam.subject) }}
                />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[13.5px] text-gray-900 truncate leading-snug">
                    {exam.title}
                  </p>
                  <p className="text-[12px] mt-0.5 truncate" style={{ color: "#A8A8A6" }}>
                    {getSubjectShort(exam.subject)}
                    {exam.timeLimit > 0 && ` · ${exam.timeLimit} นาที`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {exam.isFree && (
                    <span
                      className="text-[11px] font-bold uppercase tracking-wide px-1.5 py-[3px] rounded"
                      style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}
                    >
                      ฟรี
                    </span>
                  )}
                  {isNewExam(exam) && !exam.isFree && (
                    <span
                      className="text-[11px] font-bold uppercase tracking-wide px-1.5 py-[3px] rounded"
                      style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
                    >
                      ใหม่
                    </span>
                  )}
                  <span className="text-[12px] font-medium" style={{ color: "#A8A8A6" }}>
                    {exam.questionCount}&nbsp;ข้อ
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#D4D4D0"
                    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
