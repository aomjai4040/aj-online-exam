/**
 * waitlist-types.ts — "ลงชื่อรอคอร์ส" (Aj 2026-11-08)
 *
 * คนถามหาคอร์สสนามใหม่ → ส่งลิงก์ /waitlist ลิงก์เดียว
 * Aj เห็นยอดรอรายสนามที่ /admin/waitlist แล้วกดส่งอีเมลแจ้งตอนเปิดคอร์ส
 *
 * เก็บที่ collection "waitlist" (docId = อีเมล lowercase) — เขียน/อ่านผ่าน
 * API ฝั่ง server เท่านั้น (admin SDK) client ไม่แตะ Firestore ตรง
 */

/** สนามที่ให้เลือก — อิงทะเบียน exam-fields + "อื่นๆ" ให้พิมพ์เอง */
export const WAITLIST_FIELDS = [
  { key: "moph",    label: "สป.สธ. — สำนักงานปลัดกระทรวงสาธารณสุข" },
  { key: "dcd",     label: "กรมควบคุมโรค" },
  { key: "local",   label: "อปท. — องค์กรปกครองส่วนท้องถิ่น" },
  { key: "license", label: "ใบประกอบวิชาชีพการสาธารณสุขชุมชน" },
  { key: "other",   label: "อื่นๆ (ระบุ)" },
] as const;

export type WaitlistFieldKey = typeof WAITLIST_FIELDS[number]["key"];

export const WAITLIST_STATUSES = [
  { key: "preparing",  label: "เตรียมสอบ" },
  { key: "waitlisted", label: "ขึ้นบัญชีรอเรียก" },
  { key: "appointed",  label: "บรรจุแล้ว" },
  { key: "alumni",     label: "ศิษย์เก่า" },
] as const;

export type WaitlistStatus = typeof WAITLIST_STATUSES[number]["key"];

/** ข้อความยินยอม — เก็บสำเนาลง doc ทุกครั้ง (หลักฐานว่าตอนติ๊กเห็นข้อความไหน) */
export const WAITLIST_CONSENT_TEXT =
  "ข้าพเจ้ายินยอมให้เก็บชื่อและอีเมลนี้ไว้เพื่อแจ้งข่าวการเปิดคอร์สของ AJ ExamOnline เท่านั้น "
  + "และสามารถยกเลิกการรับข่าวได้ทุกเมื่อจากลิงก์ท้ายอีเมล";

export const WAITLIST_SOURCES = ["line", "fb", "app"] as const;

/** ป้ายเตือนยอดรอถึงเกณฑ์น่าเปิดคอร์ส */
export const WAITLIST_ALERT_AT = 300;

export function fieldLabel(key: string): string {
  return WAITLIST_FIELDS.find((f) => f.key === key)?.label ?? key;
}
export function statusLabel(key: string): string {
  return WAITLIST_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
export function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

/** แถวที่ API ฝั่ง admin ส่งกลับ (serializable) */
export interface WaitlistRow {
  email:      string;
  name:       string;
  fields:     string[];        // WaitlistFieldKey[]
  otherText:  string;
  status:     string;          // WaitlistStatus
  source:     string;
  consentAt:  string;          // ISO
  createdAt:  string;          // ISO
  updatedAt:  string;          // ISO
  unsub:      boolean;
}

export interface NotifyLog {
  field:     string;
  lastSentAt: string;          // ISO
  totalSent:  number;          // รวมทุกรอบ
  rounds:     number;
}
