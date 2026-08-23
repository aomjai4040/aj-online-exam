/**
 * /api/admin/feedback — สรุปผลแบบประเมิน (admin เท่านั้น)
 *
 * รวมฝั่ง server เพราะจำนวนสมาชิกหลายร้อยคน — ไม่ควรดึงดิบทั้งหมดมาที่ browser
 * คืนเป็นตัวเลขรวม + ข้อความอิสระ (ไม่ผูกชื่อ) ตามที่บอกน้องไว้ในหน้าแบบประเมิน
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { SURVEY, type SurveyAnswers } from "@/lib/feedback-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "aomjai.4040@gmail.com")
    .split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!adminEmails().includes(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const db = adminDb();
    const [fbSnap, ansSnap, codeSnap, courseSnap] = await Promise.all([
      db.collection("feedback").get(),
      db.collection("feedbackAnswers").get(),
      db.collection("discountCodes").get(),
      db.collection("userCourses").get(),
    ]);

    // migration ครั้งเดียว: ใบที่ส่งก่อนแยกเก็บนิรนาม (answers ติดอยู่ใน feedback/{uid})
    // → ย้ายเข้า feedbackAnswers แล้วลบออกจาก doc ที่ผูกตัวตน
    const legacy = fbSnap.docs.filter((d) => d.data().answers);
    const legacyAnswers: FirebaseFirestore.DocumentData[] = [];
    if (legacy.length > 0) {
      const batch = db.batch();
      for (const d of legacy) {
        const a = d.data().answers;
        legacyAnswers.push({ answers: a, createdAt: d.data().createdAt ?? null });
        batch.set(db.collection("feedbackAnswers").doc(), {
          answers: a, createdAt: d.data().createdAt ?? null,
        });
        batch.update(d.ref, { answers: FieldValue.delete() });
      }
      await batch.commit();
    }

    // นับ "สมาชิกที่มีสิทธิ์ตอบ" จากจำนวนบัญชีที่มีคอร์ส (ไม่ใช่จำนวน userCourses)
    const members = new Set<string>();
    courseSnap.forEach((d) => { const u = d.data().userId; if (u) members.add(u); });

    /** ตัวนับต่อคำถาม: { [qid]: { [value]: count } }  · grid = { [qid]: { "row:value": n } } */
    const tally: Record<string, Record<string, number>> = {};
    const stars: number[]   = [];
    const comments: string[] = [];

    const bump = (q: string, v: string) => {
      (tally[q] ??= {});
      tally[q][v] = (tally[q][v] ?? 0) + 1;
    };

    // รวมจากคอลเลกชันนิรนาม (+ ใบ legacy ที่เพิ่งย้าย)
    // เรียงตาม createdAt เก่า→ใหม่ (ไม่มีเวลา = เก่าสุด) — จะได้ "ใหม่สุดอยู่บน" จริง
    // (get() เฉย ๆ คืนตามลำดับ doc id ที่สุ่ม ไม่ใช่ลำดับเวลา — บั๊กที่ Aj เจอ)
    const allAnswerDocs = [
      ...ansSnap.docs.map((d) => d.data()),
      ...legacyAnswers,
    ].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return ta - tb;
    });
    // ?raw=1 → คำตอบรายใบ (นิรนาม ไม่มีชื่อ/อีเมล) ให้หน้า admin ทำไฟล์ Excel ไปวิเคราะห์ต่อ
    if (req.nextUrl.searchParams.get("raw") === "1") {
      return NextResponse.json({
        rows: allAnswerDocs.map((doc, i) => ({
          n: i + 1,
          createdAt: doc.createdAt?.toDate?.()?.toISOString() ?? null,
          answers: (doc.answers ?? {}) as SurveyAnswers,
        })),
      });
    }

    allAnswerDocs.forEach((doc) => {
      const a = (doc.answers ?? {}) as SurveyAnswers;
      for (const q of SURVEY) {
        const v = a[q.id];
        if (v === undefined || v === null) continue;
        if (q.kind === "stars" && typeof v === "number") { stars.push(v); bump(q.id, String(v)); }
        else if (q.kind === "single" && typeof v === "string") bump(q.id, v);
        else if (q.kind === "multi" && Array.isArray(v)) v.forEach((x) => bump(q.id, String(x)));
        else if (q.kind === "grid" && typeof v === "object" && !Array.isArray(v)) {
          for (const [row, val] of Object.entries(v as Record<string, string>)) {
            bump(q.id, `${row}:${val}`);
          }
        } else if (q.kind === "text" && typeof v === "string" && v.trim()) {
          comments.push(v.trim());
        }
      }
    });

    let unused = 0, used = 0;
    codeSnap.forEach((d) => { d.data().status === "used" ? used++ : unused++; });

    return NextResponse.json({
      responses:   fbSnap.size,
      members:     members.size,
      responseRate: members.size ? Math.round((fbSnap.size / members.size) * 100) : 0,
      avgStars:    stars.length ? Number((stars.reduce((s, n) => s + n, 0) / stars.length).toFixed(2)) : 0,
      tally,
      comments:    comments.slice(-300).reverse(),
      codes:       { total: codeSnap.size, unused, used },
    });
  } catch (e) {
    console.error("[admin feedback]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
