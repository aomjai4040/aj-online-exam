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
import { adminDb, adminAccessToken } from "./firebase-admin";
import { tierPlan, type OrderTier } from "./order-types";
import { normalizeCode } from "./discount-types";

/** bucket เก็บรูปสลิปที่ตรวจไม่ผ่าน (ใช้ bucket backup เดิม — lifecycle ลบเอง 30 วัน) */
export const SLIP_BUCKET = "aj-online-exam-backups";

const PROMPTPAY_ID  = process.env.PROMPTPAY_ID  ?? "";
const SLIPOK_API_KEY  = process.env.SLIPOK_API_KEY  ?? "";
const SLIPOK_BRANCH   = process.env.SLIPOK_BRANCH_ID ?? "";

/** สร้าง QR พร้อมเพย์เป็น data URL (ฝังยอดเงิน) */
export async function makePromptPayQR(amount: number): Promise<string> {
  const payload = generatePayload(PROMPTPAY_ID, { amount });
  return QRCode.toDataURL(payload, { margin: 1, width: 320 });
}

/** สิทธิ์ปัจจุบันของผู้ใช้ (ฝั่ง server) — กติกา prefix เดียวกับ lib/access.ts
 *
 *  แยกตาม "สนาม": สิทธิ์ของ สป.สธ. (app/review/full) กับ กรมควบคุมโรค (dcd-)
 *  ไม่เกี่ยวกัน — คนที่ซื้อคอร์สเต็ม สป.สธ. ต้องซื้อคอร์ส คร. ได้ตามปกติ */
async function serverAccess(uid: string): Promise<{
  hasAny: boolean; hasReview: boolean; hasFull: boolean; hasDcd: boolean;
}> {
  const snap = await adminDb().collection("userCourses").where("userId", "==", uid).get();
  const ids  = snap.docs.map((d) => String(d.data().courseId ?? "").toLowerCase());
  const isDcd = (id: string) => id.startsWith("dcd-");
  return {
    hasAny:    ids.some((id) => !isDcd(id)),   // สิทธิ์ฝั่ง สป.สธ. เท่านั้น
    hasReview: ids.some((id) => id.startsWith("review-")),
    hasFull:   ids.some((id) => !id.startsWith("app-") && !id.startsWith("review-") && !isDcd(id)),
    hasDcd:    ids.some(isDcd),
  };
}

export class CheckoutError extends Error {}

/** ออเดอร์ที่ค้างอยู่ของ tier นี้ (ยังไม่จ่าย) — ใช้ "ต่อของเดิม" ไม่สร้างใหม่
 *
 *  สำคัญมาก: ถ้าสร้างออเดอร์ใหม่ทุกครั้งที่เปิดหน้า คนที่ใส่โค้ดแล้วโอน 399
 *  พอกลับเข้ามาจะเจอ QR ยอด 499 → สลิป 399 ไม่ตรงยอด → ระบบตีตก
 *  ทั้งที่เงินเข้าบัญชีแล้ว (Aj แจ้งเคสนี้ 17 ส.ค. 69) */
export async function pendingOrder(uid: string, tier: OrderTier): Promise<{
  orderId: string; amount: number; qr: string; courseName: string;
  fullAmount?: number; discountAmount?: number; discountCode?: string;
} | null> {
  const snap = await adminDb().collection("orders")
    .where("userId", "==", uid)
    .where("tier", "==", tier)
    .where("status", "==", "pending")
    .get();
  if (snap.empty) return null;

  // เอาอันล่าสุด — เรียงใน memory กันต้องสร้าง composite index
  const docs = snap.docs.sort((a, b) =>
    (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0));
  const d = docs[0].data();
  const amount = Number(d.amount);

  return {
    orderId: docs[0].id, amount, courseName: String(d.courseName ?? ""),
    qr: await makePromptPayQR(amount),
    ...(d.fullAmount     ? { fullAmount:     Number(d.fullAmount) }   : {}),
    ...(d.discountAmount ? { discountAmount: Number(d.discountAmount) } : {}),
    ...(d.discountCode   ? { discountCode:   String(d.discountCode) }  : {}),
  };
}

/** ผู้ใช้ถือสิทธิ์ของ tier นี้อยู่แล้วหรือยัง — ใช้ก่อนแสดงหน้าจ่ายเงิน */
export async function alreadyOwns(uid: string, tier: OrderTier): Promise<boolean> {
  const acc = await serverAccess(uid);
  if (tier === "dcd") return acc.hasDcd;
  if (tier === "app") return acc.hasAny;
  if (tier === "review") return acc.hasReview || acc.hasFull;
  if (tier === "full" || tier === "upgrade" || tier === "up-full2") return acc.hasFull;
  return false;
}

/** สร้างออเดอร์ pending — คืน orderId + QR */
export async function createOrder(
  uid: string, email: string, tier: OrderTier
): Promise<{ orderId: string; amount: number; qr: string; courseName: string }> {
  // กันซื้อซ้ำ / อัปเกรดผิดเงื่อนไข / จ่ายแพงเกินจำเป็น
  const acc = await serverAccess(uid);

  // สนามกรมควบคุมโรค — คนละสนามกับ สป.สธ. ตรวจแยก และไม่ติดเงื่อนไขของสนามเดิม
  if (tier === "dcd") {
    if (acc.hasDcd) throw new CheckoutError("บัญชีนี้มีคอร์สกรมควบคุมโรคอยู่แล้ว");
    const openDcd = await pendingOrder(uid, tier);
    if (openDcd) return openDcd;
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

  if (acc.hasFull) throw new CheckoutError("บัญชีนี้มีคอร์สเต็มอยู่แล้ว");
  if (tier === "app" && acc.hasAny) throw new CheckoutError("บัญชีนี้มีสิทธิ์ App อยู่แล้ว");
  if (tier === "review") {
    if (acc.hasReview) throw new CheckoutError("บัญชีนี้มีแพ็กติวเข้ม 14 วันอยู่แล้ว");
    if (acc.hasAny)
      throw new CheckoutError("บัญชีนี้มี App Only แล้ว — อัปเกรดเป็นแพ็กติวเข้ม 14 วัน จ่ายเพิ่มแค่ 200 บาท");
  }
  if (tier === "upgrade") {
    if (!acc.hasAny) throw new CheckoutError("อัปเกรดได้เฉพาะผู้ที่มีสิทธิ์อยู่แล้ว — กรุณาเลือกคอร์สเต็ม");
    if (acc.hasReview)
      throw new CheckoutError("บัญชีนี้มีแพ็กติวเข้ม 14 วัน — อัปเกรดเป็นคอร์สเต็มจ่ายเพิ่มแค่ 200 บาท");
  }
  if (tier === "up-review") {
    if (acc.hasReview) throw new CheckoutError("บัญชีนี้มีแพ็กติวเข้ม 14 วันอยู่แล้ว");
    if (!acc.hasAny)
      throw new CheckoutError("อัปเกรดได้เฉพาะผู้ที่มี App Only อยู่แล้ว — กรุณาเลือกแพ็กติวเข้ม 14 วัน (499)");
  }
  if (tier === "up-full2" && !acc.hasReview)
    throw new CheckoutError("เมนูนี้สำหรับผู้ที่มีแพ็กติวเข้ม 14 วันอยู่แล้วเท่านั้น");

  // ผ่านด่านสิทธิ์แล้ว — ถ้ามีออเดอร์ค้าง ใช้ของเดิม (คงยอด+ส่วนลดเดิม)
  const open = await pendingOrder(uid, tier);
  if (open) return open;

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

// ─── โค้ดส่วนลด (ได้จากการทำแบบประเมินที่ /feedback) ──────────────────────────
//
// โค้ดผูกกับ userId → คนอื่นเอาไปใช้ไม่ได้แม้รู้โค้ด
// ตัดสถานะเป็น "used" ตอนจ่ายเงินสำเร็จเท่านั้น (ไม่ใช่ตอนสร้างออเดอร์) —
// ถ้าไม่จ่าย/สลิปไม่ผ่าน โค้ดยังอยู่ครบ

interface CodeCheck { code: string; amount: number }

/**
 * ตรวจโค้ดว่าใช้ได้กับบัญชีนี้/คอร์สนี้ไหม — โยน CheckoutError พร้อมเหตุผลถ้าใช้ไม่ได้
 *
 * รองรับ 2 ชนิด (ดู lib/discount-types.ts):
 *   โค้ดส่วนตัว (มี userId) = ของแบบประเมิน ใช้ได้คนเดียวครั้งเดียว
 *   โค้ดกลาง  (ไม่มี userId) = Aj สร้างเอง หลายคนใช้ได้ นับ usedCount
 */
export async function checkDiscountCode(
  uid: string, raw: string, tier?: OrderTier
): Promise<CodeCheck> {
  const code = normalizeCode(raw);
  if (!code) throw new CheckoutError("กรุณากรอกโค้ด");

  const db   = adminDb();
  const snap = await db.collection("discountCodes").doc(code).get();
  if (!snap.exists) throw new CheckoutError("ไม่พบโค้ดนี้ — ลองตรวจตัวสะกดอีกครั้ง");

  const d = snap.data()!;

  // หมดอายุ / ปิดใช้ — ใช้ร่วมกันทั้งสองชนิด
  if (d.active === false) throw new CheckoutError("โค้ดนี้ปิดใช้งานแล้ว");
  const today = new Date().toISOString().slice(0, 10);
  if (typeof d.expiresAt === "string" && d.expiresAt && d.expiresAt < today) {
    throw new CheckoutError(`โค้ดนี้หมดอายุแล้ว (ใช้ได้ถึง ${d.expiresAt})`);
  }

  // จำกัดคอร์ส
  const tiers: string[] = Array.isArray(d.tiers) ? d.tiers : [];
  if (tier && tiers.length > 0 && !tiers.includes(tier)) {
    throw new CheckoutError("โค้ดนี้ใช้กับคอร์สนี้ไม่ได้ค่ะ");
  }

  if (d.userId) {
    // ── โค้ดส่วนตัว ──────────────────────────────────────────────────────
    if (d.userId !== uid)      throw new CheckoutError("โค้ดนี้เป็นของบัญชีอื่น ใช้ได้เฉพาะเจ้าของโค้ดค่ะ");
    if (d.status === "used")   throw new CheckoutError("โค้ดนี้ถูกใช้ไปแล้ว");
    if (d.status !== "unused") throw new CheckoutError("โค้ดนี้ใช้ไม่ได้แล้ว");
  } else {
    // ── โค้ดกลาง ─────────────────────────────────────────────────────────
    const maxUses   = Number(d.maxUses ?? 0);
    const usedCount = Number(d.usedCount ?? 0);
    if (maxUses > 0 && usedCount >= maxUses) {
      throw new CheckoutError("โค้ดนี้ถูกใช้ครบจำนวนแล้วค่ะ");
    }
    // คนเดิมใช้ซ้ำไม่ได้
    const mine = await db.collection("discountCodes").doc(code)
      .collection("uses").doc(uid).get();
    if (mine.exists) throw new CheckoutError("บัญชีนี้ใช้โค้ดนี้ไปแล้วค่ะ");

    // โค้ดศิษย์เก่า — ต้องเคยมีคอร์สอื่นมาก่อน (กันคนนอกเอาไปใช้)
    if (d.alumniOnly === true) {
      const courses = await db.collection("userCourses").where("userId", "==", uid).get();
      const plan    = tier ? tierPlan(tier) : null;
      const isPrior = courses.docs.some((c) =>
        String(c.data().courseId ?? "") !== (plan?.courseId ?? ""));
      if (!isPrior) {
        throw new CheckoutError("โค้ดนี้สำหรับศิษย์เก่าที่เคยเรียนคอร์สกับพี่อ้อมมาก่อนค่ะ");
      }
    }
  }

  const amount = Number(d.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new CheckoutError("โค้ดนี้ใช้ไม่ได้");
  return { code, amount };
}

/**
 * ใช้โค้ดกับออเดอร์ที่ยังไม่จ่าย → คืนยอดใหม่ + QR ใหม่ (ยอดฝังใน QR ต้องตรงกัน)
 * ยอดขั้นต่ำ 1 บาท เพราะ QR พร้อมเพย์ยอด 0 สร้างไม่ได้
 */
export async function applyDiscount(
  uid: string, orderId: string, rawCode: string
): Promise<{ amount: number; fullAmount: number; discountAmount: number; code: string; qr: string }> {
  const db  = adminDb();
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new CheckoutError("ไม่พบคำสั่งซื้อ");

  const order = snap.data()!;
  if (order.userId !== uid)       throw new CheckoutError("คำสั่งซื้อไม่ใช่ของบัญชีนี้");
  if (order.status !== "pending") throw new CheckoutError("คำสั่งซื้อนี้ปิดแล้ว ใช้โค้ดไม่ได้");

  const { code, amount: discount } = await checkDiscountCode(
    uid, rawCode, order.tier as OrderTier | undefined);

  // ยอดเต็ม = ยอดก่อนหักส่วนลด (กันกดใช้โค้ดซ้ำแล้วลดซ้อน)
  const fullAmount = Number(order.fullAmount ?? order.amount);
  const amount     = Math.max(1, fullAmount - discount);

  await ref.update({
    fullAmount, amount,
    discountCode: code, discountAmount: fullAmount - amount,
  });

  return {
    amount, fullAmount, discountAmount: fullAmount - amount, code,
    qr: await makePromptPayQR(amount),
  };
}

/** ยกเลิกโค้ดที่ใส่ไว้ → กลับไปยอดเต็ม */
export async function removeDiscount(
  uid: string, orderId: string
): Promise<{ amount: number; qr: string }> {
  const db  = adminDb();
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new CheckoutError("ไม่พบคำสั่งซื้อ");

  const order = snap.data()!;
  if (order.userId !== uid)       throw new CheckoutError("คำสั่งซื้อไม่ใช่ของบัญชีนี้");
  if (order.status !== "pending") throw new CheckoutError("คำสั่งซื้อนี้ปิดแล้ว");

  const amount = Number(order.fullAmount ?? order.amount);
  await ref.update({
    amount,
    fullAmount:     FieldValue.delete(),
    discountCode:   FieldValue.delete(),
    discountAmount: FieldValue.delete(),
  });
  return { amount, qr: await makePromptPayQR(amount) };
}

interface SlipOkResult {
  ok: boolean;
  reason?: string;
  transRef?: string;
}

/** แปลง data URL (data:image/png;base64,....) → Blob สำหรับ multipart */
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(head)?.[1] ?? "image/jpeg";
  const bin  = Buffer.from(b64, "base64");
  return new Blob([bin], { type: mime });
}

/** ส่งสลิปให้ SlipOK ตรวจ — multipart/form-data ฟิลด์ files (ภาพสลิป) */
async function verifyWithSlipOk(slipDataUrl: string, amount: number): Promise<SlipOkResult> {
  if (!SLIPOK_API_KEY || !SLIPOK_BRANCH) return { ok: false, reason: "SLIPOK_NOT_CONFIGURED" };
  try {
    const form = new FormData();
    form.append("files", dataUrlToBlob(slipDataUrl), "slip.jpg");
    form.append("amount", String(amount)); // ให้ SlipOK เทียบยอดให้ด้วย
    form.append("log", "true");

    const res = await fetch(`https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH}`, {
      method: "POST",
      headers: { "x-authorization": SLIPOK_API_KEY }, // อย่าตั้ง Content-Type เอง — ให้ fetch ใส่ boundary
      body: form,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.success === false) {
      // SlipOK คืน code/message เมื่อสลิปปลอม/ซ้ำ/ยอดไม่ตรง
      return { ok: false, reason: data?.message ?? data?.code ?? `ตรวจสลิปไม่ผ่าน (${res.status})` };
    }
    const d = data?.data ?? data;
    const paid = Number(d?.amount ?? 0);
    if (paid > 0 && paid + 0.001 < amount) {
      return { ok: false, reason: `ยอดโอน ${paid} บาท น้อยกว่า ${amount} บาท` };
    }
    return { ok: true, transRef: String(d?.transRef ?? d?.transR ?? "") };
  } catch (e) {
    console.error("[slipok]", e);
    return { ok: false, reason: "เชื่อมต่อ SlipOK ไม่สำเร็จ" };
  }
}

/** เก็บรูปสลิปที่ตรวจไม่ผ่านลง GCS — ให้แอดมินเปิดดูตัดสินเองได้ (คืน path หรือ null) */
async function storeFailedSlip(orderId: string, slipDataUrl: string): Promise<string | null> {
  try {
    const [head, b64] = slipDataUrl.split(",");
    const mime = /data:(.*?);/.exec(head)?.[1] ?? "image/jpeg";
    const ext  = mime.includes("png") ? "png" : "jpg";
    const path = `slips/${orderId}-${Date.now()}.${ext}`;
    const token = await adminAccessToken();
    const res = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${SLIP_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": mime },
        body: Buffer.from(b64, "base64"),
      }
    );
    return res.ok ? path : null;
  } catch (e) {
    console.error("[storeFailedSlip]", e);
    return null;
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
  if (!check.ok) {
    const reason = check.reason ?? "ตรวจสลิปไม่ผ่าน";
    // เก็บหลักฐานไว้ให้แอดมินตัดสินเอง (ไม่ block การตอบผู้ใช้ถ้าเก็บพลาด)
    const slipPath = await storeFailedSlip(orderId, slipBase64);
    await orderRef.update({
      lastFailReason: reason,
      lastFailAt:     FieldValue.serverTimestamp(),
      ...(slipPath ? { lastSlipPath: slipPath } : {}),
    }).catch(() => {});
    return { ok: false, reason };
  }

  // กันสลิปซ้ำ — transRef ต้อง unique
  const transRef = check.transRef || `${orderId}-noref`;
  const slipGuard = db.collection("usedSlips").doc(transRef);

  try {
    await db.runTransaction(async (tx) => {
      const g = await tx.get(slipGuard);
      if (g.exists) throw new Error("สลิปนี้ถูกใช้ไปแล้ว");

      // โค้ดส่วนลด: ตัดพร้อมกับการให้สิทธิ์ — อ่านก่อนเขียนตามกฎ tx
      // โค้ดส่วนตัว → status "used" | โค้ดกลาง → +usedCount + จดว่าใครใช้
      // ถ้าถูกใช้ไปแล้วกับออเดอร์อื่น ไม่ล้มรายการนี้ (เงินเข้ามาแล้ว) แค่ไม่ตัดซ้ำ
      const codeRef = order.discountCode
        ? db.collection("discountCodes").doc(String(order.discountCode))
        : null;
      const codeSnap = codeRef ? await tx.get(codeRef) : null;
      const useRef   = codeRef ? codeRef.collection("uses").doc(uid) : null;
      const useSnap  = useRef ? await tx.get(useRef) : null;

      const courseRef = db.collection("userCourses").doc();
      tx.set(slipGuard, { orderId, uid, at: FieldValue.serverTimestamp() });
      tx.update(orderRef, {
        status: "paid", slipRef: transRef, paidAt: FieldValue.serverTimestamp(),
      });
      if (codeRef && codeSnap?.exists) {
        const cd = codeSnap.data()!;
        if (cd.userId) {
          // โค้ดส่วนตัว — ตัดครั้งเดียว
          if (cd.status === "unused") {
            tx.update(codeRef, {
              status: "used",
              usedAt: FieldValue.serverTimestamp(),
              usedOrderId: orderId,
            });
          }
        } else if (useRef && !useSnap?.exists) {
          // โค้ดกลาง — นับจำนวนครั้ง (ตัววัด referral) + จดว่าบัญชีนี้ใช้แล้ว
          tx.update(codeRef, { usedCount: FieldValue.increment(1) });
          tx.set(useRef, {
            uid, orderId, email: order.email ?? "",
            at: FieldValue.serverTimestamp(),
          });
        }
      }
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
