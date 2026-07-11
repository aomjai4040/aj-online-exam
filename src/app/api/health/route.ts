/**
 * GET /api/health — ตรวจว่ารากฐานฝั่ง server (Admin SDK) ทำงานครบวงจร
 * ไม่เปิดเผยข้อมูลลับใด ๆ: ตอบแค่สถานะ + จำนวนชุดข้อสอบที่เผยแพร่
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await adminDb()
      .collection("exams")
      .where("isPublished", "==", true)
      .count()
      .get();

    return NextResponse.json({
      ok: true,
      server: "admin-sdk-online",
      publishedExams: snap.data().count,
    });
  } catch (e) {
    console.error("[health]", e);
    return NextResponse.json(
      { ok: false, error: "admin-sdk-not-configured" },
      { status: 500 }
    );
  }
}
