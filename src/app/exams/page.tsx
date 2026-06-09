"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getPublishedExams } from "@/lib/firestore";
import type { Exam } from "@/lib/types";
import { SUBJECTS, SUBJECT_DISPLAY, normalizeSubject } from "@/lib/types";
import { MOCK_EXAM_LIST, type Difficulty } from "@/lib/mock-data";
import { getHistory, type ExamRecord } from "@/lib/exam-history";
import { getUserHistory } from "@/lib/user-firestore";
import { useAuth } from "@/lib/auth-context";
import { useAccessGuard } from "@/lib/use-access-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExamCard = Exam & { difficulty?: Difficulty };

// ─── Subject colors ───────────────────────────────────────────────────────────

// สีหมวดวิชา — รองรับทั้ง code ใหม่ (BASIC) และ legacy (ระบาดวิทยา)
const SUBJECT_COLOR: Record<string, string> = {
  // New codes
  BASIC:   "#3B82F6",
  APPLIED: "#10B981",
  POLICY:  "#EF4444",
  CURRENT: "#F97316",
  REFORM:  "#8B5CF6",
  LAWIT:   "#0D9488",
  MOPH:    "#EC4899",
  // Legacy Thai names (fallback)
  ระบาดวิทยา:          "#3B82F6",
  อนามัยสิ่งแวดล้อม:   "#10B981",
  กฎหมาย:              "#0D9488",
  บริหารสาธารณสุข:     "#10B981",
  ชีวสถิติ:            "#3B82F6",
  "นโยบาย สป.สธ.":     "#EC4899",
};
function subjectColor(s: string) { return SUBJECT_COLOR[s] ?? "#0B6E65"; }

// ─── Difficulty styles ────────────────────────────────────────────────────────

const DIFF_STYLE: Record<Difficulty, { color: string; bg: string }> = {
  ง่าย:    { color: "#16A34A", bg: "#F0FDF4" },
  ปานกลาง: { color: "#B45309", bg: "#FFFBEB" },
  ยาก:     { color: "#DC2626", bg: "#FEF2F2" },
};

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="bg-white rounded-2xl overflow-hidden animate-pulse"
      style={{ border: "1px solid #EBEBEA" }}
    >
      <div className="h-[3px] bg-gray-200" />
      <div className="p-5">
        <div className="flex justify-between mb-4">
          <div className="h-6 w-24 bg-gray-100 rounded-full" />
          <div className="h-6 w-16 bg-gray-100 rounded-full" />
        </div>
        <div className="h-[18px] bg-gray-100 rounded-full w-3/4 mb-2.5" />
        <div className="h-3 bg-gray-100 rounded-full w-full mb-1.5" />
        <div className="h-3 bg-gray-100 rounded-full w-4/5 mb-5" />
        <div className="h-3 bg-gray-100 rounded-full w-2/5 mb-5" />
        <div className="h-11 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Record date formatter ────────────────────────────────────────────────────

function formatRecordDate(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) {
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `วันนี้ ${hh}:${mm}`;
  }
  if (diff === 1) return "เมื่อวาน";
  if (diff < 7)  return `${diff} วันที่แล้ว`;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

// ─── Exam card ────────────────────────────────────────────────────────────────

function ExamCardItem({ exam, record }: { exam: ExamCard; record: ExamRecord | null }) {
  const normalizedSubject = normalizeSubject(exam.subject);
  const displaySubject = SUBJECT_DISPLAY[normalizedSubject] ?? exam.subject;
  const color  = subjectColor(normalizedSubject);
  const diff   = exam.difficulty;
  const ds     = diff ? DIFF_STYLE[diff] : null;
  const isDone = record !== null;

  // Subject chip background — hex → rgba 9%
  const hex    = color.replace("#", "");
  const r      = parseInt(hex.slice(0, 2), 16);
  const g      = parseInt(hex.slice(2, 4), 16);
  const b      = parseInt(hex.slice(4, 6), 16);
  const chipBg = `rgba(${r},${g},${b},0.09)`;

  return (
    <Link
      href={`/exam/${exam.id}`}
      className="block bg-white rounded-2xl overflow-hidden
                 hover:shadow-md active:scale-[0.99] transition-all duration-150"
      style={{ border: `1px solid ${isDone ? "#C3E5DE" : "#EBEBEA"}` }}
    >
      {/* Subject accent bar */}
      <div className="h-[3px]" style={{ backgroundColor: color }} />

      <div className="p-5">

        {/* Header: subject chip + badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className="text-[17px] font-bold px-2.5 py-[5px] rounded-full"
            style={{ backgroundColor: chipBg, color }}
          >
            {displaySubject}
          </span>
          <div className="flex items-center gap-1.5">
            {isDone && (
              <span
                className="text-[17px] font-bold px-2.5 py-[5px] rounded-full"
                style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
              >
                ✓ ทำแล้ว
              </span>
            )}
            {ds && diff && (
              <span
                className="text-[17px] font-semibold px-2.5 py-[5px] rounded-full"
                style={{ backgroundColor: ds.bg, color: ds.color }}
              >
                {diff}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[18px] text-gray-900 leading-snug mb-1.5">
          {exam.title}
        </h3>

        {/* Description */}
        {exam.description && (
          <p
            className="text-[18px] leading-relaxed mb-4 line-clamp-2"
            style={{ color: "#4A5568" }}
          >
            {exam.description}
          </p>
        )}

        {/* Stats row */}
        <div
          className="flex items-center gap-2 text-[18px] mb-4"
          style={{ color: "#9CA3AF" }}
        >
          <span className="font-semibold" style={{ color: "#6B7280" }}>
            {exam.questionCount} ข้อ
          </span>
          {exam.timeLimit > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span>{exam.timeLimit} นาที</span>
            </>
          )}
          <span className="opacity-40">·</span>
          <span>4 ตัวเลือก</span>
        </div>

        {/* Last result strip — shown only when completed */}
        {record && (
          <div
            className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl text-[18px]"
            style={{ backgroundColor: "#EBF5F3", border: "1px solid #C3E5DE" }}
          >
            {/* Bar-chart icon */}
            <svg
              viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-3.5 h-3.5 flex-shrink-0"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4"  />
              <line x1="6"  y1="20" x2="6"  y2="14" />
            </svg>
            <span className="font-bold" style={{ color: "#0B6E65" }}>
              {record.percentage}%
            </span>
            <span style={{ color: "#5DA89F" }}>
              ({record.score}/{record.totalQuestions} ข้อ)
            </span>
            <span className="flex-1" />
            <span style={{ color: "#4A5568" }}>
              {formatRecordDate(record.doneAt)}
            </span>
          </div>
        )}

        {/* CTA button */}
        <div
          className="flex items-center justify-center gap-2 py-3 rounded-xl
                     text-[16px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#0B6E65" }}
        >
          {isDone ? "ทำอีกครั้ง" : "เริ่มทำข้อสอบ"}
          {isDone ? (
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </div>

      </div>
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ExamsPage() {
  const guard = useAccessGuard();
  const { user } = useAuth();

  const [exams,         setExams]         = useState<ExamCard[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [activeSubject, setActiveSubject] = useState("ทั้งหมด");
  const [isMock,        setIsMock]        = useState(false);
  const [history,       setHistory]       = useState<Record<string, ExamRecord>>({});

  // Load history: Firestore when logged in, otherwise localStorage
  useEffect(() => {
    if (user) {
      getUserHistory(user.uid)
        .then(setHistory)
        .catch(() => setHistory(getHistory())); // fallback to localStorage on error
    } else {
      setHistory(getHistory());
    }
  }, [user]);

  useEffect(() => {
    getPublishedExams()
      .then((data) => {
        console.log("[ExamsPage] getPublishedExams returned:", data.length, "exams");
        console.log("[ExamsPage] exams:", data.map(e => e.title));
        if (data.length > 0) {
          setExams(data);
          setIsMock(false);
        } else {
          console.warn("[ExamsPage] 0 published exams → using mock data");
          setExams(MOCK_EXAM_LIST as ExamCard[]);
          setIsMock(true);
        }
      })
      .catch((err) => {
        console.error("[ExamsPage] getPublishedExams error:", err);
        setExams(MOCK_EXAM_LIST as ExamCard[]);
        setIsMock(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fixed 7 subject tabs — ดึงจาก SUBJECTS constant เสมอ ไม่ hardcode
  const SUBJECT_TABS = [
    { code: "ทั้งหมด", label: "ทั้งหมด" },
    ...SUBJECTS.map(s => ({ code: s.code, label: SUBJECT_DISPLAY[s.code] ?? s.code })),
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = exams.filter((e) => {
      const normalizedCode = normalizeSubject(e.subject);
      const bySubject = activeSubject === "ทั้งหมด" || normalizedCode === activeSubject;
      const bySearch  =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (SUBJECT_DISPLAY[normalizedCode] ?? e.subject).toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q);
      return bySubject && bySearch;
    });
    console.log("[ExamsPage] activeSubject:", activeSubject, "filteredExams:", result.map(e => e.title));
    return result;
  }, [exams, activeSubject, search]);

  const isFiltering = search !== "" || activeSubject !== "ทั้งหมด";

  function clearFilters() {
    setSearch("");
    setActiveSubject("ทั้งหมด");
  }

  if (guard !== "allowed") return <AccessGuardSpinner />;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#A8D5BF" }}>

      {/* ── Sticky compound header ────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 bg-stone-50">

        {/* Title row + search */}
        <div className="max-w-2xl mx-auto px-5 pt-7 pb-4">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p
                className="text-[17px] font-semibold tracking-[0.12em] uppercase mb-1"
                style={{ color: "#4A5568" }}
              >
                AJ ExamOnline
              </p>
              <h1 className="text-[22px] font-bold text-gray-900 leading-tight tracking-tight">
                คลังข้อสอบ
              </h1>
            </div>
            {isFiltering && !loading && (
              <button
                onClick={clearFilters}
                className="mt-1 text-[18px] font-medium transition-colors"
                style={{ color: "#4A5568" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#6B6B6A")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4A5568")}
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>

          {/* Search input */}
          <div className="relative">
            <svg
              viewBox="0 0 24 24" fill="none" stroke="#5A6478"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              className="w-[17px] h-[17px] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชุดข้อสอบ..."
              className="w-full bg-white rounded-2xl pl-11 pr-10 py-2.5 text-[17px]
                         text-gray-900 placeholder-gray-400 transition-all duration-150 focus:outline-none"
              style={{ border: "1px solid #E0DFDC" }}
              onFocus={(e) => {
                e.currentTarget.style.border = "1.5px solid transparent";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,110,101,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid #E0DFDC";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full
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
        </div>

        {/* Subject filter tabs — fixed 7 หมวด + ทั้งหมด */}
        <div style={{ borderBottom: "1px solid #EBEBEA" }}>
          <div className="flex overflow-x-auto no-scrollbar px-5 max-w-2xl mx-auto">
            {SUBJECT_TABS.map(({ code, label }) => {
              const active = activeSubject === code;
              // นับจำนวนข้อสอบในแต่ละหมวด
              const count = code === "ทั้งหมด"
                ? exams.length
                : exams.filter(e => normalizeSubject(e.subject) === code).length;
              return (
                <button
                  key={code}
                  onClick={() => setActiveSubject(code)}
                  className="flex-shrink-0 py-3 px-3 text-[16px] font-medium
                             transition-all duration-150 whitespace-nowrap flex items-center gap-1"
                  style={{
                    color:        active ? "#111110" : "#4A5568",
                    borderBottom: active ? "2px solid #0B6E65" : "2px solid transparent",
                    marginBottom: "-1px",
                  }}
                >
                  {label}
                  {count > 0 && (
                    <span className="text-[13px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: active ? "#0B6E65" : "#F3F2F0",
                        color: active ? "white" : "#6B7280",
                      }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 py-5">

        {/* Count label */}
        {!loading && (
          <div className="flex items-center justify-between pb-3">
            <p className="text-[17px]" style={{ color: "#4A5568" }}>
              {isFiltering
                ? `แสดง ${filtered.length} จาก ${exams.length} ชุด`
                : `ชุดข้อสอบทั้งหมด ${exams.length} ชุด`}
            </p>
            {isMock && (
              <span
                className="text-[16px] font-bold px-2 py-0.5 rounded tracking-wide uppercase"
                style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
              >
                Demo
              </span>
            )}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-[18px] font-semibold text-gray-800 mb-2">
              {isFiltering ? "ไม่พบชุดข้อสอบ" : "ยังไม่มีชุดข้อสอบ"}
            </p>
            <p className="text-[16px] mb-6" style={{ color: "#4A5568" }}>
              {isFiltering
                ? "ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น"
                : "ชุดข้อสอบจะปรากฏที่นี่เมื่อมีการเพิ่มข้อมูล"}
            </p>
            {isFiltering && (
              <button
                onClick={clearFilters}
                className="text-[16px] font-medium border rounded-full px-5 py-2
                           transition-colors text-gray-600 hover:bg-gray-50"
                style={{ borderColor: "#E0DFDC" }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        )}

        {/* Exam cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((exam) => (
              <ExamCardItem key={exam.id} exam={exam} record={history[exam.id] ?? null} />
            ))}
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}
