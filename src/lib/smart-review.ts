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
import { getPublishedExams } from "./firestore";
import { examSetField, type ExamFieldKey } from "./exam-fields";

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
    // เฉลยไม่สมบูรณ์ (เช่น จับคู่เฉลยจาก server ไม่ได้) → ไม่เก็บเข้าคลัง
    // ไม่งั้นหน้า /review จะได้ข้อที่ตอบยังไงก็ผิดและไม่โชว์เฉลย
    if (!Number.isInteger(q.correctAnswer)
      || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) return;
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

/** ตัวกรอง "ข้อนี้มาจากชุดของสนาม field ไหม" — ใช้แยกคลังข้อผิดตามสนาม
 *  (Aj 2026-08-21: คนมี 2 คอร์สต้องไม่เห็นข้อผิด สป.สธ. ปนในคอร์ส คร.)
 *  ชุดที่หาไม่เจอแล้ว (ถูกลบ/ยังไม่เผยแพร่) นับเป็นคลัง สป.สธ. เดิม */
export async function wrongKeeperForField(field: ExamFieldKey): Promise<(examId: string) => boolean> {
  const all = await getPublishedExams();
  const m = new Map(all.map((e) => [e.id, examSetField(e)] as const));
  return (examId) => (m.get(examId) ?? "moph") === field;
}

/** ดึงข้อที่เคยผิด เรียงผิดล่าสุดก่อน · keep = กรองตามสนาม (ไม่ส่ง = ทุกสนาม) */
export async function getWrongQuestions(
  uid: string, max = 20, keep?: (examId: string) => boolean,
): Promise<WrongQuestion[]> {
  // มีตัวกรอง → ดึงเผื่อไว้ก่อนแล้วค่อยตัดเหลือ max (ข้อของอีกสนามจะถูกคัดออก)
  const snap = await getDocs(query(colRef(uid), orderBy("lastWrongAt", "desc"), qLimit(keep ? 300 : max)));
  return snap.docs.filter((d) => {
    // กันข้อมูลเก่าที่เฉลยเสีย (correctAnswer นอกช่วงตัวเลือก) หลุดมาแสดง
    const ca = d.data().correctAnswer;
    const opts = d.data().options;
    return Number.isInteger(ca) && ca >= 0 && Array.isArray(opts) && ca < opts.length;
  }).filter((d) => !keep || keep(String(d.data().examId ?? "")))
    .slice(0, max)
    .map((d) => {
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

/** จำนวนข้อค้างในคลัง (โชว์บน dashboard) · keep = นับเฉพาะสนาม (ไม่ส่ง = ทั้งหมด) */
export async function countWrongQuestions(
  uid: string, keep?: (examId: string) => boolean,
): Promise<number> {
  if (!keep) {
    const snap = await getCountFromServer(colRef(uid));
    return snap.data().count;
  }
  const snap = await getDocs(colRef(uid));
  return snap.docs.filter((d) => keep(String(d.data().examId ?? ""))).length;
}

/** ตอบถูกในโหมดทบทวน → เอาออกจากคลัง */
export async function resolveWrongQuestion(uid: string, questionId: string): Promise<void> {
  await deleteDoc(doc(colRef(uid), questionId));
}
