/**
 * exam-config.ts — ค่าคงที่เกี่ยวกับรอบสอบ (แก้ที่เดียว)
 */

// วันเป้าหมายนับถอยหลัง — ใช้วันประกาศสถานที่สอบ (31 ก.ค. 2569)
// เพราะวันสอบจริงยังไม่ประกาศ นับถอยหลังไปวันสอบเสี่ยงทำให้ผู้เรียนสับสน
export const COUNTDOWN_DATE  = new Date("2026-07-31T00:00:00+07:00");
export const COUNTDOWN_LABEL = "ประกาศสถานที่สอบ";

// วันสอบโดยประมาณ (ยังไม่ประกาศทางการ ~16 ส.ค. 2569) — ใช้คำนวณจังหวะแผนเรียน
// ประกาศจริงเมื่อไหร่แก้ที่นี่ที่เดียว
export const PLAN_TARGET_DATE  = new Date("2026-08-16T00:00:00+07:00");
export const PLAN_TARGET_LABEL = "วันสอบ (ประมาณ 16 ส.ค.)";

function diffDays(target: Date, now: Date): number {
  const a = new Date(now);    a.setHours(0, 0, 0, 0);
  const b = new Date(target); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** จำนวนวันที่เหลือถึงวันเป้าหมาย (0 = วันนั้น, ติดลบ = ผ่านไปแล้ว) */
export function daysToExam(now: Date = new Date()): number {
  return diffDays(COUNTDOWN_DATE, now);
}

/** วันที่เหลือถึงวันสอบโดยประมาณ — ใช้กำหนดจังหวะแผนเรียน */
export function planDaysLeft(now: Date = new Date()): number {
  return diffDays(PLAN_TARGET_DATE, now);
}
