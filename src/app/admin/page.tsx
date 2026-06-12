"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getAllExams, getAllResults, getQuestions } from "@/lib/firestore";
import type { Exam, ExamResult, Question } from "@/lib/types";

// ─── Local types ──────────────────────────────────────────────────────────────

interface DayData {
  key:   string;   // YYYY-MM-DD
  label: string;   // "25 พ.ค."
  day:   string;   // "จ"
  count: number;
}

interface ExamStat {
  examId:    string;
  examTitle: string;
  subject:   string;
  attempts:  number;
  avgScore:  number;
  passCount: number;
  passRate:  number;
}

interface MissedQ {
  questionNum:   number;
  questionText:  string;
  examTitle:     string;
  subject:       string;
  missCount:     number;
  totalAttempts: number;
  missRate:      number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDailyStats(results: ExamResult[]): DayData[] {
  const DAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const now    = new Date();
  const items: DayData[]            = [];
  const keyIdx: Record<string, number> = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const k = dateKey(d);
    keyIdx[k] = items.length;
    items.push({
      key:   k,
      label: d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      day:   DAY_TH[d.getDay()],
      count: 0,
    });
  }
  for (const r of results) {
    const k = dateKey(new Date(r.submittedAt));
    if (k in keyIdx) items[keyIdx[k]].count++;
  }
  return items;
}

const SUBJECT_COLOR: Record<string, string> = {
  ระบาดวิทยา:          "#3B82F6",
  อนามัยสิ่งแวดล้อม:   "#10B981",
  กฎหมาย:              "#F97316",
  บริหารสาธารณสุข:     "#8B5CF6",
  ชีวสถิติ:            "#0D9488",
  "นโยบาย สป.สธ.":     "#EF4444",
  คณิตศาสตร์:          "#3B82F6",
  ภาษาไทย:            "#F472B6",
  วิทยาศาสตร์:         "#34D399",
  ภาษาอังกฤษ:         "#A78BFA",
};
function subjectColor(s: string) { return SUBJECT_COLOR[s] ?? "#0B6E65"; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  icon, label, value, sub, color,
}: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[17px] mb-3 flex-shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        {icon}
      </div>
      <div className="text-[28px] font-extrabold leading-none mb-1" style={{ color }}>
        {value}
      </div>
      <div className="text-[12px] font-semibold text-gray-500">{label}</div>
      {sub && (
        <div className="text-[11px] mt-0.5" style={{ color: "#A8A8A6" }}>{sub}</div>
      )}
    </div>
  );
}

function DailyChart({ data }: { data: DayData[] }) {
  const peak    = Math.max(...data.map((d) => d.count), 1);
  const weekSum = data.reduce((s, d) => s + d.count, 0);
  const todayKey = dateKey(new Date());

  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            ผู้สอบรายวัน (7 วัน)
          </p>
          <p className="text-[20px] font-extrabold text-gray-900 mt-0.5">{weekSum}</p>
          <p className="text-[11px]" style={{ color: "#A8A8A6" }}>ครั้งในสัปดาห์นี้</p>
        </div>
        {/* Tiny legend */}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#0B6E65" }} />
          <span className="text-[11px]" style={{ color: "#A8A8A6" }}>วันนี้</span>
          <span className="w-3 h-3 rounded-sm ml-2" style={{ backgroundColor: "#C3E5DE" }} />
          <span className="text-[11px]" style={{ color: "#A8A8A6" }}>ก่อนหน้า</span>
        </div>
      </div>

      <div className="flex items-end gap-1.5" style={{ height: "80px" }}>
        {data.map((d) => {
          const isToday = d.key === todayKey;
          const barH    = d.count > 0 ? Math.max(((d.count / peak) * 68), 6) : 3;
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
              {d.count > 0 && (
                <span className="text-[10px] font-bold" style={{ color: "#0B6E65" }}>
                  {d.count}
                </span>
              )}
              <div className="w-full flex flex-col justify-end" style={{ flex: 1 }}>
                <div
                  className="w-full rounded-t-[3px] transition-all duration-500"
                  style={{
                    height:          `${barH}px`,
                    backgroundColor: isToday ? "#0B6E65" : "#C3E5DE",
                  }}
                />
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: isToday ? "#0B6E65" : "#A8A8A6" }}
              >
                {d.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectChart({ data }: { data: [string, number][] }) {
  const peak = data[0]?.[1] ?? 1;
  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
        วิชาที่นิยมทำ
      </p>
      {data.length === 0 ? (
        <p className="text-[13px] text-center py-4" style={{ color: "#A8A8A6" }}>
          ยังไม่มีข้อมูล
        </p>
      ) : (
        <div className="space-y-4">
          {data.map(([subj, cnt]) => {
            const color = subjectColor(subj);
            const hex   = color.replace("#", "");
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return (
              <div key={subj}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-gray-700">{subj}</span>
                  <span className="text-[12px] font-bold" style={{ color }}>
                    {cnt} ครั้ง
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: `rgba(${r},${g},${b},0.12)` }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(cnt / peak) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExamStatCard({ stat }: { stat: ExamStat }) {
  const color      = subjectColor(stat.subject);
  const gradeColor = stat.avgScore >= 75 ? "#16A34A" : stat.avgScore >= 60 ? "#B45309" : "#DC2626";
  const isMock     = stat.examId.startsWith("mock");

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #EBEBEA" }}>
      <div className="h-[3px]" style={{ backgroundColor: color }} />
      <div className="px-5 py-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-gray-900 leading-snug truncate">
              {stat.examTitle}
            </p>
            {stat.subject !== "—" && (
              <span
                className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {stat.subject}
              </span>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[24px] font-extrabold leading-none" style={{ color: gradeColor }}>
              {stat.avgScore}%
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: "#A8A8A6" }}>คะแนนเฉลี่ย</div>
          </div>
        </div>

        {/* Pass-rate bar */}
        <div
          className="h-1.5 rounded-full mb-3"
          style={{ backgroundColor: "#F3F2F0" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${stat.passRate}%`, backgroundColor: "#16A34A" }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-3" style={{ color: "#A8A8A6" }}>
            <span>
              <span className="font-semibold text-gray-700">{stat.attempts}</span> คนสอบ
            </span>
            <span className="opacity-40">·</span>
            <span>
              <span className="font-semibold" style={{ color: "#16A34A" }}>{stat.passCount}</span> ผ่าน
            </span>
            <span className="opacity-40">·</span>
            <span>
              <span className="font-semibold" style={{ color: stat.passRate >= 60 ? "#16A34A" : "#DC2626" }}>
                {stat.passRate}%
              </span>
            </span>
          </div>
          {!isMock && (
            <Link
              href={`/admin/exams/${stat.examId}/edit`}
              className="text-[11px] font-medium transition-colors"
              style={{ color: "#A8A8A6" }}
            >
              แก้ไข →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function MissedQCard({ q, rank }: { q: MissedQ; rank: number }) {
  const color   = subjectColor(q.subject);
  const isHigh  = q.missRate >= 70;
  const accent  = isHigh ? "#EF4444" : "#F59E0B";

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{ border: "1px solid #EBEBEA", borderLeft: `4px solid ${accent}` }}
    >
      <div className="px-5 py-4 flex items-start gap-3.5">
        {/* Rank badge */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold
                     text-white flex-shrink-0 mt-0.5"
          style={{ backgroundColor: accent }}
        >
          {rank}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-900 leading-relaxed line-clamp-2 mb-2">
            <span className="font-bold" style={{ color: "#A8A8A6" }}>ข้อ {q.questionNum}. </span>
            {q.questionText}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {q.subject !== "—" && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {q.subject}
              </span>
            )}
            <span className="text-[11px]" style={{ color: "#A8A8A6" }}>
              {q.examTitle.length > 25 ? q.examTitle.slice(0, 25) + "…" : q.examTitle}
            </span>
          </div>
        </div>

        {/* Miss rate */}
        <div className="text-right flex-shrink-0">
          <div className="text-[22px] font-extrabold leading-none" style={{ color: accent }}>
            {q.missRate}%
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "#A8A8A6" }}>ตอบผิด</div>
          <div className="text-[11px] mt-0.5 font-medium" style={{ color: "#A8A8A6" }}>
            {q.missCount}/{q.totalAttempts}
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  const barHeights = [40, 70, 55, 85, 30, 60, 45];
  return (
    <div className="space-y-5 animate-pulse">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 h-[108px]"
            style={{ border: "1px solid #EBEBEA" }}>
            <div className="h-9 w-9 rounded-xl bg-gray-100 mb-3" />
            <div className="h-7 w-14 bg-gray-100 rounded-lg mb-1.5" />
            <div className="h-3 w-20 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Daily */}
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
          <div className="h-4 w-32 bg-gray-100 rounded mb-1.5" />
          <div className="h-7 w-10 bg-gray-100 rounded mb-4" />
          <div className="flex items-end gap-1.5 h-[80px]">
            {barHeights.map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gray-100" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        {/* Subject */}
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
          <div className="h-3.5 w-24 bg-gray-100 rounded mb-5" />
          {[75, 55, 35].map((w, i) => (
            <div key={i} className="mb-4">
              <div className="flex justify-between mb-1.5">
                <div className="h-3 w-24 bg-gray-100 rounded" />
                <div className="h-3 w-10 bg-gray-100 rounded" />
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-full rounded-full bg-gray-200" style={{ width: `${w}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exam cards */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #EBEBEA" }}>
          <div className="h-[3px] bg-gray-200" />
          <div className="p-5">
            <div className="flex justify-between mb-3">
              <div>
                <div className="h-4 w-48 bg-gray-100 rounded mb-2" />
                <div className="h-5 w-20 bg-gray-100 rounded-full" />
              </div>
              <div className="h-8 w-12 bg-gray-100 rounded" />
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full mb-3" />
            <div className="h-3 w-40 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const { signOut } = useAuth();

  const [exams,       setExams]       = useState<Exam[]>([]);
  const [results,     setResults]     = useState<ExamResult[]>([]);
  const [questionsMap, setQuestionsMap] = useState<Record<string, Question[]>>({});
  const [loading,     setLoading]     = useState(true);
  const [loadedAt,    setLoadedAt]    = useState<Date | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [examsData, resultsData] = await Promise.all([
        getAllExams(),
        getAllResults(),
      ]);
      setExams(examsData);
      setResults(resultsData);

      // Load questions for top-3 real exams (for missed-question analysis)
      const realIds = new Set(examsData.map((e) => e.id));
      const countMap: Record<string, number> = {};
      for (const r of resultsData) {
        if (realIds.has(r.examId)) countMap[r.examId] = (countMap[r.examId] || 0) + 1;
      }
      const top3 = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);

      const qMap: Record<string, Question[]> = {};
      await Promise.all(
        top3.map(async (id) => {
          const qs = await getQuestions(id);
          if (qs.length > 0) qMap[id] = qs;
        })
      );
      setQuestionsMap(qMap);
      setLoadedAt(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSignOut() {
    console.log("[AdminDashboard] → /admin/login (sign out)");
    await signOut();
    router.replace("/admin/login");
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  const analytics = useMemo(() => {
    const total = results.length;
    const examsMap = Object.fromEntries(exams.map((e) => [e.id, e]));

    // KPIs
    const todayKey   = dateKey(new Date());
    const passCount  = results.filter((r) => r.percentage >= 60).length;
    const passRate   = total ? Math.round((passCount / total) * 100) : 0;
    const avgScore   = total ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / total) : 0;
    const todayCount = results.filter((r) => dateKey(new Date(r.submittedAt)) === todayKey).length;

    // Daily (7 days)
    const daily = getDailyStats(results);

    // Subject popularity
    const subjectMap: Record<string, number> = {};
    for (const r of results) {
      const s = examsMap[r.examId]?.subject;
      if (s) subjectMap[s] = (subjectMap[s] || 0) + 1;
    }
    const subjectStats = Object.entries(subjectMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) as [string, number][];

    // Per-exam stats
    const rawStats: Record<string, {
      examTitle: string; subject: string; attempts: number; totalPct: number; passCount: number;
    }> = {};
    for (const r of results) {
      if (!rawStats[r.examId]) {
        rawStats[r.examId] = {
          examTitle: r.examTitle,
          subject:   examsMap[r.examId]?.subject ?? "—",
          attempts: 0, totalPct: 0, passCount: 0,
        };
      }
      rawStats[r.examId].attempts++;
      rawStats[r.examId].totalPct += r.percentage;
      if (r.percentage >= 60) rawStats[r.examId].passCount++;
    }
    const examStats: ExamStat[] = Object.entries(rawStats)
      .map(([examId, s]) => ({
        examId,
        examTitle: s.examTitle,
        subject:   s.subject,
        attempts:  s.attempts,
        avgScore:  Math.round(s.totalPct / s.attempts),
        passCount: s.passCount,
        passRate:  Math.round((s.passCount / s.attempts) * 100),
      }))
      .sort((a, b) => b.attempts - a.attempts);

    // Most-missed questions (only real exams with loaded questions)
    const missedQs: MissedQ[] = [];
    for (const [examId, qs] of Object.entries(questionsMap)) {
      const examResults = results.filter((r) => r.examId === examId);
      if (!examResults.length || !qs.length) continue;

      const missCount = qs.map(() => 0);
      for (const r of examResults) {
        for (let i = 0; i < qs.length; i++) {
          if ((r.answers[i] ?? -1) !== qs[i].correctAnswer) missCount[i]++;
        }
      }

      // Top-missed question for this exam
      let maxIdx = 0;
      for (let i = 1; i < missCount.length; i++) {
        if (missCount[i] > missCount[maxIdx]) maxIdx = i;
      }

      missedQs.push({
        questionNum:   maxIdx + 1,
        questionText:  qs[maxIdx].text,
        examTitle:     examsMap[examId]?.title ?? rawStats[examId]?.examTitle ?? "—",
        subject:       examsMap[examId]?.subject ?? "—",
        missCount:     missCount[maxIdx],
        totalAttempts: examResults.length,
        missRate:      Math.round((missCount[maxIdx] / examResults.length) * 100),
      });
    }
    missedQs.sort((a, b) => b.missRate - a.missRate);

    return { total, passCount, passRate, avgScore, todayCount, daily, subjectStats, examStats, missedQs };
  }, [exams, results, questionsMap]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const published = exams.filter((e) => e.isPublished).length;
  const avgColor  =
    !analytics || analytics.avgScore === 0 ? "#9CA3AF"
    : analytics.avgScore >= 75 ? "#16A34A"
    : analytics.avgScore >= 60 ? "#B45309"
    : "#DC2626";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div
        className="sticky top-14 z-30 bg-white"
        style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[15px] font-bold text-gray-900">Dashboard</h1>
            {loadedAt && !loading && (
              <span className="text-[11px] hidden sm:block" style={{ color: "#C4C4C0" }}>
                อัปเดต {loadedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh */}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg
                         transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-teal-200 border-t-[#0B6E65] rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
                </svg>
              )}
              รีเฟรช
            </button>
            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "#A8A8A6", backgroundColor: "#F5F5F3" }}
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-5 pt-6 pb-16">

        {loading ? (
          <Skeleton />
        ) : (
          <div className="space-y-5">

            {/* ═══ KPI Cards ════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                icon="👥"
                label="ผู้เข้าสอบทั้งหมด"
                value={analytics.total.toLocaleString()}
                sub={analytics.todayCount > 0 ? `+${analytics.todayCount} วันนี้` : "ยังไม่มีวันนี้"}
                color="#0B6E65"
              />
              <KPICard
                icon="🏆"
                label="ผ่านเกณฑ์ (≥60%)"
                value={analytics.total ? `${analytics.passRate}%` : "—"}
                sub={analytics.total ? `${analytics.passCount.toLocaleString()} คน` : ""}
                color="#16A34A"
              />
              <KPICard
                icon="📊"
                label="คะแนนเฉลี่ย"
                value={analytics.total ? `${analytics.avgScore}%` : "—"}
                sub={
                  !analytics.total ? "ยังไม่มีข้อมูล"
                  : analytics.avgScore >= 75 ? "ระดับดีมาก"
                  : analytics.avgScore >= 60 ? "ระดับผ่านเกณฑ์"
                  : "ควรปรับปรุง"
                }
                color={avgColor}
              />
              <KPICard
                icon="📚"
                label="ชุดข้อสอบ"
                value={published}
                sub={`จาก ${exams.length} ชุดทั้งหมด`}
                color="#7C3AED"
              />
            </div>

            {/* ═══ Charts ═══════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DailyChart data={analytics.daily} />
              <SubjectChart data={analytics.subjectStats} />
            </div>

            {/* ═══ Empty state ══════════════════════════════════════════ */}
            {analytics.total === 0 && (
              <div
                className="bg-white rounded-2xl p-10 text-center"
                style={{ border: "1px solid #EBEBEA" }}
              >
                <div className="text-4xl mb-3">📋</div>
                <p className="text-[15px] font-semibold text-gray-800 mb-1">
                  ยังไม่มีข้อมูลการสอบ
                </p>
                <p className="text-[13px] mb-6" style={{ color: "#A8A8A6" }}>
                  เมื่อนักเรียนเริ่มทำข้อสอบ สถิติจะปรากฏที่นี่
                </p>
                <div className="flex justify-center gap-3 flex-wrap">
                  <Link href="/admin/exams/new" className="btn-primary text-sm">
                    + สร้างข้อสอบใหม่
                  </Link>
                  <Link href="/admin/codes" className="btn-secondary text-sm">
                    🔑 Activation Codes
                  </Link>
                  <Link href="/admin/seed" className="btn-secondary text-sm">
                    📥 Seed ข้อสอบ
                  </Link>
                  <Link href="/admin/flashcards/import" className="btn-secondary text-sm">
                    🃏 นำเข้า Flashcard
                  </Link>
                  <Link href="/admin/moph-focus" className="btn-secondary text-sm">
                    🏥 MOPH Focus
                  </Link>
                </div>
              </div>
            )}

            {/* ═══ Exam stats ═══════════════════════════════════════════ */}
            {analytics.examStats.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    ผลรายชุดข้อสอบ
                  </p>
                  <span className="text-[11px]" style={{ color: "#A8A8A6" }}>
                    {analytics.examStats.length} ชุด
                  </span>
                </div>
                <div className="space-y-3">
                  {analytics.examStats.map((s) => (
                    <ExamStatCard key={s.examId} stat={s} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Most missed questions ════════════════════════════════ */}
            {analytics.missedQs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    ข้อที่ตอบผิดมากที่สุด
                  </p>
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
                  >
                    จุดอ่อนของนักเรียน
                  </span>
                </div>
                <div className="space-y-2">
                  {analytics.missedQs.map((q, i) => (
                    <MissedQCard key={i} q={q} rank={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Quick actions ════════════════════════════════════════ */}
            <div
              className="bg-white rounded-2xl p-5"
              style={{ border: "1px solid #EBEBEA" }}
            >
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                การดำเนินการ
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/admin/exams/new" className="btn-primary text-sm">
                  + สร้างข้อสอบใหม่
                </Link>
                <Link href="/admin/exams" className="btn-secondary text-sm">
                  จัดการข้อสอบ
                </Link>
                <Link href="/admin/codes" className="btn-secondary text-sm">
                  🔑 Activation Codes
                </Link>
                <Link href="/admin/seed" className="btn-secondary text-sm">
                  📥 Seed ข้อสอบ
                </Link>
                <Link href="/admin/flashcards/import" className="btn-secondary text-sm">
                  🃏 นำเข้า Flashcard
                </Link>
                <Link href="/admin/moph-focus" className="btn-secondary text-sm">
                  🏥 จัดการ MOPH Focus
                </Link>
                <Link href="/exams" className="btn-secondary text-sm">
                  ดูหน้านักเรียน ↗
                </Link>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
