/**
 * recall-firestore.ts — เก็บ "ความจำข้อสอบ" ที่สมาชิกช่วยกันส่งเข้ามา
 *
 * collections:
 *   recallSubmissions/{autoId}  — คำตอบที่ส่งเข้ามาทีละครั้ง (ไม่ทับของกัน เก็บทุกใบ)
 *   recallCounts/{no}           — ตัวนับสาธารณะว่าข้อนี้มีคนช่วยแล้วกี่ครั้ง
 *                                 ("new" = ข้อที่ไม่อยู่ในลิสต์ตั้งต้น)
 *
 * เจตนา: ไม่ merge อัตโนมัติ — Aj อ่านของทุกคนแล้วตัดสินใจเองที่ /admin/recall
 * เพราะเป็นข้อมูลจากความจำ ต้องมีคนตรวจก่อนเอาไปทำเฉลย
 */

import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, limit,
  orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { SubjectCode } from "./types";

export type RecallStatus     = "new" | "merged" | "rejected";
export type RecallConfidence = "sure" | "maybe";

export interface RecallSubmission {
  id:         string;
  /** เลขข้อในลิสต์ตั้งต้น — null = ข้อใหม่ที่ยังไม่มีในลิสต์ */
  no:         number | null;
  text:       string;
  options:    string[];
  answer:     string;
  subject:    SubjectCode | "";
  confidence: RecallConfidence;
  note:       string;
  userId:     string;
  userEmail:  string;
  userName:   string;
  status:     RecallStatus;
  createdAt:  Date | null;
}

export interface RecallInput {
  no:         number | null;
  text:       string;
  options:    string[];
  answer:     string;
  subject:    SubjectCode | "";
  confidence: RecallConfidence;
  note:       string;
}

const COL       = "recallSubmissions";
const COUNT_COL = "recallCounts";

function countId(no: number | null): string {
  return no === null ? "new" : String(no);
}

/** ส่งความจำ 1 ใบ + เพิ่มตัวนับสาธารณะของข้อนั้น */
export async function submitRecall(
  user: { uid: string; email: string | null; displayName: string | null },
  input: RecallInput,
): Promise<void> {
  await addDoc(collection(db, COL), {
    no:         input.no,
    text:       input.text.trim(),
    options:    input.options.map((o) => o.trim()).filter(Boolean),
    answer:     input.answer.trim(),
    subject:    input.subject,
    confidence: input.confidence,
    note:       input.note.trim(),
    userId:     user.uid,
    userEmail:  user.email       ?? "",
    userName:   user.displayName ?? "",
    status:     "new" as RecallStatus,
    createdAt:  serverTimestamp(),
  });

  // ตัวนับสาธารณะ — ให้ทุกคนเห็นว่าข้อไหนมีคนช่วยแล้ว (ดันให้ไปช่วยข้อที่ยังว่าง)
  const ref = doc(db, COUNT_COL, countId(input.no));
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) await updateDoc(ref, { count: increment(1) });
    else               await setDoc(ref, { count: 1 });
  } catch (e) {
    // ตัวนับพลาดไม่ควรทำให้การส่งล้มเหลว — ใบที่ส่งไปแล้วสำคัญกว่า
    console.warn("[recall] count update failed (non-fatal):", e);
  }
}

/** ตัวนับต่อข้อ — { "3": 2, "new": 11 } */
export async function getRecallCounts(): Promise<Record<string, number>> {
  const snap = await getDocs(collection(db, COUNT_COL));
  const out: Record<string, number> = {};
  snap.forEach((d) => { out[d.id] = (d.data().count as number) ?? 0; });
  return out;
}

/** ใบที่ผู้ใช้คนนี้ส่งเอง (rules ยอมให้อ่านเฉพาะของตัวเอง) */
export async function getMyRecalls(userId: string): Promise<RecallSubmission[]> {
  const snap = await getDocs(query(
    collection(db, COL),
    where("userId", "==", userId),
    limit(200),
  ));
  return snap.docs.map(toSubmission)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** ทั้งหมด — admin เท่านั้น */
export async function getAllRecalls(): Promise<RecallSubmission[]> {
  const snap = await getDocs(query(
    collection(db, COL),
    orderBy("createdAt", "desc"),
    limit(2000),
  ));
  return snap.docs.map(toSubmission);
}

export async function setRecallStatus(id: string, status: RecallStatus): Promise<void> {
  await updateDoc(doc(db, COL, id), { status });
}

// ─── คำตัดสินของ Aj ต่อเฉลยรายข้อ ────────────────────────────────────────────
//
// recallVerdicts/{no} — เฉลยที่ Aj ตรวจแล้ว (จะเอาไปทำชุดข้อสอบจริงต่อ)
// สมาชิกอ่านได้ (เห็นว่าข้อไหนครูอ้อมยืนยันแล้ว) แต่เขียนได้เฉพาะ admin

export type VerdictStatus = "confirmed" | "rejected";

export interface RecallVerdict {
  no:     number;
  status: VerdictStatus;
  /** เฉลยที่ Aj ฟันธง (confirmed) */
  answer: string;
  by:     string;
  at:     Date | null;
}

const VERDICT_COL = "recallVerdicts";

export async function getVerdicts(): Promise<Record<number, RecallVerdict>> {
  const snap = await getDocs(collection(db, VERDICT_COL));
  const out: Record<number, RecallVerdict> = {};
  snap.forEach((d) => {
    const x  = d.data();
    const ts = x.at as { toDate?: () => Date } | undefined;
    out[Number(d.id)] = {
      no:     Number(d.id),
      status: (x.status as VerdictStatus) ?? "confirmed",
      answer: (x.answer as string) ?? "",
      by:     (x.by as string) ?? "",
      at:     ts?.toDate ? ts.toDate() : null,
    };
  });
  return out;
}

export async function setVerdict(
  no: number, status: VerdictStatus, answer: string, by: string,
): Promise<void> {
  await setDoc(doc(db, VERDICT_COL, String(no)), {
    status, answer: answer.trim(), by, at: serverTimestamp(),
  });
}

export async function clearVerdict(no: number): Promise<void> {
  await deleteDoc(doc(db, VERDICT_COL, String(no)));
}

function toSubmission(d: {
  id: string; data: () => Record<string, unknown>;
}): RecallSubmission {
  const x = d.data();
  const ts = x.createdAt as { toDate?: () => Date } | undefined;
  return {
    id:         d.id,
    no:         (x.no as number | null) ?? null,
    text:       (x.text as string) ?? "",
    options:    (x.options as string[]) ?? [],
    answer:     (x.answer as string) ?? "",
    subject:    (x.subject as SubjectCode | "") ?? "",
    confidence: (x.confidence as RecallConfidence) ?? "maybe",
    note:       (x.note as string) ?? "",
    userId:     (x.userId as string) ?? "",
    userEmail:  (x.userEmail as string) ?? "",
    userName:   (x.userName as string) ?? "",
    status:     (x.status as RecallStatus) ?? "new",
    createdAt:  ts?.toDate ? ts.toDate() : null,
  };
}
