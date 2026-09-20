"use client";
/**
 * /recall-dcd — คลังความจำข้อสอบ คร.69 ครบ 100 ข้อ (Aj 2026-09-20)
 *
 * v2 (ค่ำวันสอบ): น้อง "เห็นเนื้อหา" ที่รวบรวมได้ของทุกข้อ — โจทย์ + ช้อยที่มี
 * พร้อมป้ายบอกว่าข้อไหนขาดอะไร (ช้อยช่องไหนว่าง / ยังไม่มีเฉลย) แล้วเติมตรงจุดได้
 * ข้อมูลผ่าน /api/recall-volunteer?bank=1 (ไม่เผยเฉลย/ชื่อผู้ส่ง)
 *
 * สถานะต่อข้อ: เขียว = ครบ (เฉลยยืนยัน+ช้อยครบ 4) · เหลือง = มีข้อมูลแต่ยังขาด ·
 * เทา = ยังว่าง · ส่งซ้ำได้ทุกข้อ + ปุ่ม "จำเลขข้อไม่ได้" ด้านล่าง
 * ช่อง "เฉลย AJ" โผล่เฉพาะบัญชี admin — ยืนยันเฉลยพร้อมส่งในคลิกเดียว
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

interface BankItem {
  no: number;
  text: string;
  options: string[];  // 4 ช่องตามตำแหน่ง — "" = ยังขาด
  verdict: boolean;   // AJ ยืนยันเฉลยแล้ว
  count: number;      // จำนวนใบที่ส่งเข้ามา
}

type ItemState = "full" | "partial" | "empty";

function stateOf(item: BankItem | undefined): ItemState {
  if (!item) return "empty";
  const optsFull = item.options.filter(Boolean).length === 4;
  return item.verdict && optsFull && item.text ? "full" : "partial";
}

function missingOf(item: BankItem): string[] {
  const out: string[] = [];
  if (!item.text) out.push("โจทย์");
  const blank = item.options.map((o, i) => (o ? "" : OPT[i])).filter(Boolean);
  if (blank.length) out.push(`ช้อย ${blank.join(", ")}`);
  if (!item.verdict) out.push("เฉลย (AJ จะยืนยัน)");
  return out;
}

const STATE_STYLE: Record<ItemState, { bg: string; color: string; border: string }> = {
  full:    { bg: "#DCFCE7", color: "#15803D", border: "#86EFAC" },
  partial: { bg: "#FEF3C7", color: "#B45309", border: "#FCD34D" },
  empty:   { bg: "white",   color: "#A8A8A6", border: "#E0DFDC" },
};

export default function RecallDcdPage() {
  useLoginGuard();
  const { user } = useAuth();
  const [bank, setBank]       = useState<Map<number, BankItem> | null>(null);
  const [denied, setDenied]   = useState(false);
  const [active, setActive]   = useState<number | null>(null);
  const [sentCount, setSentCount] = useState(0);

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
      const res = await fetch("/api/recall-volunteer?bank=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { setDenied(true); return; }
      if (res.ok) {
        const d = await res.json();
        const m = new Map<number, BankItem>();
        (d.items ?? []).forEach((it: BankItem) => m.set(it.no, it));
        setBank(m);
      }
    } catch {}
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function open(no: number) {
    setActive(no);
    setText(""); setOptions(["", "", "", ""]); setAnswer(""); setUnsure(false);
    setNote(""); setErr(""); setAjAns("");
    setTimeout(() => document.getElementById("rv-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  async function send() {
    if (!user || busy || active === null) return;
    // เติมบางส่วนได้ — ขอแค่มีอะไรสักอย่าง (โจทย์ หรือช้อย หรือเฉลย)
    const hasSomething = text.trim() || options.some((o) => o.trim()) || answer;
    if (!hasSomething) { setErr("กรอกอย่างน้อย 1 อย่างนะคะ (โจทย์ / ช้อย / เฉลยที่คิดว่าถูก)"); return; }
    setBusy(true); setErr("");
    try {
      const subId = await submitRecall(
        { uid: user.uid, email: user.email, displayName: user.displayName },
        {
          no: active === NO_NUMBER ? null : active,
          text: text.trim() || "(เติมเฉพาะช้อย/เฉลย — โจทย์ตามที่มีในคลัง)",
          options, answer,
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
      setSentCount((c) => c + 1);
      setActive(null);
      await load();
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

  const fullCount    = bank ? [...bank.values()].filter((it) => stateOf(it) === "full").length : 0;
  const partialCount = bank ? bank.size - fullCount : 0;
  const activeItem   = active !== null && active !== NO_NUMBER ? bank?.get(active) : undefined;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <div className="max-w-lg mx-auto px-5 pt-6 pb-24">

        <h1 className="text-[19px] font-bold text-gray-900">คลังความจำข้อสอบ คร. 69</h1>
        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: "#6B7280" }}>
          แตะเลขข้อเพื่อดูว่ารวบรวมได้แค่ไหนแล้ว และช่วยเติมส่วนที่ขาด —
          <b style={{ color: "#15803D" }}> เขียว = ครบแล้ว</b> ·
          <b style={{ color: "#B45309" }}> เหลือง = มีบางส่วน ขาดช้อย/เฉลย</b> ·
          เทา = ยังว่าง
        </p>

        {bank === null ? (
          <p className="text-center text-[13px] py-10" style={{ color: "#A8A8A6" }}>กำลังโหลด…</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mt-4 mb-3 text-[12px] font-semibold flex-wrap"
              style={{ color: "#6B7280" }}>
              <span style={{ color: "#15803D" }}>ครบ {fullCount}</span>
              <span style={{ color: "#B45309" }}>ขาดบางส่วน {partialCount}</span>
              <span>ยังว่าง {RV_TOTAL - fullCount - partialCount}</span>
              <span className="ml-auto" style={{ color: BRAND.primary }}>
                รวม {fullCount + partialCount}/{RV_TOTAL}
              </span>
            </div>

            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: RV_TOTAL }, (_, i) => i + 1).map((no) => {
                const s = STATE_STYLE[stateOf(bank.get(no))];
                const isActive = active === no;
                return (
                  <button key={no} onClick={() => open(no)}
                    className="aspect-square rounded-lg text-[12px] font-bold transition-all active:scale-90"
                    style={{
                      backgroundColor: isActive ? "#B45309" : s.bg,
                      color:           isActive ? "white"   : s.color,
                      border: `1.5px solid ${isActive ? "#B45309" : s.border}`,
                    }}>
                    {no}
                  </button>
                );
              })}
            </div>

            {/* จำเลขข้อไม่ได้ก็ส่งได้ — กันข้อมูลตกหล่น */}
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
                {active === NO_NUMBER ? "📝 ส่งความจำ — จำเลขข้อไม่ได้" : `ข้อที่ ${active}`}
              </p>
              <button onClick={() => setActive(null)} className="text-[12px] underline" style={{ color: "#B45309" }}>
                ปิด
              </button>
            </div>

            {/* ── ข้อมูลที่รวบรวมได้แล้วของข้อนี้ ── */}
            {activeItem ? (
              <div className="mt-2 rounded-xl px-3 py-2.5 bg-white" style={{ border: "1px solid #EBEBEA" }}>
                <p className="font-exam text-[14px] leading-relaxed text-gray-900 whitespace-pre-line">
                  {activeItem.text || "(ยังไม่มีโจทย์ — ช่วยเติมข้างล่าง)"}
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {activeItem.options.map((o, i) => (
                    <p key={i} className="font-exam text-[13px] leading-relaxed"
                      style={{ color: o ? "#4B5563" : "#D97706" }}>
                      {OPT[i]}. {o || "— ยังขาด ช่วยเติมที —"}
                    </p>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {stateOf(activeItem) === "full" ? (
                    <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
                      ✓ ข้อนี้ครบแล้ว — ส่งเสริม/แย้งได้ถ้าจำต่างจากนี้
                    </span>
                  ) : (
                    missingOf(activeItem).map((g) => (
                      <span key={g} className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>
                        ขาด{g}
                      </span>
                    ))
                  )}
                  <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>
                    · มีคนส่งแล้ว {activeItem.count} ใบ
                  </span>
                </div>
              </div>
            ) : active !== NO_NUMBER ? (
              <p className="text-[12.5px] mt-2 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: "white", border: "1px dashed #E0DFDC", color: "#A8A8A6" }}>
                ข้อนี้ยังว่างอยู่เลย — จำได้แค่ไหนส่งแค่นั้นก็มีค่ามากค่ะ
              </p>
            ) : null}

            <p className="text-[12px] mt-2.5 mb-2" style={{ color: "#B45309" }}>
              เติมเฉพาะส่วนที่ขาดก็ได้ (เช่น ช้อยที่หาย หรือแค่เฉลย) — ไม่ต้องพิมพ์ซ้ำของที่มีแล้ว
            </p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              placeholder={active === NO_NUMBER ? "โจทย์เท่าที่จำได้ (ไม่ต้องรู้ว่าข้อไหน)…"
                : activeItem?.text ? "โจทย์ (มีแล้ว — พิมพ์เฉพาะถ้าจำได้ต่าง/ครบกว่า)"
                : `โจทย์ข้อที่ ${active} เท่าที่จำได้…`}
              className={INPUT} style={INPUT_STYLE} />
            <div className="grid grid-cols-1 gap-2 mt-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[13px] font-bold w-4 flex-shrink-0" style={{ color: "#92400E" }}>
                    {OPT[i]}.
                  </span>
                  <input value={o}
                    onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={activeItem?.options[i] ? "มีแล้ว — เว้นได้" : "จำไม่ได้เว้นว่างได้"}
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
            <button onClick={send} disabled={busy}
              className="mt-3 w-full py-3 rounded-xl text-[14.5px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-40"
              style={{ backgroundColor: BRAND.primary }}>
              {busy ? "กำลังส่ง…" : active === NO_NUMBER ? "ส่งความจำ 💚" : `ส่งข้อมูลข้อที่ ${active} 💚`}
            </button>
            {err && <p className="text-[12px] mt-2" style={{ color: "#DC2626" }}>{err}</p>}
          </div>
        )}

        {sentCount > 0 && active === null && (
          <p className="text-[13px] mt-4 text-center rounded-xl py-2.5"
            style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
            💚 ขอบคุณมากค่ะ ส่งแล้ว {sentCount} ใบ — แตะข้ออื่นต่อได้เลย
          </p>
        )}

        <Link href="/course/dcd" className="btn-secondary w-full py-3 text-[14px] block text-center mt-6">
          ← กลับหน้าคอร์ส คร.
        </Link>
      </div>
    </div>
  );
}
