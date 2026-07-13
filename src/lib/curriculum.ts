/**
 * curriculum.ts — ตารางจับคู่ "หมวดข้อสอบ ↔ บทวิดีโอ/ชีท"
 * ใช้โดยโค้ชหลังส่งข้อสอบ (แนะนำว่าพลาดหมวดนี้ ให้ไปดูคลิป/อ่านชีทบทไหน)
 *
 * prefix ต้องตรงกับชื่อ chapter จริงใน collection videos (เช็คจากข้อมูลจริง 2026-07-12):
 *   "บทที่ 1 · EP.x ..." / "บทที่ 2 · EP.x ..." / "บทที่ 3 · ..." / "บทที่ 4 · ..." / "บทที่ 5 ..."
 * LAWIT / MOPH ยังไม่มีคลิป — โค้ชจะไม่โชว์ปุ่มวิดีโอของหมวดนั้น (Aj อัปเพิ่มแล้วเติมที่นี่)
 */

export interface ChapterRef {
  prefix: string; // ใช้ match ชื่อบทใน videos (startsWith)
  label:  string; // ชื่อโชว์ให้ผู้เรียน
}

export const SUBJECT_TO_CHAPTER: Record<string, ChapterRef> = {
  BASIC:   { prefix: "บทที่ 1", label: "บทที่ 1 ความรู้พื้นฐานด้านสาธารณสุข" },
  APPLIED: { prefix: "บทที่ 2", label: "บทที่ 2 การประยุกต์ความรู้ด้านสาธารณสุข" },
  POLICY:  { prefix: "บทที่ 3", label: "บทที่ 3 นโยบายของรัฐด้านการสาธารณสุข" },
  CURRENT: { prefix: "บทที่ 4", label: "บทที่ 4 สถานการณ์ปัจจุบันของระบบสาธารณสุข" },
  REFORM:  { prefix: "บทที่ 5", label: "บทที่ 5 การปฏิรูปด้านสาธารณสุข" },
};

export function chapterForSubject(subject: string): ChapterRef | null {
  return SUBJECT_TO_CHAPTER[subject] ?? null;
}
