"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import {
  getUserSummaries, getRecentResults,
  type UserExamSummary, type UserResult,
} from "@/lib/user-firestore";
import { getUserCourses, type UserCourse } from "@/lib/activation";
import { useAccessGuard } from "@/lib/use-access-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUBJECT_COLOR: Record<string, string> = {
  ระบาดวิทยา:          "#3B82F6",
  อนามัยสิ่งแวดล้อม:   "#10B981",
  กฎหมาย:              "#F97316",
  บริหารสาธารณสุข:     "#8B5CF6",
  ชีวสถิติ:            "#0D9488",
  "นโยบาย สป.สธ.":     "#EF4444",
};
function sc(s: string) { return SUBJECT_COLOR[s] ?? "#0B6E65"; }

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(results: UserResult[]): number {
  if (!results.length) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days  = new Set(results.map((r) => { const d = new Date(r.doneAt); d.setHours(0, 0, 0, 0); return d.getTime(); }));

  // Walk back from today; if today is empty, check from yesterday
  let start = today.getTime();
  if (!days.has(start)) start -= 86_400_000;
  if (!days.has(start)) return 0;

  let streak = 0;
  let cur    = start;
  while (days.has(cur)) { streak++; cur -= 86_400_000; }
  return streak;
}

function gradeColor(pct: number) {
  if (pct >= 80) return "#0B6E65";
  if (pct >= 60) return "#B45309";
  return "#DC2626";
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day:   "numeric",
    month: "short",
    year:  "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: "#F3F2F0" }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function KPICard({
  icon, label, value, sub, color,
}: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4" style={{ border: "1px solid #EBEBEA" }}>
      <div className="text-[20px] mb-1.5">{icon}</div>
      <div className="text-[22px] font-extrabold leading-none mb-0.5" style={{ color }}>
        {value}
      </div>
      <div className="text-[17px] font-semibold text-gray-700">{label}</div>
      {sub && <div className="text-[16px] mt-0.5" style={{ color: "#4A5568" }}>{sub}</div>}
    </div>
  );
}

// ─── Exam Record Card ─────────────────────────────────────────────────────────

function ExamRecordCard({ s }: { s: UserExamSummary }) {
  const color      = sc(s.subject);
  const hex        = color.replace("#", "");
  const rr         = parseInt(hex.slice(0, 2), 16);
  const gg         = parseInt(hex.slice(2, 4), 16);
  const bb         = parseInt(hex.slice(4, 6), 16);
  const chipBg     = `rgba(${rr},${gg},${bb},0.1)`;

  const isPassing  = s.percentage >= 60;
  const best       = s.bestPercentage ?? s.percentage;   // fallback for old records
  const isNewBest  = s.bestPercentage !== undefined      // only show when tracked
                     && s.percentage === best
                     && (s.attempts ?? 1) > 1;
  const attempts   = s.attempts ?? 1;
  const improved   = s.bestPercentage !== undefined && s.percentage < best; // regressed

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${isPassing ? "#C3E5DE" : "#EBEBEA"}` }}
    >
      {/* Accent bar */}
      <div className="h-[3px]" style={{ backgroundColor: color }} />

      <div className="px-4 pt-4 pb-3">

        {/* Header: subject chip + pass/fail */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className="text-[17px] font-bold px-2 py-[4px] rounded-full"
            style={{ backgroundColor: chipBg, color }}
          >
            {s.subject}
          </span>
          <span
            className="text-[17px] font-bold px-2.5 py-[4px] rounded-full"
            style={
              isPassing
                ? { backgroundColor: "#EBF5F3", color: "#0B6E65" }
                : { backgroundColor: "#FEF2F2", color: "#DC2626" }
            }
          >
            {isPassing ? "✓ ผ่านเกณฑ์" : "✗ ไม่ผ่าน"}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[17px] text-gray-900 leading-snug line-clamp-2 mb-3">
          {s.examTitle}
        </h3>

        {/* ── Stats 3-col ──────────────────────────────────────── */}
        <div
          className="grid grid-cols-3 mb-3"
          style={{ borderTop: "1px solid #F3F2F0", borderBottom: "1px solid #F3F2F0" }}
        >
          {/* Latest score */}
          <div
            className="flex flex-col items-center py-3"
            style={{ borderRight: "1px solid #F3F2F0" }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <span
                className="text-[20px] font-extrabold leading-none"
                style={{ color: gradeColor(s.percentage) }}
              >
                {s.percentage}%
              </span>
              {improved && (
                <span className="text-[17px]" title="ต่ำกว่าคะแนนสูงสุด">↘</span>
              )}
            </div>
            <span className="text-[16px]" style={{ color: "#4A5568" }}>ล่าสุด</span>
            <span className="text-[16px]" style={{ color: "#5A6478" }}>
              {s.score}/{s.totalQuestions} ข้อ
            </span>
          </div>

          {/* Best score */}
          <div
            className="flex flex-col items-center py-3"
            style={{ borderRight: "1px solid #F3F2F0" }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              {isNewBest && <span className="text-[16px] leading-none">🏆</span>}
              <span
                className="text-[20px] font-extrabold leading-none"
                style={{ color: gradeColor(best) }}
              >
                {best}%
              </span>
            </div>
            <span className="text-[16px]" style={{ color: "#4A5568" }}>สูงสุด</span>
            {best >= 60 ? (
              <span className="text-[16px]" style={{ color: "#0B6E65" }}>ผ่านแล้ว</span>
            ) : (
              <span className="text-[16px]" style={{ color: "#DC2626" }}>ยังไม่ผ่าน</span>
            )}
          </div>

          {/* Attempts */}
          <div className="flex flex-col items-center py-3">
            <span className="text-[20px] font-extrabold leading-none text-gray-900 mb-0.5">
              {attempts}
            </span>
            <span className="text-[16px]" style={{ color: "#4A5568" }}>ครั้งที่สอบ</span>
            {attempts >= 5 ? (
              <span className="text-[16px]" style={{ color: "#F97316" }}>ขยันมาก!</span>
            ) : attempts >= 2 ? (
              <span className="text-[16px]" style={{ color: "#4A5568" }}>ทบทวนแล้ว</span>
            ) : (
              <span className="text-[16px]" style={{ color: "#4A5568" }}>ครั้งแรก</span>
            )}
          </div>
        </div>

        {/* ── Footer: date + retry ──────────────────────────── */}
        <div className="flex items-center justify-between">
          {/* Date */}
          <div
            className="flex items-center gap-1.5 text-[18px]"
            style={{ color: "#4A5568" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              className="w-3.5 h-3.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8"  y1="2" x2="8"  y2="6" />
              <line x1="3"  y1="10" x2="21" y2="10" />
            </svg>
            {fmt(s.lastDoneAt)}
          </div>

          {/* Retry button */}
          <Link
            href={`/exam/${s.examId}`}
            className="flex items-center gap-1.5 text-[18px] font-semibold
                       px-3.5 py-2 rounded-xl transition-all
                       hover:opacity-80 active:scale-[0.96]"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="w-3.5 h-3.5">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
            </svg>
            ทำซ้ำ
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Sign-in prompt ───────────────────────────────────────────────────────────

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen pb-28 flex flex-col" style={{ backgroundColor: "#A8D5BF" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center">
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ backgroundColor: "#EBF5F3" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <h1 className="text-[20px] font-bold text-gray-900 mb-2">Dashboard ของคุณ</h1>
        <p className="text-[16px] leading-relaxed mb-6 max-w-xs" style={{ color: "#4A5568" }}>
          เข้าสู่ระบบเพื่อดูสถิติ คะแนน ประวัติการสอบ
          และติดตามพัฒนาการของคุณ
        </p>

        {/* Preview stats (blurred) */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-2.5 mb-6 opacity-30 blur-[2px] pointer-events-none select-none">
          {["12 ชุด", "72%", "🔥 5", "ระบาดฯ"].map((v, i) => (
            <div key={i} className="bg-white rounded-2xl p-4" style={{ border: "1px solid #EBEBEA" }}>
              <div className="text-[20px] font-extrabold text-gray-900">{v}</div>
              <div className="text-[17px] text-gray-600 mt-0.5">—</div>
            </div>
          ))}
        </div>

        <button
          onClick={onSignIn}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-semibold text-[17px]
                     bg-white shadow-md hover:shadow-lg transition-all active:scale-[0.97]"
          style={{ border: "1px solid #E0DFDC" }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          เข้าสู่ระบบด้วย Google
        </button>

        <p className="text-[17px] mt-4" style={{ color: "#5A6478" }}>
          ฟรี — ใช้บัญชี Google ของคุณ
        </p>
      </div>
      <BottomNav />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const guard = useAccessGuard();
  const { user } = useAuth();

  const [summaries,   setSummaries]   = useState<UserExamSummary[]>([]);
  const [results,     setResults]     = useState<UserResult[]>([]);
  const [courses,     setCourses]     = useState<UserCourse[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const load = useCallback(async (uid: string) => {
    setDataLoading(true);
    try {
      const [s, r, c] = await Promise.all([
        getUserSummaries(uid),
        getRecentResults(uid, 30),
        getUserCourses(uid),
      ]);
      setSummaries(s);
      setResults(r);
      setCourses(c);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load(user.uid);
  }, [user, load]);

  // ── Computed analytics ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total   = summaries.length;
    const avgScore = total
      ? Math.round(summaries.reduce((s, r) => s + r.percentage, 0) / total)
      : 0;
    const streak  = computeStreak(results);

    // Per-subject avg
    const subjectMap: Record<string, { total: number; count: number }> = {};
    for (const s of summaries) {
      if (!subjectMap[s.subject]) subjectMap[s.subject] = { total: 0, count: 0 };
      subjectMap[s.subject].total += s.percentage;
      subjectMap[s.subject].count++;
    }
    const subjectStats = Object.entries(subjectMap)
      .map(([subject, { total, count }]) => ({ subject, avg: Math.round(total / count), count }))
      .sort((a, b) => b.avg - a.avg); // desc → bestSubject picks [0]

    const bestSubject  = subjectStats[0]?.subject ?? "—";
    const weakSubjects = subjectStats.filter((s) => s.avg < 70);

    // Score history chart (last 7 results, oldest first)
    const chart = [...results].reverse().slice(-7).map((r) => ({
      label:   r.examTitle.slice(0, 6) + "…",
      pct:     r.percentage,
      subject: r.subject,
      date:    new Date(r.doneAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
    }));

    // Daily activity heatmap (last 7 days)
    const DAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
    const now = new Date();
    const daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const key = dateKey(d);
      return {
        day:   DAY_TH[d.getDay()],
        key,
        count: results.filter((r) => dateKey(new Date(r.doneAt)) === key).length,
        isToday: i === 6,
      };
    });

    return { total, avgScore, streak, subjectStats, bestSubject, weakSubjects, chart, daily };
  }, [summaries, results]);

  // ── Guards ──────────────────────────────────────────────────────────────────
  // useAccessGuard จัดการ: ไม่ login → /, ไม่ activate → /activate

  if (guard !== "allowed") return <AccessGuardSpinner />;

  // guard === "allowed" รับประกันว่า user ไม่ใช่ null
  const safeUser = user!;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#A8D5BF" }}>

      {/* ── Profile header ────────────────────────────────────────────── */}
      <div className="bg-white" style={{ borderBottom: "1px solid #EBEBEA" }}>
        <div className="max-w-2xl mx-auto px-5 py-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0">
              {safeUser.photoURL ? (
                <Image src={safeUser.photoURL} alt="" width={56} height={56} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-[22px] font-bold"
                  style={{ backgroundColor: "#0B6E65" }}
                >
                  {(safeUser.displayName ?? safeUser.email ?? "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#4A5568" }}>
                Dashboard ของฉัน
              </p>
              <p className="text-[17px] font-bold text-gray-900 truncate">
                {safeUser.displayName ?? "ผู้ใช้"}
              </p>
              <p className="text-[18px] truncate" style={{ color: "#4A5568" }}>
                {safeUser.email}
              </p>
            </div>
            {/* Refresh */}
            <button
              onClick={() => load(safeUser.uid)}
              disabled={dataLoading}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ backgroundColor: "#EBF5F3" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`w-4 h-4 ${dataLoading ? "animate-spin" : ""}`}>
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">

        {/* ═══ KPI Cards ════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard
            icon="📚" label="ชุดที่ทำแล้ว"
            value={stats.total}
            sub={`${results.length} ครั้งรวม`}
            color="#0B6E65"
          />
          <KPICard
            icon="📊" label="คะแนนเฉลี่ย"
            value={stats.total ? `${stats.avgScore}%` : "—"}
            sub={
              stats.avgScore >= 75 ? "ระดับดีมาก"
              : stats.avgScore >= 60 ? "ผ่านเกณฑ์"
              : stats.total ? "ควรพัฒนา" : "ยังไม่มีข้อมูล"
            }
            color={gradeColor(stats.avgScore)}
          />
          <KPICard
            icon="🔥" label="Streak"
            value={stats.streak > 0 ? `${stats.streak} วัน` : "0"}
            sub={stats.streak > 0 ? "ต่อเนื่อง" : "เริ่มวันนี้!"}
            color={stats.streak >= 3 ? "#F97316" : "#9CA3AF"}
          />
          <KPICard
            icon="⭐" label="วิชาที่เก่ง"
            value={stats.bestSubject !== "—" ? stats.bestSubject.slice(0, 5) : "—"}
            sub={
              stats.subjectStats[0]
                ? `${stats.subjectStats[0].avg}% เฉลี่ย`
                : "ยังไม่มีข้อมูล"
            }
            color="#7C3AED"
          />
        </div>

        {/* ═══ Activity chart (7 days) ══════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
          <p className="text-[17px] font-bold text-gray-600 uppercase tracking-widest mb-4">
            กิจกรรม 7 วันล่าสุด
          </p>
          {stats.daily.every((d) => d.count === 0) ? (
            <p className="text-[16px] text-center py-4" style={{ color: "#4A5568" }}>
              ยังไม่มีกิจกรรม — เริ่มทำข้อสอบวันนี้เลย!
            </p>
          ) : (
            <div className="flex items-end gap-2 h-16">
              {stats.daily.map((d) => {
                const peak = Math.max(...stats.daily.map((x) => x.count), 1);
                const h    = d.count > 0 ? Math.max((d.count / peak) * 52, 6) : 3;
                return (
                  <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                    {d.count > 0 && (
                      <span className="text-[16px] font-bold" style={{ color: "#0B6E65" }}>{d.count}</span>
                    )}
                    <div className="w-full flex flex-col justify-end" style={{ flex: 1 }}>
                      <div
                        className="w-full rounded-t"
                        style={{ height: h, backgroundColor: d.isToday ? "#0B6E65" : "#C3E5DE" }}
                      />
                    </div>
                    <span className="text-[16px] font-medium" style={{ color: d.isToday ? "#0B6E65" : "#4A5568" }}>
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ Score history chart ══════════════════════════════════════ */}
        {stats.chart.length > 0 && (
          <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
            <p className="text-[17px] font-bold text-gray-600 uppercase tracking-widest mb-4">
              พัฒนาการคะแนน (7 ครั้งล่าสุด)
            </p>
            <div className="space-y-3">
              {stats.chart.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[17px] font-medium w-16 text-right flex-shrink-0"
                    style={{ color: "#4A5568" }}>
                    {item.date}
                  </span>
                  <div className="flex-1">
                    <ScoreBar pct={item.pct} color={gradeColor(item.pct)} />
                  </div>
                  <span
                    className="text-[18px] font-bold w-10 text-right flex-shrink-0"
                    style={{ color: gradeColor(item.pct) }}
                  >
                    {item.pct}%
                  </span>
                </div>
              ))}
            </div>
            {/* Pass threshold line indicator */}
            <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px dashed #F3F2F0" }}>
              <div className="h-0.5 w-4 rounded" style={{ backgroundColor: "#22C55E" }} />
              <span className="text-[17px]" style={{ color: "#4A5568" }}>60% = เกณฑ์ผ่าน</span>
              <div className="h-0.5 w-4 rounded ml-2" style={{ backgroundColor: "#0B6E65" }} />
              <span className="text-[17px]" style={{ color: "#4A5568" }}>80% = ดีมาก</span>
            </div>
          </div>
        )}

        {/* ═══ Subject progress ════════════════════════════════════════ */}
        {stats.subjectStats.length > 0 && (
          <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>

            {/* Header + legend */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-[17px] font-bold text-gray-600 uppercase tracking-widest">
                  ความก้าวหน้ารายวิชา
                </p>
                <p className="text-[18px] mt-0.5" style={{ color: "#4A5568" }}>
                  {stats.subjectStats.length} วิชา · เรียงจากต้องพัฒนาก่อน
                </p>
              </div>
              {/* Legend (vertical) */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {([
                  { color: "#16A34A", label: "ดีมาก ≥80%" },
                  { color: "#F59E0B", label: "ปานกลาง ≥60%" },
                  { color: "#EF4444", label: "ต้องทบทวน <60%" },
                ] as const).map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[16px]" style={{ color: "#4A5568" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subject rows — sorted weakest first (most urgent) */}
            <div className="space-y-5">
              {[...stats.subjectStats]
                .sort((a, b) => a.avg - b.avg)
                .map(({ subject, avg, count }) => {
                  const subColor = sc(subject);
                  const perf =
                    avg >= 80
                      ? { bar: "#16A34A", badgeBg: "#F0FDF4", badgeColor: "#15803D", label: "ดีมาก" }
                      : avg >= 60
                      ? { bar: "#F59E0B", badgeBg: "#FFFBEB", badgeColor: "#B45309", label: "ปานกลาง" }
                      : { bar: "#EF4444", badgeBg: "#FEF2F2", badgeColor: "#DC2626", label: "ต้องทบทวน" };

                  return (
                    <div key={subject}>
                      {/* Label row */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {/* Left: subject dot + name + count + badge */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: subColor }}
                          />
                          <span className="text-[16px] font-semibold text-gray-800 truncate">
                            {subject}
                          </span>
                          {count > 1 && (
                            <span
                              className="text-[16px] flex-shrink-0"
                              style={{ color: "#5A6478" }}
                            >
                              {count} ชุด
                            </span>
                          )}
                        </div>
                        {/* Right: badge + score */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="text-[16px] font-bold px-2.5 py-[4px] rounded-full"
                            style={{ backgroundColor: perf.badgeBg, color: perf.badgeColor }}
                          >
                            {perf.label}
                          </span>
                          <span
                            className="text-[18px] font-extrabold w-12 text-right"
                            style={{ color: perf.bar }}
                          >
                            {avg}%
                          </span>
                        </div>
                      </div>

                      {/* Progress bar — overflow:visible to show the threshold marker */}
                      <div className="relative h-3 rounded-full overflow-hidden"
                        style={{ backgroundColor: "#F3F2F0" }}>
                        {/* Fill */}
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                          style={{ width: `${avg}%`, backgroundColor: perf.bar }}
                        />
                        {/* 60% pass-threshold marker */}
                        <div
                          className="absolute inset-y-0 w-px z-10 opacity-50"
                          style={{ left: "60%", backgroundColor: "#6B7280" }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer: threshold note */}
            <div
              className="flex items-center gap-2 mt-5 pt-4"
              style={{ borderTop: "1px dashed #F3F2F0" }}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-px h-4" style={{ backgroundColor: "#9CA3AF", opacity: 0.5 }} />
                <span className="text-[17px]" style={{ color: "#4A5568" }}>
                  เส้นกั้นในแถบ = เกณฑ์ผ่าน 60%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ คอร์สของฉัน ═════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[17px] font-bold text-gray-600 uppercase tracking-widest">
                คอร์สของฉัน
              </p>
              <p className="text-[18px] mt-0.5" style={{ color: "#4A5568" }}>
                {courses.length > 0 ? `${courses.length} คอร์สที่เปิดใช้งาน` : "ยังไม่มีคอร์ส"}
              </p>
            </div>
            <Link
              href="/activate"
              className="flex items-center gap-1.5 text-[18px] font-semibold px-3 py-1.5 rounded-xl transition-all"
              style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              กรอก Code
            </Link>
          </div>

          {dataLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-4 animate-pulse" style={{ border: "1px solid #EBEBEA" }}>
                  <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div
              className="bg-white rounded-2xl p-6 text-center"
              style={{ border: "1px dashed #E0DFDC" }}
            >
              <div className="text-2xl mb-2">🔑</div>
              <p className="text-[16px] font-semibold text-gray-700 mb-1">ยังไม่มีคอร์สที่เปิดใช้งาน</p>
              <p className="text-[18px] mb-4" style={{ color: "#4A5568" }}>
                ใช้ Activation Code เพื่อปลดล็อกคอร์ส
              </p>
              <Link
                href="/activate"
                className="inline-flex items-center gap-1.5 text-[18px] font-semibold
                           px-4 py-2 rounded-xl text-white"
                style={{ backgroundColor: "#0B6E65" }}
              >
                กรอก Activation Code
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3"
                  style={{ border: "1px solid #C3E5DE" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#EBF5F3" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
                      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-semibold text-gray-900 truncate">{c.courseName}</p>
                    <p className="text-[17px] mt-0.5" style={{ color: "#4A5568" }}>
                      Code: <span className="font-mono">{c.activationCode}</span>
                      {" · "}เปิดใช้{" "}
                      {c.activatedAt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                    </p>
                  </div>
                  <span
                    className="text-[16px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
                  >
                    ✓ เปิดแล้ว
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ บันทึกของฉัน ════════════════════════════════════════════ */}
        {summaries.length > 0 ? (
          <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[17px] font-bold text-gray-600 uppercase tracking-widest">
                  บันทึกของฉัน
                </p>
                <p className="text-[18px] mt-0.5" style={{ color: "#4A5568" }}>
                  {summaries.length} ชุดข้อสอบ · เรียงจากล่าสุด
                </p>
              </div>
              {/* Pass summary chips */}
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[17px] font-semibold px-2 py-[3px] rounded-full"
                  style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
                >
                  ✓ {summaries.filter((s) => s.percentage >= 60).length}
                </span>
                <span
                  className="text-[17px] font-semibold px-2 py-[3px] rounded-full"
                  style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
                >
                  ✗ {summaries.filter((s) => s.percentage < 60).length}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {[...summaries]
                .sort((a, b) => new Date(b.lastDoneAt).getTime() - new Date(a.lastDoneAt).getTime())
                .map((s) => (
                  <ExamRecordCard key={s.examId} s={s} />
                ))}
            </div>
          </div>
        ) : !dataLoading ? (
          <div
            className="bg-white rounded-2xl p-10 text-center"
            style={{ border: "1px solid #EBEBEA" }}
          >
            <div className="text-4xl mb-3">📋</div>
            <p className="text-[18px] font-semibold text-gray-800 mb-1">ยังไม่มีประวัติการสอบ</p>
            <p className="text-[16px] mb-5" style={{ color: "#4A5568" }}>
              เริ่มทำข้อสอบแล้วคะแนนและสถิติของคุณจะปรากฏที่นี่
            </p>
            <Link href="/exams" className="btn-primary text-sm">
              ไปที่คลังข้อสอบ →
            </Link>
          </div>
        ) : null}

      </div>
      <BottomNav />
    </div>
  );
}
