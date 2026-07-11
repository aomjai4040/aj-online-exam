/**
 * smart-review.ts — คลังข้อที่เคยตอบผิดของผู้ใช้ (users/{uid}/wrongQuestions/{questionId})
 *
 * เก็บ snapshot ของโจทย์ไว้ในเอกสารเลย เพื่อให้หน้า /review ทำงานได้
 * แม้ชุดข้อสอบต้นทางถูกแก้/ลบ และไม่ต้อง fetch questions ซ้ำ
 * ตอบถูกในโหมดทบทวน → ลบออกจากคลัง (ถือว่าจำได้แล้ว)
 */

import {
  collection, doc, getDocs, setDoc, deleteDoc, getCountFromServer,
  query, orderBy, limit as qLimit, serverTimestamp, increment, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Exam, Question } from "./types";

export interface WrongQuestion {
  id:            string;   // questionId เดิม
  examId:        string;
  examTitle:     string;
  subject:       string;
  text:          string;
  options:       string[];
  correctAnswer: number;
  explanation:   string;
  wrongCount:    number;
  lastWrongAt:   Date;
}

function colRef(uid: string) {
  return collection(db, "users", uid, "wrongQuestions");
}

/**
 * บันทึกข้อที่ตอบผิด/ข้ามหลังส่งข้อสอบ (fire-and-forget จากหน้าสอบ)
 * ข้อที่ตอบถูกในรอบนี้: ถ้าเคยอยู่ในคลังจะถูกลบออก (ฝึกจนถูกแล้ว)
 */
export async function recordExamMistakes(
  uid:       string,
  exam:      Pick<Exam, "id" | "title" | "subject">,
  questions: Question[],
  answers:   number[],
): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  questions.forEach((q, i) => {
    const ref = doc(colRef(uid), q.id);
    if (answers[i] === q.correctAnswer) {
      jobs.push(deleteDoc(ref).catch(() => {})); // ถ้าไม่เคยผิดอยู่แล้วก็เงียบ ๆ
      return;
    }
    jobs.push(
      setDoc(ref, {
        examId:        exam.id,
        examTitle:     exam.title,
        subject:       exam.subject,
        text:          q.text,
        options:       q.options,
        correctAnswer: q.correctAnswer,
        explanation:   q.explanation ?? "",
        wrongCount:    increment(1),
        lastWrongAt:   serverTimestamp(),
      }, { merge: true }).catch(() => {})
    );
  });
  await Promise.all(jobs);
}

/** ดึงข้อที่เคยผิด เรียงผิดล่าสุดก่อน */
export async function getWrongQuestions(uid: string, max = 20): Promise<WrongQuestion[]> {
  const snap = await getDocs(query(colRef(uid), orderBy("lastWrongAt", "desc"), qLimit(max)));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id:            d.id,
      examId:        String(x.examId ?? ""),
      examTitle:     String(x.examTitle ?? ""),
      subject:       String(x.subject ?? ""),
      text:          String(x.text ?? ""),
      options:       Array.isArray(x.options) ? (x.options as string[]) : [],
      correctAnswer: Number(x.correctAnswer ?? 0),
      explanation:   String(x.explanation ?? ""),
      wrongCount:    Number(x.wrongCount ?? 1),
      lastWrongAt:   x.lastWrongAt instanceof Timestamp ? x.lastWrongAt.toDate() : new Date(),
    };
  });
}

/** จำนวนข้อค้างในคลัง (โชว์บน dashboard) */
export async function countWrongQuestions(uid: string): Promise<number> {
  const snap = await getCountFromServer(colRef(uid));
  return snap.data().count;
}

/** ตอบถูกในโหมดทบทวน → เอาออกจากคลัง */
export async function resolveWrongQuestion(uid: string, questionId: string): Promise<void> {
  await deleteDoc(doc(colRef(uid), questionId));
}
