"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface Insights {
  users: number;
  codeGrants: number;
  paidGrants: number;
  trialUsers: number;
  revenue: number;
  paid: { app: number; full: number; upgrade: number };
  pending: number;
  rejected: number;
  pendingList: {
    id: string; email: string; tier: string; amount: number; createdAt: string | null;
    hasAccess: boolean; failReason: string | null; slipPath: string | null;
  }[];
  daily: { day: string; people: number; attempts: number; newGrants: number }[];
  generatedAt: string;
}

const fmtDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
};
const fmtTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "-";

function KPICard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[17px] mb-3" style={{ backgroundColor: `${color}18` }}>{icon}</div>
      <div className="text-[28px] font-extrabold leading-none mb-1" style={{ color }}>{value}</div>
      <div className="text-[12px] font-semibold text-gray-500">{label}</div>
      {sub && <div className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>{sub}</div>}
    </div>
  );
}

/** กราฟแท่งคู่: คน (เข้ม) ซ้อนบนจำนวนครั้ง (อ่อน) + จุดสิทธิ์ใหม่ */
function DailyChart({ data }: { data: Insights["daily"] }) {
  const peakAtt = Math.max(...data.map((d) => d.attempts), 1);
  const sumPeople = data.reduce((s, d) => s + d.people, 0);
  const sumGrants = data.reduce((s, d) => s + d.newGrants, 0);
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">กิจกรรมรายวัน (14 วัน)</p>
          <p className="text-[13px] mt-1" style={{ color: "#A8A8A6" }}>
            <span className="font-bold" style={{ color: "#0B6E65" }}>{sumPeople}</span> คน-วันทำข้อสอบ ·{" "}
            <span className="font-bold" style={{ color: "#B45309" }}>{sumGrants}</span> รับสิทธิ์ใหม่
          </p>
        </div>
        <div className="flex flex-col gap-1 mt-1">
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#A8A8A6" }}>
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#0B6E65" }} />คนทำข้อสอบ</span>
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#A8A8A6" }}>
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#C3E5DE" }} />จำนวนครั้ง</span>
        </div>
      </div>
      <div className="flex items-end gap-1" style={{ height: "110px" }}>
        {data.map((d) => {
          const isToday = d.day === todayKey;
          const attH = d.attempts > 0 ? Math.max((d.attempts / peakAtt) * 92, 4) : 2;
          const pplH = d.attempts > 0 ? attH * Math.min(d.people / d.attempts, 1) : 0;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold" style={{ color: isToday ? "#0B6E65" : "#C4C4C0" }}>{d.people || ""}</span>
              <div className="w-full relative flex flex-col justify-end" style={{ flex: 1 }}>
                <div className="w-full rounded-t-[3px] relative" style={{ height: `${attH}px`, backgroundColor: "#C3E5DE" }}>
                  <div className="w-full rounded-t-[3px] absolute bottom-0 left-0" style={{ height: `${pplH}px`, backgroundColor: "#0B6E65" }} />
                </div>
              </div>
              <span className="text-[10px]" style={{ color: isToday ? "#0B6E65" : "#C4C4C0" }}>{fmtDay(d.day)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 h-[108px]" style={{ border: "1px solid #EBEBEA" }}>
            <div className="h-9 w-9 rounded-xl bg-gray-100 mb-3" />
            <div className="h-7 w-14 bg-gray-100 rounded-lg mb-1.5" />
            <div className="h-3 w-20 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-5 h-[180px]" style={{ border: "1px solid #EBEBEA" }} />
    </div>
  );
}

export default function AdminInsights() {
  const { user } = useAuth();
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/insights", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(res.status === 401 ? "ไม่มีสิทธิ์เข้าถึง" : "โหลดข้อมูลไม่สำเร็จ");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── จัดการออเดอร์ค้าง: อนุมัติมือ / ปิดออเดอร์ / เปิดดูสลิปที่ไม่ผ่าน ──
  const [busy, setBusy] = useState<string | null>(null);
  type PendingOrder = Insights["pendingList"][number];

  async function orderAction(o: PendingOrder, action: "approve" | "reject") {
    if (!user) return;
    const msg = action === "approve"
      ? `อนุมัติให้สิทธิ์ ${o.email}\n(${o.tier} ${o.amount}฿)\n\nยืนยันว่าเช็คเงินเข้าบัญชีแล้วจริง?`
      : `ปิดออเดอร์ของ ${o.email} โดยไม่ให้สิทธิ์?`;
    if (!confirm(msg)) return;
    setBusy(o.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/order-action", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.id, action }),
      });
      if (!res.ok) throw new Error("ทำรายการไม่สำเร็จ");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(null);
    }
  }

  async function viewSlip(o: PendingOrder) {
    if (!user || !o.slipPath) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/slip?path=${encodeURIComponent(o.slipPath)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert("เปิดสลิปไม่สำเร็จ (อาจเกิน 30 วันถูกลบแล้ว)"); return; }
      window.open(URL.createObjectURL(await res.blob()), "_blank");
    } catch {
      alert("เปิดสลิปไม่สำเร็จ");
    }
  }

  const totalPaidCount = data ? data.paid.app + data.paid.full + data.paid.upgrade : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <div className="sticky top-14 z-30 bg-white" style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link href="/admin" className="text-[13px] font-medium" style={{ color: "#A8A8A6" }}>← Dashboard</Link>
            <h1 className="text-[15px] font-bold text-gray-900">ภาพรวมธุรกิจ</h1>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
            {loading ? <span className="w-3.5 h-3.5 border-2 border-teal-200 border-t-[#0B6E65] rounded-full animate-spin" /> : "รีเฟรช"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 pt-6 pb-16">
        {loading ? <Skeleton /> : error ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px solid #EBEBEA" }}>
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-[15px] font-semibold text-gray-800 mb-4">{error}</p>
            <button onClick={load} className="btn-primary text-sm">ลองใหม่</button>
          </div>
        ) : data ? (
          <div className="space-y-5">
            {/* ── KPI ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard icon="👤" label="ผู้ใช้ทั้งหมด" value={data.users.toLocaleString()} sub="ล็อกอินแล้ว" color="#0B6E65" />
              <KPICard icon="🎫" label="รับสิทธิ์ด้วยโค้ด" value={data.codeGrants.toLocaleString()} sub="กลุ่มเดิม" color="#2563EB" />
              <KPICard icon="💳" label="ซื้อผ่านเว็บ" value={totalPaidCount.toLocaleString()} sub={`${data.revenue.toLocaleString()} บาท`} color="#16A34A" />
              <KPICard icon="🆓" label="กลุ่มทดลอง" value={data.trialUsers.toLocaleString()} sub="ยังไม่มีสิทธิ์" color="#B45309" />
            </div>

            {/* ── กราฟรายวัน ── */}
            <DailyChart data={data.daily} />

            {/* ── ยอดขายผ่านเว็บ แยก tier ── */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
              <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-4">ยอดขายผ่านเว็บ (PromptPay)</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><div className="text-[22px] font-extrabold" style={{ color: "#0B6E65" }}>{data.paid.app}</div><div className="text-[12px]" style={{ color: "#A8A8A6" }}>App 299฿</div></div>
                <div><div className="text-[22px] font-extrabold" style={{ color: "#0B6E65" }}>{data.paid.full}</div><div className="text-[12px]" style={{ color: "#A8A8A6" }}>คอร์สเต็ม 699฿</div></div>
                <div><div className="text-[22px] font-extrabold" style={{ color: "#0B6E65" }}>{data.paid.upgrade}</div><div className="text-[12px]" style={{ color: "#A8A8A6" }}>อัปเกรด 400฿</div></div>
              </div>
            </div>

            {/* ── สลิปค้าง ── */}
            {data.pendingList.length > 0 && (() => {
              const needHelp = data.pendingList.filter((o) => !o.hasAccess).length;
              return (
              <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">ออเดอร์ค้าง (รอตรวจสลิป)</p>
                  <span className="text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>{data.pending} รายการ</span>
                </div>
                <p className="text-[12px] mb-3" style={{ color: needHelp > 0 ? "#DC2626" : "#15803D" }}>
                  {needHelp > 0
                    ? `🔴 ${needHelp} รายการยังไม่มีสิทธิ์ — อาจจ่ายจริงแต่สลิปไม่ผ่าน ควรเช็ค`
                    : "🟢 ทุกรายการได้สิทธิ์ทางอื่นแล้ว — ปิดออเดอร์ได้"}
                </p>
                <div className="space-y-2.5">
                  {data.pendingList.map((o) => (
                    <div key={o.id} className="py-1.5" style={{ borderBottom: "1px solid #F3F2F0" }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-gray-800 text-[13px] font-medium truncate flex-1">{o.email}</span>
                        {o.hasAccess ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}>🟢 มีสิทธิ์แล้ว</span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>🔴 ยังไม่มีสิทธิ์</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[12px]" style={{ color: "#A8A8A6" }}>
                        <span className="font-semibold" style={{ color: "#0B6E65" }}>{o.tier} {o.amount}฿</span>
                        <span>·</span>
                        <span>{fmtTime(o.createdAt)}</span>
                      </div>
                      {o.failReason && (
                        <p className="text-[12px] mt-1" style={{ color: "#DC2626" }}>
                          สลิปไม่ผ่านล่าสุด: {o.failReason}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {o.slipPath && (
                          <button onClick={() => viewSlip(o)}
                            className="text-[12px] font-semibold px-3 py-1 rounded-lg"
                            style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                            🧾 ดูสลิป
                          </button>
                        )}
                        {!o.hasAccess && (
                          <button onClick={() => orderAction(o, "approve")} disabled={busy === o.id}
                            className="text-[12px] font-bold px-3 py-1 rounded-lg disabled:opacity-50"
                            style={{ backgroundColor: "#0B6E65", color: "white" }}>
                            ✓ อนุมัติให้สิทธิ์
                          </button>
                        )}
                        <button onClick={() => orderAction(o, "reject")} disabled={busy === o.id}
                          className="text-[12px] font-semibold px-3 py-1 rounded-lg disabled:opacity-50"
                          style={{ backgroundColor: "#F5F5F4", color: "#78716C" }}>
                          ปิดออเดอร์
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11.5px] mt-3 leading-relaxed" style={{ color: "#C4C4C0" }}>
                  🟢 = ได้สิทธิ์แล้ว กด &quot;ปิดออเดอร์&quot; เคลียร์ได้เลย · 🔴 = เช็คเงินเข้าบัญชีพร้อมเพย์ก่อน
                  ถ้าเข้าจริงกด &quot;อนุมัติให้สิทธิ์&quot; — ระบบจะเปิดสิทธิ์และปิดออเดอร์ให้ทันที ·
                  สลิปที่ตรวจไม่ผ่านหลังจากนี้จะมีปุ่ม &quot;ดูสลิป&quot; ให้เปิดภาพดูเองได้ (เก็บ 30 วัน)
                </p>
              </div>
              );
            })()}

            <p className="text-[11px] text-center" style={{ color: "#C4C4C0" }}>
              อัปเดต {fmtTime(data.generatedAt)} · เวลาไทย
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
