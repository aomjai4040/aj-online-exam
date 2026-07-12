/**
 * GET /api/stats — ตัวเลขสาธารณะสำหรับ social proof บนหน้าแรก
 * ไม่เปิดเผยข้อมูลส่วนตัว: คืนแค่จำนวนผู้ใช้ + จำนวนชุดข้อสอบที่เผยแพร่
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // รันตอน request จริง (build ไม่มี env → prerender ได้ 0)

export async function GET() {
  try {
    const [users, exams] = await Promise.all([
      adminDb().collection("users").count().get(),
      adminDb().collection("exams").where("isPublished", "==", true).count().get(),
    ]);
    return NextResponse.json(
      { users: users.data().count, exams: exams.data().count },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch {
    return NextResponse.json({ users: 0, exams: 0 }, { status: 200 });
  }
}
