/**
 * /api/interview/clip — คลิปอวตาร์เมนูภาค ค. (handoff Aj 2026-10-17)
 *
 * GET ?code=SPS-C-001
 *   → signed URL อายุสั้นสำหรับเล่นคลิป (+poster/captions ถ้ามี)
 *   สิทธิ์: ข้อ isFreePreview เปิดได้ทุกคนไม่ต้อง login (ช่องทางขาย) ·
 *   ข้ออื่นต้องเป็นสมาชิกคอร์สใดคอร์สหนึ่ง (userCourses ไม่ว่าง)
 *   → ไม่มี URL สาธารณะถาวร ตามข้อห้ามใน handoff
 *
 * POST (admin เท่านั้น)
 *   {action:"sign-upload", code, kind:"video"|"poster"|"captions", contentType}
 *     → signed PUT URL ให้เบราว์เซอร์อัปโหลดตรงเข้า bucket (เลี่ยงลิมิต 4.5MB ของ Vercel)
 *   {action:"delete-file", code} → ลบไฟล์ทุกชนิดของข้อนั้นออกจาก bucket
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminMediaBucket, verifyBearer } from "@/lib/firebase-admin";
import { isAdmin } from "@/lib/admin-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXT: Record<string, string> = { video: "mp4", poster: "jpg", captions: "vtt" };
// รหัสคำถาม + เวอร์ชันคลิป: ข้อเดียวอัดหลายแบบได้ เช่น SPS-C-001-V2 (ไฟล์ -v2)
// รูปแบบเก่า -2..-9 ยังรับ (Aj 2026-10-18)
const CODE_RE = /^[A-Z]{3}-[A-Z]-\d{3}(-V?[2-9])?$/;

async function isMember(uid: string): Promise<boolean> {
  const snap = await adminDb().collection("userCourses")
    .where("userId", "==", uid).limit(1).get();
  return !snap.empty;
}

async function signedRead(path: string): Promise<string> {
  const [url] = await adminMediaBucket().file(path).getSignedUrl({
    version: "v4", action: "read", expires: Date.now() + 30 * 60 * 1000,
  });
  return url;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!CODE_RE.test(code)) return NextResponse.json({ error: "bad-code" }, { status: 400 });

  const doc = await adminDb().collection("interviewClips").doc(code).get();
  if (!doc.exists) return NextResponse.json({ error: "no-clip" }, { status: 404 });
  const clip = doc.data()!;
  if (clip.status === "draft") {
    // draft เล่นได้เฉพาะ admin (ไว้พรีวิวก่อนเผยแพร่)
    const user = await verifyBearer(req.headers.get("authorization"));
    if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "no-clip" }, { status: 404 });
  } else if (clip.isFreePreview !== true) {
    const user = await verifyBearer(req.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!isAdmin(user.email) && !(await isMember(user.uid))) {
      return NextResponse.json({ error: "no-access" }, { status: 403 });
    }
  }

  const out: Record<string, string> = { videoUrl: await signedRead(String(clip.videoPath)) };
  // ไม่มีปกของตัวเอง → ใช้ปกกลาง (รูปกรรมการนิ่งก่อนถาม — Aj อัป 2026-10-17)
  out.posterUrl = await signedRead(
    clip.posterPath ? String(clip.posterPath) : "interview/poster-default.png");
  if (clip.captionsPath) out.captionsUrl = await signedRead(String(clip.captionsPath));
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "");
  if (!CODE_RE.test(code)) return NextResponse.json({ error: "bad-code" }, { status: 400 });

  if (body.action === "sign-upload") {
    const kind = String(body.kind ?? "video");
    const ext = EXT[kind];
    if (!ext) return NextResponse.json({ error: "bad-kind" }, { status: 400 });
    const contentType = String(body.contentType ?? "application/octet-stream");
    const path = `interview/${code}.${ext}`;
    const [url] = await adminMediaBucket().file(path).getSignedUrl({
      version: "v4", action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });
    return NextResponse.json({ uploadUrl: url, path, contentType });
  }

  if (body.action === "delete-file") {
    for (const ext of Object.values(EXT)) {
      await adminMediaBucket().file(`interview/${code}.${ext}`)
        .delete({ ignoreNotFound: true });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad-action" }, { status: 400 });
}
