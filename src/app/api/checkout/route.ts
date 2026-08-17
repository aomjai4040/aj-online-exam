import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { createOrder, pendingOrder, alreadyOwns, CheckoutError } from "@/lib/payment-server";
import type { OrderTier } from "@/lib/order-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: OrderTier[] = ["app", "review", "full", "upgrade", "up-review", "up-full2", "dcd"];

/** สถานะก่อนเข้าหน้าจ่ายเงิน — ถามก่อนเสมอ จะได้ไม่ถามแบบสอบถามคนที่ซื้อไปแล้ว
 *
 *  owned      → มีคอร์สนี้แล้ว ไม่ต้องให้จ่ายซ้ำ
 *  pending    → มีออเดอร์ค้าง (โอนแล้วแต่ยังไม่ส่งสลิป) → โชว์ QR ยอดเดิม
 *  intakeDone → เคยตอบแบบสอบถามแล้ว (เช็คที่ server ไม่ใช่ localStorage
 *               เพราะน้องเปลี่ยนเครื่อง/ล้างแคชแล้วโดนถามซ้ำ) */
export async function GET(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tier = req.nextUrl.searchParams.get("tier") as OrderTier | null;
  if (!tier || !VALID.includes(tier)) {
    return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  }

  try {
    const [owned, pending, intakeSnap] = await Promise.all([
      alreadyOwns(user.uid, tier),
      pendingOrder(user.uid, tier),
      tier === "dcd"
        ? adminDb().collection("dcdIntake").doc(user.uid).get()
        : Promise.resolve(null),
    ]);
    return NextResponse.json({
      owned, pending, intakeDone: intakeSnap?.exists ?? false,
    });
  } catch (e) {
    console.error("[checkout GET]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tier, intake } = await req.json().catch(() => ({}));
  if (!VALID.includes(tier)) {
    return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  }

  try {
    const order = await createOrder(user.uid, user.email, tier);

    // แบบสอบถามก่อนจ่ายของคอร์ส คร. — เก็บแยก 1 doc/คน (พลาดก็ไม่ block การจ่าย)
    if (tier === "dcd" && intake && typeof intake === "object" && !Array.isArray(intake)) {
      await adminDb().collection("dcdIntake").doc(user.uid).set({
        userId:    user.uid,
        email:     user.email,
        answers:   intake,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch((e) => console.warn("[checkout] intake save failed:", e));
    }

    return NextResponse.json(order);
  } catch (e) {
    if (e instanceof CheckoutError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[checkout]", e);
    return NextResponse.json({ error: "checkout-failed" }, { status: 500 });
  }
}
