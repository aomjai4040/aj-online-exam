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
  | "dcd";       // สนามกรมควบคุมโรค 2569 — ซื้อแยกจาก สป.สธ.
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

import { PRICING, dcdCurrentPrice } from "./pricing";

/** map tier → courseId/courseName/ราคา (ฝั่ง server ใช้กำหนดของจริง) */
export function tierPlan(tier: OrderTier): { courseId: string; courseName: string; amount: number } {
  switch (tier) {
    case "dcd":
      // ราคาตามช่วงเวลา — โปรเปิดตัว 499 ถึง 31 ส.ค. แล้วกลับ 699 เอง
      return {
        courseId:   "dcd-2026",
        courseName: `${PRICING.dcd.name} (สอบ 20 ก.ย. 69)`,
        amount:     dcdCurrentPrice().amount,
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
