/**
 * exam-config.ts — ค่าคงที่เกี่ยวกับรอบสอบ (แก้ที่เดียว)
 */

// วันสอบ (ประมาณ) — ใช้ทำ countdown ใน dashboard
export const EXAM_DATE = new Date("2026-08-16T00:00:00+07:00");

/** จำนวนวันที่เหลือถึงวันสอบ (0 = วันสอบ, ติดลบ = ผ่านไปแล้ว) */
export function daysToExam(now: Date = new Date()): number {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(EXAM_DATE); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
