/**
 * POST /api/admin/migrate-user — ย้ายสิทธิ์+ข้อมูลเรียนไปบัญชีใหม่ (น้องเปลี่ยนอีเมล)
 * body: { fromEmail, toEmail }
 *
 * เงื่อนไข: บัญชีใหม่ต้องเคย login แล้ว (มี users/{uid} พร้อม email)
 * ย้าย: userCourses (สิทธิ์) + ทุก subcollection ใต้ users/{oldUid}
 *       (history, wrongQuestions, videoProgress, dailyQuiz, examSummaries, fcProgress ฯลฯ)
 *       ยกเว้น "devices" — ให้เริ่มนับเครื่องใหม่ที่บัญชีใหม่
 * ของเก่าถูกลบหลังคัดลอกเสร็จ (กันสิทธิ์ซ้อนสองบัญชี)
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // wrongQuestions อาจหลายร้อยข้อ

async function uidByEmail(db: FirebaseFirestore.Firestore, email: string): Promise<string | null> {
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function POST(req: NextRequest) {
  const caller = await verifyBearer(req.headers.get("authorization"));
  if (!caller || !isAdmin(caller.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { fromEmail?: string; toEmail?: string } | null;
  const fromEmail = String(body?.fromEmail ?? "").trim().toLowerCase();
  const toEmail   = String(body?.toEmail ?? "").trim().toLowerCase();
  if (!fromEmail || !toEmail || fromEmail === toEmail) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const [fromUid, toUid] = await Promise.all([
      uidByEmail(db, fromEmail), uidByEmail(db, toEmail),
    ]);
    if (!fromUid) return NextResponse.json({ error: "ไม่พบบัญชีอีเมลเดิมในระบบ" }, { status: 404 });
    if (!toUid)   return NextResponse.json({
      error: "ไม่พบบัญชีอีเมลใหม่ — ให้น้องล็อกอินด้วยอีเมลใหม่ 1 ครั้งก่อน แล้วลองอีกที",
    }, { status: 404 });

    // ── 1) ย้ายสิทธิ์คอร์ส (userCourses ชี้ uid+email ใหม่ — เอกสารเดิม ไม่สร้างซ้ำ) ──
    const courses = await db.collection("userCourses").where("userId", "==", fromUid).get();
    for (const d of courses.docs) {
      await d.ref.update({
        userId: toUid, email: toEmail,
        migratedFrom: fromEmail, migratedAt: new Date(), migratedBy: caller.email,
      });
    }

    // ── 2) คัดลอกทุก subcollection ใต้ users/{fromUid} → users/{toUid} แล้วลบต้นทาง ──
    const fromRef = db.collection("users").doc(fromUid);
    const toRef   = db.collection("users").doc(toUid);
    const subcols = await fromRef.listCollections();
    const movedBySubcol: Record<string, number> = {};

    for (const col of subcols) {
      if (col.id === "devices") continue; // เริ่มนับเครื่องใหม่
      const docs = await col.get();
      movedBySubcol[col.id] = docs.size;
      // batch ละไม่เกิน 200 คู่ (set+delete = 400 writes/batch — ใต้ลิมิต 500)
      for (let i = 0; i < docs.docs.length; i += 200) {
        const batch = db.batch();
        for (const d of docs.docs.slice(i, i + 200)) {
          batch.set(toRef.collection(col.id).doc(d.id), d.data(), { merge: true });
          batch.delete(d.ref);
        }
        await batch.commit();
      }
    }

    return NextResponse.json({
      ok: true,
      coursesMoved: courses.size,
      movedBySubcol,
      fromUid, toUid,
    });
  } catch (e) {
    console.error("[admin/migrate-user]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
