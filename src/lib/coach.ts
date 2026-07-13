/**
 * coach.ts — สมองของ "ติวเตอร์ส่วนตัว": คำนวณแผนเรียนจากของที่เหลือ + เวลาที่เหลือ
 *
 * หลักคิด (ตามที่ Aj กำหนด): แผนอ้างอิงจำนวนคลิป + ชุดข้อสอบ เทียบเวลาที่เหลือ
 * → บอก "วันนี้ต้องทำอะไร" (ชุดแนะนำจากหมวดอ่อนจริง + คลิปถัดไป + Daily Quiz)
 * ฟังก์ชันคำนวณเป็น pure ทั้งหมด — เทสง่าย ไม่ผูก Firebase (ยกเว้น getDailyDoneToday)
 */

import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { SUBJECTS, isMockExam, type Exam } from "./types";
import type { UserExamSummary } from "./user-firestore";
import type { CourseVideo } from "./video-firestore";
import type { VideoProgress } from "./video-progress";

export interface StudyPlan {
  daysLeft:       number;
  setsRemaining:  number;             // ชุด (ไม่รวม mock) ที่ยังไม่เคยทำ
  clipsRemaining: number;             // คลิปที่ยังดูไม่จบ (0 ถ้าไม่มีสิทธิ์วิดีโอ)
  perDaySets:     number;             // จังหวะขั้นต่ำต่อวันให้ทัน
  perDayClips:    number;
  focusSubject:   string | null;      // หมวดอ่อนสุดที่ยังมีชุดให้ทำ
  suggestedExam:  Exam | null;        // ชุดแนะนำวันนี้ (หมวดอ่อน: ยังไม่ทำก่อน → คะแนนต่ำสุด)
  suggestedIsRetry: boolean;          // ชุดแนะนำเป็นการทำซ้ำ (best < 60)
  nextClip:       CourseVideo | null; // คลิปถัดไปที่ยังไม่จบ
}

interface PlanInput {
  exams:         Exam[];                        // published ทั้งหมด
  summaries:     UserExamSummary[];             // ประวัติของผู้ใช้
  videos:        CourseVideo[];                 // [] ถ้าไม่ใช่คอร์สเต็ม
  videoProgress: Map<string, VideoProgress>;
  daysLeft:      number;
}

export function buildStudyPlan({ exams, summaries, videos, videoProgress, daysLeft }: PlanInput): StudyPlan {
  const days = Math.max(daysLeft, 1);
  const real = exams.filter((e) => !isMockExam(e));

  const doneMap = new Map(summaries.map((s) => [s.examId, s]));
  const notAttempted = real.filter((e) => !doneMap.has(e.id));

  // คะแนน best เฉลี่ยรายหมวด (ไม่รวม mock) — หาหมวดอ่อน
  const agg: Record<string, { sum: number; n: number }> = {};
  for (const s of summaries) {
    if (s.subject === "MOCK") continue;
    const pct = s.bestPercentage ?? s.percentage;
    (agg[s.subject] ??= { sum: 0, n: 0 });
    agg[s.subject].sum += pct;
    agg[s.subject].n++;
  }
  // หมวดเรียงจากอ่อนสุด; หมวดที่ยังไม่เคยแตะเลยถือว่า "อ่อนสุด" (avg = -1 ให้มาก่อน)
  const subjectOrder = SUBJECTS
    .filter((s) => s.code !== "MOCK")
    .map((s) => ({ code: s.code as string, avg: agg[s.code] ? agg[s.code].sum / agg[s.code].n : -1 }))
    .filter((s) => real.some((e) => e.subject === s.code)) // เฉพาะหมวดที่มีชุดจริง
    .sort((a, b) => a.avg - b.avg);

  // ชุดแนะนำ: ไล่หมวดอ่อน → ชุดที่ยังไม่ทำก่อน → ไม่มีก็ชุดที่ best ต่ำกว่า 60 (ทำซ้ำ)
  let suggestedExam: Exam | null = null;
  let suggestedIsRetry = false;
  let focusSubject: string | null = null;
  for (const { code } of subjectOrder) {
    const fresh = notAttempted.find((e) => e.subject === code);
    if (fresh) { suggestedExam = fresh; focusSubject = code; break; }
    const weakDone = real
      .filter((e) => e.subject === code)
      .map((e) => ({ e, best: doneMap.get(e.id)?.bestPercentage ?? doneMap.get(e.id)?.percentage ?? 100 }))
      .filter((x) => x.best < 60)
      .sort((a, b) => a.best - b.best)[0];
    if (weakDone) { suggestedExam = weakDone.e; suggestedIsRetry = true; focusSubject = code; break; }
  }

  // คลิปถัดไปที่ยังไม่จบ (เรียงตาม order อยู่แล้วจาก getPublishedVideos)
  const nextClip = videos.find((v) => !videoProgress.get(v.id)?.completed) ?? null;
  const clipsRemaining = videos.filter((v) => !videoProgress.get(v.id)?.completed).length;

  return {
    daysLeft,
    setsRemaining:  notAttempted.length,
    clipsRemaining,
    perDaySets:  Math.ceil(notAttempted.length / days),
    perDayClips: Math.ceil(clipsRemaining / days),
    focusSubject,
    suggestedExam,
    suggestedIsRetry,
    nextClip,
  };
}

/** วันนี้ (เวลาไทย) เป็น YYYY-MM-DD — ต้องตรงกับ doc id ที่ /api/daily เขียน */
export function bkkTodayClient(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

/** วันนี้ทำ Daily Quiz หรือยัง (อ่าน 1 doc — ถูกกว่ายิง /api/daily ที่ต้องจัดชุดคำถาม) */
export async function getDailyDoneToday(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "users", uid, "dailyQuiz", bkkTodayClient()));
    return snap.exists();
  } catch {
    return false;
  }
}
