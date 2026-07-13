"use client";
/**
 * TodayPlanCard — "เริ่มแบบติวเตอร์ (Mock ประเมินก่อน)" + "แผนของฉันวันนี้"
 * แสดงในหน้าแรก (ย้ายจาก dashboard ตามคำสั่ง Aj — เข้าแอปปุ๊บเห็นแผนทันที)
 * โหลดข้อมูลเองทั้งหมด · แสดงเฉพาะสมาชิก (มีคอร์ส) · ไม่ใช่สมาชิก = ไม่เรนเดอร์
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
import { buildStudyPlan, getDailyDoneToday, type StudyPlan } from "@/lib/coach";
import { planDaysLeft, PLAN_TARGET_LABEL } from "@/lib/exam-config";
import { normalizeSubject, SUBJECT_DISPLAY } from "@/lib/types";

interface PlanData {
  plan:          StudyPlan;
  didMock:       boolean;
  dailyDone:     boolean;
  examDoneToday: boolean;
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
        const [videos, vprog, dailyDone] = await Promise.all([
          full ? getPublishedVideos().catch(() => [] as CourseVideo[]) : Promise.resolve([] as CourseVideo[]),
          full ? getAllVideoProgress(user.uid).catch(() => new Map<string, VideoProgress>())
               : Promise.resolve(new Map<string, VideoProgress>()),
          getDailyDoneToday(user.uid),
        ]);

        const plan    = buildStudyPlan({ exams, summaries, videos, videoProgress: vprog, daysLeft: planDaysLeft() });
        const didMock = summaries.some((s) => normalizeSubject(s.subject) === "MOCK");
        const t = new Date(); t.setHours(0, 0, 0, 0);
        const examDoneToday = results.some((r) => {
          const d = new Date(r.doneAt); d.setHours(0, 0, 0, 0);
          return d.getTime() === t.getTime();
        });

        if (!cancelled) { setData({ plan, didMock, dailyDone, examDoneToday }); onVisible?.(true); }
      } catch { hide(); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!data) return null;
  const { plan, didMock, dailyDone, examDoneToday } = data;

  return (
    <div className="space-y-4 mb-4">

      {/* ── เริ่มแบบติวเตอร์: ทำ Mock ประเมินตัวเองก่อน ─────────────────── */}
      {!didMock && (
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

      {/* ── แผนของฉันวันนี้ ──────────────────────────────────────────────── */}
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
    </div>
  );
}
