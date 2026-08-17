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

/** ลำดับบทตามหลักสูตร — ใช้บอกว่า "ถัดไปคือบทอะไร" หลังทำข้อสอบผ่าน */
const CHAPTER_ORDER = ["BASIC", "APPLIED", "POLICY", "CURRENT", "REFORM"];

/** บทถัดไปหลังจบหมวดนี้ — คืน null ถ้าเป็นบทสุดท้ายหรือไม่รู้จัก */
export function nextChapterAfter(subject: string): ChapterRef | null {
  const i = CHAPTER_ORDER.indexOf(subject);
  if (i === -1 || i === CHAPTER_ORDER.length - 1) return null;
  return SUBJECT_TO_CHAPTER[CHAPTER_ORDER[i + 1]] ?? null;
}

/** ทางกลับ: ชื่อบทของคลิป → หมวดข้อสอบ (ใช้ปิดลูป คลิป → ข้อสอบท้ายบท)
 *  รับชื่อเต็มอย่าง "บทที่ 1 · EP.3 ระบาดวิทยา" แล้วคืน "BASIC" */
export function subjectForChapter(chapter: string): string | null {
  const c = (chapter ?? "").trim();
  if (!c) return null;
  for (const [subject, ref] of Object.entries(SUBJECT_TO_CHAPTER)) {
    if (c.startsWith(ref.prefix)) return subject;
  }
  return null;
}
