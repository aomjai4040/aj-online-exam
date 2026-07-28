/**
 * GET /api/admin/slip?path=slips/xxx.jpg — เปิดดูรูปสลิปที่ตรวจไม่ผ่าน (admin เท่านั้น)
 * รูปอยู่ใน GCS bucket ส่วนตัว — route นี้เป็นตัวกลางดึงมาให้ พร้อมเช็คสิทธิ์
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAccessToken, verifyBearer } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin-config";
import { SLIP_BUCKET } from "@/lib/payment-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const caller = await verifyBearer(req.headers.get("authorization"));
  if (!caller || !isAdmin(caller.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!path.startsWith("slips/") || path.includes("..")) {
    return NextResponse.json({ error: "bad-path" }, { status: 400 });
  }

  try {
    const token = await adminAccessToken();
    const res = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${SLIP_BUCKET}/o/${encodeURIComponent(path)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return NextResponse.json({ error: "not-found" }, { status: 404 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("[admin/slip]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
