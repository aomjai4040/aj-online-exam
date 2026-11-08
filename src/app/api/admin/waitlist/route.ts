/**
 * /api/admin/waitlist — ข้อมูลคิวรอคอร์สสำหรับหน้า admin
 *   GET    → ทุกแถว + บันทึกการส่งอีเมลรายสนาม
 *   DELETE → ลบรายคน (เมื่อมีคนขอลบข้อมูล) body: { email }
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { normalizeEmail, type WaitlistRow, type NotifyLog } from "@/lib/waitlist-types";

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

const iso = (v: unknown): string => {
  const d = (v as { toDate?: () => Date } | undefined)?.toDate?.();
  return d ? d.toISOString() : "";
};

export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (g.error) return g.error;

  try {
    const db = adminDb();
    const [rowsSnap, logsSnap] = await Promise.all([
      db.collection("waitlist").get(),
      db.collection("waitlistNotifies").get(),
    ]);
    const rows: WaitlistRow[] = rowsSnap.docs.map((d) => {
      const x = d.data();
      return {
        email: d.id,
        name:      String(x.name ?? ""),
        fields:    Array.isArray(x.fields) ? x.fields.map(String) : [],
        otherText: String(x.otherText ?? ""),
        status:    String(x.status ?? ""),
        source:    String(x.source ?? ""),
        consentAt: iso(x.consentAt),
        createdAt: iso(x.createdAt),
        updatedAt: iso(x.updatedAt),
        unsub:     x.unsub === true,
      };
    });
    const logs: NotifyLog[] = logsSnap.docs.map((d) => {
      const x = d.data();
      return {
        field:      d.id,
        lastSentAt: iso(x.lastSentAt),
        totalSent:  Number(x.totalSent ?? 0),
        rounds:     Number(x.rounds ?? 0),
      };
    });
    return NextResponse.json({ rows, logs });
  } catch (e) {
    console.error("[admin waitlist GET]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req);
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));
  if (!email) return NextResponse.json({ error: "bad-body" }, { status: 400 });
  try {
    await adminDb().collection("waitlist").doc(email).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin waitlist DELETE]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
