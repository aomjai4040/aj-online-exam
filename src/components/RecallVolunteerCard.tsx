"use client";
/**
 * RecallVolunteerCard — อาสาจำข้อสอบ คร.69 คนละ 1 ข้อ (Aj 2026-09-17)
 *
 * แสดง 2 ตำแหน่งบนหน้าคอร์ส คร. (slot):
 *   "top"  = การ์ดใหญ่ — เฉพาะตอนต้องตัดสินใจ: ① ยังไม่กดรับ/ไม่ปฏิเสธ (ชวนอาสา)
 *            ② หลังสอบ + ยังไม่ส่ง (ฟอร์มส่ง — เปิดให้ทุกคนในคอร์ส ไม่ต้องเคยรับเลข
 *            Aj 2026-09-20; คนกดไม่สะดวกไว้เข้าทางการ์ดเมนูข้างล่างได้)
 *   "menu" = การ์ดเล็กสไตล์เมนู ใต้แผงเมนูหลัก — หลังตัดสินใจแล้ว (รับเลขแล้ว/
 *            กดไม่สะดวก/ส่งแล้ว) ไม่รบกวนสายตาตอนเข้ามาติว (Aj 2026-09-18)
 *            แตะกางดูเลข/ถอนตัว/เปลี่ยนใจร่วมได้
 *
 * ปุ่ม "ไม่สะดวกครั้งนี้" เก็บที่ users/{uid}.rvDismissedDcd69 (ติดบัญชี)
 * สองตำแหน่ง sync กันผ่าน event "rv-changed"
 */
import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { submitRecall } from "@/lib/recall-firestore";
import { RV_EXAM_LABEL, type RvPhase } from "@/lib/recall-volunteer";
import { BRAND } from "@/lib/subjects";

interface Status {
  phase: RvPhase;
  assigned: number; mainFilled: number; total: number;
  mine: { no: number; round: number } | null;
  submitted: boolean;
}

const OPT = ["ก", "ข", "ค", "ง"];
const DISMISS_KEY = "rvDismissedDcd69";
const EVT = "rv-changed";

export default function RecallVolunteerCard({ slot }: { slot: "top" | "menu" }) {
  const { user } = useAuth();
  const [st, setSt]             = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState("");
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const [res, udoc] = await Promise.all([
        fetch("/api/recall-volunteer", { headers: { Authorization: `Bearer ${token}` } }),
        getDoc(doc(db, "users", user.uid)).catch(() => null),
      ]);
      if (res.ok) setSt(await res.json());
      setDismissed(Boolean(udoc?.data()?.[DISMISS_KEY]));
    } catch {}
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onChange = () => load();
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, [load]);

  const poke = () => window.dispatchEvent(new Event(EVT));

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
      await load(); poke();
    } catch { setErr("ไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    finally { setBusy(false); }
  }

  async function dismiss(on: boolean) {
    if (!user) return;
    setDismissed(on);
    setExpanded(false);
    await setDoc(doc(db, "users", user.uid), { [DISMISS_KEY]: on }, { merge: true }).catch(() => {});
    poke();
  }

  // ── ฟอร์มส่งหลังสอบ ──
  const [text, setText]       = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer]   = useState("");
  const [unsure, setUnsure]   = useState(false);
  // ทางหนีไฟ (Aj 2026-09-18): จำข้อตัวเองไม่ได้ → ส่งข้ออื่น/ไม่รู้เลขก็ได้
  const [flexNo, setFlexNo]   = useState(false);
  const [altNo, setAltNo]     = useState("");
  // เผื่อข้อสอบมีหลายชุดสลับข้อ (Aj 2026-09-19) — ติดไปกับ note ให้ admin แยกชุดได้
  const [examSet, setExamSet] = useState("");
  // ส่งได้หลายใบ (Aj 2026-09-20 ค่ำ) — นับที่ส่งในรอบนี้ไว้โชว์กำลังใจ
  const [sentCount, setSentCount] = useState(0);

  async function send() {
    if (!user || busy || !text.trim() || !st) return;
    setBusy(true); setErr("");
    try {
      // ใบที่ 2 เป็นต้นไป (เคยส่งแล้ว) — เลขข้อเอาจากช่องกรอกเสมอ
      const more = st.submitted;
      // ไม่ได้อาสาไว้ก็ส่งได้ (Aj 2026-09-20) — ใช้เลขจากช่องกรอกแทน
      const parsed = Number(altNo);
      const no = !more && st.mine && !flexNo
        ? st.mine.no
        : (Number.isInteger(parsed) && parsed >= 1 && parsed <= st.total ? parsed : null);
      await submitRecall(
        { uid: user.uid, email: user.email, displayName: user.displayName },
        {
          no, text, options, answer,
          subject: "", confidence: unsure ? "maybe" : "sure",
          note: [
            examSet.trim() ? `ชุดข้อสอบ: ${examSet.trim()}` : "",
            !more && st.mine && flexNo ? `อาสาข้อที่ ${st.mine.no} แต่ส่งข้ออื่นแทน` : "",
            !more && !st.mine ? "ส่งสมทบ (ไม่ได้รับเลขอาสา)" : "",
            more ? "ส่งเพิ่มเติม" : "",
          ].filter(Boolean).join(" · "),
          field: "dcd",
        },
      );
      // เคลียร์ฟอร์มรอใบต่อไป (คงชุดข้อสอบไว้ — ใบเดียวกันทั้งรอบ)
      setText(""); setOptions(["", "", "", ""]); setAnswer("");
      setUnsure(false); setFlexNo(false); setAltNo("");
      setSentCount((c) => c + 1);
      await load(); poke();
    } catch { setErr("ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"); }
    finally { setBusy(false); }
  }

  if (!user || !st || dismissed === null || st.phase === "closed") return null;

  const pct = Math.round((st.mainFilled / st.total) * 100);
  const INPUT = "w-full rounded-xl px-3.5 py-2.5 text-[13.5px] bg-white focus:outline-none";
  const INPUT_STYLE = { border: "1px solid #E0DFDC" } as const;

  // ── ชิ้นส่วนที่ใช้ร่วม ──

  const progressBar = (
    <div className="mt-3 flex items-center gap-2.5">
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#FDE9C8" }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: "#F59E0B" }} />
      </div>
      <span className="text-[12px] font-bold flex-shrink-0" style={{ color: "#92400E" }}>
        มีเจ้าภาพแล้ว {st.mainFilled}/{st.total} ข้อ
      </span>
    </div>
  );

  const assignedBox = st.mine && (
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
      <p className="text-[11.5px] mt-1.5 leading-relaxed rounded-lg px-2.5 py-1.5"
        style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
        สบายใจได้ 💚 ถึงหน้างานแล้วลืมเลข/จำข้อตัวเองไม่ทัน ไม่เป็นไรเลย —
        <b>ส่งข้อไหนก็ได้ที่จำได้</b> มีเพื่อนอาสาสำรองข้อเดียวกันช่วยอยู่ อย่าให้เรื่องนี้กวนสมาธิสอบนะคะ
      </p>
      <p className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: "#B45309" }}>
        📌 ถ้าหัวกระดาษข้อสอบระบุ &quot;ชุด&quot; (เช่น ชุด A/B หรือ 01/02) ช่วยสังเกตไว้ด้วย —
        ตอนส่งจะมีช่องให้กรอก ใช้แยกกรณีข้อสอบสลับชุดได้
      </p>
      <button onClick={() => act("withdraw")} disabled={busy}
        className="text-[11.5px] underline mt-1.5" style={{ color: "#B45309" }}>
        ขอถอนตัว
      </button>
    </div>
  );

  const inviteBody = (
    <>
      <p className="text-[14.5px] font-bold" style={{ color: "#92400E" }}>
        🙏 อาสาจำข้อสอบ คนละ 1 ข้อ — {RV_EXAM_LABEL}
      </p>
      <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "#B45309" }}>
        ช่วยกันคนละข้อ (โจทย์ + ช้อยทั้ง 4) สอบเสร็จกลับมาส่งในการ์ดนี้ —
        รวมกันได้แนวข้อสอบทั้งชุดไว้ให้รุ่นต่อไป
      </p>
      {progressBar}
      {st.assigned > st.mainFilled && (
        <p className="text-[11.5px] mt-1" style={{ color: "#B45309" }}>
          + อาสาสำรองอีก {st.assigned - st.mainFilled} คน (ข้อละหลายคนยิ่งดี — กันจำไม่ได้)
        </p>
      )}
      <button onClick={() => act("assign")} disabled={busy}
        className="mt-3 w-full py-3 rounded-xl text-[14.5px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
        style={{ backgroundColor: "#F59E0B" }}>
        {busy ? "กำลังรับเลข…" : "รับเลขข้อของฉัน (10 วินาที ไม่ต้องกรอกอะไร)"}
      </button>
      {!st.mine && (
        <button onClick={() => dismiss(true)} disabled={busy}
          className="mt-2 w-full py-2 rounded-xl text-[12.5px] font-semibold"
          style={{ color: "#B45309" }}>
          ไม่สะดวกครั้งนี้ — ซ่อนการ์ดไว้ข้างล่าง
        </button>
      )}
    </>
  );

  // ฟอร์มเปิดให้ทุกคนที่มีคอร์ส คร. — ไม่ได้อาสาไว้ก็ส่งสมทบได้ (Aj 2026-09-20)
  const submitForm = (
    <>
      <p className="text-[14.5px] font-bold" style={{ color: "#92400E" }}>
        {st.submitted
          ? <>📝 ส่งเพิ่มอีกข้อ — จำข้อไหนได้ส่งได้เลย</>
          : st.mine
          ? <>📝 สอบเสร็จแล้ว — ส่งข้อที่ <span className="text-[18px]">{st.mine.no}</span> ที่คุณอาสาจำ</>
          : <>📝 สอบเสร็จแล้ว — ส่งข้อสอบที่จำได้</>}
      </p>
      <p className="text-[12px] mt-0.5 mb-2" style={{ color: "#B45309" }}>
        {st.submitted
          ? "ส่งกี่ข้อก็ได้ ยิ่งเยอะยิ่งช่วยรุ่นต่อไป 💛"
          : <>ไม่ต้องเป๊ะทุกคำ จับใจความได้ก็มีค่ามากแล้ว
            {!st.mine && " — ไม่ได้รับเลขอาสาไว้ก็ส่งได้เลยค่ะ"}</>}
      </p>
      {sentCount > 0 && (
        <p className="text-[12px] mb-2 rounded-lg px-2.5 py-1.5"
          style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
          💚 ส่งแล้ว {sentCount} ใบ ขอบคุณมากค่ะ — ฟอร์มพร้อมรับข้อต่อไป
        </p>
      )}
      {/* ทางหนีไฟ: ลืม/จำข้อตัวเองไม่ได้ → ส่งข้ออื่นที่จำได้แทน มีค่าเท่ากัน */}
      {st.mine && !st.submitted && (
        <button type="button" onClick={() => setFlexNo((f) => !f)}
          className="text-[12px] underline mb-2 block" style={{ color: "#B45309" }}>
          {flexNo ? "← กลับไปส่งข้อของตัวเอง" : "จำข้อของตัวเองไม่ได้? ส่งข้ออื่นที่จำได้แทน (มีค่าเท่ากัน)"}
        </button>
      )}
      {(flexNo || !st.mine || st.submitted) && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[12.5px] font-semibold" style={{ color: "#92400E" }}>ข้อที่จะส่งคือข้อที่</span>
          <input value={altNo} onChange={(e) => setAltNo(e.target.value)}
            type="number" min={1} max={st.total} placeholder="ไม่รู้ก็เว้นได้"
            className="w-28 rounded-xl px-3 py-2 text-[13.5px] bg-white focus:outline-none"
            style={INPUT_STYLE} />
          <span className="text-[11.5px]" style={{ color: "#B45309" }}>(จำเลขไม่ได้ เว้นว่างได้เลย)</span>
        </div>
      )}
      {/* เผื่อข้อสอบมีหลายชุด (สลับข้อ/สลับช้อย) — ไม่บังคับกรอก */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12.5px] font-semibold flex-shrink-0" style={{ color: "#92400E" }}>
          ชุดข้อสอบ (ถ้ามีระบุ)
        </span>
        <input value={examSet} onChange={(e) => setExamSet(e.target.value)}
          placeholder="เช่น A / B / 01 — ไม่มีก็เว้นได้"
          className="flex-1 rounded-xl px-3 py-2 text-[13.5px] bg-white focus:outline-none"
          style={INPUT_STYLE} />
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder={st.mine && !flexNo && !st.submitted ? `โจทย์ข้อที่ ${st.mine.no} ที่จำได้…` : "โจทย์ข้อที่จำได้…"}
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
        {busy ? "กำลังส่ง…"
          : st.mine && !flexNo && !st.submitted ? `ส่งข้อที่ ${st.mine.no} 💚`
          : "ส่งข้อที่จำได้ 💚"}
      </button>
      <a href="/recall-dcd" className="text-[12px] underline mt-2 block text-center"
        style={{ color: "#B45309" }}>
        เปิดคลังความจำ 100 ข้อ — ดูว่าข้อไหนยังว่าง →
      </a>
    </>
  );

  const fullCard = (body: React.ReactNode) => (
    <div className="rounded-2xl overflow-hidden mb-4"
      style={{ border: "1.5px solid #FCD34D", backgroundColor: "#FFFBEB" }}>
      <div className="px-4 pt-3.5 pb-4">
        {body}
        {err && <p className="text-[12px] mt-2" style={{ color: "#DC2626" }}>{err}</p>}
      </div>
    </div>
  );

  // ══ slot: top — โชว์เฉพาะตอนต้องตัดสินใจ ══
  if (slot === "top") {
    if (st.phase === "before" && !st.mine && !dismissed) return fullCard(inviteBody);
    // หลังสอบ: เปิดฟอร์มให้ทุกคน ไม่ต้องเคยรับเลข (Aj 2026-09-20) — ยกเว้นคนกดไม่สะดวก
    if (st.phase === "after" && !st.submitted && !dismissed) return fullCard(submitForm);
    return null;
  }

  // ══ slot: menu — การ์ดเล็กหลังตัดสินใจแล้ว (สไตล์เดียวกับเมนู) ══
  const decided = st.mine !== null || dismissed || st.submitted;
  if (!decided) return null;
  if (st.phase === "after" && !st.submitted && !dismissed) return null; // ฟอร์มอยู่ข้างบนแล้ว

  const mini = (() => {
    if (st.phase === "after" && st.submitted) {
      // ส่งได้หลายใบ (Aj 2026-09-20 ค่ำ) — กางกลับมาเป็นฟอร์มส่งเพิ่มได้เสมอ
      return {
        icon: "💚", title: st.mine ? `ส่งข้อที่ ${st.mine.no} แล้ว` : "ส่งข้อสอบแล้ว",
        desc: "ขอบคุณมากค่ะ · แตะเพื่อส่งเพิ่มอีกข้อ", expandable: true,
      };
    }
    if (st.phase === "after") {
      // เคยกด "ไม่สะดวก" ไว้ก่อนสอบ — หลังสอบยังเปิดทางส่งเสมอ
      return { icon: "📝", title: "ส่งข้อสอบที่จำได้", desc: "จำข้อไหนได้ก็ส่งได้ · แตะเพื่อกรอก", expandable: true };
    }
    if (st.mine) {
      return {
        icon: "🙏", title: `อาสาจำข้อที่ ${st.mine.no}`,
        desc: `มีเจ้าภาพแล้ว ${st.mainFilled}/${st.total} · แตะดูรายละเอียด`,
        expandable: true,
      };
    }
    return {
      icon: "🙏", title: "อาสาจำข้อสอบ",
      desc: `มีเจ้าภาพแล้ว ${st.mainFilled}/${st.total} — เปลี่ยนใจร่วมได้ตลอด`,
      expandable: true,
    };
  })();

  return (
    <div className="mt-3">
      <button type="button"
        onClick={() => mini.expandable && setExpanded((e) => !e)}
        className={`card-elev px-4 py-4 flex items-center gap-3 w-full text-left ${
          mini.expandable ? "card-elev-hover active:scale-[0.98]" : ""}`}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-[19px]"
          style={{ backgroundColor: "#FDF6E9" }}>
          {mini.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[15px] text-gray-900 leading-tight truncate">{mini.title}</p>
          <p className="text-[12.5px] mt-0.5 truncate text-gray-500">{mini.desc}</p>
        </div>
        {mini.expandable && (
          <span className="text-[13px] flex-shrink-0" style={{ color: "#C4C4C0" }}>
            {expanded ? "▴" : "▾"}
          </span>
        )}
      </button>

      {expanded && mini.expandable && (
        <div className="mt-2">
          {st.phase === "after"
            ? fullCard(submitForm)
            : st.mine
            ? fullCard(<>{progressBar}{assignedBox}</>)
            : fullCard(inviteBody) /* ในนี้มีปุ่ม "ไม่สะดวกครั้งนี้" อยู่แล้ว = พับกลับ */}
        </div>
      )}
    </div>
  );
}
