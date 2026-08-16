"use client";
/**
 * SampleVideoTeaser — คลิปตัวอย่างฟรีสำหรับคนที่ยังไม่ซื้อคอร์ส
 * ดึงคลิปที่ admin ตั้ง isSample (เผยแพร่) มาให้ชมได้ พร้อมลายน้ำผู้ชม
 * ถ้ายังไม่มีคลิปตัวอย่าง → ไม่เรนเดอร์อะไรเลย (คืน null)
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getSampleVideos, type CourseVideo } from "@/lib/video-firestore";
import { BRAND } from "@/lib/subjects";
import CourseVideoPlayer from "@/components/CourseVideoPlayer";

export default function SampleVideoTeaser() {
  const { user } = useAuth();
  const [samples, setSamples] = useState<CourseVideo[] | null>(null);
  const [current, setCurrent] = useState<CourseVideo | null>(null);

  useEffect(() => {
    getSampleVideos()
      .then((vs) => { setSamples(vs); setCurrent(vs[0] ?? null); })
      .catch(() => setSamples([]));
  }, []);

  if (samples === null || samples.length === 0 || !current) return null;

  const userLabel = user?.email || "ตัวอย่างคอร์ส AJ";

  return (
    <div className="card-elev overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #F3F2F0" }}>
        <span className="text-[15px]">🎁</span>
        <p className="text-[13.5px] font-bold" style={{ color: BRAND.primary }}>
          ตัวอย่างคลิปติวฟรี — ดูก่อนตัดสินใจ
        </p>
      </div>

      <div className="bg-black">
        <CourseVideoPlayer
          key={current.ytId}
          ytId={current.ytId}
          userLabel={userLabel}
          hasNext={false}
          onNext={() => {}}
        />
      </div>

      <div className="px-4 py-3">
        <p className="text-[13.5px] font-bold text-gray-900 leading-snug">
          {current.title}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>{current.chapter}</p>

        {/* เลือกคลิปตัวอย่างอื่น (ถ้ามีมากกว่า 1) */}
        {samples.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {samples.map((v) => {
              const active = v.id === current.id;
              return (
                <button key={v.id} onClick={() => setCurrent(v)}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={active
                    ? { backgroundColor: BRAND.primary, color: "white" }
                    : { backgroundColor: "#F3F2F0", color: "#6B7280" }}>
                  {v.title.length > 24 ? v.title.slice(0, 24) + "…" : v.title}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
