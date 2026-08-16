/**
 * /api/line/[field] — ขอลิงก์กลุ่ม LINE ของสนามที่ตัวเองซื้อแล้ว
 *
 * GET → ตรวจ token + เป็นเจ้าของสนามนั้นจริง → คืน { url }
 * ลิงก์ไม่อยู่ใน client bundle — คนไม่มีสิทธิ์ขอไม่ได้ (403)
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { EXAM_FIELDS } from "@/lib/exam-fields";
import { LINE_GROUPS } from "@/lib/line-groups.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ field: string }> },
) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { field } = await params;
  const def   = EXAM_FIELDS.find((f) => f.id === field);
  const group = LINE_GROUPS[field];
  if (!def || !group) return NextResponse.json({ error: "unknown-field" }, { status: 404 });

  // เป็นเจ้าของสนามนี้จริงไหม — กติกา prefix เดียวกับ ownsField ฝั่ง client
  const snap = await adminDb().collection("userCourses")
    .where("userId", "==", user.uid).get();
  const owned = snap.docs.some((d) => {
    const id = String(d.data().courseId ?? "").toLowerCase();
    return def.ownPrefixes.some((p) => id.startsWith(p));
  });
  if (!owned) return NextResponse.json({ error: "no-access" }, { status: 403 });

  return NextResponse.json({
    name: group.name,
    url:  group.url,
    // รหัสเข้าห้อง (ห้องแบบต้องอนุมัติ) — โชว์ใต้ปุ่มให้เฉพาะคนมีสิทธิ์
    joinCode: group.joinCode || null,
    // โฟลเดอร์ไฟล์เรียน — null = ยังไม่พร้อม (ปุ่มดาวน์โหลดฝั่ง client ซ่อนเอง)
    driveUrl: group.driveUrl || null,
  });
}
