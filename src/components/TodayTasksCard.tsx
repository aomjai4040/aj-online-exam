"use client";
/**
 * TodayTasksCard — บล็อกบนสุดของหน้าแรก: "วันนี้ทำอะไร" (Aj ข้อ 2)
 *
 * 28% ของผู้ตอบแบบประเมินบอกว่าไม่รู้ว่าควรทำอะไรต่อ + 9% หาเมนูไม่เจอ
 * ทั้งที่เนื้อหาทุกส่วนได้ 90%+ → ปัญหาคือ "ทางเดิน" ไม่ใช่ "ของ"
 *
 * แสดงงานวันนี้ไม่เกิน 3 อย่าง กดแล้วไปที่นั้นทันที + แถบความคืบหน้ารวม
 * + ลิงก์ดูปฏิทินทั้งคอร์ส (รู้ว่าข้างหน้ามีอะไรตั้งแต่วันแรก)
 *
 * ปฏิทินมาจาก /api/course-plan/[field] ที่ Aj แก้เองได้ — ถ้ายังไม่มีแผน
 * การ์ดนี้ซ่อนตัวเอง ไม่รบกวนหน้าแรก
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getActiveField } from "@/lib/active-field";
import { BRAND } from "@/lib/subjects";
import {
  todayItems, planProgress, currentDayNumber, thaiDate,
  ITEM_KIND_LABEL, type CoursePlan, type PlanItem,
} from "@/lib/course-plan";

const ICON: Record<string, React.ReactNode> = {
  video: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  sheet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  exam: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  flashcard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <rect x="2" y="7" width="15" height="13" rx="2" />
      <path d="M7 4h13a2 2 0 012 2v11" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
};

function TaskRow({ item }: { item: PlanItem }) {
  const ready = !!item.href;
  const body = (
    <>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: ready ? "#EBF5F3" : "#F3F2F0",
                 color: ready ? BRAND.primary : "#C4C4C0" }}>
        {ICON[item.kind] ?? ICON.link}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11.5px] font-semibold"
          style={{ color: ready ? BRAND.primary : "#C4C4C0" }}>
          {ITEM_KIND_LABEL[item.kind] ?? "งาน"}
        </span>
        <span className="block text-[14.5px] font-semibold leading-snug"
          style={{ color: ready ? "#1F2937" : "#A8A8A6" }}>
          {item.label}
        </span>
      </span>
      {ready ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="#C4C4C0" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ) : (
        <span className="text-[11.5px] flex-shrink-0" style={{ color: "#C4C4C0" }}>เร็ว ๆ นี้</span>
      )}
    </>
  );

  const cls = "flex items-center gap-3 rounded-xl px-3.5 py-2.5";
  const style = { backgroundColor: "#FAFAF8", border: "1px solid #EBEBEA" };

  if (!ready) return <div className={cls} style={style}>{body}</div>;
  return item.href.startsWith("http")
    ? <a href={item.href} target="_blank" rel="noopener noreferrer"
        className={`${cls} active:scale-[0.99] transition-transform`} style={style}>{body}</a>
    : <Link href={item.href}
        className={`${cls} active:scale-[0.99] transition-transform`} style={style}>{body}</Link>;
}

export default function TodayTasksCard() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<CoursePlan | null>(null);

  useEffect(() => {
    if (!user) { setPlan(null); return; }
    let cancelled = false;
    const field = getActiveField();
    user.getIdToken()
      .then((t) => fetch(`/api/course-plan/${field}`, { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setPlan(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  if (!plan || !plan.startDate || plan.days.length === 0) return null;

  const dayNo = currentDayNumber(plan.startDate);
  const { day, items } = todayItems(plan);
  const prog = planProgress(plan);
  const notStarted = dayNo === 0;
  const finished   = dayNo > plan.days.length;

  return (
    <div className="card-elev px-4 py-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-[16.5px] font-bold text-gray-900 leading-tight">
            {notStarted ? "คอร์สเริ่มเร็ว ๆ นี้"
              : finished ? "เรียนครบทุกวันแล้ว"
              : `วันนี้ทำอะไร · วันที่ ${dayNo}`}
          </p>
          {day?.title && !notStarted && !finished && (
            <p className="text-[13px] mt-0.5" style={{ color: BRAND.primary }}>{day.title}</p>
          )}
          {notStarted && (
            <p className="text-[13px] mt-0.5" style={{ color: "#A8A8A6" }}>
              วันแรก {thaiDate(plan.startDate, 1)} · ดูปฏิทินล่วงหน้าได้เลย
            </p>
          )}
        </div>
        <Link href="/plan"
          className="text-[12.5px] font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
          style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
          ปฏิทิน
        </Link>
      </div>

      {/* ความคืบหน้ารวมทั้งคอร์ส */}
      <div className="mt-2.5 mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-[12px]" style={{ color: "#A8A8A6" }}>ความคืบหน้าคอร์ส</span>
          <span className="text-[12px] font-bold" style={{ color: BRAND.primary }}>
            วันที่ {Math.min(prog.done, prog.total)}/{prog.total}
          </span>
        </div>
        <div className="h-2 rounded-full" style={{ backgroundColor: "#F3F2F0" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${prog.percent}%`, backgroundColor: BRAND.primary }} />
        </div>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((it, i) => <TaskRow key={i} item={it} />)}
        </div>
      ) : (
        <p className="text-[13px] rounded-xl px-3.5 py-3"
          style={{ backgroundColor: "#FAFAF8", color: "#A8A8A6" }}>
          {notStarted
            ? "ยังไม่ถึงวันเริ่ม — กดปฏิทินดูว่าข้างหน้ามีอะไรบ้าง"
            : finished
            ? "ทบทวนย้อนหลังได้ทุกวันจากปฏิทิน"
            : "วันนี้ยังไม่มีงานที่กำหนดไว้ — ทบทวนของเมื่อวานได้จากปฏิทิน"}
        </p>
      )}
    </div>
  );
}
