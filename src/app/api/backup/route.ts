/**
 * GET /api/backup — สำรอง Firestore ทั้งฐานเข้า Cloud Storage (เรียกโดย Vercel Cron ทุกวัน)
 *
 * ปลายทาง: gs://aj-online-exam-backups/daily/YYYY-MM-DD (เวลาไทย)
 * bucket ตั้ง lifecycle ลบไฟล์อายุ >30 วันเองอัตโนมัติ — เก็บย้อนหลัง ~30 ชุด
 * สิทธิ์: service account มี roles/datastore.importExportAdmin (ตั้งครั้งเดียว 2026-07-25)
 *
 * ป้องกัน: ต้องมี Authorization: Bearer <CRON_SECRET> (Vercel Cron ใส่ให้อัตโนมัติ
 * เมื่อตั้ง env CRON_SECRET) — กันคนนอกยิงสั่ง export รัว ๆ ให้เปลืองเงิน
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAccessToken } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT = "aj-online-exam";
const BUCKET  = "aj-online-exam-backups";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // วันที่+เวลาตามเวลาไทย — แนบเวลาไว้ด้วย เพราะ export ซ้ำ path เดิมจะโดน
    // "Path already exists" (เช่น cron retry หรือสั่งมือซ้ำในวันเดียวกัน)
    const now = new Date();
    const day  = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    const time = now.toLocaleTimeString("sv-SE", { timeZone: "Asia/Bangkok" }).replace(/:/g, "");
    const token = await adminAccessToken();

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default):exportDocuments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ outputUriPrefix: `gs://${BUCKET}/daily/${day}-${time}` }),
      }
    );
    const body = await res.json();
    if (!res.ok) {
      console.error("[backup] export failed", res.status, JSON.stringify(body).slice(0, 300));
      return NextResponse.json({ error: "export-failed", status: res.status }, { status: 500 });
    }
    // export ทำงานต่อฝั่ง Google เอง (async) — ตอบกลับได้เลยไม่ต้องรอจบ
    return NextResponse.json({ ok: true, day, operation: body.name ?? "" });
  } catch (e) {
    console.error("[backup]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
