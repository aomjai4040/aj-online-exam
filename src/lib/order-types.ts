/**
 * order-types.ts — คำสั่งซื้อในเว็บ (collection: orders)
 * ใช้ร่วมกันระหว่าง client (แสดงสถานะ) และ server (สร้าง/ยืนยัน)
 */

export type OrderTier =
  | "app"        // 299 App Only
  | "review"     // 499 แพ็กติวทบทวน (สิทธิ์ App + คลิปโค้งสุดท้าย)
  | "full"       // 699 คอร์สเต็ม
  | "upgrade"    // 400: app → full
  | "up-review"  // 200: app → review
  | "up-full2"   // 200: review → full
  | "dcd"        // สนามกรมควบคุมโรค 2569 (ติวเข้ม: คลิป+ข้อสอบ+LINE) — ซื้อแยกจาก สป.สธ.
  | "dcd-app"    // 299: App Only สนาม คร. — ฝึกข้อสอบอย่างเดียว (Aj 2026-08-27)
  | "up-dcd"     // ส่วนต่างจริง: dcd-app → ติวเข้ม คร. (โปร +200 · หลังโปร +400)
  | "partc-moph" // 159: เมนูซ้อมภาค ค สป.สธ. อย่างเดียว (Aj 2026-10-17)
  | "partc-dcd"  // 159: เมนูซ้อมภาค ค คร. อย่างเดียว
  | "partc-duo"  // 199: ซ้อมภาค ค ทั้งสองสนาม (ตัวจูงใจคนสอบ 2 สนาม)
  | "partc-up";  // 40: มีแพ็กสนามเดียว → อัปเป็นแพ็กคู่ จ่ายส่วนต่าง (Aj 2026-10-18)
export type OrderStatus = "pending" | "paid" | "rejected" | "expired";

export interface Order {
  id:         string;
  userId:     string;
  email:      string;
  tier:       OrderTier;
  amount:     number;        // บาท (จำนวนเต็ม) — ยอดที่ต้องโอนจริง (หักส่วนลดแล้ว)
  /** ยอดเต็มก่อนหักส่วนลด — มีค่าเฉพาะออเดอร์ที่ใช้โค้ด */
  fullAmount?:     number;
  discountCode?:   string;
  discountAmount?: number;
  status:     OrderStatus;
  courseId:   string;        // สิทธิ์ที่จะได้เมื่อจ่ายสำเร็จ (app-* = App Only)
  courseName: string;
  slipRef?:   string;        // เลขอ้างอิงสลิป (transRef) — กันสลิปซ้ำ
  paidAt?:    Date;
  note?:      string;        // เหตุผลถ้า rejected
  createdAt:  Date;
}

import { PRICING, dcdCurrentPrice, dcdUpgradePrice } from "./pricing";

/** map tier → courseId/courseName/ราคา (ฝั่ง server ใช้กำหนดของจริง) */
export function tierPlan(tier: OrderTier): { courseId: string; courseName: string; amount: number } {
  switch (tier) {
    case "dcd":
      // ราคาตามช่วงเวลา — โปรเปิดตัว 499 ถึง 31 ส.ค. แล้วกลับ 699 เอง
      return {
        courseId:   "dcd-2026",
        courseName: `${PRICING.dcd.name} 2569`,
        amount:     dcdCurrentPrice().amount,
      };
    case "dcd-app":
      return {
        courseId:   "dcd-app-2026",
        courseName: `${PRICING.dcdApp.name} 2569`,
        amount:     PRICING.dcdApp.price,
      };
    case "up-dcd":
      // ส่วนต่างจริง ณ วันจ่าย — ได้สิทธิ์ติวเข้ม คร. เต็ม (dcd-2026)
      return {
        courseId:   "dcd-2026",
        courseName: "อัปเกรดเป็นติวเข้มกรมควบคุมโรค (จาก App Only)",
        amount:     dcdUpgradePrice(),
      };
    // เมนูซ้อมภาค ค แยกขาย — courseId ขึ้นต้น partc- ต้องถูกกันออกจาก
    // hasAny/isFullCourse (ดู access.ts) ไม่งั้นคนซื้อ 159 ได้คลังข้อสอบ/วิดีโอไปด้วย
    case "partc-moph":
      return {
        courseId:   "partc-moph-69",
        courseName: "ซ้อมสัมภาษณ์ภาค ค สป.สธ. 2569",
        amount:     PRICING.partc.price,
      };
    case "partc-dcd":
      return {
        courseId:   "partc-dcd-69",
        courseName: "ซ้อมสัมภาษณ์ภาค ค กรมควบคุมโรค 2569",
        amount:     PRICING.partc.price,
      };
    case "partc-duo":
      return {
        courseId:   "partc-duo-69",
        courseName: "ซ้อมสัมภาษณ์ภาค ค แพ็กคู่ สป.สธ. + คร. 2569",
        amount:     PRICING.partc.duoPrice,
      };
    case "partc-up":
      // ได้ courseId แพ็กคู่ → ปลดทั้งสองสนามทันที (สนามเดิมยังอยู่ ไม่ซ้ำซ้อน)
      return {
        courseId:   "partc-duo-69",
        courseName: "อัปเกรดซ้อมภาค ค เป็นแพ็กคู่ (เพิ่มอีกสนาม)",
        amount:     PRICING.partc.upPrice,
      };
    case "app":
      return { courseId: "app-2026", courseName: "App Only (แอปข้อสอบ) 2569", amount: 299 };
    case "review":
      return { courseId: "review-2026", courseName: "ติวเข้ม 14 วัน (ข้อสอบ+โค้งสุดท้าย) 2569", amount: 499 };
    case "full":
      return { courseId: "full-2026", courseName: "คอร์สเต็ม (วิดีโอ+ชีท+แอป) 2569", amount: 699 };
    case "upgrade":
      return { courseId: "full-2026", courseName: "อัปเกรดเป็นคอร์สเต็ม", amount: 400 };
    case "up-review":
      return { courseId: "review-2026", courseName: "อัปเกรดเป็นแพ็กติวเข้ม 14 วัน", amount: 200 };
    case "up-full2":
      return { courseId: "full-2026", courseName: "อัปเกรดเป็นคอร์สเต็ม (จากแพ็กติวเข้ม 14 วัน)", amount: 200 };
  }
}
