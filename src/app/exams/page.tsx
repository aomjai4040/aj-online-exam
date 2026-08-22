"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getPublishedExams } from "@/lib/firestore";
import type { Exam } from "@/lib/types";
import { getSubjectShort, normalizeSubject, isMockExam, subjectsForField } from "@/lib/types";
import { isFinalLapExam } from "@/lib/final-review";
import { examSetField, type ExamFieldKey } from "@/lib/exam-fields";
import { getActiveField, setActiveField } from "@/lib/active-field";
import FieldSwitcher from "@/components/FieldSwitcher";
import type { Difficulty } from "@/lib/mock-data";
import { getHistory, type ExamRecord } from "@/lib/exam-history";
import { getUserHistory } from "@/lib/user-firestore";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { getUserAccess, decideExamAccess, EMPTY_ACCESS, type UserAccess } from "@/lib/access";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExamCard = Exam & { difficulty?: Difficulty };

// ─── Subject colors (แหล่งเดียว: lib/subjects) ────────────────────────────────

import { subjectColor } from "@/lib/subjects";

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
      className="card-elev overflow-hidden animate-pulse"
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

// ─── Score band (สเปก Aj): <60 แดง / 60-69 ส้ม / 70-79 เหลือง / 80-89 เขียวอ่อน / 90+ เขียวเข้ม
function scoreBand(pct: number): { bar: string; text: string } {
  if (pct >= 90) return { bar: "#15803D", text: "#15803D" };
  if (pct >= 80) return { bar: "#4ADE80", text: "#16A34A" };
  if (pct >= 70) return { bar: "#EAB308", text: "#A16207" };
  if (pct >= 60) return { bar: "#F97316", text: "#C2410C" };
  return { bar: "#DC2626", text: "#DC2626" };
}

// ─── Exam card ────────────────────────────────────────────────────────────────

function ExamCardItem({ exam, record, locked }: { exam: ExamCard; record: ExamRecord | null; locked: boolean }) {
  const color  = subjectColor(exam.subject);
  const diff   = exam.difficulty;
  const ds     = diff ? DIFF_STYLE[diff] : null;
  const isDone = record !== null;
  const isFree = !!exam.isFree;

  // Subject chip background — hex → rgba 9%
  const hex    = color.replace("#", "");
  const r      = parseInt(hex.slice(0, 2), 16);
  const g      = parseInt(hex.slice(2, 4), 16);
  const b      = parseInt(hex.slice(4, 6), 16);
  const chipBg = `rgba(${r},${g},${b},0.09)`;

  return (
    <Link
      href={`/exam/${exam.id}`}
      className="card-elev card-elev-hover block overflow-hidden active:scale-[0.99]"
      style={isDone ? { border: "1px solid #C3E5DE" } : undefined}
    >
      {/* Subject accent bar */}
      <div className="h-[3px]" style={{ backgroundColor: color }} />

      <div className="p-5">

        {/* Header: subject chip + badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className="text-[12px] font-bold px-2.5 py-[5px] rounded-full"
            style={{ backgroundColor: chipBg, color }}
          >
            {getSubjectShort(exam.subject)}
          </span>
          <div className="flex items-center gap-1.5">
            {isFree && (
              <span
                className="text-[12px] font-bold px-2.5 py-[5px] rounded-full"
                style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}
              >
                ทดลองฟรี
              </span>
            )}
            {locked && (
              <span
                className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-[5px] rounded-full"
                style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                ล็อก
              </span>
            )}
            {record && (
              record.percentage >= 60 ? (
                <span
                  className="text-[12px] font-bold px-2.5 py-[5px] rounded-full"
                  style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}
                >
                  ✓ ผ่านเกณฑ์
                </span>
              ) : (
                <span
                  className="text-[12px] font-bold px-2.5 py-[5px] rounded-full"
                  style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
                >
                  ✗ ไม่ผ่าน
                </span>
              )
            )}
            {ds && diff && !locked && (
              <span
                className="text-[12px] font-semibold px-2.5 py-[5px] rounded-full"
                style={{ backgroundColor: ds.bg, color: ds.color }}
              >
                {diff}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[15px] text-gray-900 leading-snug mb-1.5">
          {exam.title}
        </h3>

        {/* Description */}
        {exam.description && (
          <p
            className="text-[12px] leading-relaxed mb-4 line-clamp-2"
            style={{ color: "#A8A8A6" }}
          >
            {exam.description}
          </p>
        )}

        {/* Stats row */}
        <div
          className="flex items-center gap-2 text-[12px] mb-4"
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

        {/* แถบคะแนนรอบล่าสุด — สีตามช่วงคะแนน (ดูหน้าเดียวเข้าใจเลย) */}
        {record && (() => {
          const band = scoreBand(record.percentage);
          return (
            <div className="mb-4">
              <div className="flex items-baseline justify-between text-[12px] mb-1.5">
                <span>
                  <span className="text-[15px] font-extrabold" style={{ color: band.text }}>
                    {record.percentage}%
                  </span>
                  <span style={{ color: "#A8A8A6" }}>
                    {" "}รอบล่าสุด ({record.score}/{record.totalQuestions} ข้อ)
                  </span>
                </span>
                <span style={{ color: "#A8A8A6" }}>{formatRecordDate(record.doneAt)}</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EFEC" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(Math.max(record.percentage, 2), 100)}%`,
                    backgroundColor: band.bar,
                  }}
                />
              </div>
            </div>
          );
        })()}

        {/* CTA button */}
        {locked ? (
          <div
            className="flex items-center justify-center gap-2 py-3 rounded-xl
                       text-[13.5px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#F3F4F6", color: "#4B5563" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            ปลดล็อกเพื่อทำ
          </div>
        ) : (
          <div
            className="flex items-center justify-center gap-2 py-3 rounded-xl
                       text-[13.5px] font-semibold transition-opacity hover:opacity-90"
            style={
              isDone
                ? { backgroundColor: "#EBF5F3", color: "#0B6E65", border: "1.5px solid #0B6E65" }
                : { backgroundColor: "#0B6E65", color: "white" }
            }
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
        )}

      </div>
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ExamsPage() {
  const guard = useLoginGuard();
  const { user } = useAuth();

  const [exams,         setExams]         = useState<ExamCard[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [activeSubject, setActiveSubject] = useState("ทั้งหมด");
  const [loadError,     setLoadError]     = useState(false);
  const [history,       setHistory]       = useState<Record<string, ExamRecord>>({});
  const [access,        setAccess]        = useState<UserAccess>(EMPTY_ACCESS);

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

  // Load the viewer's package entitlements → drives per-card lock badges
  useEffect(() => {
    if (user) getUserAccess(user.uid).then(setAccess).catch(() => setAccess(EMPTY_ACCESS));
    else      setAccess(EMPTY_ACCESS);
  }, [user]);

  // สนามที่กำลังดู — แยกกันเด็ดขาด (Aj 2026-08-16):
  // ?field=dcd (จากการ์ดสนาม) > ค่าที่จำไว้ตอนกดเลือกคอร์สหน้าแรก > สป.สธ.
  // เลือกแล้วจำค้างทั้งแอป — ไปเมนูไหนก็ยังอยู่สนามเดิมจนกว่าจะสลับ
  const [fieldParam, setFieldParam] = useState<ExamFieldKey>("moph");
  const [allExams,   setAllExams]   = useState<ExamCard[]>([]);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("field");
    const viewing: ExamFieldKey =
      f === "dcd" ? "dcd" : f === "moph" ? "moph" : getActiveField();
    setFieldParam(viewing);
    setActiveField(viewing);
    getPublishedExams()
      .then((data) => {
        // Mock กับชุดติวโค้งสุดท้าย แยกไปเมนูของตัวเอง (สนามกรองทีหลัง — สลับได้ไม่ต้องโหลดใหม่)
        setAllExams(data.filter((e) => !isMockExam(e) && !isFinalLapExam(e)));
        setLoadError(false);
      })
      .catch(() => setLoadError(true)) // แสดง error จริง ไม่ใช้ข้อมูลจำลอง
      .finally(() => setLoading(false));
  }, []);

  // ชุดของสนามที่กำลังดู
  useEffect(() => {
    setExams(allExams.filter((e) => examSetField(e) === fieldParam));
  }, [allExams, fieldParam]);

  const subjects = useMemo(
    () => ["ทั้งหมด", ...Array.from(new Set(exams.map((e) => e.subject))).sort()],
    [exams]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return exams.filter((e) => {
      const bySubject = activeSubject === "ทั้งหมด" || e.subject === activeSubject;
      const bySearch  =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q);
      return bySubject && bySearch;
    });
  }, [exams, activeSubject, search]);

  const isFiltering = search !== "" || activeSubject !== "ทั้งหมด";

  // จัดกลุ่มตามหมวด (โหมด "ทั้งหมด" + ไม่ได้ค้นหา) — เรียงตามลำดับหมวดสนามสอบจริง
  const grouped = useMemo(() => {
    // ลำดับหมวดตามสนามที่กำลังดู (คร. = ตามบท 1–9 ของคอร์ส)
    const order = subjectsForField(fieldParam).map((s) => s.code as string);
    const map = new Map<string, ExamCard[]>();
    for (const e of exams) {
      const key = normalizeSubject(e.subject);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(
      (a, b) =>
        (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) -
        (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0]))
    );
  }, [exams, fieldParam]);

  function clearFilters() {
    setSearch("");
    setActiveSubject("ทั้งหมด");
  }

  if (guard !== "allowed") return <AccessGuardSpinner />;

  return (
    <div className="min-h-screen bg-stone-50 pb-28">

      {/* ── Sticky compound header ────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 bg-stone-50">

        {/* Title row + search */}
        <div className="max-w-2xl md:max-w-5xl mx-auto px-5 pt-7 pb-4">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p
                className="text-[12px] font-semibold mb-1"
                style={{ color: "#A8A8A6" }}
              >
                AJ ExamOnline
              </p>
              <h1 className="text-[22px] font-bold text-gray-900 leading-tight tracking-tight">
                คลังข้อสอบ
                {fieldParam === "dcd" && (
                  <span className="ml-2 align-middle text-[12px] font-bold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                    สนามกรมควบคุมโรค
                  </span>
                )}
              </h1>
            </div>
            {isFiltering && !loading && (
              <button
                onClick={clearFilters}
                className="mt-1 text-[12px] font-medium transition-colors"
                style={{ color: "#A8A8A6" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#6B6B6A")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#A8A8A6")}
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>

          {/* Search input */}
          {/* สลับสนาม — เห็นเฉพาะคนมีคอร์ส คร. หรือกำลังดูสนาม คร. */}
          <FieldSwitcher current={fieldParam}
            show={access.hasDcd || fieldParam === "dcd"}
            onChange={(f) => {
              setFieldParam(f);
              window.history.replaceState(null, "", f === "dcd" ? "/exams?field=dcd" : "/exams");
            }} />

          <div className="relative">
            <svg
              viewBox="0 0 24 24" fill="none" stroke="#C4C4C0"
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
              className="w-full bg-white rounded-2xl pl-11 pr-10 py-2.5 text-[14px]
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

        {/* Subject filter tabs */}
        {!loading && subjects.length > 1 && (
          <div style={{ borderBottom: "1px solid #EBEBEA" }}>
            <div className="flex overflow-x-auto no-scrollbar px-5 max-w-2xl md:max-w-5xl mx-auto">
              {subjects.map((s) => {
                const active = activeSubject === s;
                return (
                  <button
                    key={s}
                    onClick={() => setActiveSubject(s)}
                    className="flex-shrink-0 py-3 px-3 text-[13px] font-medium
                               transition-all duration-150 whitespace-nowrap"
                    style={{
                      color:        active ? "#111110" : "#A8A8A6",
                      borderBottom: active ? "2px solid #111110" : "2px solid transparent",
                      marginBottom: "-1px",
                    }}
                  >
                    {s === "ทั้งหมด" ? s : getSubjectShort(s)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="max-w-2xl md:max-w-5xl mx-auto px-5 py-5">

        {/* Count label */}
        {!loading && (
          <div className="flex items-center justify-between pb-3">
            <p className="text-[12px]" style={{ color: "#A8A8A6" }}>
              {isFiltering
                ? `แสดง ${filtered.length} จาก ${exams.length} ชุด`
                : `ชุดข้อสอบทั้งหมด ${exams.length} ชุด`}
            </p>
            {loadError && (
              <span
                className="text-[11.5px] font-bold px-2 py-0.5 rounded tracking-wide"
                style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
              >
                โหลดไม่สำเร็จ — ลองรีเฟรช
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
            <p className="text-[15px] font-semibold text-gray-800 mb-2">
              {isFiltering ? "ไม่พบชุดข้อสอบ"
                : fieldParam === "dcd" ? "ข้อสอบสนามกรมควบคุมโรคกำลังทยอยมา"
                : "ยังไม่มีชุดข้อสอบ"}
            </p>
            <p className="text-[13px] mb-6" style={{ color: "#A8A8A6" }}>
              {isFiltering
                ? "ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น"
                : fieldParam === "dcd"
                ? "พี่อ้อมกำลังทำข้อสอบเจาะจงสนามนี้ให้ — มีชุดใหม่เมื่อไหร่แจ้งในกลุ่ม LINE ทุกครั้งค่ะ"
                : "ชุดข้อสอบจะปรากฏที่นี่เมื่อมีการเพิ่มข้อมูล"}
            </p>
            {isFiltering && (
              <button
                onClick={clearFilters}
                className="text-[13px] font-medium border rounded-full px-5 py-2
                           transition-colors text-gray-600 hover:bg-gray-50"
                style={{ borderColor: "#E0DFDC" }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        )}

        {/* Exam cards — โหมดกรอง/ค้นหา = ลิสต์แบน */}
        {!loading && filtered.length > 0 && isFiltering && (
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-4">
            {filtered.map((exam) => (
              <ExamCardItem
                key={exam.id}
                exam={exam}
                record={history[exam.id] ?? null}
                locked={decideExamAccess(exam, user?.uid ?? null, access) === "locked"}
              />
            ))}
          </div>
        )}

        {/* โหมดปกติ = จัดกลุ่มตามหมวดสนามสอบ พร้อมสรุปความคืบหน้าต่อหมวด */}
        {!loading && filtered.length > 0 && !isFiltering && (
          <div className="space-y-7">
            {grouped.map(([code, list]) => {
              const done = list.filter((e) => history[e.id]).length;
              return (
                <section key={code}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: subjectColor(code) }} />
                      <h2 className="text-[14px] font-bold text-gray-900 truncate">
                        {getSubjectShort(code)}
                      </h2>
                      <span className="text-[12px] flex-shrink-0" style={{ color: "#A8A8A6" }}>
                        {list.length} ชุด
                      </span>
                    </div>
                    <span className="text-[12px] font-semibold flex-shrink-0"
                      style={{ color: done === list.length && done > 0 ? "#15803D" : "#A8A8A6" }}>
                      {done === list.length && done > 0 ? "✓ ครบทุกชุด" : `ทำแล้ว ${done}/${list.length}`}
                    </span>
                  </div>
                  <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-4">
                    {list.map((exam) => (
                      <ExamCardItem
                        key={exam.id}
                        exam={exam}
                        record={history[exam.id] ?? null}
                        locked={decideExamAccess(exam, user?.uid ?? null, access) === "locked"}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}
