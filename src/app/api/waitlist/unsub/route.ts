/**
 * GET /api/waitlist/unsub?e=<email>&t=<token> — ยกเลิกรับข่าวจากลิงก์ท้ายอีเมล
 * กดครั้งเดียวมีผลทันที ไม่ต้องล็อกอิน (token สุ่มต่อคน กันคนอื่นยกเลิกแทน)
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/waitlist-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;font-family:'Sarabun',system-ui,sans-serif;background:#FAFAF9;
  display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="background:white;border:1px solid #EBEBEA;border-radius:16px;
  padding:28px 24px;max-width:360px;margin:20px;text-align:center">
<p style="font-size:17px;font-weight:700;color:#1F2937;margin:0 0 8px">${title}</p>
<p style="font-size:13.5px;color:#6B7280;line-height:1.6;margin:0">${body}</p>
<a href="https://aj-exam-online.vercel.app" style="display:inline-block;margin-top:16px;
  font-size:13.5px;font-weight:600;color:#0B6E65;text-decoration:none">← กลับหน้าแรก AJ ExamOnline</a>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const email = normalizeEmail(req.nextUrl.searchParams.get("e") ?? "");
  const token = String(req.nextUrl.searchParams.get("t") ?? "");
  if (!email || !token) return page("ลิงก์ไม่ถูกต้อง", "ลิงก์ยกเลิกรับข่าวไม่ครบถ้วน ลองกดจากอีเมลอีกครั้งนะคะ");

  try {
    const ref  = adminDb().collection("waitlist").doc(email);
    const snap = await ref.get();
    if (!snap.exists || String(snap.data()!.token ?? "") !== token) {
      return page("ลิงก์ไม่ถูกต้อง", "ไม่พบรายการลงชื่อนี้ หรือลิงก์หมดอายุแล้วค่ะ");
    }
    await ref.update({ unsub: true, unsubAt: FieldValue.serverTimestamp() });
    return page("ยกเลิกรับข่าวแล้วค่ะ ✓",
      "พี่อ้อมจะไม่ส่งอีเมลแจ้งข่าวคอร์สถึงอีเมลนี้อีก — ถ้าเปลี่ยนใจ กลับมาลงชื่อใหม่ได้เสมอที่หน้า ลงชื่อรอคอร์ส");
  } catch (e) {
    console.error("[waitlist unsub]", e);
    return page("ขัดข้องชั่วคราว", "ยกเลิกไม่สำเร็จ ลองกดลิงก์จากอีเมลอีกครั้งนะคะ");
  }
}
