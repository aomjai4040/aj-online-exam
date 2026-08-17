"use client";
/**
 * /admin/revenue — รายงานยอดขาย
 *
 * ที่มา (Aj 17 ส.ค. 2569): รายได้มาหลายทางแล้ว แต่หน้าภาพรวมเดิมบอกได้แค่
 * ยอดรวมสะสมตัวเดียว — หน้านี้ตอบ "ช่วงนี้ได้เท่าไหร่ · สนามไหน · แพ็กไหน ·
 * โค้ดไหนทำเงิน" และกดออกเป็น CSV ส่งต่อได้
 *
 * ข้อมูลทั้งหมดมาจาก /api/admin/revenue (aggregate ฝั่ง server) แล้วสรุปด้วย
 * ฟังก์ชัน pure ใน lib/revenue.ts
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  bkkDay, shiftDay, monthStart, monthEnd, fmtDay, dayCount,
  totalsOf, byField, byTier, byChannel, byCode, buildSeries, pickMode,
  fieldOfCourse, TIER_META, CHANNEL_META, toCSV, csvFileName,
  type RevenueRow, type Bucket,
} from "@/lib/revenue";

interface Report {
  from: string; to: string; prevFrom: string; prevTo: string;
  rows: RevenueRow[];
  truncated: boolean;
  prev:     { amount: number; count: number };
  allTime:  { amount: number; count: number; firstDay: string };
  unpriced: { count: number; byCourse: Record<string, number> };
  generatedAt: string;
}

const CARD = { border: "1px solid #EBEBEA" } as const;
const baht = (n: number) => n.toLocaleString("th-TH");

// ─── ช่วงเวลาสำเร็จรูป ───────────────────────────────────────────────────────

interface Preset { key: string; label: string; range: (today: string) => [string, string] }

const PRESETS: Preset[] = [
  { key: "7d",    label: "7 วัน",     range: (t) => [shiftDay(t, -6), t] },
  { key: "30d",   label: "30 วัน",    range: (t) => [shiftDay(t, -29), t] },
  { key: "month", label: "เดือนนี้",  range: (t) => [monthStart(t), t] },
  { key: "prev",  label: "เดือนก่อน", range: (t) => {
      const last = shiftDay(monthStart(t), -1);
      return [monthStart(last), monthEnd(last)];
    } },
  { key: "year",  label: "ปีนี้",     range: (t) => [`${t.slice(0, 4)}-01-01`, t] },
  { key: "all",   label: "ทั้งหมด",   range: (t) => ["2026-01-01", t] },
];

// ─── ชิ้นส่วนหน้าจอ ──────────────────────────────────────────────────────────

function KPI({ label, value, sub, color, delta }: {
  label: string; value: string; sub?: string; color: string; delta?: number | null;
}) {
  return (
    <div className="bg-white rounded-2xl p-5" style={CARD}>
      <div className="text-[12px] font-semibold text-gray-500 mb-2">{label}</div>
      <div className="text-[26px] font-extrabold leading-none" style={{ color }}>{value}</div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {delta !== undefined && delta !== null && (
          <span className="text-[11.5px] font-bold px-1.5 py-0.5 rounded-md"
            style={{
              backgroundColor: delta >= 0 ? "#DCFCE7" : "#FEE2E2",
              color:           delta >= 0 ? "#15803D" : "#DC2626",
            }}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>{sub}</span>}
      </div>
    </div>
  );
}

/** กราฟแท่งยอดขายตามช่วงเวลา */
function RevenueChart({ points, mode }: {
  points: { key: string; label: string; amount: number; count: number }[];
  mode: "day" | "month";
}) {
  const peak = Math.max(...points.map((p) => p.amount), 1);
  const showValue = points.length <= 16;
  return (
    <div className="bg-white rounded-2xl p-5" style={CARD}>
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[13px] font-bold text-gray-800">
          ยอดขาย{mode === "day" ? "รายวัน" : "รายเดือน"}
        </p>
        <p className="text-[12px]" style={{ color: "#A8A8A6" }}>
          สูงสุด {baht(peak)} บาท
        </p>
      </div>
      <div className="flex items-end gap-1 overflow-x-auto" style={{ height: "150px" }}>
        {points.map((p) => {
          const h = p.amount > 0 ? Math.max((p.amount / peak) * 100, 5) : 2;
          return (
            <div key={p.key} className="flex-1 flex flex-col items-center gap-1"
              style={{ minWidth: "18px" }}>
              {showValue && (
                <span className="text-[9.5px] font-bold" style={{ color: p.amount ? "#0B6E65" : "#E5E5E3" }}>
                  {p.amount ? baht(p.amount) : ""}
                </span>
              )}
              <div className="w-full flex flex-col justify-end" style={{ flex: 1 }}>
                <div className="w-full rounded-t-[3px]"
                  style={{
                    height: `${h}px`,
                    backgroundColor: p.amount ? "#0B6E65" : "#F3F2F0",
                  }} />
              </div>
              <span className="text-[9.5px] whitespace-nowrap" style={{ color: "#C4C4C0" }}>
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ตารางแบ่งกลุ่ม + แถบสัดส่วน */
function BucketPanel({ title, note, buckets, empty }: {
  title: string; note?: string; buckets: Bucket[]; empty: string;
}) {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  return (
    <div className="bg-white rounded-2xl p-5" style={CARD}>
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <p className="text-[13px] font-bold text-gray-800">{title}</p>
        {note && <p className="text-[11.5px]" style={{ color: "#A8A8A6" }}>{note}</p>}
      </div>
      {buckets.length === 0 ? (
        <p className="text-[12.5px] py-2" style={{ color: "#A8A8A6" }}>{empty}</p>
      ) : buckets.map((b) => {
        const pct = total ? Math.round((b.amount / total) * 100) : 0;
        return (
          <div key={b.key} className="mb-3 last:mb-0">
            <div className="flex justify-between items-baseline gap-3 mb-1">
              <span className="text-[13px] text-gray-800 font-medium truncate">{b.label}</span>
              <span className="text-[12.5px] flex-shrink-0" style={{ color: "#A8A8A6" }}>
                <span className="font-bold" style={{ color: b.color }}>{baht(b.amount)}฿</span>
                {" · "}{b.count} ราย{pct ? ` · ${pct}%` : ""}
              </span>
            </div>
            <div className="h-2 rounded-full" style={{ backgroundColor: "#F3F2F0" }}>
              <div className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: b.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl h-[104px]" style={CARD} />
        ))}
      </div>
      <div className="bg-white rounded-2xl h-[210px]" style={CARD} />
      <div className="bg-white rounded-2xl h-[160px]" style={CARD} />
    </div>
  );
}

// ─── หน้าเว็บ ────────────────────────────────────────────────────────────────

export default function AdminRevenue() {
  const { user } = useAuth();
  const today = useMemo(() => bkkDay(new Date()), []);

  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(() => monthStart(bkkDay(new Date())));
  const [to,   setTo]   = useState(today);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withTest, setWithTest] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/revenue?from=${from}&to=${to}`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(res.status === 401 ? "ไม่มีสิทธิ์เข้าถึง" : "โหลดข้อมูลไม่สำเร็จ");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [user, from, to]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(p: Preset) {
    const [f, t] = p.range(today);
    setPreset(p.key);
    setFrom(f);
    setTo(t);
  }

  // ── สรุป (ตัดออเดอร์ทดสอบออกโดยปริยาย) ──
  const rows    = useMemo(
    () => (data?.rows ?? []).filter((r) => withTest || !r.isTest), [data, withTest]);
  const testCnt = useMemo(() => (data?.rows ?? []).filter((r) => r.isTest).length, [data]);
  const sum     = useMemo(() => totalsOf(rows), [rows]);
  const mode    = useMemo(() => pickMode(from, to), [from, to]);
  const series  = useMemo(() => buildSeries(rows, from, to, mode), [rows, from, to, mode]);

  const deltaPct = data && data.prev.amount > 0
    ? Math.round(((sum.amount - data.prev.amount) / data.prev.amount) * 100)
    : null;

  function downloadCSV() {
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = csvFileName(from, to);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      {/* หัวหน้า */}
      <div className="bg-white" style={{ borderBottom: "1px solid #EBEBEA" }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link href="/admin" className="text-[13px] font-medium" style={{ color: "#A8A8A6" }}>← Dashboard</Link>
            <h1 className="text-[15px] font-bold text-gray-900">รายงานยอดขาย</h1>
          </div>
          <button onClick={load} disabled={loading}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
            {loading ? "กำลังโหลด…" : "รีเฟรช"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 pt-5 pb-16 space-y-4">

        {/* ── เลือกช่วงเวลา ── */}
        <div className="bg-white rounded-2xl p-4" style={CARD}>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => applyPreset(p)}
                className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: preset === p.key ? "#0B6E65" : "#F3F2F0",
                  color:           preset === p.key ? "white"   : "#57534E",
                }}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={from} max={to}
              onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }}
              className="text-[13px] px-2.5 py-1.5 rounded-lg"
              style={{ border: "1px solid #E5E5E3" }} />
            <span className="text-[13px]" style={{ color: "#A8A8A6" }}>ถึง</span>
            <input type="date" value={to} min={from} max={today}
              onChange={(e) => { setTo(e.target.value); setPreset("custom"); }}
              className="text-[13px] px-2.5 py-1.5 rounded-lg"
              style={{ border: "1px solid #E5E5E3" }} />
            <span className="text-[12px]" style={{ color: "#C4C4C0" }}>
              {dayCount(from, to)} วัน
            </span>
            <button onClick={downloadCSV} disabled={rows.length === 0}
              className="ml-auto text-[12.5px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-40"
              style={{ backgroundColor: "#0B6E65", color: "white" }}>
              ⬇ ดาวน์โหลด CSV
            </button>
          </div>
        </div>

        {loading ? <Skeleton /> : error ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={CARD}>
            <p className="text-[15px] font-semibold text-gray-800 mb-4">{error}</p>
            <button onClick={load} className="btn-primary text-sm">ลองใหม่</button>
          </div>
        ) : data ? (
          <>
            {/* ── KPI ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="ยอดขายสุทธิ" value={`${baht(sum.amount)}฿`} color="#0B6E65"
                delta={deltaPct}
                sub={data.prev.count > 0 ? `ช่วงก่อน ${baht(data.prev.amount)}฿` : "ไม่มีข้อมูลช่วงก่อน"} />
              <KPI label="จำนวนออเดอร์" value={baht(sum.count)} color="#2563EB"
                sub={`เฉลี่ย ${baht(sum.avg)}฿ / ราย`} />
              <KPI label="ส่วนลดที่ให้ไป" value={`${baht(sum.discount)}฿`} color="#B45309"
                sub={sum.gross ? `จากยอดเต็ม ${baht(sum.gross)}฿` : undefined} />
              <KPI label="ยอดสะสมทั้งหมด" value={`${baht(data.allTime.amount)}฿`} color="#7C3AED"
                sub={`${baht(data.allTime.count)} ออเดอร์ ตั้งแต่ ${fmtDay(data.allTime.firstDay)}`} />
            </div>

            {/* ── เงินนอกระบบ: สิทธิ์ที่แจกโดยไม่ผ่านหน้าชำระเงิน ── */}
            {data.unpriced.count > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                <p className="text-[13px] font-bold" style={{ color: "#B45309" }}>
                  ⚠️ ช่วงนี้มีสิทธิ์ที่ให้ไปโดยไม่ผ่านหน้าชำระเงินอีก {data.unpriced.count} ราย
                </p>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#92400E" }}>
                  {Object.entries(data.unpriced.byCourse)
                    .sort((a, b) => b[1] - a[1])
                    .map(([c, n]) => `${c} ${n} ราย`).join(" · ")}
                  {" — "}คนที่กรอกโค้ดเปิดคอร์ส (โอนตรง/ทักไลน์/ลูกค้ากลุ่มเดิม)
                  ยังไม่มีการบันทึกยอดเงิน ตัวเลขข้างบนจึงเป็นเฉพาะเงินที่เข้าผ่านเว็บ
                </p>
              </div>
            )}

            {/* ── กราฟ ── */}
            <RevenueChart points={series} mode={mode} />

            {/* ── แยกตามสนาม / แพ็ก ── */}
            <div className="grid md:grid-cols-2 gap-4">
              <BucketPanel title="แยกตามสนามสอบ" buckets={byField(rows)}
                note="ตัดสินจาก courseId" empty="ยังไม่มียอดในช่วงนี้" />
              <BucketPanel title="แยกตามแพ็กเกจ" buckets={byTier(rows)}
                empty="ยังไม่มียอดในช่วงนี้" />
            </div>

            {/* ── ช่องทาง / โค้ด ── */}
            <div className="grid md:grid-cols-2 gap-4">
              <BucketPanel title="ช่องทางรับเงิน" buckets={byChannel(rows)}
                note="อัตโนมัติ vs อนุมัติมือ" empty="ยังไม่มียอดในช่วงนี้" />
              <BucketPanel title="โค้ดส่วนลด" buckets={byCode(rows)}
                note="ยอดขายที่เกิดจากโค้ด"
                empty="ช่วงนี้ยังไม่มีใครใช้โค้ด" />
            </div>

            {/* ── รายการ ── */}
            <div className="bg-white rounded-2xl p-5" style={CARD}>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <p className="text-[13px] font-bold text-gray-800">
                  รายการล่าสุด <span style={{ color: "#A8A8A6" }}>({rows.length} รายการ)</span>
                </p>
                {testCnt > 0 && (
                  <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer"
                    style={{ color: "#A8A8A6" }}>
                    <input type="checkbox" checked={withTest}
                      onChange={(e) => setWithTest(e.target.checked)} />
                    รวมออเดอร์ทดสอบ ({testCnt})
                  </label>
                )}
              </div>

              {rows.length === 0 ? (
                <p className="text-[13px] py-4 text-center" style={{ color: "#A8A8A6" }}>
                  ไม่มีออเดอร์ที่จ่ายสำเร็จในช่วงนี้
                </p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "#A8A8A6" }}>
                        <th className="text-left font-semibold py-1.5 px-1">วันที่</th>
                        <th className="text-left font-semibold py-1.5 px-1">อีเมล</th>
                        <th className="text-left font-semibold py-1.5 px-1">แพ็ก</th>
                        <th className="text-right font-semibold py-1.5 px-1">ยอด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 25).map((r) => {
                        const f = fieldOfCourse(r.courseId);
                        return (
                          <tr key={r.id} style={{ borderTop: "1px solid #F3F2F0" }}>
                            <td className="py-1.5 px-1 whitespace-nowrap" style={{ color: "#78716C" }}>
                              {fmtDay(r.day)}
                            </td>
                            <td className="py-1.5 px-1 text-gray-800"
                              style={{ maxWidth: "170px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.email}{r.isTest && <span style={{ color: "#C4C4C0" }}> (ทดสอบ)</span>}
                            </td>
                            <td className="py-1.5 px-1">
                              <span className="font-medium" style={{ color: f.accent }}>{f.code}</span>
                              <span style={{ color: "#A8A8A6" }}>
                                {" "}{TIER_META[r.tier]?.label ?? r.tier}
                              </span>
                              {r.code && (
                                <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-md"
                                  style={{ backgroundColor: "#F3E8FF", color: "#7C3AED" }}>
                                  {r.code} −{r.discount}
                                </span>
                              )}
                              {r.channel === "manual" && (
                                <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-md"
                                  style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>
                                  {CHANNEL_META.manual.label}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-1 text-right font-bold whitespace-nowrap"
                              style={{ color: "#0B6E65" }}>
                              {baht(r.amount)}฿
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {rows.length > 25 && (
                    <p className="text-[11.5px] mt-2.5 text-center" style={{ color: "#C4C4C0" }}>
                      แสดง 25 รายการล่าสุด — กด &quot;ดาวน์โหลด CSV&quot; เพื่อดูครบทั้ง {rows.length} รายการ
                    </p>
                  )}
                </div>
              )}
            </div>

            {data.truncated && (
              <p className="text-[11.5px] text-center" style={{ color: "#DC2626" }}>
                ⚠️ ออเดอร์ในช่วงนี้เกิน 5,000 รายการ — รายงานตัดให้เหลือ 5,000 รายการล่าสุด
              </p>
            )}
            <p className="text-[11px] text-center" style={{ color: "#C4C4C0" }}>
              นับเฉพาะออเดอร์สถานะ &quot;จ่ายแล้ว&quot; ตามวันที่เงินเข้า (เวลาไทย) ·
              เทียบกับช่วง {fmtDay(data.prevFrom)}–{fmtDay(data.prevTo)}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
