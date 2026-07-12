/**
 * POST /api/exam/[id]/grade — ตรวจคะแนนฝั่ง server
 * body: { answers: number[] } เรียงตามลำดับข้อ (order asc) · -1 = ข้าม
 * คืนคะแนน + เฉลยรายข้อ (เฉลยออกจาก server "หลังส่งคำตอบ" เท่านั้น)
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { loadExamForUser } from "@/lib/exam-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { answers?: number[] } | null;
  if (!body || !Array.isArray(body.answers) || body.answers.length > 500) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  try {
    const loaded = await loadExamForUser(adminDb(), user.uid, id);
    if (loaded.status === "not-found") return NextResponse.json({ error: "not-found" }, { status: 404 });
    if (loaded.status === "locked")    return NextResponse.json({ error: "locked" }, { status: 403 });
    if (loaded.status === "empty")     return NextResponse.json({ error: "empty" }, { status: 404 });

    let score = 0;
    const detail = loaded.qDocs!.map((d, i) => {
      const x = d.data();
      const correctAnswer = Number(x.correctAnswer ?? -1);
      const your = Number.isInteger(body.answers![i]) ? body.answers![i] : -1;
      if (your === correctAnswer) score++;
      return { qid: d.id, correctAnswer, explanation: String(x.explanation ?? "") };
    });
    const total = loaded.qDocs!.length;

    return NextResponse.json({
      score, total,
      percentage: Math.round((score / total) * 100),
      detail,
    });
  } catch (e) {
    console.error("[exam grade]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
