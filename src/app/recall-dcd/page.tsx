"use client";
/**
 * /recall-dcd — คลังความจำข้อสอบ คร.69 ครบ 100 ข้อ (Aj 2026-09-20 บ่าย)
 *
 * ตอบโจทย์: "หน้าข้อสอบมีข้อครบ 100 ข้อ ข้อไหนยังไม่มีข้อมูลก็ขึ้นข้อไว้แต่ว่าง
 * เผื่อมีคนส่งข้อมูลเพิ่ม" — หน้านี้โชว์ตาราง 1-100 ว่าข้อไหนมีความจำแล้ว/ยังว่าง
 * แตะข้อไหนก็ได้เพื่อส่งความจำเพิ่ม → เข้า recallSubmissions (field dcd)
 * ให้ AJ ตรวจที่ /admin/recall แล้วกดอัปเดตชุดข้อสอบจริง
 *
 * แยกจากชุดข้อสอบที่ทำเก็บคะแนน (Mock "ฉบับความทรงจำ") — ชุดนั้นมีเฉพาะข้อที่
 * AJ ยืนยันเฉลยแล้ว คะแนนเลยตรงไปตรงมา ข้อว่างมาอยู่หน้านี้แทน
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { setDcdSubVerdict, setDcdVerdict, setRecallStatus, submitRecall } from "@/lib/recall-firestore";
import { isAdmin } from "@/lib/admin-config";
import { RV_TOTAL } from "@/lib/recall-volunteer";
import { BRAND } from "@/lib/subjects";

const OPT = ["ก", "ข", "ค", "ง"];
/** ค่า active สำหรับ "จำเลขข้อไม่ได้" — ส่งเป็น no: null */
const NO_NUMBER = -1;

export default function RecallDcdPage() {
  useLoginGuard();
  const { user } = useAuth();
  const [filled, setFilled]   = useState<Set<number> | null>(null);
  const [denied, setDenied]   = useState(false);
  const [active, setActive]   = useState<number | null>(null);
  const [sentNos, setSentNos] = useState<Set<number>>(new Set());

  // ── ฟอร์ม ──
  const [text, setText]       = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer]   = useState("");
  const [unsure, setUnsure]   = useState(false);
  const [note, setNote]       = useState("");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState("");
  // เฉลย AJ — โผล่เฉพาะบัญชี admin: กรอกพร้อมกันแล้วยืนยันให้เลย ไม่ต้องไปติ๊กซ้ำ
  const admin = isAdmin(user?.email);
  const [ajAns, setAjAns]     = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/recall-volunteer?nos=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { setDenied(true); return; }
      if (res.ok) {
        const d = await res.json();
        setFilled(new Set<number>(d.filled ?? []));
      }
    } catch {}
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function open(no: number) {
    setActive(no);
    setText(""); setOptions(["", "", "", ""]); setAnswer(""); setUnsure(false);
    setNote(""); setErr(""); setAjAns("");
    // เลื่อนให้ฟอร์มโผล่ (อยู่ใต้ตาราง)
    setTimeout(() => document.getElementById("rv-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  async function send() {
    if (!user || busy || active === null || !text.trim()) return;
    setBusy(true); setErr("");
    try {
      const subId = await submitRecall(
        { uid: user.uid, email: user.email, displayName: user.displayName },
        {
          no: active === NO_NUMBER ? null : active,
          text, options, answer,
          subject: "", confidence: unsure ? "maybe" : "sure",
          note: note.trim(), field: "dcd",
        },
      );
      // admin กรอกเฉลยมาด้วย → ยืนยันให้ทันที ข้อนี้พร้อมเข้าชุดข้อสอบเลย
      // และติ๊ก "ใช้ใบนี้" ให้ใบของ AJ เป็นใบหลัก (เฉลยชี้ช้อยของใบนี้แน่นอน)
      if (admin && ajAns.trim()) {
        await setRecallStatus(subId, "merged").catch(() => {});
        if (active === NO_NUMBER) await setDcdSubVerdict(subId, "confirmed", ajAns, user.email ?? "admin");
        else                      await setDcdVerdict(active, "confirmed", ajAns, user.email ?? "admin");
      }
      setSentNos((p) => new Set(p).add(active));
      if (active !== NO_NUMBER) {
        setFilled((p) => { const n = new Set(p ?? []); n.add(active); return n; });
      }
      setActive(null);
    } catch { setErr("ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"); }
    finally { setBusy(false); }
  }

  const INPUT = "w-full rounded-xl px-3.5 py-2.5 text-[16px] bg-white focus:outline-none";
  const INPUT_STYLE = { border: "1px solid #E0DFDC" } as const;

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: "#F5FAF9" }}>
        <div className="text-center">
          <p className="text-[15px] font-bold text-gray-900 mb-1">เฉพาะสมาชิกคอร์สกรมควบคุมโรคค่ะ</p>
          <Link href="/course/dcd" className="text-[13.5px] underline" style={{ color: BRAND.primary }}>
            ไปหน้าคอร์ส คร. →
          </Link>
        </div>
      </div>
    );
  }

  const filledCount = filled?.size ?? 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <div className="max-w-lg mx-auto px-5 pt-6 pb-24">

        <h1 className="text-[19px] font-bold text-gray-900">คลังความจำข้อสอบ คร. 69</h1>
        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: "#6B7280" }}>
          ครบทั้ง 100 ข้อ — <b style={{ color: "#15803D" }}>เขียว = มีความจำแล้ว</b> ·
          เทา = ยังว่าง รอคนช่วยเติม · แตะข้อไหนก็ได้เพื่อส่งความจำเพิ่ม
          (ข้อที่มีแล้วก็ส่งซ้ำได้ ยิ่งหลายคนยิ่งแม่น) AJ ตรวจทุกใบก่อนอัปเดตเข้าชุดข้อสอบ
        </p>

        {filled === null ? (
          <p className="text-center text-[13px] py-10" style={{ color: "#A8A8A6" }}>กำลังโหลด…</p>
        ) : (
          <>
            <div className="flex items-center gap-2.5 mt-4 mb-3">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E7F0EE" }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(filledCount, 2)}%`, backgroundColor: "#0B6E65" }} />
              </div>
              <span className="text-[12px] font-bold flex-shrink-0" style={{ color: BRAND.primary }}>
                มีความจำแล้ว {filledCount}/{RV_TOTAL} ข้อ
              </span>
            </div>

            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: RV_TOTAL }, (_, i) => i + 1).map((no) => {
                const has = filled.has(no);
                const isActive = active === no;
                return (
                  <button key={no} onClick={() => open(no)}
                    className="aspect-square rounded-lg text-[12px] font-bold transition-all active:scale-90"
                    style={{
                      backgroundColor: isActive ? "#B45309" : has ? "#DCFCE7" : "white",
                      color:           isActive ? "white"   : has ? "#15803D" : "#A8A8A6",
                      border: `1.5px solid ${isActive ? "#B45309" : has ? "#86EFAC" : "#E0DFDC"}`,
                    }}>
                    {no}
                  </button>
                );
              })}
            </div>

            {/* จำเลขข้อไม่ได้ก็ส่งได้ — กันข้อมูลตกหล่น (Aj 2026-09-20 ค่ำ) */}
            <button onClick={() => open(NO_NUMBER)}
              className="mt-3 w-full py-3 rounded-xl text-[13.5px] font-bold active:scale-[0.98] transition-transform"
              style={active === NO_NUMBER
                ? { backgroundColor: "#B45309", color: "white", border: "1.5px solid #B45309" }
                : { backgroundColor: "white", color: "#B45309", border: "1.5px dashed #F59E0B" }}>
              ➕ จำเลขข้อไม่ได้ / ไม่แน่ใจว่าข้อไหน — ส่งตรงนี้ได้เลย
            </button>
          </>
        )}

        {active !== null && (
          <div id="rv-form" className="mt-5 rounded-2xl px-4 pt-3.5 pb-4"
            style={{ border: "1.5px solid #FCD34D", backgroundColor: "#FFFBEB" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14.5px] font-bold" style={{ color: "#92400E" }}>
                {active === NO_NUMBER ? "📝 ส่งความจำ — จำเลขข้อไม่ได้" : `📝 ส่งความจำ — ข้อที่ ${active}`}
                {active !== NO_NUMBER && filled?.has(active) && !sentNos.has(active) && (
                  <span className="text-[11.5px] font-semibold ml-1.5" style={{ color: "#B45309" }}>
                    (มีคนส่งแล้ว ส่งเสริมได้)
                  </span>
                )}
              </p>
              <button onClick={() => setActive(null)} className="text-[12px] underline" style={{ color: "#B45309" }}>
                ปิด
              </button>
            </div>
            <p className="text-[12px] mt-0.5 mb-2" style={{ color: "#B45309" }}>
              จำได้แค่บางส่วนก็ส่งได้ — โจทย์อย่างเดียว หรือช้อยบางตัวก็มีค่ามากแล้ว
            </p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              placeholder={active === NO_NUMBER ? "โจทย์เท่าที่จำได้ (ไม่ต้องรู้ว่าข้อไหน)…" : `โจทย์ข้อที่ ${active} เท่าที่จำได้…`}
              className={INPUT} style={INPUT_STYLE} />
            <div className="grid grid-cols-1 gap-2 mt-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[13px] font-bold w-4 flex-shrink-0" style={{ color: "#92400E" }}>
                    {OPT[i]}.
                  </span>
                  <input value={o}
                    onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="จำไม่ได้เว้นว่างได้"
                    className={INPUT} style={INPUT_STYLE} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="text-[12.5px] font-semibold" style={{ color: "#92400E" }}>ข้อที่คิดว่าถูก:</span>
              {OPT.map((o) => (
                <button key={o} type="button" onClick={() => setAnswer(answer === o ? "" : o)}
                  className="w-9 h-9 rounded-lg text-[13.5px] font-bold"
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
            <input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุ (เช่น ชุดข้อสอบ A/B — ไม่มีก็เว้นได้)"
              className={`${INPUT} mt-2`} style={INPUT_STYLE} />
            {admin && (
              <div className="mt-2 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: "#F0FDF4", border: "1px solid #86EFAC" }}>
                <p className="text-[11.5px] font-bold mb-1" style={{ color: "#15803D" }}>
                  ⭐ เฉลย AJ (เห็นเฉพาะแอดมิน) — กรอกแล้วยืนยันให้ทันที ไม่ต้องไปติ๊กซ้ำที่ /admin/recall
                </p>
                <textarea value={ajAns} onChange={(e) => setAjAns(e.target.value)} rows={2}
                  placeholder="เช่น ข. หรือพิมพ์คำตอบเต็ม (เว้นว่าง = ยังไม่เฉลย)"
                  className={INPUT} style={{ border: "1px solid #86EFAC" }} />
              </div>
            )}
            <button onClick={send} disabled={busy || !text.trim()}
              className="mt-3 w-full py-3 rounded-xl text-[14.5px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-40"
              style={{ backgroundColor: BRAND.primary }}>
              {busy ? "กำลังส่ง…" : active === NO_NUMBER ? "ส่งความจำ 💚" : `ส่งความจำข้อที่ ${active} 💚`}
            </button>
            {err && <p className="text-[12px] mt-2" style={{ color: "#DC2626" }}>{err}</p>}
          </div>
        )}

        {sentNos.size > 0 && active === null && (
          <p className="text-[13px] mt-4 text-center rounded-xl py-2.5"
            style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
            💚 ขอบคุณมากค่ะ ส่งแล้ว {sentNos.size} ข้อ — แตะข้ออื่นต่อได้เลย
          </p>
        )}

        <Link href="/course/dcd" className="btn-secondary w-full py-3 text-[14px] block text-center mt-6">
          ← กลับหน้าคอร์ส คร.
        </Link>
      </div>
    </div>
  );
}
