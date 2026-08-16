/**
 * /api/admin/discount-codes — จัดการโค้ดส่วนลดกลาง (admin เท่านั้น)
 *
 * GET   → รายการโค้ดกลาง + จำนวนครั้งที่ถูกใช้ + ยอดขายที่มาจากโค้ดนั้น
 * POST  → สร้างโค้ดใหม่
 * PATCH → เปิด/ปิดโค้ด
 *
 * โค้ดส่วนตัวจากแบบประเมิน (มี userId) ไม่แสดงที่นี่ — มีเป็นร้อยใบ
 * ดูสรุปได้ที่ /admin/feedback แทน
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { normalizeCode } from "@/lib/discount-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "aomjai.4040@gmail.com")
    .split(",").map((s) => s.trim()).filter(Boolean).includes(email);
}

async function guard(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!isAdmin(user.email)) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (g.error) return g.error;

  try {
    const db = adminDb();
    const [codesSnap, ordersSnap] = await Promise.all([
      db.collection("discountCodes").get(),
      db.collection("orders").where("status", "==", "paid").get(),
    ]);

    // ยอดขายจริงที่มาจากแต่ละโค้ด (นับจากออเดอร์ที่จ่ายแล้ว)
    const revenue: Record<string, { orders: number; baht: number }> = {};
    ordersSnap.forEach((d) => {
      const o = d.data();
      const c = String(o.discountCode ?? "");
      if (!c) return;
      revenue[c] ??= { orders: 0, baht: 0 };
      revenue[c].orders++;
      revenue[c].baht += Number(o.amount ?? 0);
    });

    const codes = codesSnap.docs
      .filter((d) => !d.data().userId)     // เฉพาะโค้ดกลาง
      .map((d) => {
        const x = d.data();
        const ts = x.createdAt as { toDate?: () => Date } | undefined;
        return {
          code:       d.id,
          label:      String(x.label ?? ""),
          amount:     Number(x.amount ?? 0),
          tiers:      Array.isArray(x.tiers) ? x.tiers : [],
          maxUses:    Number(x.maxUses ?? 0),
          usedCount:  Number(x.usedCount ?? 0),
          alumniOnly: x.alumniOnly === true,
          active:     x.active !== false,
          expiresAt:  String(x.expiresAt ?? ""),
          createdAt:  ts?.toDate ? ts.toDate().toISOString() : null,
          revenue:    revenue[d.id] ?? { orders: 0, baht: 0 },
        };
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    // ยอดจากโค้ดส่วนตัว (แบบประเมิน) รวมเป็นก้อนเดียว
    let feedbackOrders = 0, feedbackBaht = 0;
    for (const [c, r] of Object.entries(revenue)) {
      if (!codes.some((k) => k.code === c)) { feedbackOrders += r.orders; feedbackBaht += r.baht; }
    }

    return NextResponse.json({
      codes,
      feedbackCodes: { orders: feedbackOrders, baht: feedbackBaht },
    });
  } catch (e) {
    console.error("[discount-codes GET]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));
  const code = normalizeCode(String(body.code ?? ""));
  const amount = Number(body.amount ?? 0);

  if (!/^[A-Z0-9-]{4,24}$/.test(code)) {
    return NextResponse.json({ error: "โค้ดต้องเป็น A-Z 0-9 ขีดกลาง ยาว 4–24 ตัว" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) {
    return NextResponse.json({ error: "ยอดส่วนลดไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const db  = adminDb();
    const ref = db.collection("discountCodes").doc(code);
    if ((await ref.get()).exists) {
      return NextResponse.json({ error: "มีโค้ดนี้อยู่แล้ว ใช้ชื่ออื่นนะคะ" }, { status: 409 });
    }

    await ref.set({
      code,
      label:      String(body.label ?? "").slice(0, 60),
      amount,
      tiers:      Array.isArray(body.tiers) ? body.tiers.map(String) : [],
      maxUses:    Math.max(0, Number(body.maxUses ?? 0)),
      usedCount:  0,
      alumniOnly: body.alumniOnly === true,
      active:     true,
      expiresAt:  String(body.expiresAt ?? ""),
      source:     "admin",
      createdAt:  FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, code });
  } catch (e) {
    console.error("[discount-codes POST]", e);
    return NextResponse.json({ error: "สร้างโค้ดไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const g = await guard(req);
  if (g.error) return g.error;

  const { code, active } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || typeof active !== "boolean") {
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }
  try {
    await adminDb().collection("discountCodes").doc(normalizeCode(code)).update({ active });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[discount-codes PATCH]", e);
    return NextResponse.json({ error: "อัปเดตไม่สำเร็จ" }, { status: 500 });
  }
}
