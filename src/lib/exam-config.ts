/**
 * exam-config.ts — ค่าคงที่เกี่ยวกับรอบสอบ (แก้ที่เดียว)
 */

// วันเป้าหมายนับถอยหลัง — ใช้วันประกาศสถานที่สอบ (31 ก.ค. 2569)
// เพราะวันสอบจริงยังไม่ประกาศ นับถอยหลังไปวันสอบเสี่ยงทำให้ผู้เรียนสับสน
export const COUNTDOWN_DATE  = new Date("2026-07-31T00:00:00+07:00");
export const COUNTDOWN_LABEL = "ประกาศสถานที่สอบ";

/** จำนวนวันที่เหลือถึงวันเป้าหมาย (0 = วันนั้น, ติดลบ = ผ่านไปแล้ว) */
export function daysToExam(now: Date = new Date()): number {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(COUNTDOWN_DATE); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
