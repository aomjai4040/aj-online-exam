import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/firebase-admin";
import { submitSlip } from "@/lib/payment-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orderId, slip } = await req.json().catch(() => ({}));
  if (!orderId || !slip) {
    return NextResponse.json({ error: "missing orderId or slip" }, { status: 400 });
  }

  const result = await submitSlip(user.uid, String(orderId), String(slip));
  if (result.ok) return NextResponse.json({ ok: true, courseName: result.courseName });
  return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
}
