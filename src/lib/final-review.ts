/**
 * final-review.ts — แผน "ติวโค้งสุดท้าย" 1–14 ส.ค. 2569 (ก่อนสอบจริง 15 ส.ค.)
 *
 * โครงแผน (ตกลงกับ Aj 2026-07-26):
 *   วัน 1–10  ทบทวน: เคลียร์คลัง Smart Review + ชุดหมวดอ่อน + Daily Quiz + คลิปสรุป
 *   วัน 11–13 โหมดสนามสอบ: Mock จับเวลา + เก็บตกข้อค้าง
 *   วัน 14    พักสมอง + เช็คลิสต์วันสอบ
 * ฟังก์ชันทั้งหมด pure — ผูกวันที่ผ่าน bkkTodayClient() ของผู้เรียก
 */

export const FR_START = "2026-08-01";
export const FR_DAYS  = 14;
export const EXAM_DAY = "2026-08-15";

export type FRPhase = "before" | "during" | "exam-eve-passed";
export type FRKind  = "review" | "mock" | "rest";

export interface FRDay {
  day:  number;   // 1..14
  date: string;   // YYYY-MM-DD
  kind: FRKind;
}

const DAY_MS = 86_400_000;

function addDays(iso: string, n: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

export function frKind(day: number): FRKind {
  if (day <= 10) return "review";
  if (day <= 13) return "mock";
  return "rest";
}

/** ตาราง 14 วันเต็ม (ใช้วาด timeline) */
export function frDays(): FRDay[] {
  return Array.from({ length: FR_DAYS }, (_, i) => ({
    day: i + 1, date: addDays(FR_START, i), kind: frKind(i + 1),
  }));
}

/** สถานะช่วงเวลา ณ วันนี้ (today = YYYY-MM-DD เวลาไทย) */
export function frPhase(today: string): FRPhase {
  if (today < FR_START) return "before";
  if (today <= addDays(FR_START, FR_DAYS - 1)) return "during";
  return "exam-eve-passed"; // 15 ส.ค. เป็นต้นไป = วันสอบ/หลังสอบ
}

/** วันที่เท่าไหร่ของแผน (1..14) — เรียกเฉพาะตอน phase = during */
export function frDayNumber(today: string): number {
  const diff = Math.round(
    (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${FR_START}T00:00:00Z`).getTime()) / DAY_MS
  );
  return Math.min(Math.max(diff + 1, 1), FR_DAYS);
}

/** วันเหลือก่อนเปิดแผน (phase = before) */
export function frDaysUntilStart(today: string): number {
  return Math.max(0, Math.round(
    (new Date(`${FR_START}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS
  ));
}

/** เป้าเคลียร์คลังทบทวนวันนี้ — เกลี่ยข้อค้างให้หมดภายในวันที่ 13 */
export function frReviewQuota(wrongCount: number, day: number): number {
  if (wrongCount <= 0) return 0;
  const remainingDays = Math.max(13 - day + 1, 1);
  return Math.ceil(wrongCount / remainingDays);
}

/** คลิปของช่วงโค้งสุดท้าย — Aj ตั้งชื่อบทให้มีคำว่า "โค้งสุดท้าย" ใน /admin/videos */
export function isFinalLapChapter(chapter: string): boolean {
  return chapter.includes("โค้งสุดท้าย");
}
