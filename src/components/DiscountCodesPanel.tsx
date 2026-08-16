"use client";
/**
 * DiscountCodesPanel — จัดการโค้ดส่วนลดกลาง (วางในหน้า /admin/codes)
 *
 * ไม่แยกเป็นเมนูใหม่ตามที่ Aj สั่งไว้ว่าอย่าเพิ่มปุ่มรายสนาม —
 * โค้ดเปิดคอร์ส (activation) กับโค้ดส่วนลด อยู่หน้าเดียวกันเพราะเป็นเรื่องโค้ดเหมือนกัน
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { BRAND } from "@/lib/subjects";
import { remainingUses } from "@/lib/discount-types";

interface Row {
  code: string; label: string; amount: number; tiers: string[];
  maxUses: number; usedCount: number; alumniOnly: boolean; active: boolean;
  expiresAt: string; createdAt: string | null;
  revenue: { orders: number; baht: number };
}

const TIER_OPTS = [
  { v: "dcd",     label: "กรมควบคุมโรค" },
  { v: "app",     label: "App Only" },
  { v: "review",  label: "ติวเข้ม 14 วัน" },
  { v: "full",    label: "คอร์สเต็ม" },
];

export default function DiscountCodesPanel() {
  const { user } = useAuth();
  const [rows,    setRows]    = useState<Row[]>([]);
  const [fbCodes, setFbCodes] = useState({ orders: 0, baht: 0 });
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [err,     setErr]     = useState("");
  const [busy,    setBusy]    = useState(false);

  // ฟอร์มสร้างโค้ด — ค่าเริ่มต้นตั้งไว้ให้ตรงเคส "ศิษย์เก่า 399" ที่ Aj ต้องการ
  const [form, setForm] = useState({
    code: "ALUMNI100", label: "ศิษย์เก่า สป.สธ.", amount: "100",
    tiers: ["dcd"] as string[], maxUses: "0", alumniOnly: true, expiresAt: "",
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/discount-codes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setRows(d.codes ?? []);
        setFbCodes(d.feedbackCodes ?? { orders: 0, baht: 0 });
      }
    } catch { /* เงียบ — กดรีเฟรชใหม่ได้ */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!user || busy) return;
    setBusy(true); setErr("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form, amount: Number(form.amount), maxUses: Number(form.maxUses),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "สร้างไม่สำเร็จ"); return; }
      setOpen(false);
      await load();
    } catch { setErr("สร้างไม่สำเร็จ ลองใหม่"); }
    finally { setBusy(false); }
  }

  async function toggle(code: string, active: boolean) {
    if (!user) return;
    setRows((p) => p.map((r) => (r.code === code ? { ...r, active } : r)));
    try {
      const token = await user.getIdToken();
      await fetch("/api/admin/discount-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code, active }),
      });
    } catch { load(); }
  }

  const totalFromCodes = rows.reduce((s, r) => s + r.revenue.baht, 0) + fbCodes.baht;

  return (
    <div className="card-elev p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">โค้ดส่วนลด</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: "#A8A8A6" }}>
            ลดราคาบนหน้าชำระเงินเดิม · นับจำนวนครั้งที่ใช้ · แยกยอดศิษย์เก่า/ลูกค้าใหม่ได้
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)}
          className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
          style={{ backgroundColor: open ? "#F5F5F3" : BRAND.primary, color: open ? "#6B7280" : "white" }}>
          {open ? "ยกเลิก" : "+ สร้างโค้ด"}
        </button>
      </div>

      {/* สรุปยอดที่มาจากโค้ด */}
      <div className="grid grid-cols-2 gap-2.5 my-3.5">
        <div className="rounded-xl px-3.5 py-2.5" style={{ backgroundColor: "#F5FAF9" }}>
          <p className="text-[19px] font-extrabold leading-none" style={{ color: BRAND.primary }}>
            ฿{totalFromCodes.toLocaleString()}
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: "#0B6E65" }}>ยอดที่ใช้ส่วนลด (รวม)</p>
        </div>
        <div className="rounded-xl px-3.5 py-2.5" style={{ backgroundColor: "#FDF6E9" }}>
          <p className="text-[19px] font-extrabold leading-none" style={{ color: "#B45309" }}>
            {fbCodes.orders}
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: "#B45309" }}>ใบที่ใช้โค้ดแบบประเมิน</p>
        </div>
      </div>

      {/* ฟอร์มสร้าง */}
      {open && (
        <div className="rounded-xl p-4 mb-3.5" style={{ backgroundColor: "#FAFAF8", border: "1px solid #EBEBEA" }}>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">โค้ด</label>
              <input value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full rounded-lg px-3 py-2 text-[14px] font-mono"
                style={{ border: "1px solid #E0DFDC" }} />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">ลด (บาท)</label>
              <input type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-[14px]"
                style={{ border: "1px solid #E0DFDC" }} />
            </div>
          </div>

          <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">ชื่อเรียกในรายงาน</label>
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-[14px] mb-2.5"
            style={{ border: "1px solid #E0DFDC" }} />

          <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">
            ใช้กับคอร์ส (ไม่เลือก = ทุกคอร์ส)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {TIER_OPTS.map((t) => {
              const sel = form.tiers.includes(t.v);
              return (
                <button key={t.v} type="button"
                  onClick={() => setForm({
                    ...form,
                    tiers: sel ? form.tiers.filter((x) => x !== t.v) : [...form.tiers, t.v],
                  })}
                  className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg"
                  style={{
                    backgroundColor: sel ? "#EBF5F3" : "white",
                    border: `1.5px solid ${sel ? BRAND.primary : "#E0DFDC"}`,
                    color: sel ? BRAND.primary : "#6B7280",
                  }}>
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">
                จำกัดกี่ครั้ง (0 = ไม่จำกัด)
              </label>
              <input type="number" value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-[14px]"
                style={{ border: "1px solid #E0DFDC" }} />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">
                หมดอายุ (ว่าง = ไม่หมด)
              </label>
              <input type="date" value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-[14px]"
                style={{ border: "1px solid #E0DFDC" }} />
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-lg px-3 py-2.5 mb-3"
            style={{ backgroundColor: form.alumniOnly ? "#EBF5F3" : "white", border: "1px solid #E0DFDC" }}>
            <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#0B6E65]"
              checked={form.alumniOnly}
              onChange={(e) => setForm({ ...form, alumniOnly: e.target.checked })} />
            <span className="text-[12.5px] leading-relaxed">
              <span className="font-bold text-gray-800">เฉพาะศิษย์เก่า</span>
              <span className="block" style={{ color: "#A8A8A6" }}>
                ต้องเคยมีคอร์สอื่นมาก่อนถึงใช้ได้ — คนนอกกรอกโค้ดนี้จะถูกปฏิเสธ
                (ถ้าทำโค้ด referral ให้คนใหม่ ไม่ต้องติ๊ก)
              </span>
            </span>
          </label>

          {err && <p className="text-[12.5px] mb-2" style={{ color: "#DC2626" }}>{err}</p>}
          <button onClick={create} disabled={busy}
            className="btn-primary w-full py-2.5 text-[13.5px] disabled:opacity-50">
            {busy ? "กำลังสร้าง…" : "สร้างโค้ด"}
          </button>
        </div>
      )}

      {/* รายการโค้ด */}
      {loading ? (
        <p className="text-[13px] py-6 text-center" style={{ color: "#A8A8A6" }}>กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] py-6 text-center" style={{ color: "#A8A8A6" }}>
          ยังไม่มีโค้ดกลาง — กด “+ สร้างโค้ด” เพื่อทำโค้ดศิษย์เก่า/referral
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const left = remainingUses(r);
            return (
              <div key={r.code} className="rounded-xl px-3.5 py-3"
                style={{ backgroundColor: r.active ? "white" : "#FAFAF8",
                         border: "1px solid #EBEBEA", opacity: r.active ? 1 : 0.6 }}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-[14px] font-bold text-gray-900">{r.code}</span>
                  <span className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
                    −฿{r.amount}
                  </span>
                  {r.alumniOnly && (
                    <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>ศิษย์เก่า</span>
                  )}
                  {!r.active && (
                    <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>ปิดอยู่</span>
                  )}
                </div>
                {r.label && (
                  <p className="text-[12.5px] mb-1" style={{ color: "#A8A8A6" }}>{r.label}</p>
                )}
                <div className="flex items-center gap-3 flex-wrap text-[12.5px]">
                  <span className="font-bold" style={{ color: BRAND.primary }}>
                    ใช้ไป {r.usedCount} ครั้ง
                  </span>
                  {left !== null && (
                    <span style={{ color: left === 0 ? "#DC2626" : "#A8A8A6" }}>เหลือ {left}</span>
                  )}
                  <span style={{ color: "#A8A8A6" }}>
                    ยอดขาย ฿{r.revenue.baht.toLocaleString()} ({r.revenue.orders} ใบ)
                  </span>
                  {r.expiresAt && <span style={{ color: "#A8A8A6" }}>ถึง {r.expiresAt}</span>}
                </div>
                <button onClick={() => toggle(r.code, !r.active)}
                  className="mt-2 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#F5F5F3", color: "#6B7280" }}>
                  {r.active ? "ปิดโค้ด" : "เปิดโค้ด"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
