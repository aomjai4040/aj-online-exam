/**
 * GET /api/exam/[id]/full — โจทย์พร้อมเฉลย+คำอธิบายทั้งชุด
 * ใช้กับหน้า "ฉบับพิมพ์ PDF" และหน้า "ผลสอบย้อนหลัง" (ผู้มีสิทธิ์เท่านั้น
 * — เทียบเท่าสิ่งที่ผู้มีสิทธิ์เห็นอยู่แล้วหลังทำข้อสอบ/ในไฟล์พิมพ์ลายน้ำ)
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
        return {
          qid: d.id,
          text: String(x.text ?? ""),
          options: (x.options ?? []) as string[],
          correctAnswer: Number(x.correctAnswer ?? -1),
          explanation: String(x.explanation ?? ""),
        };
      }),
    });
  } catch (e) {
    console.error("[exam full]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
