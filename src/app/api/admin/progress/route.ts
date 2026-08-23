/**
 * GET /api/admin/progress?field=dcd|moph — ความคืบหน้ารายคนของคอร์ส (admin)
 *
 * อ่านแบบ collectionGroup 2 ครั้ง (videoProgress + history ของทุกคน) แล้วคำนวณ
 * ด้วย lib/course-progress.ts ตัวเดียวกับการ์ดฝั่งผู้เรียน — ตัวเลขตรงกันแน่นอน
 * เรียง "หายไปนานสุด" ขึ้นก่อน → Aj รู้ว่าควรทักใครในกลุ่ม LINE
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyBearer } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin-config";
import { buildCourseProgress, type ProgressVideo, type ProgressExam } from "@/lib/course-progress";
import type { ExamFieldKey } from "@/lib/exam-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fieldOfPkg = (pid: string): ExamFieldKey => pid.toLowerCase().startsWith("dcd-") ? "dcd" : "moph";

export async function GET(req: NextRequest) {
  const caller = await verifyBearer(req.headers.get("authorization"));
  if (!caller || !isAdmin(caller.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const field: ExamFieldKey = req.nextUrl.searchParams.get("field") === "dcd" ? "dcd" : "moph";

  try {
    const db = adminDb();
    const [coursesSnap, videosSnap, examsSnap, vpSnap, histSnap] = await Promise.all([
      db.collection("userCourses").get(),
      db.collection("videos").where("isPublished", "==", true).get(),
      db.collection("exams").where("isPublished", "==", true).get(),
      db.collectionGroup("videoProgress").get(),
      db.collectionGroup("history").get(),
    ]);

    // ── สมาชิกของสนามนี้ ──
    const members = new Map<string, { email: string; activatedAt: string | null }>();
    coursesSnap.forEach((d) => {
      const c = d.data();
      if (fieldOfPkg(String(c.courseId ?? "")) !== field || !c.userId) return;
      const prev = members.get(c.userId);
      const at = c.activatedAt?.toDate?.()?.toISOString() ?? null;
      if (!prev || (at && (!prev.activatedAt || at < prev.activatedAt))) {
        members.set(c.userId, { email: String(c.email ?? prev?.email ?? ""), activatedAt: at });
      }
    });

    // ── เนื้อหาของสนาม ──
    const videos: ProgressVideo[] = videosSnap.docs
      .filter((d) => ((d.data().field === "dcd" ? "dcd" : "moph") === field))
      .map((d) => ({ id: d.id, chapter: String(d.data().chapter ?? ""), order: Number(d.data().order ?? 0), title: String(d.data().title ?? "") }));
    const exams: ProgressExam[] = examsSnap.docs
      .filter((d) => fieldOfPkg(String(d.data().packageId ?? "")) === field)
      .filter((d) => !String(d.data().title ?? "").includes("ติวโค้งสุดท้าย"))
      .map((d) => ({ id: d.id, subject: String(d.data().subject ?? ""), isMock: d.data().isMock === true, title: String(d.data().title ?? "") }));

    // ── ความคืบหน้าต่อคน (uid จาก path users/{uid}/…) ──
    const vpByUser  = new Map<string, Map<string, { completed: boolean; seconds: number }>>();
    const lastSeen  = new Map<string, number>();
    vpSnap.forEach((d) => {
      const uid = d.ref.parent.parent?.id; if (!uid || !members.has(uid)) return;
      const x = d.data();
      (vpByUser.get(uid) ?? vpByUser.set(uid, new Map()).get(uid)!)
        .set(d.id, { completed: x.completed === true, seconds: Number(x.seconds ?? 0) });
      const t = x.updatedAt?.toMillis?.(); if (t) lastSeen.set(uid, Math.max(lastSeen.get(uid) ?? 0, t));
    });
    const exByUser = new Map<string, Map<string, { best: number }>>();
    histSnap.forEach((d) => {
      const uid = d.ref.parent.parent?.id; if (!uid || !members.has(uid)) return;
      const x = d.data();
      (exByUser.get(uid) ?? exByUser.set(uid, new Map()).get(uid)!)
        .set(d.id, { best: Number(x.bestPercentage ?? x.percentage ?? 0) });
      const t = x.lastDoneAt?.toMillis?.(); if (t) lastSeen.set(uid, Math.max(lastSeen.get(uid) ?? 0, t));
    });

    const rows = [...members.entries()].map(([uid, m]) => {
      const p = buildCourseProgress(field, videos, exams, {
        videos: vpByUser.get(uid) ?? new Map(),
        exams:  exByUser.get(uid) ?? new Map(),
      });
      const seen = lastSeen.get(uid);
      return {
        uid, email: m.email, activatedAt: m.activatedAt,
        pct: p.pct, clips: p.clips, sets: p.sets, mock: p.mock,
        chaptersDone: p.chapters.filter((c) => c.complete).length,
        chaptersTotal: p.chapters.length,
        lastActiveAt: seen ? new Date(seen).toISOString() : null,
      };
    });

    // สรุปรวม
    const n = rows.length;
    const avg = (f: (r: typeof rows[number]) => number) => n ? Math.round(rows.reduce((s, r) => s + f(r), 0) / n) : 0;
    const summary = {
      members: n,
      avgPct: avg((r) => r.pct),
      started: rows.filter((r) => r.lastActiveAt).length,
      idle7d: rows.filter((r) => !r.lastActiveAt || Date.now() - new Date(r.lastActiveAt).getTime() > 7 * 86_400_000).length,
      clipsTotal: videos.length, setsTotal: exams.filter((e) => !e.isMock).length, mockTotal: exams.filter((e) => e.isMock).length,
    };

    return NextResponse.json({ field, summary, rows, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[admin/progress]", e);
    return NextResponse.json({ error: "progress-failed" }, { status: 500 });
  }
}
