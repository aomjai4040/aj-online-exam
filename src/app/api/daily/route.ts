/**
 * /api/daily — Daily Quiz วันละ 10 ข้อ (สมาชิกเท่านั้น)
 *
 * GET  → สถานะวันนี้ + streak + ชุดคำถาม (ไม่มีเฉลย — เฉลยอยู่ฝั่ง server)
 * POST → ส่งคำตอบ → ตรวจคะแนนฝั่ง server → บันทึก users/{uid}/dailyQuiz/{date}
 *        → คืนคะแนน + เฉลยรายข้อ (เปิดเฉลยหลังส่งเท่านั้น)
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { bkkToday, pickDaily, computeDailyStreak, QUIZ_SIZE } from "@/lib/daily-server";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** courseId ทั้งหมดของผู้ใช้ — ใช้ทั้งเช็คสิทธิ์และกรองชุดตามสนามใน pickDaily */
async function userCourseIds(uid: string): Promise<string[]> {
  const snap = await adminDb().collection("userCourses")
    .where("userId", "==", uid).get();
  return snap.docs.map((d) => String(d.data().courseId ?? "")).filter(Boolean);
}

/** จำกัดให้เหลือเฉพาะคอร์สของ "สนามที่กำลังเรียน" (Aj 2026-08-21: คนมี 2 คอร์ส
 *  Daily Quiz ต้องไม่สุ่มข้ามสนาม) — ถ้าไม่มีคอร์สสนามนั้นเลย คืนทั้งหมดตามเดิม */
function forField(courseIds: string[], field: string | null): string[] {
  if (field !== "dcd" && field !== "moph") return courseIds;
  const picked = courseIds.filter((id) =>
    field === "dcd" ? id.toLowerCase().startsWith("dcd-") : !id.toLowerCase().startsWith("dcd-"));
  return picked.length > 0 ? picked : courseIds;
}

export async function GET(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const courseIds = await userCourseIds(user.uid);
  if (courseIds.length === 0) {
    return NextResponse.json({ error: "no-access" }, { status: 403 });
  }

  try {
    const db    = adminDb();
    const today = bkkToday();
    const [doneSnap, streak] = await Promise.all([
      db.collection("users").doc(user.uid).collection("dailyQuiz").doc(today).get(),
      computeDailyStreak(db, user.uid, today),
    ]);

    if (doneSnap.exists) {
      const d = doneSnap.data()!;
      return NextResponse.json({
        done: true, date: today, streak,
        score: d.score, total: d.total, examTitle: d.examTitle ?? "",
      });
    }

    const field = req.nextUrl.searchParams.get("field");
    const pick = await pickDaily(db, today, user.uid, forField(courseIds, field));
    if (!pick) return NextResponse.json({ error: "no-quiz" }, { status: 404 });

    return NextResponse.json({
      done: false, date: today, streak,
      quiz: {
        examId:    pick.examId,
        examTitle: pick.examTitle,
        subject:   pick.subject,
        focus:     pick.focus,     // weak = ชุดนี้เจาะหมวดอ่อนของผู้ใช้
        questions: pick.questions, // qid/text/options — ไม่มีเฉลย
      },
    });
  } catch (e) {
    console.error("[daily GET]", e);
    return NextResponse.json({ error: "daily-failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const courseIds = await userCourseIds(user.uid);
  if (courseIds.length === 0) {
    return NextResponse.json({ error: "no-access" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as
    { examId?: string; answers?: { qid: string; answer: number }[]; field?: string } | null;
  if (!body?.examId || !Array.isArray(body.answers)
      || body.answers.length === 0 || body.answers.length > QUIZ_SIZE + 5) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  try {
    const db    = adminDb();
    const today = bkkToday();
    const ref   = db.collection("users").doc(user.uid).collection("dailyQuiz").doc(today);

    // ตรวจว่าชุดที่ส่งมาเป็นชุดของวันนี้จริง (กันยิง exam อื่น) — สนามเดียวกับตอน GET
    const pick = await pickDaily(db, today, user.uid, forField(courseIds, body.field ?? null));
    if (!pick || pick.examId !== body.examId) {
      return NextResponse.json({ error: "wrong-quiz" }, { status: 409 });
    }

    // ตรวจคะแนนจาก answerKey ฝั่ง server
    let score = 0;
    const detail = pick.questions.map((q) => {
      const key  = pick.answerKey.get(q.qid)!;
      const your = body.answers!.find((a) => a.qid === q.qid)?.answer ?? -1;
      const correct = your === key.correctAnswer;
      if (correct) score++;
      return {
        qid: q.qid, text: q.text, options: q.options,
        correctAnswer: key.correctAnswer, explanation: key.explanation,
        your, correct,
      };
    });
    const total = pick.questions.length;

    // idempotent: วันนี้ทำไปแล้ว → คืนคะแนนเดิม (ไม่เขียนทับ)
    const existing = await ref.get();
    if (!existing.exists) {
      await ref.set({
        score, total,
        examId: pick.examId, examTitle: pick.examTitle,
        at: FieldValue.serverTimestamp(),
      });
    }
    const saved = existing.exists ? existing.data()! : { score, total };
    const streak = await computeDailyStreak(db, user.uid, today);

    return NextResponse.json({
      score: saved.score, total: saved.total, streak, detail,
      alreadyDone: existing.exists,
    });
  } catch (e) {
    console.error("[daily POST]", e);
    return NextResponse.json({ error: "daily-failed" }, { status: 500 });
  }
}
