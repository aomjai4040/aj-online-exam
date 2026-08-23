"use client";
/**
 * CourseProgressCard — แผงความคืบหน้าคอร์สบนหน้าคอร์ส (อัตโนมัติ ไม่ต้องติ๊ก)
 * คำนวณด้วย lib/course-progress.ts จากคลิปที่ดู / ชุดที่ส่ง / Mock ที่ทำ
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import type { UserAccess } from "@/lib/access";
import type { ExamFieldKey } from "@/lib/exam-fields";
import { examSetField } from "@/lib/exam-fields";
import { getPublishedExams } from "@/lib/firestore";
import { getPublishedVideos } from "@/lib/video-firestore";
import { getAllVideoProgress } from "@/lib/video-progress";
import { getUserSummaries } from "@/lib/user-firestore";
import { isFinalLapExam } from "@/lib/final-review";
import { buildCourseProgress, PASS_PCT, type CourseProgress } from "@/lib/course-progress";
import { BRAND } from "@/lib/subjects";

const GREEN = "#0B6E65", AMBER = "#B45309", RED = "#DC2626", MUTED = "#A8A8A6";

function Ring({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="w-16 h-16 flex-shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="#FBBF24" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 32 32)" />
      <text x="32" y="36" textAnchor="middle" fontSize="15" fontWeight="800" fill="white">{pct}%</text>
    </svg>
  );
}

export default function CourseProgressCard({ field, access, onPct }: {
  field: ExamFieldKey; access: UserAccess;
  /** แจ้ง % รวมให้หน้าแม่ (ใช้ตัดสินว่า "จบคอร์ส" แล้วหรือยัง) */
  onPct?: (pct: number) => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<CourseProgress | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [vsAll, exAll, vp, sums] = await Promise.all([
          getPublishedVideos().catch(() => []),
          getPublishedExams().catch(() => []),
          getAllVideoProgress(user.uid).catch(() => new Map()),
          getUserSummaries(user.uid).catch(() => []),
        ]);
        // คลิปที่ "สิทธิ์นี้ดูได้" เท่านั้น (กติกาเดียวกับหน้า /videos)
        const videos = vsAll.filter((v) => {
          const vf = v.field === "dcd" ? "dcd" : "moph";
          if (vf !== field) return false;
          return vf === "dcd" ? access.hasDcd
            : (access.hasFull || (access.hasReview && v.chapter.includes("โค้งสุดท้าย")));
        });
        const exams = exAll.filter((e) => examSetField(e) === field && !isFinalLapExam(e));
        const done = {
          videos: vp,
          exams: new Map(sums.map((s) => [s.examId, { best: s.bestPercentage ?? s.percentage, lastDoneAt: new Date(s.lastDoneAt) }])),
        };
        if (cancelled) return;
        const p = buildCourseProgress(field, videos, exams, done);
        setData(p);
        onPct?.(p.pct);
      } catch { if (!cancelled) setData(null); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, field, access]);

  if (!data) return null;
  const { pct, clips, sets, mock, chapters, resume } = data;
  const hasAnything = clips.total + sets.total + mock.total > 0;
  if (!hasAnything) return null;

  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ boxShadow: "0 2px 6px rgba(16,24,40,.06), 0 12px 28px -12px rgba(11,110,101,.45)" }}>
      {/* ── หัว: % รวม + ตัวเลข 3 ส่วน ── */}
      <div className="px-4 pt-4 pb-3.5 text-white"
        style={{ background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%)` }}>
        <div className="flex items-center gap-3.5">
          <Ring pct={pct} />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#9FE1CB" }}>ความคืบหน้าคอร์ส</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[13px] font-semibold">
              {clips.total > 0 && <span>▶ คลิป {clips.done}/{clips.total}</span>}
              {sets.total  > 0 && <span>📝 ข้อสอบ {sets.done}/{sets.total}</span>}
              {mock.total  > 0 && <span>⏱ Mock {mock.done}/{mock.total}{mock.best > 0 ? ` · ดีสุด ${mock.best}%` : ""}</span>}
            </div>
            {sets.low > 0 && (
              <p className="text-[12px] mt-1" style={{ color: "#FCD34D" }}>
                มี {sets.low} ชุดที่ได้ต่ำกว่า {PASS_PCT}% — ลองทำใหม่ให้ผ่าน
              </p>
            )}
          </div>
        </div>
        {resume && (
          <Link href={resume.href}
            className="mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "white", color: BRAND.primaryDark }}>
            <span className="truncate flex-1">▶ {resume.label}</span>
            <span className="flex-shrink-0">→</span>
          </Link>
        )}
      </div>

      {/* ── รายบท ── */}
      {chapters.length > 0 && (
        <div className="bg-white">
          <button type="button" onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-[13px] font-bold"
            style={{ color: GREEN, borderBottom: open ? "1px solid #F3F2F0" : "none" }}>
            <span>รายบท · ทำครบแล้ว {chapters.filter((c) => c.complete).length}/{chapters.length} บท</span>
            <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>⌄</span>
          </button>
          {open && (
            <div className="divide-y" style={{ borderColor: "#F3F2F0" }}>
              {chapters.map((c) => {
                const total = c.clips.total + c.sets.total;
                const doneN = c.clips.done + c.sets.done;
                const ratio = total > 0 ? doneN / total : 0;
                const inner = (
                  <>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={c.complete
                        ? { backgroundColor: "#DCFCE7", color: "#15803D" }
                        : { backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                      {c.complete ? "✓" : c.no}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#EEEEEC" }}>
                          <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: c.complete ? "#16A34A" : GREEN }} />
                        </div>
                        <span className="text-[11px] flex-shrink-0" style={{ color: MUTED }}>
                          {c.clips.total > 0 && `▶ ${c.clips.done}/${c.clips.total}`}
                          {c.clips.total > 0 && c.sets.total > 0 && " · "}
                          {c.sets.total > 0 && (
                            <span style={{ color: c.sets.low > 0 ? RED : c.sets.done < c.sets.total ? AMBER : MUTED }}>
                              📝 {c.sets.done}/{c.sets.total}{c.sets.low > 0 ? ` (${c.sets.low} ต่ำกว่า ${PASS_PCT}%)` : ""}
                            </span>
                          )}
                          {total === 0 && "ยังไม่มีเนื้อหา"}
                        </span>
                      </div>
                    </div>
                    {c.href && <span className="text-[13px] flex-shrink-0" style={{ color: "#C4C4C0" }}>›</span>}
                  </>
                );
                const cls = "flex items-center gap-3 px-4 py-2.5 active:bg-stone-50";
                return c.href
                  ? <Link key={c.no} href={c.href} className={cls}>{inner}</Link>
                  : <div key={c.no} className={cls}>{inner}</div>;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
