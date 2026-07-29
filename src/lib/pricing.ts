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
  review: {
    price:   499,
    name:    "แพ็กติวทบทวน",
    tagline: "ข้อสอบครบ + ติวโค้งสุดท้าย 14 วัน + คลิปสรุป",
    period:  "ใช้ได้ 12 เดือน",
  },
  full: {
    price:   699,
    name:    "คอร์สเต็ม",
    tagline: "วิดีโอติว + ชีทสรุป + App ครบทุกอย่าง",
    period:  "ใช้ได้ 12 เดือน",
  },
  upgradePrice: 400,          // App → คอร์สเต็ม จ่ายส่วนต่าง
  upToReviewPrice: 200,       // App → แพ็กติวทบทวน จ่ายส่วนต่าง
  reviewToFullPrice: 200,     // แพ็กติวทบทวน → คอร์สเต็ม จ่ายส่วนต่าง
} as const;

/** ช่องทางติดต่อสั่งซื้อ — LINE OA ของ Aj */
export const CONTACT_URL = "https://line.me/R/ti/p/@481ccrkj";

/**
 * ทรัพยากรสำหรับสมาชิก "คอร์สเต็ม" (แสดงหลังซื้อ/อัปเกรด)
 * เว้นว่าง = ปุ่มไม่แสดง — ใส่ลิงก์จริงของ Aj แล้วจะโผล่อัตโนมัติ
 */
export const COURSE_RESOURCES = {
  lineOpenChat: "https://line.me/ti/g2/YrFWnValWt4n1raglN3PZ88YlOaiRa7l4HYFIw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default",
  driveDocs:    "https://drive.google.com/drive/folders/1bVYpGvSQXr_KRpDnRlR4F8S2Zv19LlkL?usp=sharing",
  // เอกสารของแพ็กติวทบทวน 499 (โชว์ในหน้า /final-review ให้ทั้ง 499 และคอร์สเต็ม)
  // เว้นว่าง = ปุ่มไม่แสดง — Aj ส่งลิงก์มาเมื่อไหร่วางตรงนี้แล้วปุ่มโผล่เอง
  reviewDocs:   "",
};
