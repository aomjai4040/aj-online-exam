/**
 * exam-config.ts — ค่าคงที่เกี่ยวกับรอบสอบ (แก้ที่เดียว)
 */

// วันเป้าหมายนับถอยหลัง — วันสอบจริง ประกาศทางการแล้ว: 15 ส.ค. 2569
export const COUNTDOWN_DATE  = new Date("2026-08-15T00:00:00+07:00");
export const COUNTDOWN_LABEL = "วันสอบ 15 ส.ค.";

// วันสอบจริง — ใช้คำนวณจังหวะแผนเรียน (แก้รอบสอบหน้าที่นี่ที่เดียว)
export const PLAN_TARGET_DATE  = new Date("2026-08-15T00:00:00+07:00");
export const PLAN_TARGET_LABEL = "วันสอบ 15 ส.ค.";

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
