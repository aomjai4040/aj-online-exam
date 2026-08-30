import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  deleteField,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Exam, Question, ExamResult, ExamForm, QuestionForm } from "./types";
import { examSetField } from "./exam-fields";

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

// ─── Exams ───────────────────────────────────────────────────────────────────

export async function getPublishedExams(): Promise<Exam[]> {
  // ไม่ใช้ orderBy ใน query เพื่อหลีกเลี่ยง composite index
  // เรียงลำดับใน JavaScript แทน
  const q = query(
    collection(db, "exams"),
    where("isPublished", "==", true)
  );
  const snap = await getDocs(q);
  const exams = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  } as Exam));
  return exams.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getAllExams(): Promise<Exam[]> {
  const q = query(collection(db, "exams"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt), updatedAt: toDate(d.data().updatedAt) } as Exam));
}

export async function getExam(id: string): Promise<Exam | null> {
  const snap = await getDoc(doc(db, "exams", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: snap.id, ...data, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) } as Exam;
}

// ─── Questions ───────────────────────────────────────────────────────────────

export async function getQuestions(examId: string): Promise<Question[]> {
  const q = query(
    collection(db, "exams", examId, "questions"),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question));
}

// ─── Create / Update Exam with Questions ─────────────────────────────────────

/** เตรียมข้อสอบ 1 ข้อก่อนเขียน — ตัดคีย์ที่เป็น undefined ออก
 *  (Firestore client SDK โยน error ถ้าเจอ undefined และเราไม่ได้เปิด
 *  ignoreUndefinedProperties) · tags ของข้อเก่าเป็น undefined ปกติ */
function questionDoc(q: QuestionForm, order: number): Record<string, unknown> {
  const out: Record<string, unknown> = {
    // กัน undefined ทุกช่อง — ค่า undefined ตัวเดียวทำให้ batch เขียนล้มทั้งก้อน
    text: q.text ?? "",
    options: (q.options ?? ["", "", "", ""]).map((o) => o ?? ""),
    correctAnswer: q.correctAnswer ?? 0,
    explanation: q.explanation ?? "",
    order,
  };
  if (q.tags && Object.values(q.tags).some((v) => v !== undefined && v !== "")) {
    out.tags = Object.fromEntries(
      Object.entries(q.tags).filter(([, v]) => v !== undefined && v !== "")
    );
  }
  return out;
}

export async function createExam(form: ExamForm): Promise<string> {
  const examRef = await addDoc(collection(db, "exams"), {
    title: form.title,
    description: form.description,
    subject: form.subject,
    timeLimit: form.timeLimit,
    isPublished: form.isPublished,
    isFree: form.isFree ?? false,
    isMock: form.isMock ?? false,
    ...(form.packageId ? { packageId: form.packageId } : {}),
    questionCount: form.questions.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  form.questions.forEach((q, i) => {
    const qRef = doc(collection(db, "exams", examRef.id, "questions"));
    batch.set(qRef, questionDoc(q, i));
  });
  await batch.commit();

  return examRef.id;
}

export async function updateExam(examId: string, form: ExamForm): Promise<void> {
  // ⚠️ เขียน "ตัวข้อสอบ" ก่อน แล้วค่อยเขียนเอกสารชุด — เดิมเขียนเอกสารชุดก่อน
  // ถ้าครึ่งข้อสอบพลาด updatedAt จะขยับทั้งที่เนื้อหาไม่ได้บันทึก (เคส 2026-08-30
  // "เซฟแล้วระบบไม่จำ" — ตรวจย้อนหลังแล้วหลอกว่าบันทึกสำเร็จครึ่งเดียว)

  // เขียนทับเอกสารเดิมตามตำแหน่ง เพื่อให้ question id คงเดิม —
  // ห้ามลบแล้วสร้างใหม่: id ใหม่ทั้งชุดทำให้คนที่กำลังทำข้อสอบค้างอยู่
  // ส่งตรวจแล้วจับคู่เฉลยไม่ได้ (correctAnswer = -1 รั่วเข้า Smart Review)
  const existing = await getDocs(
    query(collection(db, "exams", examId, "questions"), orderBy("order", "asc"))
  );
  // แบ่ง batch ละ ≤300 งาน กันชนลิมิต/ payload ใหญ่ (ชุด 100+ ข้อ)
  const jobs: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
  form.questions.forEach((q, i) => {
    const qRef = existing.docs[i]?.ref
      ?? doc(collection(db, "exams", examId, "questions"));
    jobs.push((b) => b.set(qRef, questionDoc(q, i)));
  });
  existing.docs.slice(form.questions.length).forEach((d) => jobs.push((b) => b.delete(d.ref)));
  for (let i = 0; i < jobs.length; i += 300) {
    const batch = writeBatch(db);
    jobs.slice(i, i + 300).forEach((fn) => fn(batch));
    await batch.commit();
  }

  await updateDoc(doc(db, "exams", examId), {
    title: form.title,
    description: form.description,
    subject: form.subject,
    timeLimit: form.timeLimit,
    isPublished: form.isPublished,
    isFree: form.isFree ?? false,
    isMock: form.isMock ?? false,
    // ไม่ผูกแพ็กเกจ = ลบฟิลด์ทิ้ง (สลับสนามกลับเป็น สป.สธ. แล้วต้องไม่ค้างค่า dcd-)
    packageId: form.packageId ? form.packageId : deleteField(),
    questionCount: form.questions.length,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteExam(examId: string): Promise<void> {
  const questions = await getDocs(collection(db, "exams", examId, "questions"));
  const batch = writeBatch(db);
  questions.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "exams", examId));
  await batch.commit();
}

export async function togglePublish(examId: string, isPublished: boolean): Promise<void> {
  await updateDoc(doc(db, "exams", examId), { isPublished, updatedAt: serverTimestamp() });
}

// ─── Create exam metadata only (no questions) ────────────────────────────────

export interface ExamMetaInput {
  title: string;
  description: string;
  subject: string;
  questionCount: number;
  timeLimit: number;   // minutes; 0 = no limit
  isPublished: boolean;
}

export async function createExamMeta(data: ExamMetaInput): Promise<string> {
  const ref = await addDoc(collection(db, "exams"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Import helpers ──────────────────────────────────────────────────────────

/** หา "ชุดเดิม" จากชื่อ — ระบุ field แล้วจะจับคู่เฉพาะชุดสนามเดียวกัน
 *  (บั๊ก Aj 2026-08-24: import Mock คร. ชื่อ "Mock Exam ชุดที่ 2" ไปต่อท้าย
 *  ชุด สป.สธ. ชื่อเดียวกัน — ห้ามต่อท้ายข้ามสนามอีก) */
export async function findExamByTitle(
  title: string, field?: "moph" | "dcd",
): Promise<Exam | null> {
  const q = query(collection(db, "exams"), where("title", "==", title), limit(10));
  const snap = await getDocs(q);
  const all = snap.docs.map((d) => ({
    id: d.id, ...d.data(),
    createdAt: toDate(d.data().createdAt), updatedAt: toDate(d.data().updatedAt),
  }) as Exam);
  if (!field) return all[0] ?? null;
  return all.find((e) => examSetField(e) === field) ?? null;
}

export async function appendQuestionsToExam(
  examId: string,
  questions: import("./types").QuestionForm[],
  currentCount: number,
): Promise<void> {
  const batch = writeBatch(db);
  questions.forEach((q, i) => {
    const qRef = doc(collection(db, "exams", examId, "questions"));
    batch.set(qRef, { ...q, order: currentCount + i });
  });
  await batch.commit();
  await updateDoc(doc(db, "exams", examId), {
    questionCount: currentCount + questions.length,
    updatedAt: serverTimestamp(),
  });
}

// ─── Results ─────────────────────────────────────────────────────────────────

export async function saveResult(
  result: Omit<ExamResult, "id" | "submittedAt">
): Promise<string> {
  // ตัด field ที่เป็น undefined ออก — Firestore client SDK throw ถ้าเจอ undefined
  const clean = Object.fromEntries(
    Object.entries(result).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(collection(db, "results"), {
    ...clean,
    submittedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getResult(resultId: string): Promise<ExamResult | null> {
  const snap = await getDoc(doc(db, "results", resultId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: snap.id, ...data, submittedAt: toDate(data.submittedAt) } as ExamResult;
}

export async function getResultsByExam(examId: string): Promise<ExamResult[]> {
  const q = query(
    collection(db, "results"),
    where("examId", "==", examId),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), submittedAt: toDate(d.data().submittedAt) } as ExamResult));
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/** Fetch all results for dashboard analytics (most-recent first, capped at 1,000) */
export async function getAllResults(): Promise<ExamResult[]> {
  const q = query(
    collection(db, "results"),
    orderBy("submittedAt", "desc"),
    limit(1000)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    submittedAt: toDate(d.data().submittedAt),
  } as ExamResult));
}
