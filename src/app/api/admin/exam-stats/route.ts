/**
 * /api/admin/exam-stats — จำนวนคนทำ (ไม่ซ้ำ) + จำนวนครั้ง ต่อชุดข้อสอบ (admin)
 *
 * Aj 2026-09-21: "อยากรู้ว่าแต่ละชุดมีคนเข้าทำข้อสอบกี่ user"
 * นับจาก collection results ทั้งก้อนฝั่ง server (client อ่านเองไม่ไหว/ติด rules)
 * คนไม่ซ้ำ: ใช้ userId — ผลเก่าก่อน 2026-07-12 ไม่มี userId ใช้ studentName แทน
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const snap = await adminDb().collection("results")
    .select("examId", "userId", "studentName").get();

  const users = new Map<string, Set<string>>();
  const attempts = new Map<string, number>();
  snap.forEach((d) => {
    const x = d.data();
    const examId = String(x.examId ?? "");
    if (!examId) return;
    const who = String(x.userId || x.studentName || d.id);
    if (!users.has(examId)) users.set(examId, new Set());
    users.get(examId)!.add(who);
    attempts.set(examId, (attempts.get(examId) ?? 0) + 1);
  });

  const stats: Record<string, { users: number; attempts: number }> = {};
  for (const [examId, set] of users) {
    stats[examId] = { users: set.size, attempts: attempts.get(examId) ?? 0 };
  }
  return NextResponse.json({ stats, totalResults: snap.size });
}
