/**
 * course-progress.ts — "ความคืบหน้าคอร์ส" คำนวณอัตโนมัติจากข้อมูลที่ระบบเก็บอยู่แล้ว
 * (Aj 2026-08-21: แทน checklist ที่น้องต้องติ๊กเอง + Aj ต้องอัพไฟล์)
 *
 *   คลิป     = users/{uid}/videoProgress  (completed = ดู ≥90%)
 *   ข้อสอบ   = users/{uid}/history        (เคยส่ง = นับ · <60% = โชว์แดงให้กลับไปทำใหม่)
 *   Mock     = history ของชุดที่เป็น Mock
 *
 * % รวม = คลิป 50 · ข้อสอบ 35 · Mock 15 (ส่วนที่คอร์สยังไม่มีของ เช่น ยังไม่มี Mock
 * จะถูกตัดออกและเกลี่ยน้ำหนักให้ส่วนที่เหลือ — ไม่ให้ % ค้างต่ำเพราะของยังไม่มา)
 *
 * การผูก "บท": คลิปใช้เลขนำหน้าชื่อบท ("3. พ.ร.บ.โรคติดต่อ" → 3)
 *   คร.   → ชุดข้อสอบผูกบทด้วยรหัสหมวด DCD_SUBJECTS (DDC=1 … RISKCOM=9)
 *   สป.สธ. → หมวดข้อสอบไม่ตรงกับบทคลิป — นับข้อสอบรวมทั้งคอร์ส ไม่แยกบท
 *
 * ไฟล์นี้ pure (ไม่แตะ Firestore) — ใช้ได้ทั้ง client และ API ฝั่ง admin
 */
import { DCD_SUBJECTS, isMockExam, normalizeSubject } from "./types";
import { DCD_CHAPTERS } from "./question-tags";
import type { ExamFieldKey } from "./exam-fields";

export const PASS_PCT = 60;
const W_CLIPS = 50, W_SETS = 35, W_MOCK = 15;

export interface ProgressVideo { id: string; chapter: string; order: number; title: string }
export interface ProgressExam  { id: string; subject: string; isMock?: boolean; title: string }
export interface ProgressDone  {
  /** videoId → completed / seconds */
  videos: Map<string, { completed: boolean; seconds: number }>;
  /** examId → best % */
  exams:  Map<string, { best: number; lastDoneAt?: Date }>;
}

export interface ChapterProgress {
  no:    number;
  title: string;
  clips: { done: number; total: number };
  sets:  { done: number; total: number; low: number }; // low = ส่งแล้วแต่ < PASS_PCT
  complete: boolean;
  /** ปลายทางเมื่อกด: คลิปแรกที่ยังไม่จบ → ชุดแรกที่ยังไม่ทำ → คลิปแรกของบท */
  href:  string | null;
}

export interface CourseProgress {
  pct:   number;
  clips: { done: number; total: number };
  sets:  { done: number; total: number; low: number };
  mock:  { done: number; total: number; best: number };
  chapters: ChapterProgress[];
  /** "ทำต่อ" — จุดที่ค้างล่าสุด */
  resume: { href: string; label: string } | null;
}

/** เลขบทจากชื่อบท "3. xxx" → 3 (ไม่มีเลข = null) */
export function chapterNoOf(chapter: string): number | null {
  const m = /^\s*(\d+)\s*[.)]/.exec(chapter);
  return m ? Number(m[1]) : null;
}

/** บทของชุดข้อสอบ (เฉพาะ คร. — รหัสหมวดตรงกับบท 1–9) */
export function examChapterNo(field: ExamFieldKey, subject: string): number | null {
  if (field !== "dcd") return null;
  const code = normalizeSubject(subject);
  const i = DCD_SUBJECTS.findIndex((s) => s.code === code && s.code !== "MOCK");
  return i === -1 ? null : i + 1;
}

export function buildCourseProgress(
  field: ExamFieldKey,
  videos: ProgressVideo[],
  exams:  ProgressExam[],
  done:   ProgressDone,
): CourseProgress {
  const vids  = [...videos].sort((a, b) => a.order - b.order);
  const mocks = exams.filter((e) => isMockExam(e));
  const sets  = exams.filter((e) => !isMockExam(e));

  const vDone = (v: ProgressVideo) => done.videos.get(v.id)?.completed === true;
  const eBest = (e: ProgressExam) => done.exams.get(e.id)?.best;

  // ── บท ──
  const titles = new Map<number, string>();
  if (field === "dcd") DCD_CHAPTERS.forEach((c, i) => titles.set(i + 1, c));
  for (const v of vids) {
    const no = chapterNoOf(v.chapter);
    if (no !== null && !titles.has(no)) titles.set(no, v.chapter);
  }
  const chapters: ChapterProgress[] = [...titles.keys()].sort((a, b) => a - b).map((no) => {
    const cv = vids.filter((v) => chapterNoOf(v.chapter) === no);
    const cs = sets.filter((e) => examChapterNo(field, e.subject) === no);
    const clipsDone = cv.filter(vDone).length;
    const setsDone  = cs.filter((e) => eBest(e) !== undefined).length;
    const low       = cs.filter((e) => { const b = eBest(e); return b !== undefined && b < PASS_PCT; }).length;
    const nextClip  = cv.find((v) => !vDone(v));
    const nextSet   = cs.find((e) => eBest(e) === undefined);
    const href = nextClip ? `/videos?v=${nextClip.id}`
      : nextSet ? `/exam/${nextSet.id}`
      : cv[0] ? `/videos?v=${cv[0].id}` : cs[0] ? `/exam/${cs[0].id}` : null;
    const total = cv.length + cs.length;
    return {
      no, title: titles.get(no)!,
      clips: { done: clipsDone, total: cv.length },
      sets:  { done: setsDone, total: cs.length, low },
      complete: total > 0 && clipsDone === cv.length && setsDone === cs.length,
      href,
    };
  });

  // ── รวม ──
  const clips = { done: vids.filter(vDone).length, total: vids.length };
  const setsP = {
    done: sets.filter((e) => eBest(e) !== undefined).length,
    total: sets.length,
    low:  sets.filter((e) => { const b = eBest(e); return b !== undefined && b < PASS_PCT; }).length,
  };
  const mockBest = Math.max(0, ...mocks.map((e) => eBest(e) ?? 0));
  const mock = { done: mocks.filter((e) => eBest(e) !== undefined).length, total: mocks.length, best: mockBest };

  // น้ำหนักเฉพาะส่วนที่ "มีของ" แล้วเกลี่ยใหม่
  const parts: { w: number; r: number }[] = [];
  if (clips.total > 0) parts.push({ w: W_CLIPS, r: clips.done / clips.total });
  if (setsP.total > 0) parts.push({ w: W_SETS,  r: setsP.done / setsP.total });
  if (mock.total  > 0) parts.push({ w: W_MOCK,  r: mock.done  / mock.total });
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  const pct = wSum > 0 ? Math.round(parts.reduce((s, p) => s + p.w * p.r, 0) / wSum * 100) : 0;

  // ── ทำต่อ: คลิปที่ดูค้าง (มี seconds แต่ยังไม่จบ) → คลิปถัดไปที่ยังไม่จบ → ชุดถัดไป → Mock ──
  let resume: CourseProgress["resume"] = null;
  const partial = vids.find((v) => { const p = done.videos.get(v.id); return p && !p.completed && p.seconds > 30; });
  const nextVid = vids.find((v) => !vDone(v));
  const nextSet = sets.find((e) => eBest(e) === undefined);
  const nextMock = mocks.find((e) => eBest(e) === undefined);
  if (partial)       resume = { href: `/videos?v=${partial.id}`, label: `ดูต่อ: ${partial.title}` };
  else if (nextVid)  resume = { href: `/videos?v=${nextVid.id}`, label: `คลิปถัดไป: ${nextVid.title}` };
  else if (nextSet)  resume = { href: `/exam/${nextSet.id}`,     label: `ทำข้อสอบ: ${nextSet.title}` };
  else if (nextMock) resume = { href: `/exam/${nextMock.id}`,    label: `ลอง Mock: ${nextMock.title}` };

  return { pct, clips, sets: setsP, mock, chapters, resume };
}
