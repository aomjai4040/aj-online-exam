/**
 * /api/recall-volunteer — อาสาจำข้อสอบสนาม คร. (Aj 2026-09-17)
 *
 * GET            → สถานะของฉัน + ความคืบหน้ารวม + phase
 * GET ?admin=1   → (admin) รายชื่ออาสาทั้งหมด + ใครส่งแล้ว (join recallSubmissions)
 * POST {action}  → "assign" รับเลขข้อ (transaction กันซ้ำ, แจกข้อที่คนน้อยสุดก่อน)
 *                → "withdraw" ถอนตัว (คืนเลขเข้ากอง — ก่อนสอบเท่านั้น)
 *
 * สิทธิ์: ต้องมีคอร์สสนาม คร. (dcd-*) แพ็กไหนก็ได้
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin-config";
import { RV_TOTAL, rvPhase } from "@/lib/recall-volunteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_REF = () => adminDb().collection("recallVolunteerMeta").doc("dcd69");
const VOL = () => adminDb().collection("recallVolunteers");

async function hasDcd(uid: string): Promise<boolean> {
  const snap = await adminDb().collection("userCourses").where("userId", "==", uid).get();
  return snap.docs.some((d) => String(d.data().courseId ?? "").toLowerCase().startsWith("dcd-"));
}

function summarize(counts: Record<string, number>) {
  let assigned = 0, mainFilled = 0;
  for (let i = 1; i <= RV_TOTAL; i++) {
    const n = counts[String(i)] ?? 0;
    assigned += n;
    if (n >= 1) mainFilled++;
  }
  return { assigned, mainFilled, total: RV_TOTAL };
}

export async function GET(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = adminDb();

  // ── โหมด admin: รายชื่อ + สถานะส่งจริง ──
  if (req.nextUrl.searchParams.get("admin") === "1") {
    if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const [volSnap, subSnap] = await Promise.all([
      VOL().get(),
      db.collection("recallSubmissions").where("field", "==", "dcd").get(),
    ]);
    const submittedByUser = new Set(subSnap.docs.map((d) => String(d.data().userId ?? "")));
    const submittedNos = new Set(subSnap.docs.map((d) => Number(d.data().no ?? 0)).filter(Boolean));
    const rows = volSnap.docs.map((d) => {
      const x = d.data();
      return {
        no: Number(x.no), round: Number(x.round ?? 1),
        email: String(x.email ?? ""), name: String(x.name ?? ""),
        submitted: submittedByUser.has(d.id),
      };
    }).sort((a, b) => a.no - b.no || a.round - b.round);
    const meta = (await META_REF().get()).data() ?? { counts: {} };
    return NextResponse.json({
      ...summarize(meta.counts ?? {}),
      volunteers: rows.length,
      submittedPeople: rows.filter((r) => r.submitted).length,
      submittedNos: submittedNos.size,
      rows,
    });
  }

  // ── คลังความจำแบบเห็นเนื้อหา (สมาชิก คร. หรือ admin — หน้า /recall-dcd) ──
  // โชว์โจทย์+ช้อยที่รวบรวมได้ของแต่ละข้อ ให้น้องเห็นว่าขาดอะไรแล้วเติมตรงจุด
  // (Aj 2026-09-20 ค่ำ: "เปิดระบบให้น้องเห็นข้อสอบทั้งหมด แล้วช่วยเติม")
  // ไม่ส่งเฉลย/ชื่อผู้ส่งออกไป — ส่งแค่สถานะว่าข้อนั้นเฉลยยืนยันแล้วหรือยัง
  if (req.nextUrl.searchParams.get("bank") === "1") {
    if (!isAdmin(user.email) && !(await hasDcd(user.uid))) {
      return NextResponse.json({ error: "no-access" }, { status: 403 });
    }
    const [subSnap, verSnap] = await Promise.all([
      db.collection("recallSubmissions").where("field", "==", "dcd").get(),
      db.collection("recallVerdicts").get(),
    ]);
    const verdictNos = new Set<number>();
    verSnap.forEach((d) => {
      const m = /^dcd-(\d+)$/.exec(d.id);
      if (m && d.data().status === "confirmed") verdictNos.add(Number(m[1]));
    });
    type Sub = { no?: unknown; text?: unknown; options?: unknown; status?: unknown;
      createdAt?: { toMillis?: () => number } };
    const byNo = new Map<number, Sub[]>();
    subSnap.forEach((d) => {
      const x = d.data() as Sub;
      if (x.status === "rejected") return;
      const no = Number(x.no);
      if (!Number.isInteger(no) || no < 1 || no > RV_TOTAL) return;
      if (!byNo.has(no)) byNo.set(no, []);
      byNo.get(no)!.push(x);
    });
    const filledCount = (s: Sub) => (Array.isArray(s.options) ? s.options : []).filter(Boolean).length;
    const items = [...byNo.entries()].map(([no, g]) => {
      // ใบหลัก: กติกาเดียวกับตัวสร้างชุดข้อสอบ (merged ก่อน → ช้อยครบสุด → มาก่อน)
      const p = [...g].sort((a, b) =>
        Number(b.status === "merged") - Number(a.status === "merged")
        || filledCount(b) - filledCount(a)
        || (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))[0];
      const opts = Array.isArray(p.options) ? p.options : [];
      return {
        no,
        text: String(p.text ?? ""),
        options: [0, 1, 2, 3].map((i) => String(opts[i] ?? "")),
        verdict: verdictNos.has(no),
        count: g.length,
      };
    }).sort((a, b) => a.no - b.no);
    return NextResponse.json({ items, total: RV_TOTAL });
  }

  // ── สถานะของฉัน (สมาชิก คร.) ──
  if (!(await hasDcd(user.uid))) return NextResponse.json({ error: "no-access" }, { status: 403 });
  const [mine, meta, mySubs] = await Promise.all([
    VOL().doc(user.uid).get(),
    META_REF().get(),
    db.collection("recallSubmissions")
      .where("userId", "==", user.uid).where("field", "==", "dcd").limit(1).get(),
  ]);
  return NextResponse.json({
    phase: rvPhase(),
    ...summarize((meta.data()?.counts ?? {}) as Record<string, number>),
    mine: mine.exists ? { no: mine.data()!.no, round: mine.data()!.round ?? 1 } : null,
    submitted: !mySubs.empty,
  });
}

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await hasDcd(user.uid))) return NextResponse.json({ error: "no-access" }, { status: 403 });

  const { action } = await req.json().catch(() => ({}));
  const db = adminDb();
  const myRef = VOL().doc(user.uid);

  try {
    if (action === "assign") {
      if (rvPhase() !== "before") {
        return NextResponse.json({ error: "หมดช่วงรับอาสาแล้วค่ะ" }, { status: 409 });
      }
      const result = await db.runTransaction(async (tx) => {
        const mine = await tx.get(myRef);
        if (mine.exists) return { no: mine.data()!.no, round: mine.data()!.round ?? 1 };

        const metaSnap = await tx.get(META_REF());
        const counts: Record<string, number> = { ...(metaSnap.data()?.counts ?? {}) };
        // หา "จำนวนคนต่อข้อ" ต่ำสุด แล้วสุ่มจากกลุ่มนั้น — รอบหลักหมดจึงวนรอบสำรอง
        let min = Infinity;
        for (let i = 1; i <= RV_TOTAL; i++) min = Math.min(min, counts[String(i)] ?? 0);
        const candidates: number[] = [];
        for (let i = 1; i <= RV_TOTAL; i++) if ((counts[String(i)] ?? 0) === min) candidates.push(i);
        const no = candidates[Math.floor(Math.random() * candidates.length)];
        const round = min + 1;

        counts[String(no)] = min + 1;
        tx.set(META_REF(), { counts }, { merge: true });
        tx.set(myRef, {
          userId: user.uid,
          email: user.email ?? "",
          name: "",
          no, round,
          assignedAt: FieldValue.serverTimestamp(),
        });
        return { no, round };
      });
      return NextResponse.json({ ok: true, mine: result });
    }

    if (action === "withdraw") {
      if (rvPhase() !== "before") {
        return NextResponse.json({ error: "เลยช่วงถอนตัวแล้วค่ะ" }, { status: 409 });
      }
      await db.runTransaction(async (tx) => {
        const mine = await tx.get(myRef);
        if (!mine.exists) return;
        const no = String(mine.data()!.no);
        const metaSnap = await tx.get(META_REF());
        const counts: Record<string, number> = { ...(metaSnap.data()?.counts ?? {}) };
        counts[no] = Math.max(0, (counts[no] ?? 1) - 1);
        tx.set(META_REF(), { counts }, { merge: true });
        tx.delete(myRef);
      });
      return NextResponse.json({ ok: true, mine: null });
    }

    return NextResponse.json({ error: "bad-action" }, { status: 400 });
  } catch (e) {
    console.error("[recall-volunteer]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
