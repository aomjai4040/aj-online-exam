"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { getUserAccess, EMPTY_ACCESS, type UserAccess } from "@/lib/access";
import { getPublishedVideos, type CourseVideo } from "@/lib/video-firestore";
import { PRICING, CONTACT_URL } from "@/lib/pricing";
import { BRAND } from "@/lib/subjects";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";
import CourseVideoPlayer from "@/components/CourseVideoPlayer";

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

  useEffect(() => {
    if (guard !== "allowed" || !user) return;
    (async () => {
      try {
        const a = await getUserAccess(user.uid);
        setAccess(a);
        if (a.hasFull) {
          const vs = await getPublishedVideos();
          setVideos(vs);
          setCurrent(vs[0] ?? null);
        }
      } catch { setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่"); }
      finally { setLoading(false); }
    })();
  }, [guard, user]);

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

  // ── ยังไม่มีสิทธิ์คอร์สเต็ม → upsell ──────────────────────────────────────
  if (!access.hasFull) {
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
          <p className="text-[13.5px] leading-relaxed mb-7 max-w-xs mx-auto" style={{ color: "#A8A8A6" }}>
            วิดีโอติวครบทุกหัวข้อ + ชีทสรุป ~500 หน้า
            {access.hasAny
              ? ` — อัปเกรดจาก App Only จ่ายเพิ่มเพียง ฿${PRICING.upgradePrice}`
              : ` — คอร์สเต็ม ฿${PRICING.full.price} รวมทุกอย่างในแอปด้วย`}
          </p>
          <div className="space-y-3 max-w-xs mx-auto">
            <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full py-3.5 text-[15px] block text-center">
              {access.hasAny ? `อัปเกรด ฿${PRICING.upgradePrice} — ทัก LINE` : "สั่งซื้อคอร์สเต็ม — ทัก LINE"}
            </a>
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

      {/* Player (ควบคุมเองทั้งหมด — ไม่มีทางกดหลุดไป YouTube) */}
      <div className="bg-black sticky top-14 z-30">
        <div className="max-w-2xl mx-auto">
          {current ? (
            <CourseVideoPlayer
              ytId={current.ytId}
              userLabel={userLabel}
              hasNext={!!nextVideo}
              onNext={() => nextVideo && setCurrent(nextVideo)}
            />
          ) : (
            <div className="w-full flex items-center justify-center text-white/60 text-[13.5px]"
              style={{ aspectRatio: "16/9" }}>
              ยังไม่มีวิดีโอในคอร์ส — Admin เพิ่มได้ที่ Admin › คอร์สวิดีโอ
            </div>
          )}
        </div>
      </div>

      {/* ชื่อคลิปปัจจุบัน */}
      {current && (
        <div className="max-w-2xl mx-auto px-5 py-4 bg-white" style={{ borderBottom: "1px solid #EBEBEA" }}>
          <p className="text-[12px] font-semibold mb-0.5" style={{ color: BRAND.primary }}>
            {current.chapter}
          </p>
          <h1 className="text-[16px] font-bold text-gray-900 leading-snug">
            {current.order}. {current.title}
          </h1>
        </div>
      )}

      {/* Playlist */}
      <div className="max-w-2xl mx-auto px-5 py-5 space-y-6">
        {error && <p className="text-[13.5px] text-red-500">{error}</p>}
        {chapters.map(([chapter, list]) => (
          <section key={chapter}>
            <p className="text-[12.5px] font-bold uppercase tracking-wider mb-2.5"
              style={{ color: "#A8A8A6" }}>
              {chapter}
            </p>
            <div className="space-y-2">
              {list.map((v) => {
                const active = current?.id === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => { setCurrent(v); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="w-full text-left bg-white rounded-2xl px-4 py-3 flex items-center gap-3.5
                               active:scale-[0.99] transition-transform"
                    style={{ border: active ? `1.5px solid ${BRAND.primary}` : "1px solid #EBEBEA" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: active ? BRAND.primary : "#EBF5F3" }}>
                      {active ? (
                        <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
                          <rect x="5" y="4" width="4" height="16" rx="1" />
                          <rect x="15" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill={BRAND.primary} className="w-3.5 h-3.5">
                          <polygon points="6 3 20 12 6 21 6 3" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13.5px] leading-snug truncate ${active ? "font-bold" : "font-semibold"}`}
                        style={{ color: active ? BRAND.primary : "#1F2937" }}>
                        {v.order}. {v.title}
                      </p>
                      {v.duration && (
                        <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>{v.duration}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
