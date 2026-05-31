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
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Exam, Question, ExamResult, ExamForm } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

// ─── Exams ───────────────────────────────────────────────────────────────────

export async function getPublishedExams(): Promise<Exam[]> {
  const q = query(
    collection(db, "exams"),
    where("isPublished", "==", true),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt), updatedAt: toDate(d.data().updatedAt) } as Exam));
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

export async function createExam(form: ExamForm): Promise<string> {
  const examRef = await addDoc(collection(db, "exams"), {
    title: form.title,
    description: form.description,
    subject: form.subject,
    timeLimit: form.timeLimit,
    isPublished: form.isPublished,
    questionCount: form.questions.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  form.questions.forEach((q, i) => {
    const qRef = doc(collection(db, "exams", examRef.id, "questions"));
    batch.set(qRef, { ...q, order: i });
  });
  await batch.commit();

  return examRef.id;
}

export async function updateExam(examId: string, form: ExamForm): Promise<void> {
  await updateDoc(doc(db, "exams", examId), {
    title: form.title,
    description: form.description,
    subject: form.subject,
    timeLimit: form.timeLimit,
    isPublished: form.isPublished,
    questionCount: form.questions.length,
    updatedAt: serverTimestamp(),
  });

  // Delete existing questions then re-create
  const existing = await getDocs(collection(db, "exams", examId, "questions"));
  const deleteBatch = writeBatch(db);
  existing.docs.forEach((d) => deleteBatch.delete(d.ref));
  await deleteBatch.commit();

  const addBatch = writeBatch(db);
  form.questions.forEach((q, i) => {
    const qRef = doc(collection(db, "exams", examId, "questions"));
    addBatch.set(qRef, { ...q, order: i });
  });
  await addBatch.commit();
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

// ─── Results ─────────────────────────────────────────────────────────────────

export async function saveResult(
  result: Omit<ExamResult, "id" | "submittedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "results"), {
    ...result,
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
