"use client";
/**
 * TodayPlanCard — "การ์ดโค้ช" ใบเดียวบนหน้าแรก (สมาชิกเท่านั้น)
 *
 * สไตล์ตามระบบเดิมของแอป (Aj รีวิว 2026-07-14: ลดอีโมจิ ใช้หัวข้อเทา
 * uppercase + ไอคอน SVG แบบเดียวกับหน้าอื่น): ทักทายครูอ้อมเป็นหัวการ์ด →
 * เช็คลิสต์วันนี้ + ตัวนับ → ท้ายการ์ด framing บวก "ทำไปแล้ว a/b"
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getUserCourses } from "@/lib/activation";
import { isAppOnlyCourse } from "@/lib/access";
import { getUserSummaries, getRecentResults } from "@/lib/user-firestore";
import { getPublishedExams } from "@/lib/firestore";
import { getPublishedVideos, type CourseVideo } from "@/lib/video-firestore";
import { getAllVideoProgress, type VideoProgress } from "@/lib/video-progress";
import {
  buildStudyPlan, getDailyDoneToday, getDailyStreakClient, bkkTodayClient, type StudyPlan,
} from "@/lib/coach";
import { planDaysLeft, PLAN_TARGET_LABEL } from "@/lib/exam-config";
import { pickGreeting, type Greeting } from "@/lib/greeting";
import { normalizeSubject, SUBJECT_DISPLAY } from "@/lib/types";
import { BRAND } from "@/lib/subjects";

interface PlanData {
  plan:          StudyPlan;
  didMock:       boolean;
  dailyDone:     boolean;
  examDoneToday: boolean;
  streak:        number;
  greeting:      Greeting;
}

/** แถวเช็คลิสต์: วงติ๊ก + เนื้อหา + chevron — โทนเดียวกับลิสต์อื่นในแอป */
function Row({ href, done, title, sub, subColor }: {
  href: string; done: boolean; title: string; sub?: string; subColor?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl px-3.5 py-3 active:scale-[0.99] transition-transform"
      style={{ backgroundColor: done ? "#F7FDF9" : "#FAFAF8", border: `1px solid ${done ? "#BBF7D0" : "#EBEBEA"}` }}>
      <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={done ? { backgroundColor: "#DCFCE7" } : { border: "2px solid #D4D4D0" }}>
        {done && (
          <svg viewBox="0 0 24 24" fill="none" stroke="#15803D"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold truncate"
          style={{ color: done ? "#9CA3AF" : "#1F2937", textDecoration: done ? "line-through" : "none" }}>
          {title}
        </span>
        {sub && (
          <span className="block text-[12.5px] mt-0.5" style={{ color: subColor ?? "#A8A8A6" }}>
            {sub}
          </span>
        )}
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="#C4C4C0"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

function MiniBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className="inline-block align-middle w-14 h-[5px] rounded-full overflow-hidden ml-1.5"
      style={{ backgroundColor: "#F0EFEC" }}>
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: BRAND.primary }} />
    </span>
  );
}

export default function TodayPlanCard({ onVisible }: { onVisible?: (v: boolean) => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<PlanData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hide = () => { if (!cancelled) { setData(null); onVisible?.(false); } };
    if (!user) { hide(); return; }
    (async () => {
      try {
        const [courses, summaries, exams, results] = await Promise.all([
          getUserCourses(user.uid),
          getUserSummaries(user.uid),
          getPublishedExams(),
          getRecentResults(user.uid, 10),
        ]);
        if (courses.length === 0) { hide(); return; } // ไม่ใช่สมาชิก — หน้าแรกมีการ์ดชวนอยู่แล้ว

        const full = courses.some((c) => !isAppOnlyCourse(c.courseId));
        const [videos, vprog, dailyDone, streak] = await Promise.all([
          full ? getPublishedVideos().catch(() => [] as CourseVideo[]) : Promise.resolve([] as CourseVideo[]),
          full ? getAllVideoProgress(user.uid).catch(() => new Map<string, VideoProgress>())
               : Promise.resolve(new Map<string, VideoProgress>()),
          getDailyDoneToday(user.uid),
          getDailyStreakClient(user.uid),
        ]);

        const plan    = buildStudyPlan({ exams, summaries, videos, videoProgress: vprog, daysLeft: planDaysLeft() });
        const didMock = summaries.some((s) => normalizeSubject(s.subject) === "MOCK");
        const t = new Date(); t.setHours(0, 0, 0, 0);
        const examDoneToday = results.some((r) => {
          const d = new Date(r.doneAt); d.setHours(0, 0, 0, 0);
          return d.getTime() === t.getTime();
        });

        // ทักทายตามพฤติกรรม — daysSince จากผลสอบล่าสุด
        let daysSince: number | null = null;
        if (results[0]?.doneAt) {
          const b = new Date(results[0].doneAt); b.setHours(0, 0, 0, 0);
          daysSince = Math.round((t.getTime() - b.getTime()) / 86_400_000);
        }
        const greeting = pickGreeting(user.uid, bkkTodayClient(), daysSince);

        if (!cancelled) { setData({ plan, didMock, dailyDone, examDoneToday, streak, greeting }); onVisible?.(true); }
      } catch { hide(); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!data) return null;
  const { plan, didMock, dailyDone, examDoneToday, streak, greeting } = data;

  // ตัวนับวันนี้ — นับเฉพาะรายการที่ติ๊กได้ (Mock [ถ้าโชว์] / Daily / ชุดข้อสอบ)
  const items: boolean[] = [...(!didMock ? [false] : []), dailyDone, examDoneToday];
  const doneCount = items.filter(Boolean).length;
  const allDone   = doneCount === items.length;

  const setsDone  = plan.setsTotal  - plan.setsRemaining;
  const clipsDone = plan.clipsTotal - plan.clipsRemaining;

  return (
    <div className="bg-white rounded-2xl p-5 mb-4" style={{ border: "1px solid #C3E5DE" }}>

      {/* ── ครูอ้อมทักทาย — หัวข้อเทาแบบเดียวกับ section อื่นทั้งแอป ─────── */}
      <div className="pb-3.5 mb-3.5" style={{ borderBottom: "1px solid #F3F2F0" }}>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          ครูอ้อมทักทาย
        </p>
        <p className="text-[14.5px] leading-relaxed text-gray-800">
          {greeting.text}
        </p>
      </div>

      {/* ── หัวแผน + ตัวนับ ─────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">
          แผนของฉันวันนี้
        </p>
        {allDone ? (
          <span className="text-[13.5px] font-bold" style={{ color: "#15803D" }}>✓ ครบแล้ว</span>
        ) : (
          <span className="text-[13.5px]" style={{ color: "#A8A8A6" }}>
            เสร็จแล้ว <span className="font-extrabold text-[15px]" style={{ color: BRAND.primary }}>{doneCount}</span>/{items.length}
          </span>
        )}
      </div>

      {/* แถบความคืบหน้าวันนี้ */}
      <div className="h-[6px] rounded-full overflow-hidden mb-2" style={{ backgroundColor: "#F0EFEC" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%`, backgroundColor: allDone ? "#15803D" : BRAND.primary }} />
      </div>
      <div className="flex items-center gap-2 text-[13px] mb-3.5" style={{ color: "#A8A8A6" }}>
        <span>เหลือ <span className="font-bold" style={{ color: "#B45309" }}>{plan.daysLeft}</span> วัน · {PLAN_TARGET_LABEL}</span>
        {streak > 0 && (
          <>
            <span className="opacity-50">·</span>
            <span className="font-semibold" style={{ color: "#EA580C" }}>🔥 {streak} วันติด</span>
          </>
        )}
      </div>

      {/* ── เช็คลิสต์ ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {!didMock && (
          <Row href="/mock-exam" done={false}
            title="ทำ Mock Exam ประเมินตัวเอง"
            sub="รู้จุดอ่อนทุกหมวดใน 1 ชุด — แผนจะเจาะจุดอ่อนคุณแม่นขึ้น" />
        )}

        <Row href="/daily" done={dailyDone}
          title="Daily Quiz เจาะจุดอ่อน 10 ข้อ"
          sub={dailyDone ? undefined : "ชุดใหม่ทุกวัน · เก็บ streak ต่อเนื่อง"} />

        {plan.suggestedExam ? (
          <Row href={`/exam/${plan.suggestedExam.id}`} done={examDoneToday}
            title={plan.suggestedExam.title}
            sub={`${plan.suggestedIsRetry ? "ทำซ้ำเก็บคะแนน" : "ชุดใหม่"}${plan.focusSubject ? ` · หมวดอ่อนของคุณ: ${SUBJECT_DISPLAY[plan.focusSubject] ?? plan.focusSubject}` : ""}`}
            subColor="#B45309" />
        ) : (
          <Row href="/review" done={examDoneToday}
            title="ทำครบทุกชุดแล้ว — ทบทวนข้อที่เคยผิดต่อ" />
        )}

        {plan.nextClip && (
          <Link href="/videos" className="flex items-center gap-3 rounded-xl px-3.5 py-3 active:scale-[0.99] transition-transform"
            style={{ backgroundColor: "#FAFAF8", border: "1px solid #EBEBEA" }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#EBF5F3" }}>
              <svg viewBox="0 0 24 24" fill={BRAND.primary} className="w-2.5 h-2.5">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14.5px] font-semibold truncate" style={{ color: "#1F2937" }}>
                {plan.nextClip.title}
              </span>
              <span className="block text-[12.5px] mt-0.5" style={{ color: "#A8A8A6" }}>
                คลิปถัดไปของคุณ{plan.nextClip.duration ? ` · ${plan.nextClip.duration}` : ""}
              </span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="#C4C4C0"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        )}
      </div>

      {/* ── ความคืบหน้ารวม — framing บวก ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3.5 text-[13px]"
        style={{ color: "#6B7280", borderTop: "1px solid #F3F2F0" }}>
        <span>
          ทำแล้ว <span className="font-bold" style={{ color: BRAND.primary }}>{setsDone}/{plan.setsTotal}</span> ชุด
          <MiniBar done={setsDone} total={plan.setsTotal} />
        </span>
        {plan.clipsTotal > 0 && (
          <span>
            ดูแล้ว <span className="font-bold" style={{ color: BRAND.primary }}>{clipsDone}/{plan.clipsTotal}</span> คลิป
            <MiniBar done={clipsDone} total={plan.clipsTotal} />
          </span>
        )}
        <span style={{ color: "#A8A8A6" }}>
          วันละ {plan.perDaySets} ชุด{plan.clipsTotal > 0 ? ` + ${plan.perDayClips} คลิป` : ""} ก็ทันสอบ
        </span>
      </div>
    </div>
  );
}
