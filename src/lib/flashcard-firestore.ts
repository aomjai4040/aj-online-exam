// ─────────────────────────────────────────────────────────────────────────────
// Flash Card — Firestore service
// ─────────────────────────────────────────────────────────────────────────────
//
// Collections:
//   flashcardDecks/{deckId}              — deck metadata
//   flashcards/{cardId}                  — card content
//   users/{uid}/fcProgress/{cardId}      — per-user progress
//
// Query patterns (→ indexes ใน firestore.indexes.json):
//   getPublishedDecks  : isPublished + order
//   getCardsByDeck     : isPublished + deckIds(array) + deckOrder.{slug}
//   setFCProgress      : single-doc write

import {
  collection, doc,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, runTransaction,
  serverTimestamp, Timestamp,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  FCDeck, FlashCard, FCProgress, FCStatus, FCDeckStats,
} from "./flashcard-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date)      return v;
  return new Date();
}

function toDeck(d: QueryDocumentSnapshot | DocumentSnapshot): FCDeck {
  const x = d.data() as Record<string, unknown>;
  return {
    id:          d.id,
    slug:        String(x.slug        ?? ""),
    name:        String(x.name        ?? ""),
    description: String(x.description ?? ""),
    type:        (x.type as FCDeck["type"]) ?? "custom",
    coverEmoji:  String(x.coverEmoji  ?? "🃏"),
    totalCards:  Number(x.totalCards  ?? 0),
    isPublished: Boolean(x.isPublished ?? false),
    order:       Number(x.order       ?? 0),
    createdAt:   toDate(x.createdAt),
    updatedAt:   toDate(x.updatedAt),
  };
}

function toCard(d: QueryDocumentSnapshot | DocumentSnapshot): FlashCard {
  const x = d.data() as Record<string, unknown>;
  return {
    id:          d.id,
    front:       String(x.front      ?? ""),
    back:        String(x.back       ?? ""),
    hint:        String(x.hint       ?? ""),
    category:    String(x.category   ?? ""),
    importance:  ([1, 2, 3].includes(Number(x.importance))
                   ? Number(x.importance) : 1) as 1 | 2 | 3,
    tags:        Array.isArray(x.tags)    ? (x.tags    as string[]) : [],
    deckIds:     Array.isArray(x.deckIds) ? (x.deckIds as string[]) : [],
    deckOrder:   (x.deckOrder as Record<string, number>) ?? {},
    isPublished: Boolean(x.isPublished ?? false),
    createdAt:   toDate(x.createdAt),
    updatedAt:   toDate(x.updatedAt),
  };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ─── Deck queries ─────────────────────────────────────────────────────────────

/** ดึง deck ทั้งหมดที่ published เรียงตาม order */
export async function getPublishedDecks(): Promise<FCDeck[]> {
  const q    = query(
    collection(db, "flashcardDecks"),
    where("isPublished", "==", true),
    orderBy("order", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(toDeck);
}

/** ดึง deck เดียวด้วย id */
export async function getDeckById(deckId: string): Promise<FCDeck | null> {
  const snap = await getDoc(doc(db, "flashcardDecks", deckId));
  return snap.exists() ? toDeck(snap) : null;
}

/** ดึง deck เดียวด้วย slug */
export async function getDeckBySlug(slug: string): Promise<FCDeck | null> {
  const q    = query(
    collection(db, "flashcardDecks"),
    where("slug", "==", slug),
    limit(1),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : toDeck(snap.docs[0]);
}

// ─── Card queries ─────────────────────────────────────────────────────────────

/**
 * ดึงการ์ดทั้งหมดของ deck หนึ่ง
 * เรียงตาม deckOrder[deckSlug] — client-side sort หลัง fetch
 * (Firestore ไม่รองรับ dynamic field sort โดยตรง)
 */
export async function getCardsByDeck(
  deckId:   string,
  deckSlug: string,
): Promise<FlashCard[]> {
  const q    = query(
    collection(db, "flashcards"),
    where("isPublished", "==", true),
    where("deckIds", "array-contains", deckSlug),
  );
  const snap = await getDocs(q);
  const cards = snap.docs.map(toCard);

  // Sort by deckOrder[slug] → fallback to 0
  return cards.sort((a, b) => {
    const ao = a.deckOrder[deckSlug] ?? 0;
    const bo = b.deckOrder[deckSlug] ?? 0;
    return ao - bo;
  });
}

// ─── User Progress ────────────────────────────────────────────────────────────

/**
 * อ่าน progress สำหรับชุด cardId[]
 * ใช้ batched in-query (สูงสุด 30 ต่อ batch)
 */
export async function getFCProgress(
  uid:     string,
  cardIds: string[],
): Promise<Map<string, FCProgress>> {
  if (!cardIds.length) return new Map();

  const result = new Map<string, FCProgress>();

  await Promise.all(
    chunk(cardIds, 30).map(async (ids) => {
      const q    = query(
        collection(db, "users", uid, "fcProgress"),
        where("cardId", "in", ids),
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const x = d.data() as Record<string, unknown>;
        result.set(d.id, {
          cardId:      d.id,
          status:      (x.status as FCStatus) ?? "new",
          reviewCount: Number(x.reviewCount   ?? 0),
          knownAt:     x.knownAt ? toDate(x.knownAt) : null,
          updatedAt:   toDate(x.updatedAt),
        });
      });
    })
  );

  return result;
}

/**
 * บันทึก / อัพเดต progress การ์ดใบเดียว
 * พร้อม transaction อัพเดต fcDeckStats ให้ sync กัน
 *
 * @param deckId  Firestore document id ของ deck (ไม่ใช่ slug)
 *                — ส่งมาเพื่ออัพเดต aggregate stats
 */
export async function setFCProgress(
  uid:    string,
  cardId: string,
  status: FCStatus,
  deckId: string,
): Promise<void> {
  const progRef  = doc(db, "users", uid, "fcProgress",   cardId);
  const statsRef = doc(db, "users", uid, "fcDeckStats",  deckId);

  await runTransaction(db, async (t) => {
    const [progSnap, statsSnap] = await Promise.all([
      t.get(progRef),
      t.get(statsRef),
    ]);

    // ── อ่าน progress เดิม ──────────────────────────────────────────
    const prevData      = progSnap.data() as Partial<FCProgress> | undefined;
    const prevStatus    = (prevData?.status as FCStatus | undefined) ?? "new";
    const prevReview    = Number(prevData?.reviewCount ?? 0);
    const prevKnownAt   = prevData?.knownAt ?? null;

    // ── เขียน progress ใหม่ ─────────────────────────────────────────
    t.set(progRef, {
      cardId,
      status,
      reviewCount: prevReview + 1,
      knownAt:
        status === "known"
          ? (prevKnownAt ?? serverTimestamp())
          : prevKnownAt,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // ── อัพเดต aggregate stats ──────────────────────────────────────
    const s = (statsSnap.data() ?? {}) as Record<string, number>;
    let known    = Number(s.known    ?? 0);
    let learning = Number(s.learning ?? 0);
    let skipped  = Number(s.skipped  ?? 0);

    // ลบ counter เดิม (ถ้าไม่ใช่ "new" ซึ่งไม่มี counter)
    if (prevStatus !== status) {
      if (prevStatus === "known")    known    = Math.max(0, known    - 1);
      if (prevStatus === "learning") learning = Math.max(0, learning - 1);
      if (prevStatus === "skipped")  skipped  = Math.max(0, skipped  - 1);

      // เพิ่ม counter ใหม่
      if (status === "known")    known++;
      if (status === "learning") learning++;
      if (status === "skipped")  skipped++;
    }

    t.set(statsRef, {
      deckId,
      known,
      learning,
      skipped,
      lastStudiedAt: serverTimestamp(),
      updatedAt:     serverTimestamp(),
    }, { merge: true });
  });
}

// ─── Deck Stats ───────────────────────────────────────────────────────────────

function toStats(
  id: string,
  x: Record<string, unknown>,
): FCDeckStats {
  return {
    deckId:        id,
    known:         Number(x.known         ?? 0),
    learning:      Number(x.learning      ?? 0),
    skipped:       Number(x.skipped       ?? 0),
    lastStudiedAt: x.lastStudiedAt ? toDate(x.lastStudiedAt) : null,
    updatedAt:     toDate(x.updatedAt),
  };
}

/** อ่าน stats ของ deck เดียว */
export async function getFCDeckStats(
  uid:    string,
  deckId: string,
): Promise<FCDeckStats | null> {
  const snap = await getDoc(doc(db, "users", uid, "fcDeckStats", deckId));
  if (!snap.exists()) return null;
  return toStats(snap.id, snap.data() as Record<string, unknown>);
}

/** อ่าน stats ของทุก deck ในครั้งเดียว → Map<deckId, FCDeckStats> */
export async function getAllFCDeckStats(
  uid: string,
): Promise<Map<string, FCDeckStats>> {
  const snap   = await getDocs(collection(db, "users", uid, "fcDeckStats"));
  const result = new Map<string, FCDeckStats>();
  snap.docs.forEach((d) => {
    result.set(d.id, toStats(d.id, d.data() as Record<string, unknown>));
  });
  return result;
}

/**
 * รีเซ็ต progress ทั้งหมดของ deck
 * — ลบ fcProgress ทุก card ใน deck
 * — ลบ fcDeckStats ของ deck
 */
export async function resetDeckProgress(
  uid:      string,
  deckId:   string,
  deckSlug: string,
): Promise<void> {
  // ดึง card IDs ของ deck
  const cards   = await getCardsByDeck(deckId, deckSlug);
  const cardIds = cards.map((c) => c.id);

  // Batch delete fcProgress
  for (const ids of chunk(cardIds, 490)) {
    const b = writeBatch(db);
    ids.forEach((id) => b.delete(doc(db, "users", uid, "fcProgress", id)));
    await b.commit();
  }

  // ลบ fcDeckStats
  await deleteDoc(doc(db, "users", uid, "fcDeckStats", deckId));
}

// ─── Admin — Deck CRUD ────────────────────────────────────────────────────────

export async function createDeck(
  data: Omit<FCDeck, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, "flashcardDecks"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDeckTotalCards(
  deckId: string,
  total:  number,
): Promise<void> {
  await updateDoc(doc(db, "flashcardDecks", deckId), {
    totalCards: total,
    updatedAt:  serverTimestamp(),
  });
}

// ─── Admin — Bulk import ──────────────────────────────────────────────────────

export interface ImportCardRow {
  deckSlug:    string;
  deckName:    string;
  deckType:    FCDeck["type"];
  deckOrder:   number;          // ลำดับการ์ดนี้ภายใน deck
  front:       string;
  back:        string;
  hint:        string;
  category:    string;
  importance:  FCImportance;
  tags:        string[];
  isPublished: boolean;
}

type FCImportance = 1 | 2 | 3;

/**
 * Import cards แบบ batch
 * — สร้าง / อัพเดต deck document อัตโนมัติตาม deckSlug
 * — เพิ่ม card และผูก deckIds + deckOrder
 * — อัพเดต totalCards บน deck
 */
export async function bulkImportCards(rows: ImportCardRow[]): Promise<{
  decksCreated: number;
  cardsImported: number;
}> {
  if (!rows.length) return { decksCreated: 0, cardsImported: 0 };

  // ── 1. Upsert deck documents ─────────────────────────────────────────────
  const deckSlugs = [...new Set(rows.map((r) => r.deckSlug))];
  const deckIdMap = new Map<string, string>(); // slug → firestoreId
  let decksCreated = 0;

  for (const slug of deckSlugs) {
    const existing = await getDeckBySlug(slug);
    if (existing) {
      deckIdMap.set(slug, existing.id);
    } else {
      // สร้าง deck ใหม่จากข้อมูลแถวแรกที่มี slug นี้
      const sample = rows.find((r) => r.deckSlug === slug)!;
      const id = await createDeck({
        slug,
        name:        sample.deckName,
        description: "",
        type:        sample.deckType,
        coverEmoji:  deckEmoji(sample.deckType),
        totalCards:  0,
        isPublished: true,
        order:       0,
      });
      deckIdMap.set(slug, id);
      decksCreated++;
    }
  }

  // ── 2. Import cards in batches of 490 ────────────────────────────────────
  const BATCH = 490;
  let cardsImported = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batchRows = rows.slice(i, i + BATCH);
    const b = writeBatch(db);

    batchRows.forEach((row) => {
      const ref = doc(collection(db, "flashcards"));
      b.set(ref, {
        front:       row.front,
        back:        row.back,
        hint:        row.hint,
        category:    row.category,
        importance:  row.importance,
        tags:        row.tags,
        deckIds:     [row.deckSlug],
        deckOrder:   { [row.deckSlug]: row.deckOrder },
        isPublished: row.isPublished,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
    });

    await b.commit();
    cardsImported += batchRows.length;
  }

  // ── 3. Update totalCards on each deck ────────────────────────────────────
  const countBySlug = new Map<string, number>();
  rows.forEach((r) => countBySlug.set(r.deckSlug, (countBySlug.get(r.deckSlug) ?? 0) + 1));

  await Promise.all(
    [...countBySlug.entries()].map(([slug, count]) => {
      const id = deckIdMap.get(slug);
      return id ? updateDeckTotalCards(id, count) : Promise.resolve();
    })
  );

  return { decksCreated, cardsImported };
}

function deckEmoji(type: FCDeck["type"]): string {
  const map: Record<FCDeck["type"], string> = {
    chapter:  "📚",
    pre_exam: "🎯",
    tag:      "🔖",
    custom:   "✨",
  };
  return map[type];
}

// ─── Shuffle ──────────────────────────────────────────────────────────────────

export function shuffleCards(cards: FlashCard[]): FlashCard[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
