/**
 * pricing.ts — ราคากลางทั้งแอป (Aj ยืนยัน 2026-07-11)
 * แก้ราคา = แก้ที่นี่ที่เดียว
 */

export const PRICING = {
  // ชื่อ/จุดขายให้ตรงหน้าโปสเตอร์ขายของ Aj (2026-07-29)
  app: {
    price:     299,
    compareAt: 399,          // ป้ายขีดฆ่า
    name:      "App Only",
    tagline:   "สำหรับคนมีพื้นฐานแล้ว ต้องการฝึกข้อสอบ",
    period:    "ใช้ได้ 12 เดือน",
  },
  review: {
    price:   499,
    name:    "ติวเข้ม 14 วัน",
    tagline: "สำหรับคนมีพื้นฐานมาบ้าง ต้องการทบทวนให้ทันสอบ",
    period:  "ใช้ได้ 12 เดือน",
  },
  full: {
    price:   699,
    name:    "คอร์สเต็ม",
    tagline: "สำหรับคนอยากได้ครบ และถามพี่อ้อมได้ตลอด",
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
  // ชีทประเด็นสำคัญของแพ็กติวเข้ม 14 วัน (โชว์ใน /final-review ให้ทั้ง 499 และคอร์สเต็ม)
  // โฟลเดอร์เดียว — Aj ทยอยอัปไฟล์เพิ่มตามวันติว (เริ่มวันที่ 1 เมื่อ 2026-07-31)
  reviewDocs:   "https://drive.google.com/drive/folders/15ytbYc0tYB0j_Z8_8V0UbbVXiGGh-nlY?usp=sharing",
};
