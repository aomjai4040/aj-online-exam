import {
  collection, doc, getDoc, setDoc, getDocs,
  addDoc, query, orderBy, limit,
  serverTimestamp, Timestamp, increment,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ExamRecord } from "./exam-history";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserExamSummary {
  examId:         string;
  examTitle:      string;
  subject:        string;
  score:          number;
  totalQuestions: number;
  percentage:     number;
  bestPercentage: number;
  attempts:       number;
  lastDoneAt:     string; // ISO string
}

export interface UserResult {
  id?:            string;
  examId:         string;
  examTitle:      string;
  subject:        string;
  score:          number;
  totalQuestions: number;
  percentage:     number;
  doneAt:         Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date)      return v;
  if (typeof v === "string")  return new Date(v);
  return new Date();
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Save an exam result for the user.
 * - Appends to `users/{uid}/results`
 * - Upserts summary in `users/{uid}/history/{examId}`
 */
export async function saveUserRecord(
  uid:  string,
  data: {
    examId:         string;
    examTitle:      string;
    subject:        string;
    score:          number;
    totalQuestions: number;
    percentage:     number;
  }
): Promise<void> {
  const summaryRef = doc(db, "users", uid, "history", data.examId);

  // Read existing summary to compute running best score
  const existing      = await getDoc(summaryRef);
  const prevBest      = (existing.data() as Partial<UserExamSummary> | undefined)?.bestPercentage ?? 0;
  const bestPercentage = Math.max(data.percentage, prevBest);

  // Append individual result
  await addDoc(collection(db, "users", uid, "results"), {
    ...data,
    doneAt: serverTimestamp(),
  });

  // Upsert per-exam summary (merge keeps existing fields we don't set here)
  await setDoc(summaryRef, {
    examId:         data.examId,
    examTitle:      data.examTitle,
    subject:        data.subject,
    score:          data.score,           // latest score
    totalQuestions: data.totalQuestions,
    percentage:     data.percentage,      // latest percentage
    bestPercentage,                       // max across all attempts
    lastDoneAt:     serverTimestamp(),
    attempts:       increment(1),
  }, { merge: true });
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Returns per-exam summaries as Record<examId, ExamRecord> for ExamCard badges. */
export async function getUserHistory(uid: string): Promise<Record<string, ExamRecord>> {
  const snap = await getDocs(collection(db, "users", uid, "history"));
  const out: Record<string, ExamRecord> = {};
  snap.docs.forEach((d) => {
    const x = d.data() as UserExamSummary;
    out[d.id] = {
      examId:         d.id,
      score:          x.score ?? 0,
      totalQuestions: x.totalQuestions ?? 0,
      percentage:     x.percentage ?? 0,
      doneAt:         toDate(x.lastDoneAt).toISOString(),
    };
  });
  return out;
}

/** Returns recent individual results for dashboard chart + streak. */
export async function getRecentResults(uid: string, n = 30): Promise<UserResult[]> {
  const q    = query(
    collection(db, "users", uid, "results"),
    orderBy("doneAt", "desc"),
    limit(n)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id:             d.id,
    ...(d.data() as Omit<UserResult, "id" | "doneAt">),
    doneAt:         toDate(d.data().doneAt),
  }));
}

/** Full summaries for dashboard stats per subject. */
export async function getUserSummaries(uid: string): Promise<UserExamSummary[]> {
  const snap = await getDocs(collection(db, "users", uid, "history"));
  return snap.docs.map((d) => ({
    ...(d.data() as UserExamSummary),
    lastDoneAt: toDate(d.data().lastDoneAt).toISOString(),
  }));
}

/** Total exam attempts for a user (sum of attempts across all exam summaries). */
export async function getUserTotalAttempts(uid: string): Promise<number> {
  const snap = await getDocs(collection(db, "users", uid, "history"));
  return snap.docs.reduce((sum, d) => sum + (Number(d.data().attempts) || 0), 0);
}
