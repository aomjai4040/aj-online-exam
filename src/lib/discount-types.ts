/**
 * discount-types.ts — โครงโค้ดส่วนลด (ใช้ร่วม client/server)
 *
 * มี 2 ชนิดในคอลเลกชันเดียวกัน (discountCodes/{CODE}) แยกด้วยการมี userId:
 *
 *  ① โค้ดส่วนตัว (มี userId) — ออกอัตโนมัติจากแบบประเมิน AJ100-XXXXX
 *     ใช้ได้คนเดียว ครั้งเดียว ตัดด้วย status
 *
 *  ② โค้ดกลาง (ไม่มี userId) — Aj สร้างเองที่ /admin/codes
 *     หลายคนใช้ได้ นับ usedCount (ใช้เป็นตัววัด referral) และกันคนเดิมใช้ซ้ำ
 *     ด้วย subcollection uses/{uid}
 *
 * ที่มา: Aj ขอราคา "399 ศิษย์เก่า" ให้แยกยอดศิษย์เก่ากับลูกค้าใหม่ออกจากกันได้
 * (17 ส.ค. 2569) — ทุกรายการต้องผ่านหน้าชำระเงินเดียวกัน ห้ามปลดล็อกด้วยมือ
 */

export interface DiscountCode {
  code:       string;
  /** ชื่อเรียกในรายงาน เช่น "ศิษย์เก่า สป.สธ." */
  label:      string;
  /** ลดกี่บาท */
  amount:     number;
  /** จำกัดเฉพาะ tier ไหน — ว่าง = ใช้ได้ทุกคอร์ส */
  tiers:      string[];
  /** 0 = ไม่จำกัดจำนวนครั้ง */
  maxUses:    number;
  usedCount:  number;
  /** true = ต้องเคยมีคอร์สอื่นมาก่อน (กันคนนอกใช้โค้ดศิษย์เก่า) */
  alumniOnly: boolean;
  active:     boolean;
  expiresAt:  string;          // YYYY-MM-DD
  source:     string;          // "admin" | "feedback-2026"
  createdAt:  Date | null;
  /** โค้ดส่วนตัว: เจ้าของ + สถานะ (โค้ดกลางไม่มีสองฟิลด์นี้) */
  userId?:    string;
  userEmail?: string;
  status?:    "unused" | "used";
}

/** ตัดอักษรที่อ่านสับสน (0/O 1/I/L) — แบบเดียวกับโค้ดเปิดคอร์ส */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** ใช้ได้อีกกี่ครั้ง — null = ไม่จำกัด */
export function remainingUses(c: Pick<DiscountCode, "maxUses" | "usedCount">): number | null {
  return c.maxUses > 0 ? Math.max(0, c.maxUses - c.usedCount) : null;
}
