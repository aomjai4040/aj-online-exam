/**
 * POST /api/admin/order-action — จัดการออเดอร์ค้างจากหน้า /admin/insights
 * body: { orderId, action: "approve" | "reject" }
 *
 * approve = แอดมินเช็คสลิป/ยอดเงินเองแล้ว → ให้สิทธิ์ทันที (ใช้กรณี SlipOK ตรวจไม่ผ่าน
 *           แต่เงินเข้าจริง) — atomic เหมือน submitSlip แต่ข้ามการตรวจสลิป
 * reject  = ปิดออเดอร์ (ลูกค้าได้สิทธิ์ทางอื่นแล้ว / ออเดอร์ทดสอบ / ไม่จ่ายจริง)
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const caller = await verifyBearer(req.headers.get("authorization"));
  if (!caller || !isAdmin(caller.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { orderId?: string; action?: string } | null;
  const orderId = String(body?.orderId ?? "");
  const action  = String(body?.action ?? "");
  if (!orderId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) return NextResponse.json({ error: "not-found" }, { status: 404 });
    const order = snap.data()!;
    if (order.status !== "pending") {
      return NextResponse.json({ error: "not-pending", status: order.status }, { status: 409 });
    }

    if (action === "reject") {
      await orderRef.update({
        status: "rejected",
        rejectedAt: FieldValue.serverTimestamp(),
        rejectedBy: caller.email,
      });
      return NextResponse.json({ ok: true, action });
    }

    // approve — ให้สิทธิ์ + ปิดออเดอร์ใน transaction เดียว
    await db.runTransaction(async (tx) => {
      const courseRef = db.collection("userCourses").doc();
      tx.update(orderRef, {
        status:     "paid",
        slipRef:    `MANUAL-${Date.now()}`,
        paidAt:     FieldValue.serverTimestamp(),
        approvedBy: caller.email,   // ร่องรอยว่าใครอนุมัติมือ
      });
      tx.set(courseRef, {
        userId:         order.userId,
        email:          order.email,
        courseId:       order.courseId,
        courseName:     order.courseName,
        activatedAt:    FieldValue.serverTimestamp(),
        activationCode: `MANUAL-${orderId.slice(0, 8).toUpperCase()}`,
        source:         "manual-approve",
      });
    });
    return NextResponse.json({ ok: true, action });
  } catch (e) {
    console.error("[admin/order-action]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
