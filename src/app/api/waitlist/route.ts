/**
 * POST /api/waitlist — รับลงชื่อรอคอร์ส (สาธารณะ ไม่ต้องล็อกอิน)
 *
 * อีเมลซ้ำ = ไม่สร้างแถวใหม่: รวมสนามที่เลือกเพิ่ม + อัปเดตชื่อ/สถานะ/updatedAt
 * (docId = อีเมล lowercase ทำให้ upsert ชนกันเองไม่ได้)
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  WAITLIST_FIELDS, WAITLIST_STATUSES, WAITLIST_CONSENT_TEXT,
  normalizeEmail, isValidEmail,
} from "@/lib/waitlist-types";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_KEYS  = new Set<string>(WAITLIST_FIELDS.map((f) => f.key));
const STATUS_KEYS = new Set<string>(WAITLIST_STATUSES.map((s) => s.key));

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    name?: string; email?: string; fields?: string[]; otherText?: string;
    status?: string; consent?: boolean; source?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "bad-body" }, { status: 400 });

  const name  = String(body.name ?? "").trim().slice(0, 60);
  const email = normalizeEmail(String(body.email ?? ""));
  const fields = Array.isArray(body.fields)
    ? [...new Set(body.fields.map(String).filter((f) => FIELD_KEYS.has(f)))]
    : [];
  const otherText = String(body.otherText ?? "").trim().slice(0, 100);
  const status    = String(body.status ?? "");

  if (!name)                   return NextResponse.json({ error: "กรุณากรอกชื่อเล่น" }, { status: 400 });
  if (!isValidEmail(email))    return NextResponse.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  if (fields.length === 0)     return NextResponse.json({ error: "เลือกสนามที่สนใจอย่างน้อย 1 สนาม" }, { status: 400 });
  if (fields.includes("other") && !otherText)
    return NextResponse.json({ error: "กรุณาระบุสนามในช่อง อื่นๆ" }, { status: 400 });
  if (!STATUS_KEYS.has(status)) return NextResponse.json({ error: "กรุณาเลือกสถานะ" }, { status: 400 });
  if (body.consent !== true)   return NextResponse.json({ error: "กรุณาติ๊กช่องยินยอมก่อนส่ง" }, { status: 400 });

  const source = ["line", "fb", "app"].includes(String(body.source)) ? String(body.source) : "direct";

  try {
    const db  = adminDb();
    const ref = db.collection("waitlist").doc(email);
    const cur = await ref.get();

    if (cur.exists) {
      const prev: string[] = Array.isArray(cur.data()!.fields) ? cur.data()!.fields.map(String) : [];
      await ref.update({
        name, status,
        fields: [...new Set([...prev, ...fields])],
        ...(otherText ? { otherText } : {}),
        // กลับมาลงชื่อใหม่ = ขอรับข่าวอีกครั้ง (เผื่อเคยกดยกเลิกไป)
        unsub: false,
        consentAt:   FieldValue.serverTimestamp(),
        consentText: WAITLIST_CONSENT_TEXT,
        updatedAt:   FieldValue.serverTimestamp(),
      });
    } else {
      await ref.set({
        email, name, fields, otherText, status, source,
        unsub: false,
        // token สำหรับลิงก์ยกเลิกรับข่าวในอีเมล — กดครั้งเดียวมีผล ไม่ต้องล็อกอิน
        token: randomBytes(12).toString("hex"),
        consentAt:   FieldValue.serverTimestamp(),
        consentText: WAITLIST_CONSENT_TEXT,
        createdAt:   FieldValue.serverTimestamp(),
        updatedAt:   FieldValue.serverTimestamp(),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[waitlist POST]", e);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะคะ" }, { status: 500 });
  }
}
