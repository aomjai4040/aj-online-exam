/**
 * /api/checkout/code — ใส่/ถอดโค้ดส่วนลดกับออเดอร์ที่ยังไม่จ่าย
 *
 * POST   { orderId, code } → ยอดใหม่ + QR ใหม่ (ยอดฝังใน QR ต้องตรงกับยอดจริง)
 * DELETE { orderId }       → กลับไปยอดเต็ม
 *
 * ตรวจสิทธิ์เจ้าของโค้ด/สถานะ/วันหมดอายุ ฝั่ง server ทั้งหมด
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/firebase-admin";
import { applyDiscount, removeDiscount, CheckoutError } from "@/lib/payment-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orderId, code } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string" || typeof code !== "string") {
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  try {
    return NextResponse.json(await applyDiscount(user.uid, orderId, code));
  } catch (e) {
    if (e instanceof CheckoutError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[checkout code]", e);
    return NextResponse.json({ error: "ใช้โค้ดไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== "string") {
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  try {
    return NextResponse.json(await removeDiscount(user.uid, orderId));
  } catch (e) {
    if (e instanceof CheckoutError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[checkout code delete]", e);
    return NextResponse.json({ error: "ยกเลิกโค้ดไม่สำเร็จ" }, { status: 500 });
  }
}
