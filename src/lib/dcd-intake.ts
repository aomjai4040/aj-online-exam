/**
 * dcd-intake.ts — แบบสอบถามก่อนชำระเงินคอร์ส คร. (แก้คำถาม = แก้ไฟล์นี้ไฟล์เดียว)
 *
 * หลักการเลือกคำถาม: ทุกข้อก่อนหน้าจอจ่ายเงินคือ friction ที่ทำให้คนหลุด
 * → เอาเฉพาะข้อที่ "คำตอบเปลี่ยนการกระทำของ Aj ได้จริง" และแตะตอบได้ใน 30 วิ
 *   (ความพึงพอใจ/คำติชม ไปถามหลังเรียนที่ /feedback อยู่แล้ว — ไม่ถามซ้ำ)
 *
 * ปลายทางของแต่ละข้อ:
 *   applied  → เตือนคนที่ยังไม่สมัครสอบกับกรมฯ ก่อนปิดรับ 4 ก.ย.
 *              (กันเคสซื้อคอร์สแล้วลืมสมัครสอบ = ขอเงินคืน/รีวิวเสีย)
 *   background → รู้ว่าต้องปูพื้นแค่ไหน + วัดว่าลูกค้าเดิม สป.สธ. ตามมากี่ %
 *   worry    → ⭐ เรียงคิวผลิตเนื้อหา 35 วันของ Aj — เรื่องที่คนกลัวมากสุดอัดก่อน
 *   source   → รู้ว่าช่องทางไหนขายได้จริง โปรโมทถูกที่
 */

export interface IntakeQuestion {
  id:      string;
  title:   string;
  sub?:    string;
  multi?:  boolean;
  max?:    number;
  choices: { value: string; label: string }[];
}

export const DCD_INTAKE: IntakeQuestion[] = [
  {
    id: "applied",
    title: "สมัครสอบกับกรมควบคุมโรคแล้วหรือยัง",
    sub: "รับสมัครถึง 4 ก.ย. ที่ ddc.thaijobjob.com",
    choices: [
      { value: "yes",  label: "สมัครแล้ว" },
      { value: "soon", label: "ยังไม่สมัคร เดี๋ยวไปสมัคร" },
    ],
  },
  {
    id: "background",
    title: "พื้นฐานของน้องตอนนี้",
    choices: [
      { value: "moph69",  label: "เพิ่งสอบ สป.สธ. เมื่อ 15 ส.ค. มา" },
      { value: "other",   label: "เคยสอบ นวก.สธ. สนามอื่นมาแล้ว" },
      { value: "first",   label: "สอบราชการครั้งแรก" },
    ],
  },
  {
    id: "worry",
    title: "เรื่องไหนกังวลที่สุด (เลือกได้ 2 ข้อ)",
    sub: "พี่อ้อมจะเอาไปจัดลำดับว่าติวเรื่องไหนก่อน",
    multi: true, max: 2,
    choices: [
      { value: "epi",     label: "ระบาดวิทยา + การเฝ้าระวังโรค" },
      { value: "law",     label: "กฎหมาย + พ.ร.บ.โรคติดต่อ" },
      { value: "stat",    label: "สถิติ + ข้อคำนวณ" },
      { value: "ddc",     label: "ภารกิจ/โครงสร้างกรมควบคุมโรค" },
      { value: "general", label: "ความรู้สาธารณสุขทั่วไป" },
      { value: "lost",    label: "ไม่รู้จะเริ่มอ่านตรงไหนเลย" },
    ],
  },
  {
    id: "source",
    title: "รู้จักคอร์สนี้จากช่องทางไหน",
    choices: [
      { value: "line",   label: "กลุ่ม LINE คอร์ส สป.สธ." },
      { value: "fb",     label: "เพจ Facebook พี่อ้อม" },
      { value: "friend", label: "เพื่อนแนะนำ" },
      { value: "tiktok", label: "TikTok" },
      { value: "search", label: "ค้นเจอเอง / อื่น ๆ" },
    ],
  },
];

export type IntakeAnswers = Record<string, string | string[]>;

export function intakeComplete(answers: IntakeAnswers): boolean {
  return DCD_INTAKE.every((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : typeof a === "string" && a !== "";
  });
}
