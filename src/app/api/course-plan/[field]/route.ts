/**
 * /api/course-plan/[field] — ปฏิทินคอร์สรายสนาม
 *
 * GET  → ใครที่ล็อกอินอ่านได้ (หน้าแรก + หน้าปฏิทินใช้)
 * PUT  → admin เท่านั้น (บันทึกทั้ง doc ทีเดียว — แผนไม่ใหญ่ ~30 วัน)
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { EMPTY_PLAN, type CoursePlan, type PlanDay } from "@/lib/course-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "aomjai.4040@gmail.com")
    .split(",").map((s) => s.trim()).includes(email);
}

export async function GET(
  req: NextRequest, { params }: { params: Promise<{ field: string }> },
) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { field } = await params;
  try {
    const snap = await adminDb().collection("coursePlans").doc(field).get();
    if (!snap.exists) return NextResponse.json(EMPTY_PLAN(field));
    const d = snap.data()!;
    return NextResponse.json({
      fieldId:   field,
      startDate: String(d.startDate ?? ""),
      days:      Array.isArray(d.days) ? d.days : [],
    } satisfies CoursePlan);
  } catch (e) {
    console.error("[course-plan GET]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest, { params }: { params: Promise<{ field: string }> },
) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { field } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.startDate !== "string" || !Array.isArray(body.days)) {
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  // ล้างข้อมูลก่อนเขียน — กันฟิลด์แปลกปลอมและ undefined
  const raw = body.days as Record<string, unknown>[];
  const days = raw
    .map((d, i) => ({
      n:     Number(d.n) || i + 1,
      title: String(d.title ?? "").slice(0, 120),
      items: (Array.isArray(d.items) ? d.items as Record<string, unknown>[] : [])
        .slice(0, 6)
        .map((it) => ({
          kind:  String(it.kind ?? "link"),
          label: String(it.label ?? "").slice(0, 160),
          href:  String(it.href ?? "").slice(0, 400),
        })),
    }))
    .sort((a, b) => a.n - b.n) as unknown as PlanDay[];

  try {
    await adminDb().collection("coursePlans").doc(field).set({
      startDate: body.startDate, days,
    });
    return NextResponse.json({ ok: true, days: days.length });
  } catch (e) {
    console.error("[course-plan PUT]", e);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
