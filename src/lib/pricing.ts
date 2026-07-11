/**
 * pricing.ts — ราคากลางทั้งแอป (Aj ยืนยัน 2026-07-11)
 * แก้ราคา = แก้ที่นี่ที่เดียว
 */

export const PRICING = {
  app: {
    price:     299,
    compareAt: 399,          // ป้ายขีดฆ่า
    name:      "App Only",
    tagline:   "คลังข้อสอบเต็ม + เครื่องมือฝึกครบ",
    period:    "ใช้ได้ 12 เดือน",
  },
  full: {
    price:   699,
    name:    "คอร์สเต็ม",
    tagline: "วิดีโอติว + ชีทสรุป + App ครบทุกอย่าง",
    period:  "ใช้ได้ 12 เดือน",
  },
  upgradePrice: 400,          // App → คอร์สเต็ม จ่ายส่วนต่าง
} as const;

/** ช่องทางติดต่อสั่งซื้อ (แก้เป็นลิงก์เพจ/LINE OA จริงของ Aj) */
export const CONTACT_URL = "https://www.facebook.com"; // TODO: รอลิงก์จริงจาก Aj
