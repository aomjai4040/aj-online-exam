// ─────────────────────────────────────────────────────────────────────────────
// Flash Card Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Tags ──────────────────────────────────────────────────────────────────────
// open-ended array — เพิ่ม tag ใหม่ได้โดยไม่ต้องแก้ schema

export const FC_TAGS = {
  CRITICAL:    "จุดตาย",
  NUMBER:      "ตัวเลข",
  LAST_REVIEW: "ก่อนสอบ",
  CONFUSING:   "สับสนบ่อย",
} as const;

export type FCTag = typeof FC_TAGS[keyof typeof FC_TAGS];

// ── Importance ────────────────────────────────────────────────────────────────

export type FCImportance = 1 | 2 | 3;

export const FC_IMPORTANCE_LABEL: Record<FCImportance, string> = {
  1: "ทั่วไป",
  2: "สำคัญ",
  3: "สำคัญมาก",
};

// ── Deck type ─────────────────────────────────────────────────────────────────
//
// chapter   → เรียนตามบท (สร้างจาก deck_type = "chapter" ใน CSV)
// pre_exam  → ทบทวนก่อนสอบ (admin คัดเลือกข้ามบท)
// tag       → จุดตาย / ตัวเลข / สับสนบ่อย ฯลฯ
// custom    → คลังพิเศษอื่น ๆ

export type FCDeckType = "chapter" | "pre_exam" | "tag" | "custom";

// ── Deck (Firestore: flashcardDecks/{deckId}) ─────────────────────────────────
//
// ความสัมพันธ์กับการ์ด:
//   การ์ด 1 ใบ อยู่ได้หลาย deck พร้อมกัน ผ่าน deckIds[] array
//   ลำดับต่าง deck ต่างกัน เก็บใน deckOrder map บน card

export interface FCDeck {
  id:          string;
  slug:        string;       // URL-safe, unique เช่น "ch01", "pre-exam-2025"
  name:        string;       // "บทที่ 1 ระบาดวิทยา"
  description: string;
  type:        FCDeckType;
  coverEmoji:  string;       // "📚", "🎯", "🔢"
  totalCards:  number;       // cache — อัพเดตหลัง import
  isPublished: boolean;
  order:       number;       // ลำดับแสดงผลในหน้า list
  createdAt:   Date;
  updatedAt:   Date;
}

// ── FlashCard (Firestore: flashcards/{cardId}) ────────────────────────────────
//
// deckIds: string[]              → array-contains query เพื่อดึงการ์ดของ deck
// deckOrder: Record<slug,number> → ลำดับการ์ดในแต่ละ deck แยกต่างกัน

export interface FlashCard {
  id:          string;
  front:       string;
  back:        string;
  hint:        string;          // คำใบ้ก่อน flip (optional)
  category:    string;          // หมวดหมู่ เช่น "ระบาดวิทยา", "กฎหมาย"
  importance:  FCImportance;
  tags:        string[];        // ["จุดตาย", "ตัวเลข"]
  deckIds:     string[];        // ["ch01", "pre-exam-2025"]
  deckOrder:   Record<string, number>; // { "ch01": 1, "pre-exam-2025": 5 }
  isPublished: boolean;
  createdAt:   Date;
  updatedAt:   Date;
}

// ── User Progress (Firestore: users/{uid}/fcProgress/{cardId}) ────────────────

export type FCStatus = "new" | "learning" | "known" | "skipped";

export interface FCProgress {
  cardId:      string;
  status:      FCStatus;
  reviewCount: number;
  knownAt:     Date | null;
  updatedAt:   Date;
}

// ── Session result (summary หลังเล่นครบ) ─────────────────────────────────────

export interface FCSessionResult {
  total:    number;
  known:    number;
  learning: number;
  skipped:  number;
}

// ── Deck Stats per user (Firestore: users/{uid}/fcDeckStats/{deckId}) ─────────
//
// Aggregate counter — อัพเดต transaction เดียวกับ fcProgress
// new = deck.totalCards - known - learning - skipped  (คำนวณ client-side)

export interface FCDeckStats {
  deckId:        string;
  known:         number;
  learning:      number;
  skipped:       number;
  lastStudiedAt: Date | null;
  updatedAt:     Date;
}
