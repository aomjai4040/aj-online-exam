/**
 * /api/feedback — แบบประเมินการสอน + ออกโค้ดส่วนลดให้คนที่ตอบครบ
 *
 * GET  → ตอบไปหรือยัง + โค้ดของตัวเอง (ถ้ามี)
 * POST → บันทึกคำตอบ + ออกโค้ดส่วนลด ฿100 (1 บัญชี 1 โค้ด)
 *
 * ⚠️ ออกโค้ดฝั่ง server เท่านั้น — ถ้าให้ client สร้างเอง ใครก็ปลอมโค้ดได้
 * โค้ดผูกกับ userId → แชร์ต่อไม่ได้ (บทเรียนจากโค้ดกลุ่ม MOPH69AJ ที่รั่ว)
 *
 * เฉพาะสมาชิกที่มีคอร์ส — คนที่ไม่ได้เรียนประเมินการสอนไม่ได้
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  FEEDBACK_REWARD, missingQuestions, type SurveyAnswers,
} from "@/lib/feedback-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ตัดอักษรที่อ่านสับสน (0/O 1/I/L) — แบบเดียวกับโค้ดเปิดคอร์ส */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomSuffix(len = 5): string {
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function hasAnyCourse(uid: string): Promise<boolean> {
  const snap = await adminDb().collection("userCourses")
    .where("userId", "==", uid).limit(1).get();
  return !snap.empty;
}

export async function GET(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const [doneSnap, member] = await Promise.all([
      adminDb().collection("feedback").doc(user.uid).get(),
      hasAnyCourse(user.uid),
    ]);
    if (!member) return NextResponse.json({ error: "no-access" }, { status: 403 });

    if (doneSnap.exists) {
      const d    = doneSnap.data()!;
      const code = String(d.code ?? "");
      // ใช้โค้ดไปหรือยัง — หน้าแรกใช้ตัดสินว่าจะโชว์โค้ดค้างไว้ให้อีกไหม
      // (น้องที่ไม่ได้จดโค้ดจะได้ไม่ต้องตามหา)
      let used = false;
      if (code) {
        const c = await adminDb().collection("discountCodes").doc(code).get();
        used = c.exists && c.data()!.status === "used";
      }
      return NextResponse.json({
        done: true,
        code,
        used,
        amount: FEEDBACK_REWARD.amount,
        expiresLabel: FEEDBACK_REWARD.expiresLabel,
      });
    }
    return NextResponse.json({ done: false });
  } catch (e) {
    console.error("[feedback GET]", e);
    return NextResponse.json({ error: "feedback-failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await hasAnyCourse(user.uid))) {
    return NextResponse.json({ error: "no-access" }, { status: 403 });
  }

  let answers: SurveyAnswers;
  try {
    const body = await req.json();
    answers = (body?.answers ?? {}) as SurveyAnswers;
  } catch {
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  const missing = missingQuestions(answers);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "incomplete", missing: missing.map((q) => q.id) },
      { status: 400 },
    );
  }

  try {
    const db  = adminDb();
    const ref = db.collection("feedback").doc(user.uid);

    // ตอบไปแล้ว → คืนโค้ดเดิม ไม่ออกใบใหม่ (กดซ้ำ/เน็ตหลุดแล้วส่งซ้ำก็ปลอดภัย)
    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json({
        ok: true, alreadyDone: true, code: existing.data()!.code ?? "",
        amount: FEEDBACK_REWARD.amount, expiresLabel: FEEDBACK_REWARD.expiresLabel,
      });
    }

    // หาโค้ดที่ยังไม่ชน (โอกาสชนต่ำมาก แต่กันไว้)
    let code = "";
    for (let i = 0; i < 5; i++) {
      const candidate = `AJ100-${randomSuffix()}`;
      const taken = await db.collection("discountCodes").doc(candidate).get();
      if (!taken.exists) { code = candidate; break; }
    }
    if (!code) {
      return NextResponse.json({ error: "code-gen-failed" }, { status: 500 });
    }

    // เขียนพร้อมกัน — ไม่มีทางได้โค้ดโดยไม่มีคำตอบ หรือมีคำตอบแล้วไม่ได้โค้ด
    //
    // ⚠️ นิรนามโดยโครงสร้าง (Aj 2026-08-16: น้องกลัวไม่กล้าติเพราะเห็นบัญชี Google):
    //   feedback/{uid}        = แค่ "คนนี้ตอบแล้ว" + โค้ดของเขา (กันตอบซ้ำ/ดูโค้ดตัวเอง)
    //   feedbackAnswers/{สุ่ม} = คำตอบล้วน ๆ ไม่มี uid/email — โยงกลับหาคนตอบไม่ได้เลย
    // เปิด Firestore console ดูก็พิสูจน์ได้ว่าคำตอบไม่ผูกกับใคร
    const batch = db.batch();
    batch.set(ref, {
      userId:    user.uid,
      userEmail: user.email,
      code,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("feedbackAnswers").doc(), {
      answers,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("discountCodes").doc(code), {
      code,
      userId:    user.uid,
      userEmail: user.email,
      amount:    FEEDBACK_REWARD.amount,
      scope:     FEEDBACK_REWARD.scope,      // any = ใช้กับคอร์สไหนก็ได้
      source:    FEEDBACK_REWARD.source,
      status:    "unused",
      expiresAt: FEEDBACK_REWARD.expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({
      ok: true, code,
      amount: FEEDBACK_REWARD.amount,
      expiresLabel: FEEDBACK_REWARD.expiresLabel,
    });
  } catch (e) {
    console.error("[feedback POST]", e);
    return NextResponse.json({ error: "feedback-failed" }, { status: 500 });
  }
}
