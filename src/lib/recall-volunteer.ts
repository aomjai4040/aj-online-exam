/**
 * recall-volunteer.ts — อาสาสมัครจำข้อสอบสนาม คร. 69 (Aj 2026-09-17)
 *
 * ก่อนสอบ: น้องแตะรับ "เลขข้อ" คนละ 1 ข้อ (1–100) ระบบแจกแบบไม่ซ้ำจนครบรอบ
 * แล้ววนรอบสำรอง (ข้อละหลายคนยิ่งดี — กันจำไม่ได้/ข้อสอบสลับชุด)
 * หลังสอบ: การ์ดเดิมพลิกเป็นฟอร์มส่งข้อที่ตัวเองจำ เข้า recallSubmissions
 * (คลังเดียวกับที่ Aj ตรวจที่ /admin/recall)
 *
 * เก็บข้อมูล:
 *   recallVolunteers/{uid}        — 1 คน 1 สิทธิ์ { no, round, email, name }
 *   recallVolunteerMeta/dcd69     — { counts: { "1": n, ... } } ตัวนับต่อข้อ (แจกแบบ transaction)
 */

export const RV_TOTAL = 100;                       // จำนวนข้อของสนาม
export const RV_EXAM_LABEL = "สนามกรมควบคุมโรค 20 ก.ย. 69";
/** เวลาพลิกโหมด "ส่งข้อที่จำ" — เที่ยงวันสอบพอดี (Aj 2026-09-19: สอบเลิก 12:00
 *  น้องออกจากห้องแล้วอยากพิมพ์ทันทีตอนความจำสดที่สุด) */
export const RV_FLIP_AT = "2026-09-20T12:00:00+07:00";
/** เลิกโชว์การ์ดทั้งหมด (เก็บตกพอแล้ว) */
export const RV_END_AT = "2026-10-05T00:00:00+07:00";

export type RvPhase = "before" | "after" | "closed";

export function rvPhase(now: Date = new Date()): RvPhase {
  if (now.getTime() >= new Date(RV_END_AT).getTime()) return "closed";
  if (now.getTime() >= new Date(RV_FLIP_AT).getTime()) return "after";
  return "before";
}
