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
  /** สนามของใบนี้ — "dcd" = คร.69 · "" = สป.สธ. เดิม (ใบเก่าไม่มี field) */
  field:      string;
}

export interface RecallInput {
  no:         number | null;
  text:       string;
  options:    string[];
  answer:     string;
  subject:    SubjectCode | "";
  confidence: RecallConfidence;
  note:       string;
  /** สนามของข้อสอบ — "dcd" = คร.69 (อาสาจำข้อสอบ) · ไม่ใส่ = สป.สธ. เดิม */
  field?:     string;
}

const COL       = "recallSubmissions";
const COUNT_COL = "recallCounts";

/** ตัดเฉพาะช่องว่าง "ท้ายลิสต์" — ช่องว่างกลางลิสต์คงไว้เพื่อตรึงตำแหน่ง ก-ง */
function trimTrailing(opts: string[]): string[] {
  const out = [...opts];
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

function countId(no: number | null): string {
  return no === null ? "new" : String(no);
}

/** ส่งความจำ 1 ใบ + เพิ่มตัวนับสาธารณะของข้อนั้น — คืน id ของใบ
 *  (ใช้ผูกเฉลย AJ รายใบตอน admin กรอกเองจาก /recall-dcd) */
export async function submitRecall(
  user: { uid: string; email: string | null; displayName: string | null },
  input: RecallInput,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    no:         input.no,
    text:       input.text.trim(),
    // ตรึงตำแหน่ง ก-ข-ค-ง — ห้าม filter ช่องว่างทิ้ง ไม่งั้นช้อยที่จำไม่ได้
    // ทำให้ตัวถัดไปเลื่อนตำแหน่ง เฉลยตัวอักษรเพี้ยนทั้งข้อ (Aj 2026-09-20)
    options:    trimTrailing(input.options.map((o) => o.trim())),
    answer:     input.answer.trim(),
    subject:    input.subject,
    confidence: input.confidence,
    note:       input.note.trim(),
    ...(input.field ? { field: input.field } : {}),
    userId:     user.uid,
    userEmail:  user.email       ?? "",
    userName:   user.displayName ?? "",
    status:     "new" as RecallStatus,
    createdAt:  serverTimestamp(),
  });

  // ตัวนับสาธารณะ — ให้ทุกคนเห็นว่าข้อไหนมีคนช่วยแล้ว (ดันให้ไปช่วยข้อที่ยังว่าง)
  const countRef = doc(db, COUNT_COL, countId(input.no));
  try {
    const snap = await getDoc(countRef);
    if (snap.exists()) await updateDoc(countRef, { count: increment(1) });
    else               await setDoc(countRef, { count: 1 });
  } catch (e) {
    // ตัวนับพลาดไม่ควรทำให้การส่งล้มเหลว — ใบที่ส่งไปแล้วสำคัญกว่า
    console.warn("[recall] count update failed (non-fatal):", e);
  }

  return ref.id;
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

/** admin แก้เนื้อหาใบที่ส่งเข้ามา — น้องพิมพ์ผิด/ส่งไม่ครบ/ส่งผิดข้อ Aj แก้ได้ (Aj 2026-09-20) */
export async function updateRecallSubmission(
  id: string,
  patch: { no: number | null; text: string; options: string[]; answer: string; note: string },
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    no:      patch.no,
    text:    patch.text.trim(),
    options: trimTrailing(patch.options.map((o) => o.trim())),
    answer:  patch.answer.trim(),
    note:    patch.note.trim(),
  });
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

/** เฉลยที่ Aj ฟันธง — สป.สธ. ใช้ doc id เป็นเลขล้วน, คร. ใช้ "dcd-{no}" (แชร์ collection เดิม
 *  เพื่อไม่ต้องแตะ rules — Aj 2026-09-20) */
function readVerdicts(
  snap: { forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => void },
  idToNo: (id: string) => number | null,
): Record<number, RecallVerdict> {
  const out: Record<number, RecallVerdict> = {};
  snap.forEach((d) => {
    const no = idToNo(d.id);
    if (no === null) return;
    const x  = d.data();
    const ts = x.at as { toDate?: () => Date } | undefined;
    out[no] = {
      no,
      status: (x.status as VerdictStatus) ?? "confirmed",
      answer: (x.answer as string) ?? "",
      by:     (x.by as string) ?? "",
      at:     ts?.toDate ? ts.toDate() : null,
    };
  });
  return out;
}

export async function getVerdicts(): Promise<Record<number, RecallVerdict>> {
  const snap = await getDocs(collection(db, VERDICT_COL));
  return readVerdicts(snap, (id) => (/^\d+$/.test(id) ? Number(id) : null));
}

export async function getDcdVerdicts(): Promise<Record<number, RecallVerdict>> {
  const snap = await getDocs(collection(db, VERDICT_COL));
  return readVerdicts(snap, (id) => {
    const m = /^dcd-(\d+)$/.exec(id);
    return m ? Number(m[1]) : null;
  });
}

/** เฉลย AJ ของ "ใบที่ไม่ระบุเลขข้อ" (คร.) — ผูกกับ submission id: doc "dcd-x-{subId}"
 *  (Aj 2026-09-20 เย็น: น้องจำเลขข้อไม่ได้แต่ส่งโจทย์มา ก็ต้องเฉลยได้) */
export async function getDcdSubVerdicts(): Promise<Record<string, RecallVerdict>> {
  const snap = await getDocs(collection(db, VERDICT_COL));
  const out: Record<string, RecallVerdict> = {};
  snap.forEach((d) => {
    const m = /^dcd-x-(.+)$/.exec(d.id);
    if (!m) return;
    const x  = d.data();
    const ts = x.at as { toDate?: () => Date } | undefined;
    out[m[1]] = {
      no:     0,
      status: (x.status as VerdictStatus) ?? "confirmed",
      answer: (x.answer as string) ?? "",
      by:     (x.by as string) ?? "",
      at:     ts?.toDate ? ts.toDate() : null,
    };
  });
  return out;
}

export async function setDcdSubVerdict(
  subId: string, status: VerdictStatus, answer: string, by: string,
): Promise<void> {
  await setDoc(doc(db, VERDICT_COL, `dcd-x-${subId}`), {
    status, answer: answer.trim(), by, at: serverTimestamp(),
  });
}

export async function clearDcdSubVerdict(subId: string): Promise<void> {
  await deleteDoc(doc(db, VERDICT_COL, `dcd-x-${subId}`));
}

export async function setDcdVerdict(
  no: number, status: VerdictStatus, answer: string, by: string,
): Promise<void> {
  await setDoc(doc(db, VERDICT_COL, `dcd-${no}`), {
    status, answer: answer.trim(), by, at: serverTimestamp(),
  });
}

export async function clearDcdVerdict(no: number): Promise<void> {
  await deleteDoc(doc(db, VERDICT_COL, `dcd-${no}`));
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
    field:      (x.field as string) ?? "",
  };
}
