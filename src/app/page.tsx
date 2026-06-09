"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getPublishedExams } from "@/lib/firestore";
import type { Exam } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/auth-context";

// ─── Subject palette ─────────────────────────────────────────────────────────

const SUBJECT_COLOR: Record<string, string> = {
  ระบาดวิทยา:          "#3B82F6",
  อนามัยสิ่งแวดล้อม:   "#10B981",
  กฎหมาย:              "#F97316",
  บริหารสาธารณสุข:     "#8B5CF6",
  ชีวสถิติ:            "#0D9488",
  "นโยบาย สป.สธ.":     "#EF4444",
  คณิตศาสตร์:          "#3B82F6",
  ภาษาไทย:            "#EC4899",
  วิทยาศาสตร์:         "#10B981",
  ภาษาอังกฤษ:         "#8B5CF6",
  สังคมศึกษา:          "#F59E0B",
  ประวัติศาสตร์:        "#EF4444",
  คอมพิวเตอร์:         "#06B6D4",
};
function dotColor(s: string) { return SUBJECT_COLOR[s] ?? "#0B6E65"; }

// ─── Subject filter chips ────────────────────────────────────────────────────

const SUBJECT_CHIPS = [
  "ทั้งหมด",
  "ระบาดวิทยา",
  "อนามัยสิ่งแวดล้อม",
  "กฎหมาย",
  "บริหารสาธารณสุข",
  "ชีวสถิติ",
  "นโยบาย สป.สธ.",
];

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
      className="flex-shrink-0 w-[158px] bg-white rounded-2xl p-4
                 flex flex-col hover:bg-stone-50 active:scale-[0.97]
                 transition-all duration-150"
      style={{ border: "1px solid #EBEBEA" }}
    >
      {/* Subject accent bar */}
      <div className="w-7 h-[3px] rounded-full mb-3.5" style={{ backgroundColor: color }} />

      <p className="font-semibold text-[16px] text-gray-900 leading-snug line-clamp-2 flex-1 mb-3">
        {exam.title}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <span className="text-[17px]" style={{ color: "#4A5568" }}>
          {exam.questionCount}&nbsp;ข้อ
        </span>
        {isNew ? (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
          >
            ใหม่
          </span>
        ) : (
          <span className="text-[17px]" style={{ color }}>
            {exam.subject.slice(0, 4)}
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
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ทั้งหมด");
  const today = thaiDate();

  useEffect(() => {
    getPublishedExams().then(setExams).finally(() => setLoading(false));
  }, []);

  const featuredExam = exams[0] ?? null;
  const latestExams  = exams.slice(0, 5);

  const filtered = exams.filter((e) => {
    const q = search.toLowerCase().trim();
    const bySubject = selectedSubject === "ทั้งหมด" || e.subject === selectedSubject;
    const bySearch  = !q || e.title.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q);
    return bySubject && bySearch;
  });

  const isFiltering = search !== "" || selectedSubject !== "ทั้งหมด";

  return (
    <div className="min-h-screen font-sans pb-28" style={{ backgroundColor: "#A8D5BF" }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{ backgroundColor: "rgba(168,213,191,0.92)", borderBottom: "1px solid rgba(11,110,101,0.15)" }}
      >
        <div className="max-w-lg mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
              style={{ background: "linear-gradient(135deg, #0B6E65 0%, #34C88A 100%)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <span className="font-bold text-[18px] text-gray-900 tracking-tight">
              AJ <span style={{ color: "#0B6E65" }}>ExamOnline</span>
            </span>
          </Link>
          {authLoading ? (
            <div className="w-8 h-8 rounded-full animate-pulse bg-white/50" />
          ) : user ? (
            <Link href="/dashboard" className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              {user.photoURL ? (
                <Image src={user.photoURL} alt="" width={32} height={32} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-[16px] font-bold"
                  style={{ backgroundColor: "#0B6E65" }}
                >
                  {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
                </div>
              )}
            </Link>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-[17px] font-semibold px-2.5 py-1.5 rounded-xl border transition-all"
              style={{ borderColor: "#E0DFDC", color: "#374151" }}
            >
              เข้าสู่ระบบ
            </button>
          )}
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="max-w-lg mx-auto px-5 pt-8 pb-7">

        {/* Hero layout: text left, image right */}
        <div className="flex items-end gap-3 mb-4">

          {/* Text column */}
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] font-bold tracking-[0.16em] uppercase mb-3"
              style={{ color: "#0B6E65" }}
            >
              AJ ExamOnline · สนาม สป.สธ.
            </p>
            <h1 className="text-[1.45rem] font-bold text-gray-900 leading-[1.25] tracking-tight mb-2">
              เตรียมพร้อมสอบ
              <br />
              <span style={{ color: "#0B6E65" }}>นักวิชาการสาธารณสุข</span>
            </h1>
            <p className="text-[14px] font-medium text-gray-700 mb-2">
              สำนักงานปลัดกระทรวงสาธารณสุข (สป.สธ.)
            </p>
            <p className="text-[14px] leading-relaxed mb-0" style={{ color: "#4A5568" }}>
              รวมแนวข้อสอบ แบบฝึก และ Mock Exam
              <br />
              ฝึกทำได้ทุกวัน พร้อมเฉลยและสรุปผลคะแนน
            </p>
          </div>

          {/* Hero image */}
          <div className="flex-shrink-0 w-[140px]">
            <Image
              src="/hero-student.png.webp"
              alt="นักเรียนกำลังทำข้อสอบ"
              width={280}
              height={320}
              className="w-full h-auto object-contain drop-shadow-sm"
              priority
            />
          </div>
        </div>

        {/* Search — full width */}
        <div className="relative mb-3">
          <svg
            viewBox="0 0 24 24" fill="none" stroke="#5A6478"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            className="w-[16px] h-[16px] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="w-full bg-white rounded-2xl pl-10 pr-9 py-2.5 text-[16px]
                       text-gray-900 placeholder-gray-400 focus:outline-none transition-all duration-150"
            style={{ border: "1px solid #E0DFDC" }}
            onFocus={(e) => {
              e.currentTarget.style.border = "1.5px solid transparent";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,110,101,0.14)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid #E0DFDC";
              e.currentTarget.style.boxShadow = "none";
            }}
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
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {SUBJECT_CHIPS.map((chip) => {
            const active = selectedSubject === chip;
            return (
              <button
                key={chip}
                onClick={() => setSelectedSubject(chip)}
                className="flex-shrink-0 text-[17px] font-medium px-3 py-[5px] rounded-full
                           transition-all duration-150 whitespace-nowrap"
                style={{
                  backgroundColor: active ? "#111110" : "white",
                  color:           active ? "white"   : "#6B6B6A",
                  border:          active ? "1px solid #111110" : "1px solid #E0DFDC",
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Section divider ────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5">
        <div className="h-px" style={{ backgroundColor: "#EBEBEA" }} />
      </div>

      {/* ── Daily Quiz card ────────────────────────────────────────────────── */}
      <section className="max-w-lg mx-auto px-5 py-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[17px] font-bold tracking-[0.12em] uppercase" style={{ color: "#4A5568" }}>
            ข้อสอบประจำวัน
          </p>
          <p className="text-[17px]" style={{ color: "#4A5568" }}>{today}</p>
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
              {/* Subject + live indicator */}
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-[16px] font-semibold"
                  style={{ color: dotColor(featuredExam.subject) }}
                >
                  {featuredExam.subject}
                </span>
                <span className="flex items-center gap-1 text-[16px] font-semibold" style={{ color: "#0B6E65" }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: "#0B6E65", animation: "pulse 2s infinite" }}
                  />
                  LIVE
                </span>
              </div>
              <p className="font-bold text-[17px] text-gray-900 leading-snug line-clamp-2">
                {featuredExam.title}
              </p>
              <p className="text-[17px] mt-1" style={{ color: "#4A5568" }}>
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
            style={{ border: "1px dashed #E0DFDC", color: "#4A5568" }}
          >
            <p className="text-[16px]">ยังไม่มีข้อสอบในระบบ</p>
          </div>
        )}
      </section>

      {/* ── Section divider ────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5">
        <div className="h-px" style={{ backgroundColor: "#EBEBEA" }} />
      </div>

      {/* ── Feature menu ──────────────────────────────────────────────────── */}
      <section className="max-w-lg mx-auto px-5 py-5">
        <p className="text-[17px] font-bold tracking-[0.12em] uppercase mb-3.5" style={{ color: "#4A5568" }}>
          เมนูหลัก
        </p>

        {/* Primary — light teal surface, no dark fill */}
        <Link
          href="/exams"
          className="flex items-center gap-3.5 w-full rounded-2xl px-4 py-3.5 mb-3
                     hover:opacity-90 active:scale-[0.98] transition-all duration-150"
          style={{
            backgroundColor: "#EBF5F3",
            border: "1px solid #D0EDE9",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#0B6E65" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-bold tracking-wider uppercase mb-0.5" style={{ color: "#0B6E65" }}>
              เริ่มต้นที่นี่
            </p>
            <p className="font-bold text-[17px] text-gray-900 leading-none">คลังข้อสอบ</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0" style={{ opacity: 0.5 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        {/* Secondary 2 × 2 */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            {
              title: "คลังความรู้",
              desc: "สรุปเนื้อหา",
              href: "#",
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                </svg>
              ),
            },
            {
              title: "Mock Exam",
              desc: "เสมือนสอบจริง",
              href: "#",
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              ),
            },
            {
              title: "แบบฝึกหัด",
              desc: "ฝึกทีละบท",
              href: "#",
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              ),
            },
            {
              title: "บันทึกของฉัน",
              desc: "ผลสอบและคะแนน",
              href: "/dashboard",
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ),
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="bg-white rounded-2xl px-3.5 py-3.5 flex items-center gap-3
                         hover:bg-stone-50 active:scale-[0.97] transition-all duration-150"
              style={{ border: "1px solid #EBEBEA" }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#F5F5F3", color: "#6B6B6A" }}
              >
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[18px] text-gray-900 leading-none truncate">
                  {item.title}
                </p>
                <p className="text-[17px] mt-0.5 truncate" style={{ color: "#4A5568" }}>
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
        <div className="flex items-center justify-between mb-3.5 px-5">
          <p className="text-[17px] font-bold tracking-[0.12em] uppercase" style={{ color: "#4A5568" }}>
            เพิ่มล่าสุด
          </p>
          <Link
            href="/exams"
            className="text-[18px] font-medium transition-colors"
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
                <p className="text-[16px] py-8" style={{ color: "#4A5568" }}>
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
          <p className="text-[17px] font-bold tracking-[0.12em] uppercase" style={{ color: "#4A5568" }}>
            ชุดข้อสอบทั้งหมด
          </p>
          {isFiltering && !loading && (
            <button
              onClick={() => { setSearch(""); setSelectedSubject("ทั้งหมด"); }}
              className="text-[18px] font-medium transition-colors"
              style={{ color: "#4A5568" }}
            >
              ล้างตัวกรอง ×
            </button>
          )}
        </div>

        {/* Count note */}
        {!loading && (
          <p className="text-[17px] mb-3" style={{ color: "#5A6478" }}>
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
            <p className="text-[17px] font-semibold text-gray-700 mb-1.5">
              {isFiltering ? "ไม่พบชุดข้อสอบ" : "ยังไม่มีชุดข้อสอบ"}
            </p>
            <p className="text-[18px] mb-5" style={{ color: "#4A5568" }}>
              {isFiltering ? "ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น" : "ชุดข้อสอบจะปรากฏที่นี่เมื่อมีการเพิ่มข้อมูล"}
            </p>
            {isFiltering && (
              <button
                onClick={() => { setSearch(""); setSelectedSubject("ทั้งหมด"); }}
                className="text-[16px] font-medium"
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
                  className="text-[17px] font-medium w-5 text-right flex-shrink-0"
                  style={{ color: "#6B7280" }}
                >
                  {idx + 1}
                </span>

                {/* Subject dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor(exam.subject) }}
                />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[16px] text-gray-900 truncate leading-snug">
                    {exam.title}
                  </p>
                  <p className="text-[17px] mt-0.5 truncate" style={{ color: "#4A5568" }}>
                    {exam.subject}
                    {exam.timeLimit > 0 && ` · ${exam.timeLimit} นาที`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isNewExam(exam) && (
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-[3px] rounded"
                      style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
                    >
                      ใหม่
                    </span>
                  )}
                  <span className="text-[17px] font-medium" style={{ color: "#4A5568" }}>
                    {exam.questionCount}&nbsp;ข้อ
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#6B7280"
                    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Admin */}
      <div className="max-w-lg mx-auto px-5 pb-4 text-center">
        <Link href="/admin" className="text-[17px] text-gray-300 hover:text-gray-600 transition-colors">
          Admin Panel →
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
