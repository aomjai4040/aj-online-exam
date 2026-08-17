"use client";
/**
 * /admin/plan — จัดปฏิทินคอร์ส (Aj แก้เอง ไม่ต้องรอ dev)
 *
 * แผนคอร์สเปลี่ยนระหว่างผลิตเนื้อหา ถ้าฝังในโค้ดจะล้าสมัยทันที
 * หน้านี้ให้ Aj ใส่เอง แล้วหน้าแรกของน้องดึงไปแสดง "วันนี้ทำอะไร" อัตโนมัติ
 *
 * ปุ่ม "เติมคลิป/ข้อสอบอัตโนมัติ" ช่วยตั้งต้น: ดึงคลิปกับชุดข้อสอบของสนามนั้น
 * มาไล่ใส่ทีละวัน แล้ว Aj ค่อยแก้รายละเอียด
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { BRAND } from "@/lib/subjects";
import { getPublishedVideos } from "@/lib/video-firestore";
import { getPublishedExams } from "@/lib/firestore";
import { isMockExam } from "@/lib/types";
import { examSetField, FIELD_SHORT, type ExamFieldKey } from "@/lib/exam-fields";
import {
  thaiDate, currentDayNumber, ITEM_KIND_LABEL,
  type CoursePlan, type PlanDay, type PlanItem, type PlanItemKind,
} from "@/lib/course-plan";

const KINDS: PlanItemKind[] = ["video", "sheet", "exam", "flashcard", "link"];

export default function AdminPlanPage() {
  const { user } = useAuth();
  const [field,   setField]   = useState<ExamFieldKey>("dcd");
  const [plan,    setPlan]    = useState<CoursePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState("");

  const load = useCallback(async (f: ExamFieldKey) => {
    if (!user) { setPlan({ fieldId: f, startDate: "2026-08-21", days: [{ n: 1, title: "ระบาดวิทยาเบื้องต้น", items: [{ kind: "video", label: "EP.1 ระบาดวิทยา", href: "/videos" }, { kind: "exam", label: "ชุดฝึก 20 ข้อ", href: "" }] }] }); setLoading(false); return; }
    setLoading(true); setMsg("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/course-plan/${f}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPlan(await res.json());
    } catch { setMsg("โหลดไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(field); }, [field, load]);

  function patch(fn: (p: CoursePlan) => CoursePlan) {
    setPlan((p) => (p ? fn(structuredClone(p)) : p));
  }

  async function save() {
    if (!user || !plan || saving) return;
    setSaving(true); setMsg("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/course-plan/${field}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startDate: plan.startDate, days: plan.days }),
      });
      const d = await res.json();
      setMsg(res.ok ? `บันทึกแล้ว ${d.days} วัน` : (d.error ?? "บันทึกไม่สำเร็จ"));
    } catch { setMsg("บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  /** ตั้งต้นจากเนื้อหาที่มีอยู่จริง — คลิป 1 ตัว + ข้อสอบหมวดเดียวกันต่อวัน */
  async function autofill() {
    if (!plan) return;
    setMsg("กำลังดึงเนื้อหา…");
    try {
      const [videos, exams] = await Promise.all([getPublishedVideos(), getPublishedExams()]);
      const vs = videos.filter((v) => v.field === field);
      const es = exams.filter((e) => !isMockExam(e) && examSetField(e) === field);

      const days: PlanDay[] = vs.map((v, i) => ({
        n: i + 1,
        title: v.title,
        items: [
          { kind: "video" as PlanItemKind, label: v.title, href: `/videos?v=${v.id}` },
          ...(es[i] ? [{ kind: "exam" as PlanItemKind,
                         label: `${es[i].title} (${es[i].questionCount} ข้อ)`,
                         href: `/exam/${es[i].id}` }] : []),
        ],
      }));
      if (days.length === 0) { setMsg("ยังไม่มีคลิปของสนามนี้ — เพิ่มวันเองได้ด้านล่าง"); return; }
      patch((p) => ({ ...p, days }));
      setMsg(`ตั้งต้นให้ ${days.length} วันแล้ว — แก้รายละเอียดแล้วกดบันทึก`);
    } catch { setMsg("ดึงเนื้อหาไม่สำเร็จ"); }
  }

  const dayNo = plan?.startDate ? currentDayNumber(plan.startDate) : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <div className="max-w-3xl mx-auto px-5 pt-6 pb-16">

        <h1 className="text-[19px] font-bold text-gray-900">ปฏิทินคอร์ส</h1>
        <p className="text-[13px] mt-0.5 mb-4" style={{ color: "#A8A8A6" }}>
          น้องเห็นเป็น &ldquo;วันนี้ทำอะไร&rdquo; บนหน้าแรก + หน้าปฏิทินทั้งคอร์ส
        </p>

        {/* เลือกสนาม */}
        <div className="flex gap-2 mb-4">
          {(["dcd", "moph"] as ExamFieldKey[]).map((f) => (
            <button key={f} onClick={() => setField(f)}
              className="flex-1 py-2.5 rounded-xl text-[13.5px] font-semibold"
              style={{
                backgroundColor: field === f ? BRAND.primary : "white",
                color: field === f ? "white" : "#6B7280",
                border: `1.5px solid ${field === f ? BRAND.primary : "#EBEBEA"}`,
              }}>
              สนาม{FIELD_SHORT[f]}
            </button>
          ))}
        </div>

        {loading || !plan ? (
          <p className="text-[13px] py-8 text-center" style={{ color: "#A8A8A6" }}>กำลังโหลด…</p>
        ) : (
          <>
            <div className="card-elev p-4 mb-4">
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                วันแรกของคอร์ส
              </label>
              <input type="date" value={plan.startDate}
                onChange={(e) => patch((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-[14px] mb-2"
                style={{ border: "1px solid #E0DFDC" }} />
              {plan.startDate && (
                <p className="text-[12.5px]" style={{ color: BRAND.primary }}>
                  {dayNo === 0 ? "ยังไม่ถึงวันเริ่ม"
                    : dayNo > plan.days.length ? "เลยวันสุดท้ายแล้ว"
                    : `วันนี้คือวันที่ ${dayNo} ของคอร์ส`}
                </p>
              )}

              <div className="flex gap-2 mt-3">
                <button onClick={autofill}
                  className="text-[12.5px] font-semibold px-3 py-2 rounded-lg"
                  style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
                  เติมจากคลิป/ข้อสอบที่มีอยู่
                </button>
                <button
                  onClick={() => patch((p) => ({
                    ...p,
                    days: [...p.days, { n: p.days.length + 1, title: "", items: [] }],
                  }))}
                  className="text-[12.5px] font-semibold px-3 py-2 rounded-lg"
                  style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
                  + เพิ่มวัน
                </button>
              </div>
            </div>

            {/* รายวัน */}
            <div className="space-y-3 mb-4">
              {plan.days.map((d, di) => (
                <div key={di} className="card-elev p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[12px] font-bold px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
                      วันที่ {d.n}
                    </span>
                    <span className="text-[12px]" style={{ color: "#A8A8A6" }}>
                      {plan.startDate ? thaiDate(plan.startDate, d.n) : ""}
                    </span>
                    <button
                      onClick={() => patch((p) => ({
                        ...p,
                        days: p.days.filter((_, i) => i !== di).map((x, i) => ({ ...x, n: i + 1 })),
                      }))}
                      className="ml-auto text-[12px] px-2 py-1 rounded-lg"
                      style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                      ลบวัน
                    </button>
                  </div>

                  <input value={d.title} placeholder="หัวข้อของวัน เช่น ระบาดวิทยาเบื้องต้น"
                    onChange={(e) => patch((p) => {
                      p.days[di].title = e.target.value; return p;
                    })}
                    className="w-full rounded-lg px-3 py-2 text-[14px] mb-2.5"
                    style={{ border: "1px solid #E0DFDC" }} />

                  <div className="space-y-2">
                    {d.items.map((it, ii) => (
                      <div key={ii} className="flex gap-1.5 items-start">
                        <select value={it.kind}
                          onChange={(e) => patch((p) => {
                            p.days[di].items[ii].kind = e.target.value as PlanItemKind; return p;
                          })}
                          className="rounded-lg px-2 py-2 text-[12.5px] flex-shrink-0"
                          style={{ border: "1px solid #E0DFDC", width: 104 }}>
                          {KINDS.map((k) => (
                            <option key={k} value={k}>{ITEM_KIND_LABEL[k]}</option>
                          ))}
                        </select>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <input value={it.label} placeholder="ชื่อที่น้องเห็น"
                            onChange={(e) => patch((p) => {
                              p.days[di].items[ii].label = e.target.value; return p;
                            })}
                            className="w-full rounded-lg px-2.5 py-2 text-[13px]"
                            style={{ border: "1px solid #E0DFDC" }} />
                          <input value={it.href} placeholder="ลิงก์ เช่น /exam/abc123 (เว้นว่าง = ยังไม่พร้อม)"
                            onChange={(e) => patch((p) => {
                              p.days[di].items[ii].href = e.target.value; return p;
                            })}
                            className="w-full rounded-lg px-2.5 py-1.5 text-[12px] font-mono"
                            style={{ border: "1px solid #E0DFDC" }} />
                        </div>
                        <button
                          onClick={() => patch((p) => {
                            p.days[di].items.splice(ii, 1); return p;
                          })}
                          className="text-[12px] px-2 py-2 rounded-lg flex-shrink-0"
                          style={{ color: "#DC2626" }}>✕</button>
                      </div>
                    ))}
                  </div>

                  {d.items.length < 6 && (
                    <button
                      onClick={() => patch((p) => {
                        p.days[di].items.push({ kind: "video", label: "", href: "" } as PlanItem);
                        return p;
                      })}
                      className="mt-2 text-[12.5px] font-semibold px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: "#F5F5F3", color: "#6B7280" }}>
                      + เพิ่มงาน {d.items.length >= 3 && "(น้องเห็นแค่ 3 อันแรกบนหน้าแรก)"}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {msg && (
              <p className="text-[13px] mb-3 font-semibold" style={{ color: BRAND.primary }}>{msg}</p>
            )}

            <button onClick={save} disabled={saving}
              className="btn-primary w-full py-3.5 text-[15px] disabled:opacity-50">
              {saving ? "กำลังบันทึก…" : "บันทึกปฏิทิน"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
