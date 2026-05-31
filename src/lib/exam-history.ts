// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExamRecord {
  examId:         string;
  score:          number;
  totalQuestions: number;
  percentage:     number;
  doneAt:         string; // ISO-8601
}

// ─── Storage key ──────────────────────────────────────────────────────────────

const KEY = "aj_exam_history";

// ─── Safe JSON parser ─────────────────────────────────────────────────────────
/**
 * JSON.parse ที่ปลอดภัย — ไม่ throw ในทุกกรณี:
 *  - null / undefined  → fallback
 *  - ""  (empty string) → fallback   ← สาเหตุหลักของ SyntaxError: Unexpected end of JSON input
 *  - invalid JSON       → fallback + clear localStorage key ที่เสีย
 */
function safeParse<T>(raw: string | null | undefined, fallback: T, storageKey?: string): T {
  // กรอง null, undefined, empty string, whitespace-only
  if (!raw || !raw.trim()) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn("[exam-history] JSON.parse failed:", e, "| raw preview:", raw.slice(0, 80));
    // ถ้า localStorage key เสีย → ล้างทิ้งเพื่อไม่ให้ error ซ้ำ
    if (storageKey && typeof window !== "undefined") {
      try { localStorage.removeItem(storageKey); } catch {}
    }
    return fallback;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getHistory(): Record<string, ExamRecord> {
  if (typeof window === "undefined") return {};
  return safeParse<Record<string, ExamRecord>>(
    localStorage.getItem(KEY),
    {},
    KEY,
  );
}

export function saveRecord(record: ExamRecord): void {
  if (typeof window === "undefined") return;
  try {
    const prev = getHistory();
    prev[record.examId] = record;
    localStorage.setItem(KEY, JSON.stringify(prev));
  } catch {
    // quota exceeded / private mode — fail silently
  }
}

export function getRecord(examId: string): ExamRecord | null {
  return getHistory()[examId] ?? null;
}
