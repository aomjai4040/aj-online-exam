"use client";
/**
 * /plan — ปฏิทินคอร์สทั้งหมด (Aj ข้อ 2: "เห็นได้ตั้งแต่วันแรก รู้ว่าข้างหน้ามีอะไร")
 *
 * วันที่ผ่านมาแล้ว = กดเข้าไปทำได้ · วันข้างหน้า = เห็นหัวข้อแต่ยังกดไม่ได้
 * ทำให้คนที่เพิ่งซื้อคอร์สที่เนื้อหายังไม่ครบ เห็นว่าจะได้อะไรบ้าง
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { getActiveField } from "@/lib/active-field";
import { FIELD_SHORT, type ExamFieldKey } from "@/lib/exam-fields";
import { BRAND } from "@/lib/subjects";
import {
  currentDayNumber, thaiDate, planProgress, ITEM_KIND_LABEL,
  type CoursePlan,
} from "@/lib/course-plan";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

export default function PlanPage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();
  const [plan,    setPlan]    = useState<CoursePlan | null>(null);
  const [field,   setField]   = useState<ExamFieldKey>("moph");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const f = getActiveField();
    setField(f);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/course-plan/${f}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPlan(await res.json());
    } catch { /* ลองใหม่ได้ */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (guard === "allowed") load(); }, [guard, load]);

  if (guard !== "allowed" || loading) return <AccessGuardSpinner />;

  const p2 = plan ?? { fieldId: "dcd", startDate: "2026-08-14", days: [1,2,3,4].map((n) => ({ n, title: "หัวข้อวันที่ " + n, items: [{ kind: "video" as const, label: "คลิป EP." + n, href: "/videos" }, { kind: "exam" as const, label: "ชุดฝึก 20 ข้อ", href: n < 3 ? "/exams" : "" }] })) };
  const hasPlan = plan && plan.startDate && plan.days.length > 0;
  const dayNo   = hasPlan ? currentDayNumber(plan!.startDate) : 0;
  const prog    = hasPlan ? planProgress(plan!) : { done: 0, total: 0, percent: 0 };

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <section className="relative overflow-hidden px-5 pt-8 pb-6"
        style={{ background: "linear-gradient(160deg, #0E5F56 0%, #0B4F48 100%)" }}>
        <div className="max-w-lg mx-auto">
          <p className="text-[12px] font-semibold mb-1.5" style={{ color: "#9FE1CB" }}>
            ปฏิทินคอร์ส · สนาม{FIELD_SHORT[field]}
          </p>
          <h1 className="text-[22px] font-bold text-white leading-snug">
            แผนเรียนทั้งคอร์ส
          </h1>
          {hasPlan && (
            <p className="text-[13px] mt-1.5" style={{ color: "rgba(255,255,255,0.72)" }}>
              {plan!.days.length} วัน · เริ่ม {thaiDate(plan!.startDate, 1)}
              {dayNo > 0 && dayNo <= plan!.days.length && ` · วันนี้วันที่ ${dayNo}`}
            </p>
          )}
        </div>
      </section>

      <div className="max-w-lg mx-auto px-5 py-5">
        {!hasPlan ? (
          <div className="card-elev px-5 py-12 text-center">
            <p className="text-[15px] font-semibold text-gray-800 mb-1">ยังไม่มีปฏิทินคอร์ส</p>
            <p className="text-[13px]" style={{ color: "#A8A8A6" }}>
              พี่อ้อมกำลังจัดตารางอยู่ — พร้อมเมื่อไหร่จะขึ้นที่นี่ค่ะ
            </p>
            <Link href="/" className="btn-secondary mt-6 px-6 py-2.5 text-[14px] inline-block">
              กลับหน้าแรก
            </Link>
          </div>
        ) : (
          <>
            {/* ความคืบหน้า */}
            <div className="card-elev px-4 py-3.5 mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-[13px] font-semibold text-gray-800">ความคืบหน้า</span>
                <span className="text-[13px] font-bold" style={{ color: BRAND.primary }}>
                  วันที่ {Math.min(prog.done, prog.total)}/{prog.total}
                </span>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: "#F3F2F0" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${prog.percent}%`, backgroundColor: BRAND.primary }} />
              </div>
            </div>

            {/* รายวัน */}
            <div className="space-y-3">
              {plan!.days.map((d) => {
                const date    = thaiDate(plan!.startDate, d.n);
                const isToday = d.n === dayNo;
                const past    = d.n < dayNo;
                const future  = d.n > dayNo;
                return (
                  <div key={d.n} className="card-elev overflow-hidden"
                    style={isToday ? { border: `2px solid ${BRAND.primary}` } : undefined}>
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[12px] font-bold px-2 py-0.5 rounded-md"
                          style={{
                            backgroundColor: isToday ? BRAND.primary : past ? "#EBF5F3" : "#F3F2F0",
                            color: isToday ? "white" : past ? BRAND.primary : "#A8A8A6",
                          }}>
                          วันที่ {d.n}
                        </span>
                        <span className="text-[12px]" style={{ color: "#A8A8A6" }}>{date}</span>
                        {isToday && (
                          <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>วันนี้</span>
                        )}
                      </div>

                      {d.title && (
                        <p className="text-[14.5px] font-bold text-gray-900 leading-snug mb-2">
                          {d.title}
                        </p>
                      )}

                      <div className="space-y-1.5">
                        {d.items.map((it, i) => {
                          const open = !!it.href && !future;
                          const row = (
                            <>
                              <span className="text-[11.5px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                                style={{ backgroundColor: open ? "#EBF5F3" : "#F3F2F0",
                                         color: open ? BRAND.primary : "#A8A8A6" }}>
                                {ITEM_KIND_LABEL[it.kind] ?? "งาน"}
                              </span>
                              <span className="text-[13.5px] leading-snug flex-1 min-w-0"
                                style={{ color: open ? "#374151" : "#A8A8A6" }}>
                                {it.label}
                              </span>
                            </>
                          );
                          const cls = "flex items-start gap-2 py-0.5";
                          return open
                            ? it.href.startsWith("http")
                              ? <a key={i} href={it.href} target="_blank" rel="noopener noreferrer" className={cls}>{row}</a>
                              : <Link key={i} href={it.href} className={cls}>{row}</Link>
                            : <div key={i} className={cls}>{row}</div>;
                        })}
                        {d.items.length === 0 && (
                          <p className="text-[12.5px]" style={{ color: "#C4C4C0" }}>ยังไม่ระบุรายละเอียด</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
