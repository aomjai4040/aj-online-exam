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

/** ช่องทางติดต่อสั่งซื้อ — LINE OA ของ Aj */
export const CONTACT_URL = "https://line.me/R/ti/p/@481ccrkj";

/**
 * ทรัพยากรสำหรับสมาชิก "คอร์สเต็ม" (แสดงหลังซื้อ/อัปเกรด)
 * เว้นว่าง = ปุ่มไม่แสดง — ใส่ลิงก์จริงของ Aj แล้วจะโผล่อัตโนมัติ
 */
export const COURSE_RESOURCES = {
  lineOpenChat: "", // TODO: ลิงก์เชิญเข้า LINE OpenChat กลุ่มผู้เรียน
  driveDocs:    "", // TODO: ลิงก์ Google Drive ชีทสรุป ~500 หน้า
};
