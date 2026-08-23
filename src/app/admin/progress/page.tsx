"use client";
/**
 * /admin/progress — ความคืบหน้าผู้เรียนรายคน (คลิป / ข้อสอบ / Mock) แยกสนาม
 * เรียง "หายไปนานสุด" ขึ้นก่อน — ไว้ทักน้องในกลุ่ม LINE โดยไม่ต้องถามเอง
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { FIELD_SHORT, type ExamFieldKey } from "@/lib/exam-fields";

interface Row {
  uid: string; email: string; activatedAt: string | null;
  pct: number;
  clips: { done: number; total: number };
  sets:  { done: number; total: number; low: number };
  mock:  { done: number; total: number; best: number };
  chaptersDone: number; chaptersTotal: number;
  lastActiveAt: string | null;
}
interface Data {
  field: ExamFieldKey;
  summary: { members: number; avgPct: number; started: number; idle7d: number; clipsTotal: number; setsTotal: number; mockTotal: number };
  rows: Row[];
  generatedAt: string;
}

type Sort = "idle" | "pct-asc" | "pct-desc" | "recent";

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" }).format(new Date(iso)) : "—";
const daysAgo = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

function KPI({ value, label, color = "#0B6E65" }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4" style={{ border: "1px solid #EBEBEA" }}>
      <div className="text-[24px] font-extrabold leading-none mb-1" style={{ color }}>{value}</div>
      <div className="text-[12px] font-semibold text-gray-500">{label}</div>
    </div>
  );
}

export default function AdminProgressPage() {
  const { user } = useAuth();
  const [field, setField] = useState<ExamFieldKey>("dcd");
  const [data, setData]   = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort]   = useState<Sort>("idle");
  const [q, setQ]         = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/progress?field=${field}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(res.status === 401 ? "ไม่มีสิทธิ์เข้าถึง" : "โหลดข้อมูลไม่สำเร็จ");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }, [user, field]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    const list = data.rows.filter((r) => !s || r.email.toLowerCase().includes(s));
    const t = (iso: string | null) => iso ? new Date(iso).getTime() : 0;
    return [...list].sort((a, b) => {
      if (sort === "idle")     return t(a.lastActiveAt) - t(b.lastActiveAt);   // ไม่เคยเข้า/หายนาน ขึ้นก่อน
      if (sort === "recent")   return t(b.lastActiveAt) - t(a.lastActiveAt);
      if (sort === "pct-asc")  return a.pct - b.pct;
      return b.pct - a.pct;
    });
  }, [data, sort, q]);

  const pctColor = (p: number) => p >= 70 ? "#15803D" : p >= 30 ? "#B45309" : "#DC2626";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <div className="sticky top-14 z-30 bg-white" style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <h1 className="text-[15px] font-bold text-gray-900">ความคืบหน้าผู้เรียน</h1>
          <div className="flex gap-1.5">
            {(["dcd", "moph"] as ExamFieldKey[]).map((f) => (
              <button key={f} onClick={() => setField(f)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full border"
                style={{
                  backgroundColor: field === f ? "#0B6E65" : "white",
                  borderColor: field === f ? "#0B6E65" : "#E0DFDC",
                  color: field === f ? "white" : "#6B7280",
                }}>
                {FIELD_SHORT[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 pt-6 pb-16 space-y-4">
        {error && <div className="rounded-xl px-4 py-3 text-[13px] font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>{error}</div>}

        {loading || !data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="bg-white rounded-2xl h-20" style={{ border: "1px solid #EBEBEA" }} />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI value={data.summary.members} label={`สมาชิกคอร์ส ${FIELD_SHORT[field]}`} />
              <KPI value={`${data.summary.avgPct}%`} label="ความคืบหน้าเฉลี่ย" color="#7C3AED" />
              <KPI value={data.summary.started} label="เริ่มเรียนแล้ว (มีกิจกรรม)" />
              <KPI value={data.summary.idle7d} label="หายไป > 7 วัน / ยังไม่เริ่ม" color={data.summary.idle7d > 0 ? "#DC2626" : "#15803D"} />
            </div>
            <p className="text-[12px]" style={{ color: "#A8A8A6" }}>
              เนื้อหาในคอร์สตอนนี้: คลิป {data.summary.clipsTotal} · ชุดข้อสอบ {data.summary.setsTotal} · Mock {data.summary.mockTotal}
              · คิด % จากคลิป 50 / ข้อสอบ 35 / Mock 15 (ส่วนที่ยังไม่มีของถูกตัดออก) · นับอัตโนมัติจากการดู/ส่งจริง ไม่ต้องติ๊ก
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาอีเมล"
                className="flex-1 min-w-[180px] rounded-xl px-3 py-2 text-[13px] bg-white focus:outline-none" style={{ border: "1px solid #E0DFDC" }} />
              {([["idle", "หายไปนานสุด"], ["pct-asc", "คืบหน้าน้อยสุด"], ["pct-desc", "คืบหน้ามากสุด"], ["recent", "เข้าล่าสุด"]] as [Sort, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setSort(k)}
                  className="text-[12px] font-semibold px-2.5 py-1.5 rounded-full border"
                  style={{ backgroundColor: sort === k ? "#0B6E65" : "white", borderColor: sort === k ? "#0B6E65" : "#E0DFDC", color: sort === k ? "white" : "#6B7280" }}>
                  {label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #EBEBEA" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ backgroundColor: "#FAFAF9", color: "#6B7280" }}>
                      <th className="text-left font-semibold px-4 py-2.5">ผู้เรียน</th>
                      <th className="text-right font-semibold px-3 py-2.5">%</th>
                      <th className="text-right font-semibold px-3 py-2.5">▶ คลิป</th>
                      <th className="text-right font-semibold px-3 py-2.5">📝 ข้อสอบ</th>
                      <th className="text-right font-semibold px-3 py-2.5">⏱ Mock</th>
                      <th className="text-right font-semibold px-3 py-2.5">บทครบ</th>
                      <th className="text-right font-semibold px-3 py-2.5">เข้าล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const d = daysAgo(r.lastActiveAt);
                      const idle = d === null || d > 7;
                      return (
                        <tr key={r.uid} style={{ borderTop: "1px solid #F3F2F0" }}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900 truncate max-w-[220px]">{r.email || r.uid}</div>
                            <div className="text-[11px]" style={{ color: "#A8A8A6" }}>เปิดสิทธิ์ {fmt(r.activatedAt)}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-extrabold" style={{ color: pctColor(r.pct) }}>{r.pct}%</td>
                          <td className="px-3 py-2.5 text-right">{r.clips.total ? `${r.clips.done}/${r.clips.total}` : "—"}</td>
                          <td className="px-3 py-2.5 text-right">
                            {r.sets.total ? `${r.sets.done}/${r.sets.total}` : "—"}
                            {r.sets.low > 0 && <span className="ml-1 text-[11px] font-bold" style={{ color: "#DC2626" }}>({r.sets.low} ต่ำ)</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {r.mock.total ? `${r.mock.done}/${r.mock.total}` : "—"}
                            {r.mock.best > 0 && <span className="ml-1 text-[11px]" style={{ color: "#6B7280" }}>{r.mock.best}%</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">{r.chaptersTotal ? `${r.chaptersDone}/${r.chaptersTotal}` : "—"}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: idle ? "#DC2626" : "#15803D" }}>
                            {d === null ? "ยังไม่เริ่ม" : d === 0 ? "วันนี้" : `${d} วันก่อน`}
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: "#A8A8A6" }}>ไม่มีรายการ</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11px] text-center" style={{ color: "#C4C4C0" }}>อัปเดต {fmt(data.generatedAt)} · กดสลับสนามเพื่อโหลดใหม่</p>
          </>
        )}
      </div>
    </div>
  );
}
