/**
 * exam-client.ts — เรียก /api/exam/* จากฝั่ง client
 *
 * แทนการอ่าน exams/{id}/questions ตรงจาก Firestore (ถูกปิดใน rules แล้ว
 * เพราะเอกสารมี correctAnswer ติดมา — scrape ได้) — โจทย์ตอนทำข้อสอบไม่มีเฉลย
 * เฉลยได้หลังส่งคำตอบ (grade) หรือดึงทั้งชุดเมื่อมีสิทธิ์ (full: พิมพ์/ดูผลย้อนหลัง)
 */
import type { User } from "firebase/auth";
import type { Question } from "./types";

export class ExamApiError extends Error {
  constructor(public code: "locked" | "not-found" | "failed") { super(code); }
}

async function call(user: User, path: string, init?: RequestInit): Promise<Response> {
  const token = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) throw new ExamApiError("locked");
  if (res.status === 404) throw new ExamApiError("not-found");
  if (!res.ok)            throw new ExamApiError("failed");
  return res;
}

interface RawQ { qid: string; text: string; options: string[]; correctAnswer?: number; explanation?: string }

function toQuestion(q: RawQ, i: number): Question {
  return {
    id:            q.qid,
    order:         i + 1,
    text:          q.text,
    options:       q.options as [string, string, string, string],
    correctAnswer: q.correctAnswer ?? -1, // -1 = ยังไม่เปิดเฉลย
    explanation:   q.explanation ?? "",
  };
}

/** โจทย์สำหรับทำข้อสอบ — ไม่มีเฉลย (correctAnswer = -1 จนกว่าจะ grade) */
export async function fetchExamQuestions(user: User, examId: string): Promise<Question[]> {
  const res = await call(user, `/api/exam/${examId}/questions`);
  const d = await res.json();
  return (d.questions as RawQ[]).map(toQuestion);
}

export interface GradeResult {
  score:      number;
  total:      number;
  percentage: number;
  detail:     { qid: string; correctAnswer: number; explanation: string }[];
}

/** ส่งคำตอบให้ server ตรวจ — คืนคะแนน + เฉลยรายข้อ */
export async function gradeExam(user: User, examId: string, answers: number[]): Promise<GradeResult> {
  const res = await call(user, `/api/exam/${examId}/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  return res.json();
}

/** โจทย์พร้อมเฉลยทั้งชุด (พิมพ์ PDF / ดูผลย้อนหลัง) — ผู้มีสิทธิ์เท่านั้น */
export async function fetchExamFull(user: User, examId: string): Promise<Question[]> {
  const res = await call(user, `/api/exam/${examId}/full`);
  const d = await res.json();
  return (d.questions as RawQ[]).map(toQuestion);
}
