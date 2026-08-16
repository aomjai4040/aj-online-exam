/**
 * daily-server.ts — Daily Quiz ฝั่ง server (ใช้ใน /api/daily เท่านั้น)
 *
 * หลักการ: "เจาะจุดอ่อนรายคน" — เลือกหมวดที่ผู้ใช้ได้คะแนนต่ำสุดจากประวัติ
 * แล้วสุ่มข้อจากชุดในหมวดนั้น (deterministic ต่อ วัน+คน → refresh ไม่เปลี่ยนชุด)
 * คนไม่มีประวัติ → สุ่มกลางตามวันที่. เฉลยไม่ออกจาก server ก่อนส่งคำตอบ
 */

import "server-only";
import { FieldPath, type Firestore } from "firebase-admin/firestore";

export const QUIZ_SIZE = 10;

/** วันนี้ตามเวลาไทย เป็น YYYY-MM-DD (ใช้เป็น seed + doc id) */
export function bkkToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

// FNV-1a string hash → seed
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 PRNG — deterministic จาก seed
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyQuestion {
  qid:      string;
  text:     string;
  options:  string[];
}

export interface DailyPick {
  examId:    string;
  examTitle: string;
  subject:   string;
  focus:     "weak" | "general";              // weak = เจาะหมวดอ่อนของผู้ใช้คนนี้
  questions: DailyQuestion[];                 // ไม่มีเฉลย — ส่งให้ client ได้
  answerKey: Map<string, { correctAnswer: number; explanation: string }>; // ฝั่ง server เท่านั้น
}

function isMockLike(x: Record<string, unknown>): boolean {
  return x.isMock === true || String(x.subject ?? "") === "MOCK";
}

/** หมวดของผู้ใช้เรียงจากอ่อนสุด (คะแนน best เฉลี่ยต่ำสุด) — จาก users/{uid}/history */
async function subjectsWeakFirst(db: Firestore, uid: string): Promise<string[]> {
  const snap = await db.collection("users").doc(uid).collection("history").get();
  const agg: Record<string, { sum: number; n: number }> = {};
  snap.forEach((d) => {
    const x = d.data();
    const subj = String(x.subject ?? "");
    if (!subj || subj === "MOCK") return;
    const pct = Number(x.bestPercentage ?? x.percentage);
    if (!Number.isFinite(pct)) return;
    (agg[subj] ??= { sum: 0, n: 0 });
    agg[subj].sum += pct;
    agg[subj].n++;
  });
  return Object.entries(agg)
    .map(([s, { sum, n }]) => ({ s, avg: sum / n }))
    .sort((a, b) => a.avg - b.avg)
    .map((x) => x.s);
}

/** เลือกชุด + 10 ข้อของวันนั้น — เจาะหมวดอ่อนของ uid (deterministic ต่อ วัน+คน)
 *
 *  ownedPackageIds: courseId ทั้งหมดของผู้ใช้ — ใช้กรองชุดตาม "สนาม" ที่ซื้อ
 *  (Aj 2026-08-16: แต่ละสนามแยกขาด) ชุดไม่ผูก packageId = คลัง สป.สธ. เดิม
 *  ต้องมีคอร์สฝั่ง สป.สธ. (ไม่ใช่ dcd-) จึงเห็น · ชุดผูกแพ็ก = ต้องเป็นเจ้าของแพ็กนั้น */
export async function pickDaily(
  db: Firestore, dateStr: string, uid?: string, ownedPackageIds?: string[]
): Promise<DailyPick | null> {
  const owned     = ownedPackageIds ?? [];
  const hasLegacy = ownedPackageIds === undefined // ไม่ส่งมา = พฤติกรรมเดิม (เผื่อ caller อื่น)
    || owned.some((id) => !id.toLowerCase().startsWith("dcd-"));

  const snap = await db.collection("exams").where("isPublished", "==", true).get();
  let exams = snap.docs
    .filter((d) => !isMockLike(d.data()) && Number(d.data().questionCount ?? 0) >= 5)
    .filter((d) => {
      const pid = String(d.data().packageId ?? "");
      return pid ? owned.includes(pid) : hasLegacy;
    })
    .sort((a, b) => a.id.localeCompare(b.id)); // เรียงคงที่ ให้ index เสถียร
  if (exams.length === 0) return null;

  // เจาะหมวดอ่อน: ไล่จากหมวดที่คะแนนต่ำสุดที่ "มีชุดข้อสอบจริง"
  let focus: "weak" | "general" = "general";
  if (uid) {
    for (const s of await subjectsWeakFirst(db, uid)) {
      const inSubject = exams.filter((d) => String(d.data().subject ?? "") === s);
      if (inSubject.length > 0) { exams = inSubject; focus = "weak"; break; }
    }
  }

  // seed ต่อ วัน+คน → ชุดของแต่ละคนคงที่ทั้งวัน แต่ไม่จำเป็นต้องเหมือนคนอื่น
  const rng  = mulberry32(hashStr(uid ? `${dateStr}:${uid}` : dateStr));
  const exam = exams[Math.floor(rng() * exams.length)];

  const qSnap = await exam.ref.collection("questions").orderBy("order", "asc").get();
  const all = qSnap.docs;
  if (all.length === 0) return null;

  // seeded shuffle (Fisher–Yates) แล้วหยิบ QUIZ_SIZE ข้อแรก เรียงตามลำดับเดิม
  const idx = all.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const chosen = idx.slice(0, Math.min(QUIZ_SIZE, idx.length)).sort((a, b) => a - b);

  const questions: DailyQuestion[] = [];
  const answerKey = new Map<string, { correctAnswer: number; explanation: string }>();
  for (const i of chosen) {
    const d = all[i];
    const x = d.data();
    questions.push({ qid: d.id, text: String(x.text ?? ""), options: (x.options ?? []) as string[] });
    answerKey.set(d.id, {
      correctAnswer: Number(x.correctAnswer ?? -1),
      explanation:   String(x.explanation ?? ""),
    });
  }

  const e = exam.data();
  return {
    examId:    exam.id,
    examTitle: String(e.title ?? ""),
    subject:   String(e.subject ?? ""),
    focus,
    questions,
    answerKey,
  };
}

/** streak = จำนวนวันติดกันที่ทำ Daily Quiz (นับถอยจากวันนี้ หรือเมื่อวานถ้าวันนี้ยังไม่ทำ) */
export async function computeDailyStreak(
  db: Firestore, uid: string, today: string
): Promise<number> {
  // range ตาม doc id (YYYY-MM-DD) 60 วันย้อนหลัง — ใช้ index ปกติ ไม่ต้อง composite
  const dayMs = 86_400_000;
  const start = new Date(new Date(`${today}T00:00:00Z`).getTime() - 60 * dayMs)
    .toISOString().slice(0, 10);
  const snap = await db.collection("users").doc(uid).collection("dailyQuiz")
    .where(FieldPath.documentId(), ">=", start).get();
  const days = new Set(snap.docs.map((d) => d.id));
  let cur = new Date(`${today}T00:00:00Z`).getTime();
  if (!days.has(today)) cur -= dayMs; // วันนี้ยังไม่ทำ → เริ่มนับจากเมื่อวาน
  let streak = 0;
  while (days.has(new Date(cur).toISOString().slice(0, 10))) {
    streak++;
    cur -= dayMs;
  }
  return streak;
}
