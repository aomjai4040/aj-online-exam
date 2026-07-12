/**
 * GET /api/exam/[id]/questions — โจทย์สำหรับทำข้อสอบ "ไม่มีเฉลย"
 * ต้อง login + มีสิทธิ์เข้าชุดนั้น (ฟรี/เป็นเจ้าของแพ็ก/legacy)
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { loadExamForUser } from "@/lib/exam-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const loaded = await loadExamForUser(adminDb(), user.uid, id);
    if (loaded.status === "not-found") return NextResponse.json({ error: "not-found" }, { status: 404 });
    if (loaded.status === "locked")    return NextResponse.json({ error: "locked" }, { status: 403 });
    if (loaded.status === "empty")     return NextResponse.json({ error: "empty" }, { status: 404 });

    return NextResponse.json({
      questions: loaded.qDocs!.map((d) => {
        const x = d.data();
        return { qid: d.id, text: String(x.text ?? ""), options: (x.options ?? []) as string[] };
      }),
    });
  } catch (e) {
    console.error("[exam questions]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
