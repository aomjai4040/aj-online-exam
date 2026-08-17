"use client";
/**
 * DripScheduler — ตั้งตารางปล่อยการ์ดรายวันของ deck หนึ่ง (Aj ข้อ 4)
 *
 * บริบท: คอร์ส คร. ส่งการ์ดโรค 1 โรค/วัน เริ่ม 22 ส.ค.
 * Aj ผลิตการ์ดครั้งเดียวทั้งชุด → กดตั้งวันเริ่ม → ระบบไล่ปล่อยให้เอง
 * การ์ดที่ปล่อยแล้วกองอยู่ในคลังถาวร คนเข้าวันที่ 10 ย้อนดู 9 ใบแรกได้
 * LINE ใช้เป็นแค่ตัวเตือน ไม่ใช่ที่เก็บ
 */
import { useCallback, useEffect, useState } from "react";
import {
  getCardsByDeck, scheduleDrip, clearDrip, bkkToday, isReleased,
} from "@/lib/flashcard-firestore";
import { BRAND } from "@/lib/subjects";
import type { FCDeck } from "@/lib/flashcard-types";

export default function DripScheduler({ deck }: { deck: FCDeck }) {
  const [open,    setOpen]    = useState(false);
  const [start,   setStart]   = useState("");
  const [perDay,  setPerDay]  = useState("1");
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState("");
  const [stat,    setStat]    = useState<{ released: number; upcoming: number; next: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await getCardsByDeck(deck.id, deck.slug, { includeUnreleased: true });
      const today = bkkToday();
      const released = all.filter((c) => isReleased(c, today));
      const future = all.filter((c) => !isReleased(c, today))
        .map((c) => c.releaseAt).sort();
      setStat({ released: released.length, upcoming: future.length, next: future[0] ?? null });
    } catch { /* เปิดดูใหม่ได้ */ }
  }, [deck.id, deck.slug]);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function apply() {
    if (!start || busy) return;
    setBusy(true); setMsg("");
    try {
      const n = await scheduleDrip(deck.slug, start, Math.max(1, Number(perDay) || 1));
      setMsg(`ตั้งตารางให้ ${n} ใบแล้ว — ใบแรกปล่อย ${start}`);
      await load();
    } catch { setMsg("ตั้งตารางไม่สำเร็จ ลองใหม่"); }
    finally { setBusy(false); }
  }

  async function releaseAll() {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      const n = await clearDrip(deck.slug);
      setMsg(`ปล่อยการ์ดทั้งหมด ${n} ใบทันทีแล้ว`);
      await load();
    } catch { setMsg("ยกเลิกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-2.5">
      <button onClick={() => setOpen((o) => !o)}
        className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
        style={{ backgroundColor: open ? BRAND.primary : "#FDF6E9",
                 color: open ? "white" : "#B45309" }}>
        ตารางปล่อยรายวัน
      </button>

      {open && (
        <div className="mt-2 rounded-xl px-3.5 py-3"
          style={{ backgroundColor: "#FAFAF8", border: "1px solid #EBEBEA" }}>

          {stat && (
            <p className="text-[12.5px] mb-2.5" style={{ color: "#6B7280" }}>
              ปล่อยแล้ว <span className="font-bold" style={{ color: BRAND.primary }}>{stat.released}</span> ใบ
              {stat.upcoming > 0 && (
                <> · รอปล่อยอีก <span className="font-bold" style={{ color: "#B45309" }}>{stat.upcoming}</span> ใบ
                  {stat.next && <> (ใบถัดไป {stat.next})</>}
                </>
              )}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">
                เริ่มปล่อยวันที่
              </label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg px-2.5 py-2 text-[13px] bg-white"
                style={{ border: "1px solid #E0DFDC" }} />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">
                วันละกี่ใบ
              </label>
              <input type="number" min={1} value={perDay} onChange={(e) => setPerDay(e.target.value)}
                className="w-full rounded-lg px-2.5 py-2 text-[13px] bg-white"
                style={{ border: "1px solid #E0DFDC" }} />
            </div>
          </div>

          <p className="text-[11.5px] leading-relaxed mb-2.5" style={{ color: "#A8A8A6" }}>
            เรียงตามลำดับการ์ดใน deck แล้วไล่ทีละวัน · การ์ดที่ปล่อยแล้วอยู่ในคลังถาวร
            ย้อนดูได้ทุกใบ · ตั้งซ้ำได้ ระบบเขียนทับตารางเดิม
          </p>

          <div className="flex gap-2">
            <button onClick={apply} disabled={busy || !start}
              className="btn-primary flex-1 py-2 text-[13px] disabled:opacity-40">
              {busy ? "กำลังบันทึก…" : "ตั้งตาราง"}
            </button>
            <button onClick={releaseAll} disabled={busy}
              className="px-3 py-2 rounded-xl text-[12.5px] font-semibold"
              style={{ backgroundColor: "#F5F5F3", color: "#6B7280" }}>
              ปล่อยทั้งหมดเลย
            </button>
          </div>

          {msg && (
            <p className="text-[12.5px] mt-2 font-semibold" style={{ color: "#15803D" }}>{msg}</p>
          )}
        </div>
      )}
    </div>
  );
}
