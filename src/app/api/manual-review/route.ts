/**
 * /api/manual-review — ลูกค้ายืนยัน "โอนแล้วจริง" หลังสลิปตรวจอัตโนมัติไม่ผ่าน
 *
 * ที่มา (Aj 2026-08-16): คอร์สก่อนมีคนอัปสลิปไม่ผ่านหลายคน แล้วคิดว่าจ่ายไม่สำเร็จ
 * → โอนซ้ำ/ทักไลน์วุ่น ทั้งที่สลิปที่ไม่ผ่านถูกเก็บไว้ให้แอดมินดูอยู่แล้ว
 * endpoint นี้แค่ติดธง manualReview ให้ออเดอร์ → ฝั่งลูกค้าเห็นสถานะ "รอพี่อ้อมตรวจ"
 * แทนทางตัน · ฝั่ง /admin/insights เห็นป้ายส้มว่าลูกค้ายืนยันโอนแล้ว
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string" || !orderId) {
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  try {
    const ref  = adminDb().collection("orders").doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "ไม่พบคำสั่งซื้อ" }, { status: 404 });

    const o = snap.data()!;
    if (o.userId !== user.uid) {
      return NextResponse.json({ error: "คำสั่งซื้อไม่ใช่ของบัญชีนี้" }, { status: 403 });
    }
    if (o.status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });
    if (o.status !== "pending") {
      return NextResponse.json({ error: "คำสั่งซื้อนี้ปิดแล้ว" }, { status: 409 });
    }

    await ref.update({
      manualReview:   true,
      manualReviewAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[manual-review]", e);
    return NextResponse.json({ error: "ส่งเรื่องไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
