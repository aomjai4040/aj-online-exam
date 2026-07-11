/**
 * payment-server.ts — ตรรกะจ่ายเงินฝั่ง server (ห้าม import จาก client)
 *
 * - สร้าง PromptPay QR (payload EMVCo + ฝังยอดเงิน)
 * - ตรวจสลิปกับ SlipOK
 * - ให้สิทธิ์คอร์ส (สร้าง userCourse) เมื่อจ่ายสำเร็จ — atomic กันซ้ำ
 */

import "server-only";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { tierPlan, type OrderTier } from "./order-types";

const PROMPTPAY_ID  = process.env.PROMPTPAY_ID  ?? "";
const SLIPOK_API_KEY  = process.env.SLIPOK_API_KEY  ?? "";
const SLIPOK_BRANCH   = process.env.SLIPOK_BRANCH_ID ?? "";

/** สร้าง QR พร้อมเพย์เป็น data URL (ฝังยอดเงิน) */
export async function makePromptPayQR(amount: number): Promise<string> {
  const payload = generatePayload(PROMPTPAY_ID, { amount });
  return QRCode.toDataURL(payload, { margin: 1, width: 320 });
}

/** สร้างออเดอร์ pending — คืน orderId + QR */
export async function createOrder(
  uid: string, email: string, tier: OrderTier
): Promise<{ orderId: string; amount: number; qr: string; courseName: string }> {
  const plan = tierPlan(tier);
  const ref  = adminDb().collection("orders").doc();
  await ref.set({
    userId: uid, email, tier,
    amount: plan.amount, status: "pending",
    courseId: plan.courseId, courseName: plan.courseName,
    createdAt: FieldValue.serverTimestamp(),
  });
  return {
    orderId: ref.id, amount: plan.amount, courseName: plan.courseName,
    qr: await makePromptPayQR(plan.amount),
  };
}

interface SlipOkResult {
  ok: boolean;
  reason?: string;
  transRef?: string;
}

/** ส่งสลิปให้ SlipOK ตรวจ (แนบไฟล์ base64 หรือ url) */
async function verifyWithSlipOk(slipBase64: string, amount: number): Promise<SlipOkResult> {
  if (!SLIPOK_API_KEY || !SLIPOK_BRANCH) return { ok: false, reason: "SLIPOK_NOT_CONFIGURED" };
  try {
    const res = await fetch(`https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-authorization": SLIPOK_API_KEY,
      },
      body: JSON.stringify({ files: slipBase64, log: true, amount }),
    });
    const data = await res.json();
    if (!res.ok || data?.success === false) {
      return { ok: false, reason: data?.message ?? data?.code ?? "SLIP_INVALID" };
    }
    // SlipOK คืน data.transRef/amount ให้ตรวจซ้ำ
    const paid = Number(data?.data?.amount ?? 0);
    if (paid + 0.001 < amount) return { ok: false, reason: `ยอดโอน ${paid} น้อยกว่า ${amount}` };
    return { ok: true, transRef: String(data?.data?.transRef ?? "") };
  } catch (e) {
    console.error("[slipok]", e);
    return { ok: false, reason: "SLIPOK_ERROR" };
  }
}

export type SubmitSlipResult =
  | { ok: true; courseName: string }
  | { ok: false; reason: string };

/**
 * ผู้ใช้ส่งสลิปของออเดอร์ → ตรวจ → ให้สิทธิ์
 * - ยืนยันว่าออเดอร์เป็นของ uid นี้ + ยัง pending
 * - กันสลิปซ้ำ (transRef ต้องไม่เคยใช้)
 * - atomic: อัปเดต order + สร้าง userCourse ใน transaction เดียว
 */
export async function submitSlip(
  uid: string, orderId: string, slipBase64: string
): Promise<SubmitSlipResult> {
  const db = adminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return { ok: false, reason: "ไม่พบคำสั่งซื้อ" };

  const order = snap.data()!;
  if (order.userId !== uid)      return { ok: false, reason: "คำสั่งซื้อไม่ใช่ของบัญชีนี้" };
  if (order.status === "paid")   return { ok: true, courseName: order.courseName };
  if (order.status !== "pending") return { ok: false, reason: "คำสั่งซื้อนี้ปิดแล้ว" };

  const check = await verifyWithSlipOk(slipBase64, order.amount);
  if (!check.ok) return { ok: false, reason: check.reason ?? "ตรวจสลิปไม่ผ่าน" };

  // กันสลิปซ้ำ — transRef ต้อง unique
  const transRef = check.transRef || `${orderId}-noref`;
  const slipGuard = db.collection("usedSlips").doc(transRef);

  try {
    await db.runTransaction(async (tx) => {
      const g = await tx.get(slipGuard);
      if (g.exists) throw new Error("สลิปนี้ถูกใช้ไปแล้ว");

      const courseRef = db.collection("userCourses").doc();
      tx.set(slipGuard, { orderId, uid, at: FieldValue.serverTimestamp() });
      tx.update(orderRef, {
        status: "paid", slipRef: transRef, paidAt: FieldValue.serverTimestamp(),
      });
      tx.set(courseRef, {
        userId: uid, email: order.email,
        courseId: order.courseId, courseName: order.courseName,
        activatedAt: FieldValue.serverTimestamp(),
        activationCode: `PAID-${orderId.slice(0, 8).toUpperCase()}`,
        source: "payment",
      });
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
  return { ok: true, courseName: order.courseName };
}
