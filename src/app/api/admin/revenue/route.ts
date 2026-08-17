/**
 * GET /api/admin/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD — รายงานยอดขายตามช่วงเวลา
 *
 * คืน "แถวดิบ" ของออเดอร์ที่จ่ายแล้วในช่วง แล้วให้หน้าเว็บสรุปเอง (lib/revenue.ts)
 * — สรุปฝั่ง client ได้เพราะจำนวนออเดอร์ยังหลักร้อย และทำให้ปุ่ม export CSV
 *   ไม่ต้องยิง API ซ้ำ
 *
 * ป้องกัน: Bearer ID token + อีเมลใน ADMIN_EMAILS (แบบเดียวกับ insights)
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin-config";
import { bkkDay, shiftDay, dayCount, isTestEmail, type RevenueRow, type Channel } from "@/lib/revenue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** กันหลุด: ถ้าออเดอร์โตเกินนี้ต้องเปลี่ยนไปสรุปฝั่ง server */
const MAX_ROWS = 5000;

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * เติม codeGroup ให้ทุกแถวที่ใช้โค้ด
 *
 * โค้ดรายบุคคล (มี userId — ออกจากแบบประเมิน ใบละคน) ถูกยุบเป็น "AJ100-*"
 * ไม่งั้นรายงานจะขึ้นเป็นร้อยแถว แถวละ 1 ครั้ง
 * โค้ดกลางที่ Aj สร้างเอง (ไม่มี userId) คงเป็นแถวของตัวเอง
 *
 * อ่านเฉพาะโค้ดที่ปรากฏในช่วงนี้ (getAll) — ไม่สแกนทั้ง collection
 */
async function fillCodeGroups(rows: RevenueRow[]): Promise<void> {
  const codes = [...new Set(rows.map((r) => r.code).filter(Boolean))];
  if (codes.length === 0) return;

  const db    = adminDb();
  const group = new Map<string, string>();
  for (let i = 0; i < codes.length; i += 300) {   // แบ่งก้อน กันช่วงเวลายาว ๆ ยิงทีเดียวเยอะเกิน
    const refs = codes.slice(i, i + 300).map((c) => db.collection("discountCodes").doc(c));
    const docs = await db.getAll(...refs);
    docs.forEach((d) => {
      // ไม่เจอ doc (ถูกลบไปแล้ว) → ใช้ชื่อโค้ดตามเดิม ปลอดภัยกว่าเดาจากรูปแบบ
      const personal = d.exists && Boolean(d.data()?.userId);
      group.set(d.id, personal ? `${d.id.split("-")[0]}-*` : d.id);
    });
  }

  for (const r of rows) {
    if (r.code) r.codeGroup = group.get(r.code) ?? r.code;
  }
}

export async function GET(req: NextRequest) {
  const caller = await verifyBearer(req.headers.get("authorization"));
  if (!caller || !isAdmin(caller.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = bkkDay(new Date());
  const q     = req.nextUrl.searchParams;
  const from  = isDay(q.get("from") ?? "") ? q.get("from")! : `${today.slice(0, 7)}-01`;
  const to    = isDay(q.get("to")   ?? "") ? q.get("to")!   : today;
  if (from > to) return NextResponse.json({ error: "bad-range" }, { status: 400 });

  // ช่วงก่อนหน้าที่ยาวเท่ากัน — ไว้เทียบว่าโตขึ้นหรือลดลง
  const span     = dayCount(from, to);
  const prevTo   = shiftDay(from, -1);
  const prevFrom = shiftDay(prevTo, -(span - 1));

  try {
    const db = adminDb();
    // ออเดอร์ยังหลักร้อย — ดึงทั้งก้อนแล้วกรองในหน่วยความจำ
    // (ไม่ใช้ where + range เพราะต้องสร้าง composite index เพิ่ม)
    const [ordersSnap, coursesSnap] = await Promise.all([
      db.collection("orders").get(),
      db.collection("userCourses").get(),
    ]);

    const rows: RevenueRow[] = [];
    let prevAmount = 0, prevCount = 0;
    let allTimeAmount = 0, allTimeCount = 0;
    let firstPaidDay = today;

    ordersSnap.forEach((doc) => {
      const o = doc.data();
      if (o.status !== "paid") return;

      // ออเดอร์เก่าบางใบไม่มี paidAt (อนุมัติก่อนมีฟิลด์นี้) → ใช้วันสร้างแทน
      const at: Date | undefined = o.paidAt?.toDate?.() ?? o.createdAt?.toDate?.();
      if (!at) return;
      const day = bkkDay(at);

      const amount     = Number(o.amount ?? 0);
      const fullAmount = Number(o.fullAmount ?? o.amount ?? 0);
      const email      = String(o.email ?? "");
      const test       = isTestEmail(email);

      if (!test) {
        allTimeAmount += amount;
        allTimeCount++;
        if (day < firstPaidDay) firstPaidDay = day;
        if (day >= prevFrom && day <= prevTo) { prevAmount += amount; prevCount++; }
      }
      if (day < from || day > to) return;
      if (rows.length >= MAX_ROWS) return;

      // อนุมัติมือ = แอดมินเช็คเงินเข้าเองแล้วกดให้สิทธิ์ (slipRef ขึ้นต้น MANUAL-)
      const channel: Channel =
        o.approvedBy || String(o.slipRef ?? "").startsWith("MANUAL-") ? "manual" : "auto";

      rows.push({
        id:         doc.id,
        day,
        at:         at.toISOString(),
        email,
        tier:       String(o.tier ?? ""),
        courseId:   String(o.courseId ?? ""),
        courseName: String(o.courseName ?? ""),
        amount,
        fullAmount,
        discount:   Math.max(0, fullAmount - amount),
        code:       String(o.discountCode ?? ""),
        codeGroup:  "",   // เติมหลังอ่าน discountCodes ด้านล่าง
        channel,
        isTest:     test,
      });
    });

    rows.sort((a, b) => b.at.localeCompare(a.at));
    await fillCodeGroups(rows);

    // ── สิทธิ์ที่ให้ไปโดยไม่ผ่านหน้าชำระเงิน (โค้ด/แจกมือ) ในช่วงเดียวกัน ──
    // ยังไม่มีการบันทึกยอดเงิน → หน้าเว็บเอาไปขึ้นกล่องเตือนว่ารายงานยังไม่ครบ
    let unpricedGrants = 0;
    const unpricedByCourse: Record<string, number> = {};
    coursesSnap.forEach((doc) => {
      const c = doc.data();
      if (c.source === "payment") return;               // มาจากออเดอร์ นับในรายงานแล้ว
      const ts: Date | undefined = c.activatedAt?.toDate?.();
      if (!ts) return;
      const day = bkkDay(ts);
      if (day < from || day > to) return;
      unpricedGrants++;
      const courseId = String(c.courseId ?? "ไม่ระบุ");
      unpricedByCourse[courseId] = (unpricedByCourse[courseId] || 0) + 1;
    });

    return NextResponse.json({
      from, to, prevFrom, prevTo,
      rows,
      truncated: rows.length >= MAX_ROWS,
      prev:    { amount: prevAmount, count: prevCount },
      allTime: { amount: allTimeAmount, count: allTimeCount, firstDay: firstPaidDay },
      unpriced: { count: unpricedGrants, byCourse: unpricedByCourse },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[admin/revenue]", e);
    return NextResponse.json({ error: "revenue-failed" }, { status: 500 });
  }
}
