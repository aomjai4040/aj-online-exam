/**
 * exam-progress.ts — autosave ความคืบหน้าข้อสอบใน localStorage
 * ใช้ร่วมกันระหว่างหน้าทำข้อสอบ (บันทึก/กู้คืน) และ dashboard (การ์ดทำต่อจากเดิม)
 */

export interface SavedProgress {
  answers:    number[];
  current:    number;
  elapsed:    number;  // วินาทีที่ใช้ไปแล้ว
  qCount:     number;  // ไว้เช็คว่าชุดข้อสอบยังเป็นชุดเดิม
  savedAt:    number;
  examTitle?: string;  // สำหรับการ์ด "ทำต่อจากเดิม" (save เก่าอาจไม่มี)
  subject?:   string;
}

export const PROGRESS_TTL = 24 * 60 * 60 * 1000; // เก็บไม่เกิน 24 ชม.

const PREFIX = "exam-progress-";

export function progressKey(id: string) { return `${PREFIX}${id}`; }

function isUsable(p: SavedProgress): boolean {
  if (Date.now() - p.savedAt > PROGRESS_TTL) return false;
  return p.answers.some((a) => a !== -1); // ต้องตอบไปแล้วอย่างน้อย 1 ข้อ
}

export function loadProgress(id: string, qCount: number): SavedProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(id));
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedProgress;
    if (p.qCount !== qCount) return null; // ชุดข้อสอบถูกแก้ไประหว่างทาง
    return isUsable(p) ? p : null;
  } catch { return null; }
}

export function saveProgress(id: string, p: SavedProgress) {
  try { localStorage.setItem(progressKey(id), JSON.stringify(p)); } catch { /* quota */ }
}

export function clearProgress(id: string) {
  try { localStorage.removeItem(progressKey(id)); } catch { /* noop */ }
}

/** ข้อสอบที่ค้างอยู่ทั้งหมดในเครื่องนี้ (ล่าสุดก่อน) — ใช้ทำการ์ด "ทำต่อจากเดิม" */
export function listInProgress(): Array<SavedProgress & { examId: string }> {
  const out: Array<SavedProgress & { examId: string }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const p = JSON.parse(localStorage.getItem(key)!) as SavedProgress;
        if (isUsable(p)) out.push({ ...p, examId: key.slice(PREFIX.length) });
      } catch { /* ข้าม entry เสีย */ }
    }
  } catch { /* SSR / storage ปิด */ }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}
