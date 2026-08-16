/**
 * /api/admin/tag-coverage — สรุปว่าคลังข้อสอบแท็กครบแค่ไหน (admin เท่านั้น)
 *
 * ที่มา (Aj ข้อ 5): ต้องคุมสัดส่วน ความจำ:ประยุกต์ ≈ 60:40 และต้องรู้ว่ามีข้อ
 * ที่อ้างบริบท อปท./ท้องถิ่น กี่ข้อ ก่อนย้ายข้อสอบเข้าสนามกรมควบคุมโรค
 *
 * รวมฝั่ง server เพราะต้องไล่อ่าน subcollection questions ของทุกชุด —
 * ดึงดิบมาที่ browser จะกินโควตาอ่านมหาศาล
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { summarizeTags, type QuestionTags } from "@/lib/question-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admins = (process.env.ADMIN_EMAILS ?? "aomjai.4040@gmail.com")
    .split(",").map((s) => s.trim());
  if (!admins.includes(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const db = adminDb();
    // collectionGroup อ่าน questions ของทุกชุดในครั้งเดียว
    const snap = await db.collectionGroup("questions").get();

    const tags: (QuestionTags | undefined)[] = [];
    /** ข้อที่บริบทเป็นท้องถิ่น แยกตามชุด — ไว้ให้ Aj ไล่แก้ทีละชุด */
    const localByExam: Record<string, number> = {};

    snap.forEach((d) => {
      const t = d.data().tags as QuestionTags | undefined;
      tags.push(t);
      if (t?.agency === "local") {
        const examId = d.ref.parent.parent?.id ?? "?";
        localByExam[examId] = (localByExam[examId] ?? 0) + 1;
      }
    });

    const stats = summarizeTags(tags);

    // ใส่ชื่อชุดให้ข้อที่ต้องกันออก
    const localExams = await Promise.all(
      Object.entries(localByExam).map(async ([examId, count]) => {
        const e = await db.collection("exams").doc(examId).get();
        return { examId, title: String(e.data()?.title ?? examId), count };
      })
    );

    return NextResponse.json({
      ...stats,
      localExams: localExams.sort((a, b) => b.count - a.count),
    });
  } catch (e) {
    console.error("[tag-coverage]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
