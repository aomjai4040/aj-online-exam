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
  /**
   * สนามกรมควบคุมโรค 2569 — คนละสนามกับ สป.สธ. ซื้อแยก (Aj ยืนยันราคา 2026-08-16)
   * ราคาเต็ม 699 · โปรเปิดตัว 499 ถึง 31 ส.ค. · โค้ดแบบประเมิน −100 → เหลือ 399
   * ไทม์ไลน์ทางการ: รับสมัคร 17 ส.ค. – 4 ก.ย. · สอบข้อเขียน 20 ก.ย. 69
   */
  dcd: {
    price:       699,
    launchPrice: 499,
    launchUntil: "2026-08-31",   // ถึงสิ้นวัน (เวลาไทย)
    name:        "ติวเข้มกรมควบคุมโรค",
    tagline:     "นักวิชาการสาธารณสุข กรมควบคุมโรค — วันสอบรอประกาศ",
    period:      "ใช้ได้ 12 เดือน",
  },
  upgradePrice: 400,          // App → คอร์สเต็ม จ่ายส่วนต่าง
  upToReviewPrice: 200,       // App → แพ็กติวทบทวน จ่ายส่วนต่าง
  reviewToFullPrice: 200,     // แพ็กติวทบทวน → คอร์สเต็ม จ่ายส่วนต่าง
} as const;

/**
 * ราคาคอร์ส คร. ณ ตอนนี้ — โปรเปิดตัวถึงสิ้นวัน 31 ส.ค. (เวลาไทย) แล้วกลับราคาเต็มเอง
 * ใช้ทั้งฝั่งแสดงผลและฝั่ง server ตอนสร้างออเดอร์ (แหล่งเดียว ราคาไม่มีทางไม่ตรงกัน)
 */
export function dcdCurrentPrice(now: Date = new Date()): { amount: number; isLaunch: boolean } {
  const bkkDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
  const isLaunch = bkkDate <= PRICING.dcd.launchUntil;
  return { amount: isLaunch ? PRICING.dcd.launchPrice : PRICING.dcd.price, isLaunch };
}

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
  // "ชีททวนก่อนสอบ" (21 หัวข้อ 34 หน้า) — แจกสมาชิกทุกแพ็ก (299/499/699)
  // ⚠️ ต้องเป็นลิงก์แชร์ "เฉพาะไฟล์" ไม่ใช่ทั้งโฟลเดอร์ (กันแพ็ก 299 เห็นชีทรายวันของ 499)
  // ลิงก์เฉพาะไฟล์ (2026-08-12) — 21 หัวข้อ 34 หน้า
  preExamSheet: "https://drive.google.com/file/d/1-JlERZU8pkAeo0RhIvp9Mal-DmBKwzP6/view?usp=sharing",
};
