"use client";
/**
 * RecallVolunteerCard — อาสาจำข้อสอบ คร.69 คนละ 1 ข้อ (Aj 2026-09-17)
 * วางบนหน้าคอร์ส คร. — สมาชิกทุกแพ็กเห็น
 *
 *   ก่อนสอบ: แตะปุ่มเดียวรับเลขข้อ (API แจกแบบไม่ซ้ำ) + แถบความคืบหน้ารวม
 *   บ่ายวันสอบเป็นต้นไป: พลิกเป็นฟอร์มส่ง "ข้อของฉัน" เข้า recallSubmissions
 *   (คลังเดียวกับ /admin/recall) · เลย RV_END_AT = ซ่อนตัวเอง
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { submitRecall } from "@/lib/recall-firestore";
import { RV_TOTAL, RV_EXAM_LABEL, type RvPhase } from "@/lib/recall-volunteer";
import { BRAND } from "@/lib/subjects";

interface Status {
  phase: RvPhase;
  assigned: number; mainFilled: number; total: number;
  mine: { no: number; round: number } | null;
  submitted: boolean;
}

const OPT = ["ก", "ข", "ค", "ง"];

export default function RecallVolunteerCard() {
  const { user } = useAuth();
  const [st, setSt]     = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/recall-volunteer", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSt(await res.json());
    } catch {}
  }, [user]);
  useEffect(() => { load(); }, [load]);

  async function act(action: "assign" | "withdraw") {
    if (!user || busy) return;
    if (action === "withdraw" && !confirm("ถอนตัวจากการอาสา? เลขข้อของคุณจะถูกส่งต่อให้คนอื่น")) return;
    setBusy(true); setErr("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/recall-volunteer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? "ไม่สำเร็จ ลองใหม่อีกครั้ง"); return; }
      await load();
    } catch { setErr("ไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    finally { setBusy(false); }
  }

  // ── ฟอร์มส่งหลังสอบ ──
  const [text, setText]       = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer]   = useState("");
  const [unsure, setUnsure]   = useState(false);

  async function send() {
    if (!user || busy || !text.trim() || !st?.mine) return;
    setBusy(true); setErr("");
    try {
      await submitRecall(
        { uid: user.uid, email: user.email, displayName: user.displayName },
        {
          no: st.mine.no, text, options, answer,
          subject: "", confidence: unsure ? "maybe" : "sure", note: "", field: "dcd",
        },
      );
      await load();
    } catch { setErr("ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"); }
    finally { setBusy(false); }
  }

  if (!user || !st || st.phase === "closed") return null;

  const pct = Math.round((st.mainFilled / st.total) * 100);
  const INPUT = "w-full rounded-xl px-3.5 py-2.5 text-[13.5px] bg-white focus:outline-none";
  const INPUT_STYLE = { border: "1px solid #E0DFDC" } as const;

  return (
    <div className="rounded-2xl overflow-hidden mb-4"
      style={{ border: "1.5px solid #FCD34D", backgroundColor: "#FFFBEB" }}>
      <div className="px-4 pt-3.5 pb-4">

        {/* ── ก่อนสอบ ── */}
        {st.phase === "before" && (
          <>
            <p className="text-[14.5px] font-bold" style={{ color: "#92400E" }}>
              🙏 อาสาจำข้อสอบ คนละ 1 ข้อ — {RV_EXAM_LABEL}
            </p>
            <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "#B45309" }}>
              ช่วยกันคนละข้อ (โจทย์ + ช้อยทั้ง 4) สอบเสร็จกลับมาส่งในการ์ดนี้ —
              รวมกันได้แนวข้อสอบทั้งชุดไว้ให้รุ่นต่อไป
            </p>

            {/* ความคืบหน้ารวม */}
            <div className="mt-3 flex items-center gap-2.5">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#FDE9C8" }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: "#F59E0B" }} />
              </div>
              <span className="text-[12px] font-bold flex-shrink-0" style={{ color: "#92400E" }}>
                มีเจ้าภาพแล้ว {st.mainFilled}/{st.total} ข้อ
              </span>
            </div>
            {st.assigned > st.mainFilled && (
              <p className="text-[11.5px] mt-1" style={{ color: "#B45309" }}>
                + อาสาสำรองอีก {st.assigned - st.mainFilled} คน (ข้อละหลายคนยิ่งดี — กันจำไม่ได้)
              </p>
            )}

            {st.mine ? (
              <div className="mt-3 rounded-xl px-4 py-3 text-center"
                style={{ backgroundColor: "white", border: "1.5px dashed #F59E0B" }}>
                <p className="text-[12.5px] font-semibold" style={{ color: "#B45309" }}>
                  คุณอาสาจำ{st.mine.round > 1 ? ` (คนที่ ${st.mine.round} ของข้อนี้)` : ""}
                </p>
                <p className="text-[30px] font-extrabold leading-tight" style={{ color: "#92400E" }}>
                  ข้อที่ {st.mine.no}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "#B45309" }}>
                  จำโจทย์ + ช้อยทั้ง 4 ของข้อนี้ · สอบเสร็จกลับมาส่งที่การ์ดนี้เลย
                </p>
                <button onClick={() => act("withdraw")} disabled={busy}
                  className="text-[11.5px] underline mt-1.5" style={{ color: "#B45309" }}>
                  ขอถอนตัว
                </button>
              </div>
            ) : (
              <button onClick={() => act("assign")} disabled={busy}
                className="mt-3 w-full py-3 rounded-xl text-[14.5px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ backgroundColor: "#F59E0B" }}>
                {busy ? "กำลังรับเลข…" : "รับเลขข้อของฉัน (10 วินาที ไม่ต้องกรอกอะไร)"}
              </button>
            )}
          </>
        )}

        {/* ── หลังสอบ ── */}
        {st.phase === "after" && (
          st.mine === null ? (
            <p className="text-[13px] leading-relaxed" style={{ color: "#92400E" }}>
              🙏 สอบเสร็จแล้ว จำข้อไหนได้บ้าง ส่งช่วยเพื่อน ๆ ได้ที่เมนู <b>ทบทวน/เก็บข้อสอบ</b>
              — ขอบคุณทุกความจำค่ะ
            </p>
          ) : st.submitted ? (
            <p className="text-[14px] font-bold text-center py-2"
              style={{ color: "#15803D" }}>
              ✓ ส่งข้อที่ {st.mine.no} แล้ว — ขอบคุณมากค่ะ 💚 (จำข้ออื่นได้อีกก็ส่งเพิ่มได้เลย)
            </p>
          ) : (
            <>
              <p className="text-[14.5px] font-bold" style={{ color: "#92400E" }}>
                📝 สอบเสร็จแล้ว — ส่งข้อที่ <span className="text-[18px]">{st.mine.no}</span> ที่คุณอาสาจำ
              </p>
              <p className="text-[12px] mt-0.5 mb-3" style={{ color: "#B45309" }}>
                ไม่ต้องเป๊ะทุกคำ จับใจความได้ก็มีค่ามากแล้ว
              </p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                placeholder={`โจทย์ข้อที่ ${st.mine.no} ที่จำได้…`}
                className={INPUT} style={INPUT_STYLE} />
              <div className="grid grid-cols-2 gap-2 mt-2">
                {options.map((o, i) => (
                  <input key={i} value={o}
                    onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={`ช้อย ${OPT[i]}.`} className={INPUT} style={INPUT_STYLE} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[12.5px] font-semibold" style={{ color: "#92400E" }}>ข้อที่คิดว่าถูก:</span>
                {OPT.map((o) => (
                  <button key={o} type="button" onClick={() => setAnswer(answer === o ? "" : o)}
                    className="w-8 h-8 rounded-lg text-[13px] font-bold"
                    style={answer === o
                      ? { backgroundColor: BRAND.primary, color: "white" }
                      : { backgroundColor: "white", border: "1px solid #E0DFDC", color: "#6B7280" }}>
                    {o}
                  </button>
                ))}
                <label className="flex items-center gap-1.5 text-[12px]" style={{ color: "#B45309" }}>
                  <input type="checkbox" checked={unsure} onChange={(e) => setUnsure(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#B45309]" />
                  ไม่แน่ใจเฉลย
                </label>
              </div>
              <button onClick={send} disabled={busy || !text.trim()}
                className="mt-3 w-full py-3 rounded-xl text-[14.5px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ backgroundColor: BRAND.primary }}>
                {busy ? "กำลังส่ง…" : `ส่งข้อที่ ${st.mine.no} 💚`}
              </button>
            </>
          )
        )}

        {err && <p className="text-[12px] mt-2" style={{ color: "#DC2626" }}>{err}</p>}
      </div>
    </div>
  );
}
