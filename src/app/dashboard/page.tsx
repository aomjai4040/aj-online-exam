"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import {
  getUserSummaries, getRecentResults,
  type UserExamSummary, type UserResult,
} from "@/lib/user-firestore";
import { getUserCourses, type UserCourse } from "@/lib/activation";
import { isAppOnlyCourse } from "@/lib/access";
import { PRICING } from "@/lib/pricing";
import { getPublishedExams } from "@/lib/firestore";
import { getPublishedVideos, type CourseVideo } from "@/lib/video-firestore";
import { getAllVideoProgress, type VideoProgress } from "@/lib/video-progress";
import { buildStudyPlan, getDailyDoneToday } from "@/lib/coach";
import { normalizeSubject, isMockExam, getSubjectShort, SUBJECT_DISPLAY, type Exam } from "@/lib/types";
import { daysToExam, COUNTDOWN_LABEL, planDaysLeft, PLAN_TARGET_LABEL } from "@/lib/exam-config";
import { listInProgress } from "@/lib/exam-progress";
import { countWrongQuestions } from "@/lib/smart-review";
import { useLoginGuard } from "@/lib/use-login-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { subjectColor as sc } from "@/lib/subjects";

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
            className="text-[12px] font-bold px-2 py-[4px] rounded-full"
            style={{ backgroundColor: chipBg, color }}
          >
            {s.subject}
          </span>
          <span
            className="text-[12px] font-bold px-2.5 py-[4px] rounded-full"
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
        <h3 className="font-bold text-[14px] text-gray-900 leading-snug line-clamp-2 mb-3">
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
                <span className="text-[12px]" title="ต่ำกว่าคะแนนสูงสุด">↘</span>
              )}
            </div>
            <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>ล่าสุด</span>
            <span className="text-[11.5px]" style={{ color: "#C4C4C0" }}>
              {s.score}/{s.totalQuestions} ข้อ
            </span>
          </div>

          {/* Best score */}
          <div
            className="flex flex-col items-center py-3"
            style={{ borderRight: "1px solid #F3F2F0" }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              {isNewBest && <span className="text-[13px] leading-none">🏆</span>}
              <span
                className="text-[20px] font-extrabold leading-none"
                style={{ color: gradeColor(best) }}
              >
                {best}%
              </span>
            </div>
            <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>สูงสุด</span>
            {best >= 60 ? (
              <span className="text-[11.5px]" style={{ color: "#0B6E65" }}>ผ่านแล้ว</span>
            ) : (
              <span className="text-[11.5px]" style={{ color: "#DC2626" }}>ยังไม่ผ่าน</span>
            )}
          </div>

          {/* Attempts */}
          <div className="flex flex-col items-center py-3">
            <span className="text-[20px] font-extrabold leading-none text-gray-900 mb-0.5">
              {attempts}
            </span>
            <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>ครั้งที่สอบ</span>
            {attempts >= 5 ? (
              <span className="text-[11.5px]" style={{ color: "#F97316" }}>ขยันมาก!</span>
            ) : attempts >= 2 ? (
              <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>ทบทวนแล้ว</span>
            ) : (
              <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>ครั้งแรก</span>
            )}
          </div>
        </div>

        {/* ── Footer: date + retry ──────────────────────────── */}
        <div className="flex items-center justify-between">
          {/* Date */}
          <div
            className="flex items-center gap-1.5 text-[12px]"
            style={{ color: "#A8A8A6" }}
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
            className="flex items-center gap-1.5 text-[12px] font-semibold
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
    <div className="min-h-screen bg-stone-50 pb-28 flex flex-col">
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
        <p className="text-[13px] leading-relaxed mb-6 max-w-xs" style={{ color: "#A8A8A6" }}>
          เข้าสู่ระบบเพื่อดูสถิติ คะแนน ประวัติการสอบ
          และติดตามพัฒนาการของคุณ
        </p>

        {/* Preview stats (blurred) */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-2.5 mb-6 opacity-30 blur-[2px] pointer-events-none select-none">
          {["12 ชุด", "72%", "🔥 5", "ระบาดฯ"].map((v, i) => (
            <div key={i} className="bg-white rounded-2xl p-4" style={{ border: "1px solid #EBEBEA" }}>
              <div className="text-[20px] font-extrabold text-gray-900">{v}</div>
              <div className="text-[12px] text-gray-400 mt-0.5">—</div>
            </div>
          ))}
        </div>

        <button
          onClick={onSignIn}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-semibold text-[14px]
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

        <p className="text-[12px] mt-4" style={{ color: "#C4C4C0" }}>
          ฟรี — ใช้บัญชี Google ของคุณ
        </p>
      </div>
      <BottomNav />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const guard  = useLoginGuard();
  const router = useRouter();
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    if (!confirm("ออกจากระบบ?")) return;
    await signOut();
    router.replace("/");
  }

  const [summaries,   setSummaries]   = useState<UserExamSummary[]>([]);
  const [results,     setResults]     = useState<UserResult[]>([]);
  const [courses,     setCourses]     = useState<UserCourse[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [wrongCount,  setWrongCount]  = useState(0);
  const [totalSets,   setTotalSets]   = useState(0); // จำนวนชุดข้อสอบทั้งหมด (ไม่รวม mock) — ตัวหารความครอบคลุม
  const [freeSets,    setFreeSets]    = useState(0); // ชุดทดลองฟรี — ใช้คำนวณจำนวนชุดที่ล็อกบนการ์ด upsell
  const [allExams,    setAllExams]    = useState<Exam[]>([]);               // ใช้สร้างแผนเรียน
  const [videos,      setVideos]      = useState<CourseVideo[]>([]);        // คอร์สเต็มเท่านั้น
  const [videoProg,   setVideoProg]   = useState<Map<string, VideoProgress>>(new Map());
  const [dailyDone,   setDailyDone]   = useState(false);                    // วันนี้ทำ Daily Quiz แล้ว
  const [inProgress,  setInProgress]  = useState<ReturnType<typeof listInProgress>>([]);

  const load = useCallback(async (uid: string) => {
    setDataLoading(true);
    try {
      const [s, r, c, w, all] = await Promise.all([
        getUserSummaries(uid),
        getRecentResults(uid, 30),
        getUserCourses(uid),
        countWrongQuestions(uid).catch(() => 0),
        getPublishedExams().catch(() => []),
      ]);
      const realSets = all.filter((e) => !isMockExam(e));
      setTotalSets(realSets.length);
      setFreeSets(realSets.filter((e) => e.isFree).length);
      setAllExams(all);
      setSummaries(s);
      setResults(r);
      setCourses(c);
      setWrongCount(w);

      // ข้อมูลแผนเรียน: คลิป (คอร์สเต็มเท่านั้น) + สถานะ Daily Quiz วันนี้
      const full = c.some((x) => !isAppOnlyCourse(x.courseId));
      const [vids, vprog, dq] = await Promise.all([
        full ? getPublishedVideos().catch(() => []) : Promise.resolve([]),
        full ? getAllVideoProgress(uid).catch(() => new Map<string, VideoProgress>()) : Promise.resolve(new Map<string, VideoProgress>()),
        getDailyDoneToday(uid),
      ]);
      setVideos(vids);
      setVideoProg(vprog);
      setDailyDone(dq);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load(user.uid);
  }, [user, load]);

  // ข้อสอบที่ค้างกลางคันบนเครื่องนี้ (localStorage — อ่านหลัง mount เท่านั้น)
  useEffect(() => { setInProgress(listInProgress()); }, []);

  // การ์ด "เรียนต่อ": ① ข้อสอบค้างกลางคัน (แรงสุด) ② ชุดล่าสุดที่ยังไม่ผ่าน
  const continueTarget = useMemo(() => {
    if (inProgress.length > 0) {
      const p = inProgress[0];
      return {
        type:   "resume" as const,
        examId: p.examId,
        title:  p.examTitle || "ข้อสอบที่ทำค้างไว้",
        done:   p.answers.filter((a) => a !== -1).length,
        total:  p.qCount,
        pct:    undefined as number | undefined,
      };
    }
    const recentFailed = [...summaries]
      .sort((a, b) => new Date(b.lastDoneAt).getTime() - new Date(a.lastDoneAt).getTime())
      .find((s) => (s.bestPercentage ?? s.percentage) < 60);
    if (recentFailed) {
      return {
        type:   "retry" as const,
        examId: recentFailed.examId,
        title:  recentFailed.examTitle,
        done:   0,
        total:  0,
        pct:    recentFailed.bestPercentage ?? recentFailed.percentage,
      };
    }
    return null;
  }, [inProgress, summaries]);

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

    // ── คะแนนความพร้อมสอบ (สังเคราะห์จากข้อมูลจริง) ─────────────────────────
    // mastery 40% (คะแนนสูงสุดเฉลี่ย) · coverage 35% (ทำครอบคลุมกี่ชุด)
    // consistency 15% (streak) · mock 10% (คะแนน Mock ล่าสุด)
    const avgBest = total
      ? summaries.reduce((s, r) => s + (r.bestPercentage ?? r.percentage), 0) / total
      : 0;
    const coverage = totalSets > 0 ? Math.min(1, total / totalSets) : 0;
    const consistency = Math.min(streak, 7) / 7;
    const mockSummaries = summaries.filter((s) => normalizeSubject(s.subject) === "MOCK");
    const mockBest = mockSummaries.length
      ? Math.max(...mockSummaries.map((s) => s.bestPercentage ?? s.percentage))
      : 0;
    const hasData = total > 0;
    const readiness = hasData
      ? Math.round(
          (avgBest / 100) * 40 +
          coverage       * 35 +
          consistency    * 15 +
          (mockBest / 100) * 10
        )
      : 0;
    const predictedScore = Math.round(avgBest); // ถ้าสอบวันนี้ประมาณกี่ %

    // โมเมนตัม 7 วัน: เฉลี่ย 3 ครั้งล่าสุด เทียบ 3 ครั้งก่อนหน้า
    const recent = [...results].sort((a, b) => new Date(b.doneAt).getTime() - new Date(a.doneAt).getTime());
    const lastAvg = recent.slice(0, 3);
    const prevAvg = recent.slice(3, 6);
    const mAvg = (arr: UserResult[]) => arr.length ? arr.reduce((s, r) => s + r.percentage, 0) / arr.length : 0;
    const momentum = prevAvg.length ? Math.round(mAvg(lastAvg) - mAvg(prevAvg)) : 0;

    const didMock = mockSummaries.length > 0;

    return {
      total, avgScore, streak, subjectStats, bestSubject, weakSubjects, chart, daily,
      readiness, predictedScore, momentum, coverage, didMock, hasData,
    };
  }, [summaries, results, totalSets]);

  // ── แผนเรียนวันนี้ (ติวเตอร์ส่วนตัว — สมาชิกเท่านั้น) ────────────────────────
  const plan = useMemo(() => {
    if (courses.length === 0 || allExams.length === 0) return null;
    return buildStudyPlan({
      exams: allExams, summaries, videos, videoProgress: videoProg,
      daysLeft: planDaysLeft(),
    });
  }, [courses, allExams, summaries, videos, videoProg]);

  const examDoneToday = useMemo(() => {
    const today = dateKey(new Date());
    return results.some((r) => dateKey(new Date(r.doneAt)) === today);
  }, [results]);

  // ── Guards ──────────────────────────────────────────────────────────────────
  // useAccessGuard จัดการ: ไม่ login → /, ไม่ activate → /activate

  if (guard !== "allowed") return <AccessGuardSpinner />;

  // guard === "allowed" รับประกันว่า user ไม่ใช่ null
  const safeUser = user!;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-50 pb-28">

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
              <p className="text-[12px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#A8A8A6" }}>
                Dashboard ของฉัน
              </p>
              <p className="text-[17px] font-bold text-gray-900 truncate">
                {safeUser.displayName ?? "ผู้ใช้"}
              </p>
              <p className="text-[12px] truncate" style={{ color: "#A8A8A6" }}>
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
            {/* Logout */}
            <button
              onClick={handleSignOut}
              title="ออกจากระบบ"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-red-100"
              style={{ backgroundColor: "#FEF2F2" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">

        {/* ═══ คะแนนความพร้อมสอบ (hero) ════════════════════════════════ */}
        {(() => {
          const dLeft = daysToExam();
          const R = stats.readiness;
          const ring = 264 * (1 - R / 100);
          const rColor = R >= 70 ? "#5DCAA5" : R >= 45 ? "#FBBF24" : "#F87171";
          return (
            <div className="rounded-2xl p-5" style={{ backgroundColor: "#0B4F48" }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px]" style={{ color: "#9FE1CB" }}>ความพร้อมสอบของคุณ</span>
                {dLeft >= 0 && (
                  <span className="flex items-baseline gap-1 px-2.5 py-[3px] rounded-full"
                    style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                    <span className="text-[11px]" style={{ color: "#9FE1CB" }}>อีก</span>
                    <span className="text-[16px] font-extrabold leading-none" style={{ color: "#FBBF24" }}>{dLeft}</span>
                    <span className="text-[11px] text-white">วัน · {COUNTDOWN_LABEL}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0" style={{ width: 92, height: 92 }}>
                  <svg viewBox="0 0 100 100" style={{ width: 92, height: 92, transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="9" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={rColor} strokeWidth="9"
                      strokeLinecap="round" strokeDasharray="264" strokeDashoffset={ring}
                      style={{ transition: "stroke-dashoffset 900ms ease" }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[25px] font-extrabold text-white leading-none">
                      {stats.hasData ? `${R}%` : "—"}
                    </span>
                    <span className="text-[10.5px]" style={{ color: "#9FE1CB" }}>พร้อม</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {stats.hasData ? (
                    <p className="text-[13px] leading-relaxed mb-2.5" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {stats.momentum > 0 && (
                        <>เก่งขึ้น <span style={{ color: "#9FE1CB" }}>+{stats.momentum}%</span> ช่วงหลัง · </>
                      )}
                      ถ้าสอบวันนี้คาดว่าได้ราว <span className="text-white font-bold">{stats.predictedScore}%</span>
                    </p>
                  ) : (
                    <p className="text-[13px] leading-relaxed mb-2.5" style={{ color: "rgba(255,255,255,0.85)" }}>
                      เริ่มทำข้อสอบเพื่อดูคะแนนความพร้อมของคุณ
                    </p>
                  )}
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-lg px-2 py-1.5 text-center" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                      <div className="text-[14px] font-bold text-white leading-none">🔥 {stats.streak}</div>
                      <div className="text-[9.5px] mt-0.5" style={{ color: "#9FE1CB" }}>วันติด</div>
                    </div>
                    <div className="flex-1 rounded-lg px-2 py-1.5 text-center" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                      <div className="text-[14px] font-bold text-white leading-none">{stats.total}/{totalSets || "?"}</div>
                      <div className="text-[9.5px] mt-0.5" style={{ color: "#9FE1CB" }}>ชุดที่ทำ</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ Upsell: คนทดลอง → ปลดล็อก / App Only → อัปเกรด ═══════════ */}
        {!dataLoading && totalSets > 0 && courses.length === 0 && (
          <Link href="/packages"
            className="block rounded-2xl p-4 active:scale-[0.99] transition-transform"
            style={{ backgroundColor: "#FEF9EC", border: "1.5px solid #FCD34D" }}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[20px] flex-shrink-0"
                style={{ backgroundColor: "#FDE68A" }}>
                🔓
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 leading-snug">
                  ปลดล็อกอีก {Math.max(totalSets - freeSets, 0)} ชุดที่ยังล็อกอยู่
                </p>
                <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "#B45309" }}>
                  เห็นจุดอ่อน-จุดแข็งครบทุกหมวด + Smart Review เต็มระบบ · เริ่ม ฿{PRICING.app.price}
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#B45309"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        )}
        {!dataLoading && courses.length > 0 && !courses.some((c) => !isAppOnlyCourse(c.courseId)) && (
          <Link href="/checkout/upgrade"
            className="block rounded-2xl p-4 active:scale-[0.99] transition-transform bg-white"
            style={{ border: "1px solid #EBEBEA" }}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[20px] flex-shrink-0"
                style={{ backgroundColor: "#EBF5F3" }}>
                🎬
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 leading-snug">
                  อัปเกรดคอร์สเต็ม จ่ายเพิ่ม ฿{PRICING.upgradePrice}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>
                  วิดีโอติว 65 คลิป ~45 ชม. + ชีทสรุป ~500 หน้า
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        )}

        {/* ═══ เริ่มแบบติวเตอร์: ทำ Mock ประเมินตัวเองก่อน ═══════════════ */}
        {courses.length > 0 && !dataLoading && !stats.didMock && (
          <Link href="/mock-exam" className="block rounded-2xl p-4 active:scale-[0.99] transition-transform"
            style={{ backgroundColor: "#0B4F48" }}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[20px] flex-shrink-0"
                style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                🩺
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-white leading-snug">
                  เริ่มแบบติวเตอร์: ทำ Mock ประเมินตัวเองก่อน
                </p>
                <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "#9FE1CB" }}>
                  รู้จุดอ่อนทุกหมวดใน 1 ชุด → แผนเรียน + Daily Quiz จะเจาะจุดอ่อนคุณแม่นขึ้น
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#9FE1CB"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        )}

        {/* ═══ แผนของฉันวันนี้ (ติวเตอร์ส่วนตัว) ═══════════════════════ */}
        {plan && !dataLoading && (
          <div className="bg-white rounded-2xl p-4" style={{ border: "1.5px solid #C3E5DE" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#0B6E65" }}>
                🎯 แผนของฉันวันนี้
              </p>
              <span className="text-[12px] font-semibold" style={{ color: "#B45309" }}>
                เหลือ {plan.daysLeft} วัน · {PLAN_TARGET_LABEL}
              </span>
            </div>

            <div className="space-y-2">
              {/* 1. Daily Quiz */}
              <Link href="/daily" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                style={{ backgroundColor: dailyDone ? "#F7FDF9" : "#FAFAF8", border: `1px solid ${dailyDone ? "#BBF7D0" : "#EBEBEA"}` }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                  style={dailyDone ? { backgroundColor: "#DCFCE7", color: "#15803D" } : { border: "2px solid #D4D4D0", color: "transparent" }}>
                  ✓
                </span>
                <span className="flex-1 text-[13px] font-semibold"
                  style={{ color: dailyDone ? "#6B7280" : "#1F2937", textDecoration: dailyDone ? "line-through" : "none" }}>
                  🔥 Daily Quiz เจาะจุดอ่อน 10 ข้อ
                </span>
              </Link>

              {/* 2. ชุดแนะนำจากหมวดอ่อน */}
              {plan.suggestedExam ? (
                <Link href={`/exam/${plan.suggestedExam.id}`} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ backgroundColor: examDoneToday ? "#F7FDF9" : "#FAFAF8", border: `1px solid ${examDoneToday ? "#BBF7D0" : "#EBEBEA"}` }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                    style={examDoneToday ? { backgroundColor: "#DCFCE7", color: "#15803D" } : { border: "2px solid #D4D4D0", color: "transparent" }}>
                    ✓
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold truncate" style={{ color: "#1F2937" }}>
                      📝 {plan.suggestedExam.title}
                    </span>
                    <span className="block text-[11.5px]" style={{ color: "#B45309" }}>
                      {plan.suggestedIsRetry ? "ทำซ้ำเก็บคะแนน" : "ชุดใหม่"}
                      {plan.focusSubject ? ` · หมวดอ่อนของคุณ: ${SUBJECT_DISPLAY[plan.focusSubject] ?? plan.focusSubject}` : ""}
                    </span>
                  </span>
                </Link>
              ) : (
                <Link href="/review" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ backgroundColor: "#F7FDF9", border: "1px solid #BBF7D0" }}>
                  <span className="text-[13px] font-semibold" style={{ color: "#15803D" }}>
                    👏 ทำครบทุกชุดแล้ว — วนทบทวนข้อที่เคยผิดต่อ
                  </span>
                </Link>
              )}

              {/* 3. คลิปถัดไป (คอร์สเต็ม) */}
              {plan.nextClip && (
                <Link href="/videos" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ backgroundColor: "#FAFAF8", border: "1px solid #EBEBEA" }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#EBF5F3" }}>
                    <svg viewBox="0 0 24 24" fill="#0B6E65" className="w-2.5 h-2.5">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold truncate" style={{ color: "#1F2937" }}>
                      🎬 {plan.nextClip.title}
                    </span>
                    <span className="block text-[11.5px]" style={{ color: "#A8A8A6" }}>
                      คลิปถัดไปของคุณ{plan.nextClip.duration ? ` · ${plan.nextClip.duration}` : ""}
                    </span>
                  </span>
                </Link>
              )}
            </div>

            <p className="text-[11.5px] mt-3 leading-relaxed" style={{ color: "#A8A8A6" }}>
              ค้างอีก {plan.setsRemaining} ชุด{plan.clipsRemaining > 0 ? ` · ${plan.clipsRemaining} คลิป` : ""}
              {" "}→ เฉลี่ยวันละ {plan.perDaySets} ชุด{plan.clipsRemaining > 0 ? ` + ${plan.perDayClips} คลิป` : ""} ก็ทันสอบ
            </p>
          </div>
        )}

        {/* ═══ ทำตอนนี้เพื่อขยับความพร้อม ══════════════════════════════ */}
        {(() => {
          const weakest = [...stats.subjectStats].sort((a, b) => a.avg - b.avg)[0];
          const showWeak = weakest && weakest.avg < 70;
          const showMock = !stats.didMock;
          if (!showWeak && wrongCount === 0 && !showMock) return null;
          return (
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                </svg>
                <span className="text-[13px] font-bold text-gray-800">ทำตอนนี้เพื่อขยับความพร้อม</span>
              </div>
              <div className="space-y-2.5">
                {showWeak && (
                  <Link href="/exams"
                    className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 active:scale-[0.99] transition-transform"
                    style={{ border: "1px solid #EBEBEA" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FEF2F2" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 truncate">จุดอ่อน: {getSubjectShort(weakest.subject)}</p>
                      <p className="text-[11.5px]" style={{ color: "#A8A8A6" }}>เฉลี่ย {weakest.avg}% · ต่ำสุดในทุกหมวด</p>
                    </div>
                    <span className="text-[12px] flex-shrink-0" style={{ color: "#0B6E65" }}>ฝึกเลย ›</span>
                  </Link>
                )}
                {wrongCount > 0 && (
                  <Link href="/review"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 active:scale-[0.99] transition-transform"
                    style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F59E0B" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold" style={{ color: "#92400E" }}>ทบทวนข้อที่เคยผิด</p>
                      <p className="text-[11.5px]" style={{ color: "#B45309" }}>มี {wrongCount} ข้อรอทบทวน</p>
                    </div>
                    <span className="text-[12px] flex-shrink-0" style={{ color: "#B45309" }}>ทบทวน ›</span>
                  </Link>
                )}
                {showMock && (
                  <Link href="/mock-exam"
                    className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 active:scale-[0.99] transition-transform"
                    style={{ border: "1px solid #EBEBEA" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EBF5F3" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 truncate">ยังไม่เคยลอง Mock Exam</p>
                      <p className="text-[11.5px]" style={{ color: "#A8A8A6" }}>วัดความพร้อมจริงแบบจับเวลา</p>
                    </div>
                    <span className="text-[12px] flex-shrink-0" style={{ color: "#0B6E65" }}>เริ่ม ›</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })()}

        {/* ═══ เรียนต่อ (Continue) ═════════════════════════════════════ */}
        {continueTarget && (
          <div className="space-y-2.5">
            {continueTarget && (
              <Link
                href={`/exam/${continueTarget.examId}`}
                className="block bg-white rounded-2xl px-4 py-4 active:scale-[0.99] transition-transform"
                style={{ border: "1.5px solid #0B6E65" }}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#0B6E65" }}>
                    <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-bold uppercase tracking-wider mb-0.5"
                      style={{ color: "#0B6E65" }}>
                      {continueTarget.type === "resume" ? "ทำต่อจากที่ค้างไว้" : "พิชิตชุดที่ยังไม่ผ่าน"}
                    </p>
                    <p className="text-[14.5px] font-bold text-gray-900 truncate">
                      {continueTarget.title}
                    </p>
                    <p className="text-[12.5px] mt-0.5" style={{ color: "#A8A8A6" }}>
                      {continueTarget.type === "resume"
                        ? `ตอบแล้ว ${continueTarget.done}/${continueTarget.total} ข้อ`
                        : `รอบที่แล้วได้ ${continueTarget.pct}% — อีก ${Math.max(60 - (continueTarget.pct ?? 0), 1)}% ถึงเกณฑ์ผ่าน`}
                    </p>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="w-5 h-5 flex-shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* ═══ Subject progress ════════════════════════════════════════ */}
        {stats.subjectStats.length > 0 && (
          <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>

            {/* Header + legend */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">
                  ความก้าวหน้ารายวิชา
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>
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
                    <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>{label}</span>
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
                          <span className="text-[13px] font-semibold text-gray-800 truncate">
                            {subject}
                          </span>
                          {count > 1 && (
                            <span
                              className="text-[12px] flex-shrink-0"
                              style={{ color: "#C4C4C0" }}
                            >
                              {count} ชุด
                            </span>
                          )}
                        </div>
                        {/* Right: badge + score */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="text-[12px] font-bold px-2.5 py-[4px] rounded-full"
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
                <span className="text-[12px]" style={{ color: "#A8A8A6" }}>
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
              <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">
                คอร์สของฉัน
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>
                {courses.length > 0 ? `${courses.length} คอร์สที่เปิดใช้งาน` : "ยังไม่มีคอร์ส"}
              </p>
            </div>
            <Link
              href="/activate"
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-all"
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
              <p className="text-[13px] font-semibold text-gray-700 mb-1">ยังไม่มีคอร์สที่เปิดใช้งาน</p>
              <p className="text-[12px] mb-4" style={{ color: "#A8A8A6" }}>
                ใช้ Activation Code เพื่อปลดล็อกคอร์ส
              </p>
              <Link
                href="/activate"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold
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
                    <p className="text-[13.5px] font-semibold text-gray-900 truncate">{c.courseName}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>
                      Code: <span className="font-mono">{c.activationCode}</span>
                      {" · "}เปิดใช้{" "}
                      {c.activatedAt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                    </p>
                  </div>
                  <span
                    className="text-[12px] font-bold px-2 py-1 rounded-full flex-shrink-0"
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
                <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">
                  บันทึกของฉัน
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>
                  {summaries.length} ชุดข้อสอบ · เรียงจากล่าสุด
                </p>
              </div>
              {/* Pass summary chips */}
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[12px] font-semibold px-2 py-[3px] rounded-full"
                  style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
                >
                  ✓ {summaries.filter((s) => s.percentage >= 60).length}
                </span>
                <span
                  className="text-[12px] font-semibold px-2 py-[3px] rounded-full"
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
            <p className="text-[15px] font-semibold text-gray-800 mb-1">ยังไม่มีประวัติการสอบ</p>
            <p className="text-[13px] mb-5" style={{ color: "#A8A8A6" }}>
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
