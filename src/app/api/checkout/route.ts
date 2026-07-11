import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/firebase-admin";
import { createOrder, CheckoutError } from "@/lib/payment-server";
import type { OrderTier } from "@/lib/order-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: OrderTier[] = ["app", "full", "upgrade"];

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tier } = await req.json().catch(() => ({}));
  if (!VALID.includes(tier)) {
    return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  }

  try {
    const order = await createOrder(user.uid, user.email, tier);
    return NextResponse.json(order);
  } catch (e) {
    if (e instanceof CheckoutError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[checkout]", e);
    return NextResponse.json({ error: "checkout-failed" }, { status: 500 });
  }
}
