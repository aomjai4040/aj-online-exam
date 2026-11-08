/**
 * POST /api/admin/waitlist/notify — ส่งอีเมล "เปิดคอร์สแล้ว" ถึงคนที่รอสนามนั้น
 *
 * ส่งผ่าน Brevo (api.brevo.com — แพ็กฟรี 300 ฉบับ/วัน ใช้กับ Vercel ได้)
 * ต้องตั้ง env: BREVO_API_KEY (ห้ามเขียนลงโค้ด) · ผู้ส่ง = WAITLIST_FROM_EMAIL
 * (ต้อง verify ใน Brevo ก่อน) — ไม่ตั้ง key = ตอบ error ชัดเจน ไม่ส่งมั่ว
 *
 * กันส่งซ้ำ: บันทึก waitlistNotifies/{field} (lastSentAt, totalSent, rounds)
 * รอบถัดไปส่งเฉพาะคนที่ "ลงชื่อหลังรอบก่อน" เท่านั้น — คนเดิมไม่โดนอีเมลซ้ำ
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { WAITLIST_FIELDS, fieldLabel } from "@/lib/waitlist-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // ลูปส่งทีละฉบับ — เผื่อผู้รับหลักร้อย

const SITE = "https://aj-exam-online.vercel.app";
const FROM_EMAIL = process.env.WAITLIST_FROM_EMAIL ?? "aomjai.4040@gmail.com";
const FROM_NAME  = "พี่อ้อม AJ ExamOnline";

function isAdmin(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "aomjai.4040@gmail.com")
    .split(",").map((s) => s.trim()).filter(Boolean).includes(email);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** HTML อีเมลโทนแบรนด์ — ข้อความจาก Aj + ปุ่มดูคอร์ส + ลิงก์ยกเลิกรับข่าว (บังคับมีทุกฉบับ)
 *  (ห้าม export จาก route.ts — Next ตรวจ export แปลกปลอมแล้ว build พัง
 *   หน้า admin วาดพรีวิวเองด้วย markup เดียวกัน) */
function emailHtml(name: string, bodyText: string, ctaUrl: string, unsubUrl: string): string {
  const paras = bodyText.split(/\n+/).map((p) =>
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">${esc(p)}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#FAFAF9;padding:24px 12px">
<div style="max-width:520px;margin:0 auto;font-family:'Sarabun',system-ui,sans-serif">
  <div style="background:linear-gradient(135deg,#10857A,#0B4F48);border-radius:16px 16px 0 0;padding:20px 24px">
    <p style="margin:0;color:white;font-size:17px;font-weight:700">AJ ExamOnline</p>
  </div>
  <div style="background:white;border:1px solid #EBEBEA;border-top:none;border-radius:0 0 16px 16px;padding:24px">
    <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">สวัสดีค่ะ ${esc(name || "น้อง")} 💚</p>
    ${paras}
    <a href="${ctaUrl}" style="display:block;background:#0B6E65;color:white;text-decoration:none;
      text-align:center;font-size:15px;font-weight:700;padding:13px;border-radius:12px;margin:18px 0 6px">
      ดูรายละเอียดคอร์ส →</a>
    <p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #F3F2F0;font-size:12px;color:#A8A8A6;line-height:1.6">
      คุณได้รับอีเมลนี้เพราะลงชื่อรอคอร์สไว้กับ AJ ExamOnline ·
      <a href="${unsubUrl}" style="color:#A8A8A6">ยกเลิกรับข่าว (กดครั้งเดียวมีผลทันที)</a>
    </p>
  </div>
</div></body></html>`;
}

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const field    = String(body.field ?? "");
  const subject  = String(body.subject ?? "").trim().slice(0, 150);
  const bodyText = String(body.bodyText ?? "").trim().slice(0, 4000);
  if (!WAITLIST_FIELDS.some((f) => f.key === field)) {
    return NextResponse.json({ error: "สนามไม่ถูกต้อง" }, { status: 400 });
  }
  if (!subject || !bodyText) {
    return NextResponse.json({ error: "กรอกหัวข้อและเนื้อหาอีเมลก่อนนะคะ" }, { status: 400 });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "ยังไม่ได้ตั้งค่า BREVO_API_KEY ใน Vercel env — สมัคร brevo.com (ฟรี) แล้วเอา API key มาใส่ก่อนค่ะ",
    }, { status: 500 });
  }

  try {
    const db = adminDb();
    const logRef  = db.collection("waitlistNotifies").doc(field);
    const logSnap = await logRef.get();
    const lastSentAt: Date | null = logSnap.data()?.lastSentAt?.toDate?.() ?? null;

    // ผู้รับ = รอสนามนี้ + ยังรับข่าว + (รอบ 2 เป็นต้นไป) ลงชื่อหลังรอบก่อนเท่านั้น
    const snap = await db.collection("waitlist")
      .where("fields", "array-contains", field).get();
    const recipients = snap.docs
      .map((d) => ({ email: d.id, ...d.data() } as {
        email: string; name?: string; token?: string; unsub?: boolean;
        createdAt?: { toDate?: () => Date };
      }))
      .filter((r) => r.unsub !== true)
      .filter((r) => {
        if (!lastSentAt) return true;
        const created = (r.createdAt as { toDate?: () => Date } | undefined)?.toDate?.();
        return !!created && created.getTime() > lastSentAt.getTime();
      });

    if (recipients.length === 0) {
      return NextResponse.json({
        error: lastSentAt
          ? "ส่งรอบก่อนไปแล้ว และยังไม่มีคนลงชื่อใหม่หลังจากนั้นค่ะ"
          : "ยังไม่มีคนรอสนามนี้ค่ะ",
      }, { status: 409 });
    }

    const ctaUrl = ["moph", "dcd", "local"].includes(field) ? `${SITE}/course/${field}` : SITE;
    let sent = 0;
    const failed: string[] = [];
    for (const r of recipients) {
      const unsubUrl = `${SITE}/api/waitlist/unsub?e=${encodeURIComponent(r.email)}&t=${encodeURIComponent(String(r.token ?? ""))}`;
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender:  { name: FROM_NAME, email: FROM_EMAIL },
          to:      [{ email: r.email, name: String(r.name ?? "") }],
          subject,
          htmlContent: emailHtml(String(r.name ?? ""), bodyText, ctaUrl, unsubUrl),
        }),
      });
      if (res.ok) sent++;
      else {
        failed.push(r.email);
        console.error("[waitlist notify] brevo", res.status, await res.text().catch(() => ""));
      }
    }

    await logRef.set({
      field,
      lastSentAt: FieldValue.serverTimestamp(),
      totalSent:  FieldValue.increment(sent),
      rounds:     FieldValue.increment(1),
      lastSubject: subject,
      lastBy: user.email,
    }, { merge: true });

    return NextResponse.json({
      ok: true, sent, failedCount: failed.length,
      fieldLabel: fieldLabel(field),
      ...(failed.length ? { failed: failed.slice(0, 20) } : {}),
    });
  } catch (e) {
    console.error("[waitlist notify]", e);
    return NextResponse.json({ error: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
