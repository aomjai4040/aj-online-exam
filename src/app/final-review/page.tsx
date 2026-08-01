"use client";
/**
 * /final-review — ติวโค้งสุดท้าย (ทบทวนรอบ 2) 1–14 ส.ค. 2569
 *
 * สมาชิก (คอร์สไหนก็ได้): แผนทวนรายวัน 14 วัน ปรับตามข้อมูลจริงของแต่ละคน
 *   วัน 1–10 เคลียร์ Smart Review + ชุดหมวดอ่อน + Daily Quiz + คลิปสรุปโค้งสุดท้าย
 *   วัน 11–13 Mock จับเวลา · วัน 14 พัก + เช็คลิสต์วันสอบ
 * คนไม่ล็อกอิน/ยังไม่ซื้อ: เห็นโครงแผน (read-only) + ปุ่มสมัคร — การตลาด
 * ก่อน 1 ส.ค.: นับถอยหลังเปิดแผน + ให้กำลังใจเรียนรอบแรกให้จบ
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";
import { PRICING, COURSE_RESOURCES } from "@/lib/pricing";
import { getUserCourses } from "@/lib/activation";
import { isFullCourse, isReviewCourse } from "@/lib/access";
import { getUserSummaries } from "@/lib/user-firestore";
import { getPublishedExams } from "@/lib/firestore";
import { getPublishedVideos, type CourseVideo } from "@/lib/video-firestore";
import { getAllVideoProgress, type VideoProgress } from "@/lib/video-progress";
import { countWrongQuestions } from "@/lib/smart-review";
import { buildStudyPlan, getDailyDoneToday, bkkTodayClient, type StudyPlan } from "@/lib/coach";
import { planDaysLeft } from "@/lib/exam-config";
import { normalizeSubject, SUBJECT_DISPLAY } from "@/lib/types";
import {
  frDays, frPhase, frDayNumber, frDaysUntilStart, frKind, frReviewQuota,
  isFinalLapChapter, FR_DAYS, type FRPhase,
} from "@/lib/final-review";

const ACCENT = "#0B6E65";
const LINE   = "#ECEBE9";
const MUTED  = "#A8A29E";
const CARD_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.05)";

// ─── ชิ้นส่วนเล็ก ─────────────────────────────────────────────────────────────

function FlameIcon({ size = 20, color = ACCENT }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      style={{ width: size, height: size }}>
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  );
}

/** แถวภารกิจของวันนี้ — done = ติ๊กเขียว+ขีดฆ่า */
function TaskRow({ href, done, title, sub }: {
  href: string; done?: boolean; title: string; sub?: string;
}) {
  return (
    <Link href={href}
      className="flex items-center gap-3 rounded-xl px-3.5 py-3 active:scale-[0.99] transition-transform"
      style={{ backgroundColor: done ? "#F7FDF9" : "#FAFAF8",
               border: `1px solid ${done ? "#BBF7D0" : "#EBEBEA"}` }}>
      <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={done ? { backgroundColor: "#DCFCE7" } : { border: "2px solid #D4D4D0" }}>
        {done && (
          <svg viewBox="0 0 24 24" fill="none" stroke="#15803D"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold truncate"
          style={{ color: done ? "#9CA3AF" : "#1F2937", textDecoration: done ? "line-through" : "none" }}>
          {title}
        </span>
        {sub && <span className="block text-[13px] mt-0.5" style={{ color: MUTED }}>{sub}</span>}
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="#C4C4C0"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

/** timeline 14 วัน — จุดไล่วัน: ผ่านแล้ว/วันนี้/ยังไม่ถึง + สีตามช่วง */
function DayTimeline({ currentDay }: { currentDay: number }) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {frDays().map((d) => {
          const past    = d.day < currentDay;
          const current = d.day === currentDay;
          const color = d.kind === "mock" ? "#B45309" : d.kind === "rest" ? "#6D28D9" : ACCENT;
          return (
            <div key={d.day}
              className="rounded-lg py-1.5 text-center text-[11.5px] font-bold"
              style={{
                backgroundColor: current ? color : past ? "#F0FDF4" : "#F7F7F5",
                color:           current ? "white" : past ? "#15803D" : "#B8B4AF",
                border: current ? "none" : `1px solid ${past ? "#BBF7D0" : LINE}`,
              }}>
              {past ? "✓" : d.day}
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2 text-[11px]" style={{ color: MUTED }}>
        <span><span style={{ color: ACCENT }}>●</span> วัน 1–10 ทบทวน</span>
        <span><span style={{ color: "#B45309" }}>●</span> วัน 11–13 Mock</span>
        <span><span style={{ color: "#6D28D9" }}>●</span> วัน 14 พัก</span>
      </div>
    </div>
  );
}

/** เช็คลิสต์เตรียมตัววันสอบ — ติ๊กเก็บใน localStorage เครื่องนั้น */
const EXAM_CHECK_KEY = "exam-day-checklist-v1";
const EXAM_CHECK_ITEMS = [
  "บัตรประชาชนตัวจริง (ไม่หมดอายุ)",
  "ดินสอ 2B, ยางลบ, ปากกา",
  "เช็คสถานที่สอบ + เลขห้อง/แถวที่นั่ง",
  "วางแผนเดินทาง เผื่อเวลาอย่างน้อย 1 ชั่วโมง",
  "ชุดสุภาพตามระเบียบการสอบ",
  "นอนให้พอ — ก่อน 4 ทุ่มคืนก่อนสอบ",
];

function ExamDayChecklist() {
  const [ticks, setTicks] = useState<boolean[]>(() => EXAM_CHECK_ITEMS.map(() => false));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(EXAM_CHECK_KEY) ?? "[]");
      if (Array.isArray(saved)) setTicks(EXAM_CHECK_ITEMS.map((_, i) => !!saved[i]));
    } catch { /* ignore */ }
  }, []);
  function toggle(i: number) {
    setTicks((prev) => {
      const next = prev.map((v, j) => (j === i ? !v : v));
      try { localStorage.setItem(EXAM_CHECK_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  const done = ticks.filter(Boolean).length;
  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${LINE}` }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[14px] font-bold text-gray-900">เช็คลิสต์วันสอบ 15 ส.ค.</p>
        <span className="text-[12px] font-semibold tabular-nums"
          style={{ color: done === EXAM_CHECK_ITEMS.length ? "#15803D" : MUTED }}>
          {done}/{EXAM_CHECK_ITEMS.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {EXAM_CHECK_ITEMS.map((item, i) => (
          <button key={i} onClick={() => toggle(i)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left active:scale-[0.99] transition-transform"
            style={{ backgroundColor: ticks[i] ? "#F7FDF9" : "#FAFAF8",
                     border: `1px solid ${ticks[i] ? "#BBF7D0" : "#EBEBEA"}` }}>
            <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={ticks[i] ? { backgroundColor: "#16A34A" } : { border: "2px solid #D4D4D0" }}>
              {ticks[i] && (
                <svg viewBox="0 0 24 24" fill="none" stroke="white"
                  strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span className="text-[13.5px] leading-snug"
              style={{ color: ticks[i] ? "#9CA3AF" : "#374151",
                       textDecoration: ticks[i] ? "line-through" : "none" }}>
              {item}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface MemberData {
  hasLap:     boolean;   // ดูคลิปโค้งสุดท้ายได้ (คอร์สเต็ม หรือแพ็กติวทบทวน 499)
  wrongCount: number;
  dailyDone:  boolean;
  plan:       StudyPlan;
  didMock:    boolean;
  lapClips:   CourseVideo[];               // คลิปบท "โค้งสุดท้าย"
  lapDone:    number;                       // ดูจบแล้วกี่คลิป
}

export default function FinalReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [member,  setMember]  = useState<MemberData | null>(null); // null = ไม่ใช่สมาชิก/ยังไม่ล็อกอิน

  const today = bkkTodayClient();
  const phase: FRPhase = frPhase(today);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setMember(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const courses = await getUserCourses(user.uid);
        if (courses.length === 0) { if (!cancelled) setMember(null); return; }
        const hasLap = courses.some((c) => isFullCourse(c.courseId) || isReviewCourse(c.courseId));

        const [summaries, exams, wrongCount, dailyDone, videos, vprog] = await Promise.all([
          getUserSummaries(user.uid),
          getPublishedExams(),
          countWrongQuestions(user.uid).catch(() => 0),
          getDailyDoneToday(user.uid),
          hasLap ? getPublishedVideos().catch(() => [] as CourseVideo[]) : Promise.resolve([] as CourseVideo[]),
          hasLap ? getAllVideoProgress(user.uid).catch(() => new Map<string, VideoProgress>())
                  : Promise.resolve(new Map<string, VideoProgress>()),
        ]);

        const plan = buildStudyPlan({ exams, summaries, videos, videoProgress: vprog, daysLeft: planDaysLeft() });
        const lapClips = videos.filter((v) => isFinalLapChapter(v.chapter));
        const lapDone  = lapClips.filter((v) => vprog.get(v.id)?.completed).length;
        const didMock  = summaries.some((s) => normalizeSubject(s.subject) === "MOCK");

        if (!cancelled) setMember({ hasLap, wrongCount, dailyDone, plan, didMock, lapClips, lapDone });
      } catch {
        if (!cancelled) setMember(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FAFAF9" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "#D0EDE9", borderTopColor: ACCENT }} />
      </div>
    );
  }

  // ═══ ไม่ใช่สมาชิก / ยังไม่ล็อกอิน — โครงแผน + ชวนสมัคร ═══════════════════════
  if (!member) {
    return (
      <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAFAF9" }}>
        <div className="max-w-lg mx-auto px-5 pt-10 space-y-4">
          <div className="bg-white rounded-[28px] p-7 text-center"
            style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "#EBF5F3" }}>
              <FlameIcon size={28} />
            </div>
            <h1 className="text-[21px] font-extrabold text-gray-900 mb-1">ติวโค้งสุดท้าย</h1>
            <p className="text-[13.5px] font-semibold mb-4" style={{ color: ACCENT }}>
              ทบทวนรอบ 2 · 1–14 ส.ค. · ก่อนสอบจริง 15 ส.ค.
            </p>
            <p className="text-[13.5px] leading-relaxed mb-5 max-w-xs mx-auto" style={{ color: "#57534E" }}>
              สมาชิกจะได้แผนทวนรายวันที่ปรับตามจุดอ่อนของแต่ละคน —
              เคลียร์ข้อที่เคยผิด ทวนหมวดที่คะแนนต่ำ คลิปสรุปชุดใหม่
              และ Mock จับเวลาเสมือนสนามจริง
            </p>

            {/* โครงแผน (read-only) */}
            <div className="text-left space-y-2 mb-6">
              {[
                ["วัน 1–10", "ทบทวน: เคลียร์ข้อที่เคยผิด + ชุดหมวดอ่อน + คลิปสรุป", ACCENT],
                ["วัน 11–13", "โหมดสนามสอบ: Mock Exam จับเวลาเต็มรูปแบบ", "#B45309"],
                ["วัน 14", "พักสมอง + เช็คลิสต์เตรียมตัววันสอบ", "#6D28D9"],
              ].map(([d, t, c]) => (
                <div key={d as string} className="flex items-center gap-3 rounded-xl px-3.5 py-3"
                  style={{ backgroundColor: "#FAFAF8", border: `1px solid ${LINE}` }}>
                  <span className="text-[12px] font-bold w-16 flex-shrink-0" style={{ color: c as string }}>{d}</span>
                  <span className="text-[13px] leading-snug" style={{ color: "#57534E" }}>{t}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              <Link href="/packages"
                className="block w-full py-3.5 rounded-2xl font-bold text-[15px] text-white
                           transition-transform active:scale-[0.98]"
                style={{ backgroundColor: ACCENT }}>
                สมัครเลย เริ่ม ฿{PRICING.app.price} — ทันติวโค้งสุดท้าย
              </Link>
              {!user && (
                <Link href="/login?from=%2Ffinal-review"
                  className="block w-full py-3 rounded-2xl font-semibold text-[14px] bg-white"
                  style={{ border: `1px solid ${LINE}`, color: "#44403C" }}>
                  มีบัญชีแล้ว? เข้าสู่ระบบ
                </Link>
              )}
              <Link href="/" className="block text-[13px] pt-1" style={{ color: MUTED }}>
                ← กลับหน้าหลัก
              </Link>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ═══ สมาชิก — ก่อนแผนเปิด (ตอนนี้–31 ก.ค.) ═══════════════════════════════════
  if (phase === "before") {
    const until = frDaysUntilStart(today);
    return (
      <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAFAF9" }}>
        <div className="max-w-lg mx-auto px-5 pt-10 space-y-4">
          <div className="bg-white rounded-[28px] p-7 text-center"
            style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "#EBF5F3" }}>
              <FlameIcon size={28} />
            </div>
            <span className="inline-block text-[12px] font-bold px-3 py-1 rounded-full mb-3"
              style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
              เปิดแผนใน {until} วัน — 1 ส.ค.นี้
            </span>
            <h1 className="text-[21px] font-extrabold text-gray-900 mb-1.5">ติวโค้งสุดท้าย</h1>
            <p className="text-[13.5px] font-semibold mb-4" style={{ color: ACCENT }}>
              แผนทวนรายวัน 14 วัน ปรับตามจุดอ่อนของคุณ
            </p>
            <p className="text-[13.5px] leading-relaxed mb-5 max-w-xs mx-auto" style={{ color: "#57534E" }}>
              ระหว่างนี้ตั้งใจเรียนเนื้อหาและฝึกข้อสอบให้ครบรอบแรกนะคะ
              เรียนจบก่อน ทวนรอบสองจะยิ่งแม่น 💪
            </p>
            <div className="text-left mb-6">
              <DayTimeline currentDay={0} />
            </div>
            <div className="space-y-2.5">
              {/* คลิปติวสรุปมาแล้ว — โชว์ตั้งแต่ก่อนแผนเปิด ไม่ต้องรอ 1 ส.ค. */}
              {member.hasLap && member.lapClips.length > 0 && (
                <Link href={`/videos?chapter=${encodeURIComponent("ติวโค้งสุดท้าย")}`}
                  className="block w-full py-3.5 rounded-2xl font-bold text-[15px] text-white
                             transition-transform active:scale-[0.98]"
                  style={{ backgroundColor: "#B45309" }}>
                  ▶ คลิปติวสรุปมาแล้ว {member.lapClips.length} คลิป — ดูเลย
                </Link>
              )}
              <Link href="/exams"
                className="block w-full py-3.5 rounded-2xl font-bold text-[15px] text-white
                           transition-transform active:scale-[0.98]"
                style={{ backgroundColor: ACCENT }}>
                ไปฝึกทำข้อสอบต่อ
              </Link>
              {member.wrongCount > 0 && (
                <Link href="/review"
                  className="block w-full py-3 rounded-2xl font-semibold text-[14px] bg-white"
                  style={{ border: `1px solid ${LINE}`, color: "#44403C" }}>
                  เริ่มเคลียร์ข้อที่เคยผิดล่วงหน้า ({member.wrongCount} ข้อ)
                </Link>
              )}
              {member.hasLap && COURSE_RESOURCES.reviewDocs !== "" && (
                <a href={COURSE_RESOURCES.reviewDocs} target="_blank" rel="noopener noreferrer"
                  className="block w-full py-3 rounded-2xl font-semibold text-[14px] bg-white"
                  style={{ border: `1px solid ${LINE}`, color: "#44403C" }}>
                  📄 ชีทประเด็นสำคัญ 20 เรื่อง (PDF)
                </a>
              )}
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ═══ สมาชิก — 15 ส.ค. เป็นต้นไป: วันสอบ ═══════════════════════════════════════
  if (phase === "exam-eve-passed") {
    return (
      <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAFAF9" }}>
        <div className="max-w-lg mx-auto px-5 pt-10 space-y-4">
          <div className="bg-white rounded-[28px] p-7 text-center"
            style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            <div className="text-[40px] mb-3">🍀</div>
            <h1 className="text-[21px] font-extrabold text-gray-900 mb-2">ถึงวันสอบแล้ว — โชคดีนะคะ!</h1>
            <p className="text-[14px] leading-relaxed max-w-xs mx-auto" style={{ color: "#57534E" }}>
              คุณเตรียมตัวมาดีแล้ว เชื่อมั่นในตัวเอง อ่านโจทย์ให้ครบ
              ข้อไหนไม่แน่ใจให้ข้ามไว้ก่อนแล้วค่อยวนกลับมา — ครูอ้อมเป็นกำลังใจให้ค่ะ
            </p>
          </div>
          <ExamDayChecklist />
        </div>
        <BottomNav />
      </div>
    );
  }

  // ═══ สมาชิก — ช่วงแผนเดิน (1–14 ส.ค.) ════════════════════════════════════════
  const day  = frDayNumber(today);
  const kind = frKind(day);
  const quota = frReviewQuota(member.wrongCount, day);
  const p = member.plan;
  const subjName = p.focusSubject
    ? (SUBJECT_DISPLAY[p.focusSubject] ?? p.focusSubject)
    : null;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAFAF9" }}>
      <div className="max-w-lg mx-auto px-5 pt-8 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#EBF5F3" }}>
            <FlameIcon size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-extrabold text-gray-900 leading-tight">ติวโค้งสุดท้าย</h1>
            <p className="text-[12.5px]" style={{ color: MUTED }}>
              วันที่ {day} จาก {FR_DAYS} · สอบจริง 15 ส.ค.
            </p>
          </div>
          <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{
              backgroundColor: kind === "mock" ? "#FDF6E9" : kind === "rest" ? "#F5F2FC" : "#EBF5F3",
              color:           kind === "mock" ? "#B45309" : kind === "rest" ? "#6D28D9" : ACCENT,
            }}>
            {kind === "mock" ? "โหมดสนามสอบ" : kind === "rest" ? "วันพักสมอง" : "ช่วงทบทวน"}
          </span>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${LINE}` }}>
          <DayTimeline currentDay={day} />
        </div>

        {/* ภารกิจวันนี้ */}
        {kind !== "rest" && (
          <div className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: MUTED }}>
              ภารกิจวันนี้
            </p>
            <div className="space-y-2">
              {kind === "mock" && (
                <TaskRow href="/mock-exam" done={false}
                  title="Mock Exam จับเวลาเสมือนจริง"
                  sub={member.didMock ? "รอบนี้ลองทำให้ดีกว่าครั้งก่อน" : "ครั้งแรกของคุณ — จัดเวลา 2 ชม.ให้เหมือนวันจริง"} />
              )}
              {member.wrongCount > 0 ? (
                <TaskRow href="/review" done={false}
                  title={`เคลียร์ข้อที่เคยผิด ~${quota} ข้อ`}
                  sub={`ค้างในคลัง ${member.wrongCount} ข้อ — เกลี่ยให้หมดก่อนวันที่ 13`} />
              ) : (
                <TaskRow href="/review" done
                  title="คลังข้อผิดว่างแล้ว เยี่ยมมาก!"
                  sub="ทำข้อสอบต่อได้เลย ข้อที่ผิดใหม่จะเข้ามารอที่นี่" />
              )}
              {kind === "review" && p.suggestedExam && (
                <TaskRow href={`/exam/${p.suggestedExam.id}`} done={false}
                  title={p.suggestedIsRetry ? `ทำซ้ำ: ${p.suggestedExam.title}` : p.suggestedExam.title}
                  sub={subjName ? `หมวดที่ควรเก็บเพิ่ม: ${subjName}` : undefined} />
              )}
              <TaskRow href="/daily" done={member.dailyDone}
                title="Daily Quiz วันนี้"
                sub={member.dailyDone ? "เก็บ streak แล้ววันนี้" : "10 ข้อ เจาะจุดอ่อนของคุณ"} />
            </div>
          </div>
        )}

        {/* วัน 14 — พัก + เช็คลิสต์ */}
        {kind === "rest" && (
          <div className="bg-white rounded-2xl p-6 text-center"
            style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            <div className="text-[36px] mb-2">🌿</div>
            <p className="text-[16px] font-bold text-gray-900 mb-1.5">วันนี้พักสมองนะคะ</p>
            <p className="text-[13.5px] leading-relaxed max-w-xs mx-auto" style={{ color: "#57534E" }}>
              คุณทวนมาครบแล้ว ความรู้อยู่ในหัวแล้ว วันนี้นอนให้พอ กินให้ดี
              เตรียมของตามเช็คลิสต์ด้านล่าง — พรุ่งนี้ไปคว้ามันมาค่ะ 💪
            </p>
          </div>
        )}

        {/* คลิปสรุปโค้งสุดท้าย */}
        {member.hasLap ? (
          member.lapClips.length > 0 ? (
            <Link href={`/videos?chapter=${encodeURIComponent("ติวโค้งสุดท้าย")}`}
              className="flex items-center gap-3.5 bg-white rounded-2xl px-4 py-4 active:scale-[0.98] transition-transform"
              style={{ border: `1.5px solid ${ACCENT}` }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: ACCENT }}>
                <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 ml-0.5">
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-gray-900">คลิปสรุปโค้งสุดท้าย</p>
                <p className="text-[12.5px]" style={{ color: member.lapDone === member.lapClips.length ? "#15803D" : MUTED }}>
                  {member.lapDone === member.lapClips.length
                    ? `✓ ดูครบ ${member.lapClips.length} คลิปแล้ว`
                    : `ดูแล้ว ${member.lapDone}/${member.lapClips.length} คลิป`}
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#C4C4C0"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ) : (
            <div className="rounded-2xl px-4 py-3.5 text-[13px]"
              style={{ backgroundColor: "#FDF6E9", color: "#92400E", border: "1px solid #FDE9C8" }}>
              🎬 คลิปสรุปชุดใหม่กำลังทยอยมาระหว่าง 1–14 ส.ค. — เช็คที่นี่ทุกวัน
            </div>
          )
        ) : (
          <Link href="/checkout/up-review"
            className="block rounded-2xl px-4 py-3.5 text-[13px] active:scale-[0.99] transition-transform"
            style={{ backgroundColor: "#FDF6E9", color: "#92400E", border: "1px solid #FDE9C8" }}>
            🎬 คลิปสรุปโค้งสุดท้ายอยู่ในแพ็กติวเข้ม 14 วัน — อัปเกรดจ่ายเพิ่มแค่ ฿{PRICING.upToReviewPrice} →
          </Link>
        )}

        {/* เอกสารติวทบทวน (แพ็ก 499 + คอร์สเต็ม) — โผล่เมื่อ Aj ใส่ลิงก์ใน pricing.ts */}
        {member.hasLap && COURSE_RESOURCES.reviewDocs !== "" && (
          <a href={COURSE_RESOURCES.reviewDocs} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3.5 bg-white rounded-2xl px-4 py-4
                       active:scale-[0.98] transition-transform"
            style={{ border: `1px solid ${LINE}` }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#EBF5F3" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT}
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-gray-900">ชีทประเด็นสำคัญ 20 เรื่อง</p>
              <p className="text-[12.5px]" style={{ color: MUTED }}>PDF ทยอยอัปเพิ่มตามวันติว — เช็คไฟล์ใหม่ทุกวัน (Google Drive)</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#C4C4C0"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        )}

        {/* เช็คลิสต์วันสอบ — โผล่ตั้งแต่วันที่ 12 */}
        {day >= 12 && <ExamDayChecklist />}

      </div>
      <BottomNav />
    </div>
  );
}
