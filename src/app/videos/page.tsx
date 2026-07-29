"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { getUserAccess, EMPTY_ACCESS, type UserAccess } from "@/lib/access";
import { getPublishedVideos, type CourseVideo } from "@/lib/video-firestore";
import { getAllVideoProgress, saveVideoProgress, type VideoProgress } from "@/lib/video-progress";
import { PRICING } from "@/lib/pricing";
import { daysToExam } from "@/lib/exam-config";
import { BRAND } from "@/lib/subjects";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";
import CourseVideoPlayer from "@/components/CourseVideoPlayer";
import CourseResources from "@/components/CourseResources";
import SampleVideoTeaser from "@/components/SampleVideoTeaser";

// ─── /videos — คอร์สวิดีโอ (เฉพาะคอร์สเต็ม) ───────────────────────────────────
// player ควบคุมเองทั้งหมด (ดู components/CourseVideoPlayer) — ปิดทุกทางที่
// ผู้ใช้จะกดหลุดไป YouTube แล้ว copy ลิงก์ unlisted ไปแชร์ + ลายน้ำผู้ชม

export default function VideosPage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();

  const [videos,  setVideos]  = useState<CourseVideo[]>([]);
  const [access,  setAccess]  = useState<UserAccess>(EMPTY_ACCESS);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [current, setCurrent] = useState<CourseVideo | null>(null);
  const [progress, setProgress] = useState<Map<string, VideoProgress>>(new Map());

  useEffect(() => {
    if (guard !== "allowed" || !user) return;
    (async () => {
      try {
        const a = await getUserAccess(user.uid);
        setAccess(a);
        if (a.hasFull || a.hasReview) {
          const [vsAll, pg] = await Promise.all([
            getPublishedVideos(),
            getAllVideoProgress(user.uid).catch(() => new Map<string, VideoProgress>()),
          ]);
          // แพ็กติวทบทวน (499) เห็นเฉพาะบท "โค้งสุดท้าย" — คอร์สเต็มเห็นครบ
          const vs = a.hasFull ? vsAll : vsAll.filter((v) => v.chapter.includes("โค้งสุดท้าย"));
          setVideos(vs);
          setProgress(pg);
          // โค้ชหลังสอบส่ง ?chapter=บทที่ x มา → เปิดคลิปของบทนั้น (ที่ยังไม่จบก่อน)
          const chParam = new URLSearchParams(window.location.search).get("chapter");
          const inChapter = chParam ? vs.filter((v) => v.chapter.startsWith(chParam)) : [];
          const firstUnfinished = vs.find((v) => !pg.get(v.id)?.completed);
          setCurrent(
            (inChapter.find((v) => !pg.get(v.id)?.completed) ?? inChapter[0])
            ?? firstUnfinished ?? vs[0] ?? null
          );
        }
      } catch { setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่"); }
      finally { setLoading(false); }
    })();
  }, [guard, user]);

  // map ytId → video (player รายงานความคืบหน้าด้วย ytId)
  const videosByYtId = useMemo(() => {
    const m = new Map<string, CourseVideo>();
    videos.forEach((v) => m.set(v.ytId, v));
    return m;
  }, [videos]);

  function handleProgress(ytId: string, seconds: number, duration: number, ended: boolean) {
    const v = videosByYtId.get(ytId);
    if (!v || !user) return;
    const completed = ended || (duration > 0 && seconds / duration >= 0.9)
      || !!progress.get(v.id)?.completed;
    setProgress((prev) => {
      const next = new Map(prev);
      next.set(v.id, { seconds, duration, completed });
      return next;
    });
    saveVideoProgress(user.uid, v.id, seconds, duration, ended).catch(() => {});
  }

  const chapters = useMemo(() => {
    const map = new Map<string, CourseVideo[]>();
    for (const v of videos) {
      if (!map.has(v.chapter)) map.set(v.chapter, []);
      map.get(v.chapter)!.push(v);
    }
    return Array.from(map.entries());
  }, [videos]);

  // คลิปถัดไปตามลำดับรวม (สำหรับปุ่ม "คลิปถัดไป" ตอนจบคลิป)
  const nextVideo = useMemo(() => {
    if (!current) return null;
    const i = videos.findIndex((v) => v.id === current.id);
    return i >= 0 ? videos[i + 1] ?? null : null;
  }, [videos, current]);

  if (guard !== "allowed" || loading) return <AccessGuardSpinner />;

  // ── ยังไม่มีสิทธิ์วิดีโอเลย (ไม่มีทั้งเต็มและแพ็กติวทบทวน) → upsell ─────────
  if (!access.hasFull && !access.hasReview) {
    return (
      <div className="min-h-screen bg-stone-50 pb-28">
        <div className="max-w-lg mx-auto px-5 pt-14 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ backgroundColor: "#EBF5F3" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <h1 className="text-[19px] font-bold text-gray-900 mb-2">คอร์สวิดีโอสำหรับสมาชิกคอร์สเต็ม</h1>
          <p className="text-[13.5px] leading-relaxed mb-4 max-w-xs mx-auto" style={{ color: "#A8A8A6" }}>
            วิดีโอติวครบทุกบท 47 ชม. + คู่มือฉบับละเอียด 395 หน้า
            {access.hasAny
              ? ` — อัปเกรดจาก App Only จ่ายเพิ่มเพียง ฿${PRICING.upgradePrice}`
              : ` — คอร์สเต็ม ฿${PRICING.full.price} รวมทุกอย่างในแอปด้วย`}
          </p>

          {/* urgency — นับถอยหลังวันสอบจริง */}
          {daysToExam() > 0 && (
            <p className="text-[13px] font-semibold mb-6 rounded-xl py-2.5 px-4 max-w-xs mx-auto"
              style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
              ⏳ สอบจริง 15 ส.ค. — เหลืออีก {daysToExam()} วัน · เริ่มวันนี้ยังทัน
            </p>
          )}

          {/* คลิปตัวอย่างฟรี (โผล่เมื่อ admin ตั้งคลิปตัวอย่าง) */}
          <div className="mb-6 text-left">
            <SampleVideoTeaser />
          </div>

          <div className="space-y-3 max-w-xs mx-auto">
            <Link href={access.hasAny ? "/checkout/upgrade" : "/checkout/full"}
              className="btn-primary w-full py-3.5 text-[15px] block text-center">
              {access.hasAny
                ? `อัปเกรดจ่ายเพิ่ม ฿${PRICING.upgradePrice} — ปลดล็อกทันที`
                : `สั่งซื้อคอร์สเต็ม ฿${PRICING.full.price}`}
            </Link>
            <Link href="/packages" className="btn-secondary w-full py-3.5 text-[15px] block text-center">
              ดูรายละเอียดแพ็กเกจ
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── มีสิทธิ์ ────────────────────────────────────────────────────────────────
  const userLabel = user?.email ?? "";

  return (
    <div className="min-h-screen bg-stone-50 pb-28">

      {/* จอกว้าง (≥lg): สองฝั่ง — player ซ้าย (ตรึงไว้) + playlist ขวา */}
      <div className="lg:max-w-6xl lg:mx-auto lg:px-5 lg:pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:items-start">
      <div className="min-w-0 lg:sticky lg:top-[72px]">

      {/* Player (ควบคุมเองทั้งหมด — ไม่มีทางกดหลุดไป YouTube) */}
      <div className="bg-black sticky top-14 z-30 lg:static lg:rounded-2xl lg:overflow-hidden">
        <div className="max-w-2xl mx-auto lg:max-w-none">
          {current ? (
            <CourseVideoPlayer
              ytId={current.ytId}
              userLabel={userLabel}
              hasNext={!!nextVideo}
              onNext={() => nextVideo && setCurrent(nextVideo)}
              initialSeconds={
                progress.get(current.id)?.completed
                  ? 0
                  : progress.get(current.id)?.seconds ?? 0
              }
              onProgress={handleProgress}
            />
          ) : (
            <div className="w-full flex items-center justify-center text-white/60 text-[13.5px] px-6 text-center"
              style={{ aspectRatio: "16/9" }}>
              {access.hasFull
                ? "ยังไม่มีวิดีโอในคอร์ส — Admin เพิ่มได้ที่ Admin › คอร์สวิดีโอ"
                : "🎬 คลิปสรุปโค้งสุดท้ายกำลังทยอยมาระหว่าง 1–14 ส.ค. — กลับมาเช็คที่นี่ได้เลย"}
            </div>
          )}
        </div>
      </div>

      {/* ชื่อคลิปปัจจุบัน */}
      {current && (
        <div className="max-w-2xl mx-auto lg:max-w-none px-5 py-4 bg-white lg:rounded-b-2xl" style={{ borderBottom: "1px solid #EBEBEA" }}>
          <p className="text-[12px] font-semibold mb-0.5" style={{ color: BRAND.primary }}>
            {current.chapter}
          </p>
          <h1 className="text-[16px] font-bold text-gray-900 leading-snug">
            {current.order}. {current.title}
          </h1>
        </div>
      )}

      {/* ทรัพยากรคอร์สเต็ม: ชีทสรุป + กลุ่ม LINE (เฉพาะคอร์สเต็ม) */}
      <div className="max-w-2xl mx-auto lg:max-w-none px-5 lg:px-0 pt-4">
        {access.hasFull ? (
          <CourseResources />
        ) : (
          <Link href="/checkout/up-full2"
            className="block rounded-2xl px-4 py-3.5 text-[13px] active:scale-[0.99] transition-transform"
            style={{ backgroundColor: "#FDF6E9", color: "#92400E", border: "1px solid #FDE9C8" }}>
            🎬 อยากดูวิดีโอติวครบ 65 คลิป + ชีทสรุป? อัปเกรดเป็นคอร์สเต็ม จ่ายเพิ่ม ฿{PRICING.reviewToFullPrice} →
          </Link>
        )}
      </div>

      </div>{/* /ฝั่งซ้าย */}

      {/* Playlist — จอกว้างเป็นคอลัมน์ขวา */}
      <div className="max-w-2xl mx-auto lg:max-w-none lg:mx-0 min-w-0 px-5 lg:px-0 py-5 lg:py-0 space-y-6">
        {error && <p className="text-[13.5px] text-red-500">{error}</p>}
        {chapters.map(([chapter, list]) => {
          const doneCount = list.filter((v) => progress.get(v.id)?.completed).length;
          return (
          <section key={chapter}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[12.5px] font-bold uppercase tracking-wider"
                style={{ color: "#A8A8A6" }}>
                {chapter}
              </p>
              <span className="text-[12px] font-semibold"
                style={{ color: doneCount === list.length ? "#15803D" : "#A8A8A6" }}>
                {doneCount === list.length ? "✓ ครบแล้ว" : `${doneCount}/${list.length} จบ`}
              </span>
            </div>
            <div className="space-y-2">
              {list.map((v) => {
                const active    = current?.id === v.id;
                const pg        = progress.get(v.id);
                const completed = !!pg?.completed;
                const partial   = !completed && !!pg && pg.seconds > 5 && pg.duration > 0;
                const pct       = partial ? Math.min(99, Math.round((pg!.seconds / pg!.duration) * 100)) : 0;
                return (
                  <button
                    key={v.id}
                    onClick={() => { setCurrent(v); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="w-full text-left rounded-2xl px-4 py-3 flex items-center gap-3.5
                               active:scale-[0.99] transition-transform"
                    style={{
                      backgroundColor: completed && !active ? "#F7FDF9" : "white",
                      border: active
                        ? `1.5px solid ${BRAND.primary}`
                        : completed ? "1px solid #BBF7D0" : "1px solid #EBEBEA",
                    }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: active ? BRAND.primary
                          : completed ? "#DCFCE7" : "#EBF5F3",
                      }}>
                      {active ? (
                        <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
                          <rect x="5" y="4" width="4" height="16" rx="1" />
                          <rect x="15" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : completed ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#15803D"
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill={BRAND.primary} className="w-3.5 h-3.5">
                          <polygon points="6 3 20 12 6 21 6 3" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13.5px] leading-snug truncate ${active ? "font-bold" : "font-semibold"}`}
                        style={{
                          color: active ? BRAND.primary
                            : completed ? "#6B7280" : "#1F2937",
                        }}>
                        {v.order}. {v.title}
                      </p>
                      {/* สถานะใต้ชื่อ */}
                      {completed ? (
                        <p className="text-[12px] mt-0.5 font-semibold" style={{ color: "#15803D" }}>
                          ✓ ดูจบแล้ว{v.duration && ` · ${v.duration}`}
                        </p>
                      ) : partial ? (
                        <div className="mt-1.5">
                          <div className="h-[4px] rounded-full overflow-hidden"
                            style={{ backgroundColor: "#F0EFEC" }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: "#F59E0B" }} />
                          </div>
                          <p className="text-[12px] mt-1 font-semibold" style={{ color: "#B45309" }}>
                            ดูค้างไว้ {pct}%{v.duration && ` · ${v.duration}`}
                          </p>
                        </div>
                      ) : (
                        v.duration && (
                          <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>{v.duration}</p>
                        )
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
          );
        })}
      </div>

      </div>{/* /สองฝั่ง */}

      <BottomNav />
    </div>
  );
}
