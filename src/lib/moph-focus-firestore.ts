// ─────────────────────────────────────────────────────────────────────────────
// MOPH Focus — Firestore Service
// ─────────────────────────────────────────────────────────────────────────────
//
// Collection: mophFocus/{id}
// Queries:
//   getPublishedMOPHFocus  : isPublished=true  orderBy publishedDate DESC
//   getMOPHFocusById       : single doc
//   bulkImportMOPHFocus    : admin batch write

import {
  collection, doc,
  getDoc, getDocs, deleteDoc, setDoc, updateDoc,
  query, orderBy,
  writeBatch, serverTimestamp, Timestamp,
  type QueryDocumentSnapshot, type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { MOPHFocusItem, MOPHImportRow, MOPHTag } from "./moph-focus-types";
import { MOPH_TAG_LIST } from "./moph-focus-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date)      return v;
  return new Date();
}

function toItem(d: QueryDocumentSnapshot | DocumentSnapshot): MOPHFocusItem {
  const x = d.data() as Record<string, unknown>;
  const rawTags = Array.isArray(x.tags) ? (x.tags as string[]) : [];
  const tags = rawTags.filter((t) => MOPH_TAG_LIST.includes(t as MOPHTag)) as MOPHTag[];

  return {
    id:            d.id,
    title:         String(x.title        ?? ""),
    subtitle:      String(x.subtitle     ?? ""),
    summary:       String(x.summary      ?? ""),
    coverEmoji:    String(x.coverEmoji   ?? "🏥"),
    mustKnow:      String(x.mustKnow     ?? ""),
    examPoints:    String(x.examPoints   ?? ""),
    quickMemory:   String(x.quickMemory  ?? ""),
    fullContent:   String(x.fullContent  ?? ""),
    tags,
    isPublished:   Boolean(x.isPublished  ?? false),
    order:         Number(x.order         ?? 0),
    publishedDate: toDate(x.publishedDate),
    updatedAt:     toDate(x.updatedAt),
    createdAt:     toDate(x.createdAt),
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** ดึงทุกเรื่องที่ published เรียงจากใหม่ → เก่า
 *  ใช้ orderBy อย่างเดียว (single-field index — auto-created โดย Firestore)
 *  กรอง isPublished client-side เพื่อไม่ต้องพึ่ง composite index
 */
export async function getPublishedMOPHFocus(): Promise<MOPHFocusItem[]> {
  const q    = query(
    collection(db, "mophFocus"),
    orderBy("publishedDate", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(toItem)
    .filter((item) => item.isPublished);
}

/** ดึงเรื่องเดียวด้วย id */
export async function getMOPHFocusById(id: string): Promise<MOPHFocusItem | null> {
  const snap = await getDoc(doc(db, "mophFocus", id));
  return snap.exists() ? toItem(snap) : null;
}

// ── Client-side filter (search + tag) ────────────────────────────────────────

/** กรอง items ที่โหลดมาแล้ว — ใช้ client-side เพื่อรองรับ full-text search */
export function filterMOPHFocus(
  items:  MOPHFocusItem[],
  search: string,
  tag:    MOPHTag | "ทั้งหมด",
): MOPHFocusItem[] {
  let result = items;

  // filter by tag
  if (tag !== "ทั้งหมด") {
    result = result.filter((item) => item.tags.includes(tag));
  }

  // filter by search (title + summary + tags)
  const q = search.trim().toLowerCase();
  if (q) {
    result = result.filter((item) => {
      const haystack = [
        item.title,
        item.subtitle,
        item.summary,
        ...item.tags,
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }

  return result;
}

// ── Admin — CRUD ──────────────────────────────────────────────────────────────

/** ดึงทุก item (รวม unpublished) สำหรับ Admin */
export async function getAllMOPHFocus(): Promise<MOPHFocusItem[]> {
  const q    = query(collection(db, "mophFocus"), orderBy("publishedDate", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(toItem);
}

export interface MOPHFocusSaveData {
  title:         string;
  subtitle:      string;
  summary:       string;
  mustKnow:      string;
  examPoints:    string;
  quickMemory:   string;
  fullContent:   string;
  coverEmoji:    string;
  tags:          MOPHTag[];
  order:         number;
  isPublished:   boolean;
  publishedDate: Date;
}

/** สร้างใหม่ หรืออัปเดต item ที่มีอยู่ */
export async function saveMOPHFocus(
  id:   string | null,
  data: MOPHFocusSaveData,
): Promise<string> {
  const payload = {
    title:         data.title,
    subtitle:      data.subtitle,
    summary:       data.summary,
    mustKnow:      data.mustKnow,
    examPoints:    data.examPoints,
    quickMemory:   data.quickMemory,
    fullContent:   data.fullContent,
    coverEmoji:    data.coverEmoji || "🏥",
    tags:          data.tags,
    order:         data.order,
    isPublished:   data.isPublished,
    publishedDate: Timestamp.fromDate(data.publishedDate),
    updatedAt:     serverTimestamp(),
  };

  if (id) {
    await updateDoc(doc(db, "mophFocus", id), payload);
    return id;
  } else {
    const ref = doc(collection(db, "mophFocus"));
    await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
    return ref.id;
  }
}

/** ลบ item */
export async function deleteMOPHFocusById(id: string): Promise<void> {
  await deleteDoc(doc(db, "mophFocus", id));
}

// ── Admin — Bulk Import ───────────────────────────────────────────────────────

const BATCH_SIZE = 490;

export async function bulkImportMOPHFocus(
  rows: MOPHImportRow[],
): Promise<{ imported: number }> {
  if (!rows.length) return { imported: 0 };

  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const b     = writeBatch(db);

    chunk.forEach((row) => {
      const ref  = doc(collection(db, "mophFocus"));
      const date = row.publishedDate
        ? new Date(row.publishedDate)
        : new Date();

      b.set(ref, {
        title:         row.title,
        subtitle:      row.subtitle,
        summary:       row.summary,
        mustKnow:      row.mustKnow,
        examPoints:    row.examPoints,
        quickMemory:   row.quickMemory,
        fullContent:   row.fullContent,
        coverEmoji:    row.coverEmoji || "🏥",
        tags:          row.tags,
        order:         row.order,
        isPublished:   row.isPublished,
        publishedDate: Timestamp.fromDate(date),
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
      });
    });

    await b.commit();
    imported += chunk.length;
  }

  return { imported };
}
