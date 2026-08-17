/**
 * GET /api/admin/insights — สถิติธุรกิจสำหรับ admin (คน/ยอดขาย/funnel)
 * ป้องกัน: ต้องเป็น admin (ตรวจ Bearer ID token + อีเมลใน ADMIN_EMAILS)
 * ใช้ Admin SDK aggregate ฝั่ง server — ไม่ดึงเอกสารทั้งหมดมา client
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin-config";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS = 14;
const bkkDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d); // YYYY-MM-DD

export async function GET(req: NextRequest) {
  const caller = await verifyBearer(req.headers.get("authorization"));
  if (!caller || !isAdmin(caller.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = adminDb();
    const now = Date.now();
    const cutoff = Timestamp.fromMillis(now - DAYS * 86_400_000);

    const [usersCnt, coursesSnap, ordersSnap, resSnap] = await Promise.all([
      db.collection("users").count().get(),
      db.collection("userCourses").get(),
      db.collection("orders").get(),
      db.collection("results").where("submittedAt", ">=", cutoff).get(),
    ]);

    // ── สิทธิ์คอร์ส: แยกโค้ด vs ซื้อผ่านเว็บ + เจ้าของ (กันซ้ำ) ──
    const owners = new Set<string>();
    let codeGrants = 0, paidGrants = 0;
    const ownerEmails = new Set<string>();  // อีเมลที่มีสิทธิ์คอร์สแล้ว (ไว้จับคู่ออเดอร์ค้าง)
    const newGrantByDay: Record<string, number> = {};
    // แยกเจ้าของตามสนาม — ป้าย "มีสิทธิ์แล้ว" ต้องดูสนามเดียวกับออเดอร์เท่านั้น
    // (เดิมเช็ครวมทุกสนาม → คนมีคอร์ส สป.สธ. ที่จ่ายคอร์ส คร. ถูกซ่อนปุ่มอนุมัติ)
    const dcdOwners = new Set<string>(), dcdOwnerEmails = new Set<string>();
    coursesSnap.forEach((d) => {
      const c = d.data();
      const isDcd = String(c.courseId ?? "").toLowerCase().startsWith("dcd-");
      if (isDcd) {
        if (c.userId) dcdOwners.add(c.userId);
        if (c.email) dcdOwnerEmails.add(String(c.email).toLowerCase());
      } else {
        if (c.userId) owners.add(c.userId);
        if (c.email) ownerEmails.add(String(c.email).toLowerCase());
      }
      if (c.source === "payment") paidGrants++; else codeGrants++;
      const ts = c.activatedAt?.toDate?.();
      if (ts && ts.getTime() >= now - DAYS * 86_400_000) {
        const k = bkkDay(ts);
        newGrantByDay[k] = (newGrantByDay[k] || 0) + 1;
      }
    });

    // ── ออเดอร์ในเว็บ ──
    const paid = { app: 0, full: 0, upgrade: 0 } as Record<string, number>;
    let revenue = 0, pending = 0, rejected = 0;
    const pendingList: {
      id: string; email: string; tier: string; amount: number; createdAt: string | null;
      hasAccess: boolean; failReason: string | null; slipPath: string | null;
      manualReview: boolean;
    }[] = [];
    ordersSnap.forEach((d) => {
      const o = d.data();
      if (o.status === "paid") { paid[o.tier] = (paid[o.tier] || 0) + 1; revenue += o.amount || 0; }
      else if (o.status === "pending") {
        pending++;
        // ลูกค้าได้สิทธิ์ "สนามเดียวกับออเดอร์นี้" แล้วหรือยัง → ปิดออเดอร์ค้างได้
        const em = String(o.email || "").toLowerCase();
        const hasAccess = o.tier === "dcd"
          ? dcdOwners.has(o.userId) || dcdOwnerEmails.has(em)
          : owners.has(o.userId)    || ownerEmails.has(em);
        pendingList.push({
          id: d.id, email: o.email || "", tier: o.tier, amount: o.amount || 0,
          createdAt: o.createdAt?.toDate?.()?.toISOString() ?? null,
          hasAccess,
          failReason: o.lastFailReason ? String(o.lastFailReason) : null,
          slipPath:   o.lastSlipPath   ? String(o.lastSlipPath)   : null,
          manualReview: o.manualReview === true, // ลูกค้ากดยืนยัน "โอนแล้วจริง" รอตรวจมือ
        });
      } else if (o.status === "rejected") rejected++;
    });
    // เรียงออเดอร์ค้างจากรายการล่าสุดลงไป (ไม่มีวันที่ = ท้ายสุด)
    pendingList.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    // ── กิจกรรมทำข้อสอบรายวัน (นับคนจาก userId ถ้ามี ไม่งั้น studentName) ──
    const byDay: Record<string, { attempts: number; people: Set<string> }> = {};
    resSnap.forEach((d) => {
      const r = d.data();
      const ts = r.submittedAt?.toDate?.(); if (!ts) return;
      const k = bkkDay(ts);
      (byDay[k] ??= { attempts: 0, people: new Set() });
      byDay[k].attempts++;
      byDay[k].people.add(r.userId || r.userEmail || (r.studentName || "?").trim());
    });

    // ── ประกอบซีรีส์รายวันย้อนหลัง DAYS วัน ──
    const daily: { day: string; people: number; attempts: number; newGrants: number }[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const k = bkkDay(new Date(now - i * 86_400_000));
      const b = byDay[k];
      daily.push({
        day: k,
        people: b ? b.people.size : 0,
        attempts: b ? b.attempts : 0,
        newGrants: newGrantByDay[k] || 0,
      });
    }

    const users = usersCnt.data().count;
    return NextResponse.json({
      users,
      codeGrants,
      paidGrants,
      trialUsers: Math.max(users - owners.size, 0), // ล็อกอินแต่ยังไม่มีสิทธิ์
      revenue,
      paid,
      pending,
      rejected,
      pendingList,
      daily,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[admin/insights]", e);
    return NextResponse.json({ error: "insights-failed" }, { status: 500 });
  }
}
