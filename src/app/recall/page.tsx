"use client";
/**
 * /recall — "ช่วยกันเก็บข้อสอบ 69"
 *
 * ออกแบบให้น้องที่เพิ่งออกจากห้องสอบกรอกได้เร็วที่สุดบนมือถือ:
 *  - โหมดหลักคือ "ทีละข้อ" (คิว) ไม่ต้องเลื่อนหาเอง เรียงข้อที่ตอบง่ายสุดขึ้นก่อน
 *  - ข้อที่มีตัวเลือกครบ → แตะ ก/ข/ค/ง แล้วส่งเลย ไม่ต้องพิมพ์
 *  - ข้อที่ขาดตัวเลือกบางช่อง → ขอเฉพาะช่องที่ขาด ไม่ใช่ 4 ช่องรวด
 *  - ข้ามได้ตลอดโดยไม่รู้สึกผิด
 *  - ช่องกรอกทุกช่อง 16px (ต่ำกว่านี้ iOS Safari จะซูมเองตอนแตะ)
 *
 * โครง 84 ข้อมาจาก recall-seed.ts · คำตอบลง recallSubmissions (Aj ตรวจเองที่ /admin/recall)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { BRAND, subjectColor } from "@/lib/subjects";
import { SUBJECTS, SUBJECT_DISPLAY, type SubjectCode } from "@/lib/types";
import {
  RECALL_ALL, GAP_LABEL, isComplete, recallProgress,
  crowdAnswerFor, type RecallSeedItem,
} from "@/lib/recall-seed";
import {
  getRecallCounts, getVerdicts, submitRecall,
  type RecallConfidence, type RecallVerdict,
} from "@/lib/recall-firestore";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

const OPT = ["ก", "ข", "ค", "ง"];
type Mode = "queue" | "list" | "new";

/** ช่องกรอกทุกที่ใช้ 16px — ต่ำกว่านี้ iOS Safari ซูมหน้าจอเองตอนแตะ */
const INPUT = "w-full rounded-xl px-3.5 py-3 text-[16px] leading-relaxed font-exam";
const INPUT_STYLE = { border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" } as const;

/** ข้อไหนตอบง่ายสุด = ให้ขึ้นก่อน (0 = แตะปุ่มเดียวจบ) */
function effortOf(item: RecallSeedItem): number {
  const full = item.options.length >= 2 && item.options.every((o) => o.trim());
  if (item.gaps.includes("stem")) return 3;
  if (full) return 0;                       // แตะ ก-ง ได้เลย
  if (item.options.some((o) => o.trim())) return 1; // มีบางช่อง เติมที่เหลือ
  return 2;                                  // ว่างเปล่า ต้องพิมพ์เอง
}

function buildQueue(): RecallSeedItem[] {
  return RECALL_ALL.filter((i) => !isComplete(i))
    .sort((a, b) => effortOf(a) - effortOf(b) || a.no - b.no);
}

// ─── การ์ดทีละข้อ (โหมดหลัก) ─────────────────────────────────────────────────

function QueueCard({
  item, onSent, onSkip,
}: { item: RecallSeedItem; onSent: (no: number) => void; onSkip: () => void }) {
  const { user } = useAuth();
  const crowd = crowdAnswerFor(item.no);

  // ช่องตัวเลือกที่ยังขาด — ขอเฉพาะช่องนี้เท่านั้น
  const missingIdx = item.options
    .map((o, i) => (o.trim() ? -1 : i))
    .filter((i) => i >= 0);
  const hasAnyOption = item.options.some((o) => o.trim());
  const canTap = hasAnyOption && !item.gaps.includes("stem");

  const [picked,  setPicked]  = useState<number | null>(null);
  const [typed,   setTyped]   = useState("");                 // เฉลยแบบพิมพ์เอง
  const [stem,    setStem]    = useState("");
  const [fills,   setFills]   = useState<Record<number, string>>({});
  const [unsure,  setUnsure]  = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [ok,      setOk]      = useState(false);
  const [err,     setErr]     = useState("");

  async function send(answer: string, confidence: RecallConfidence) {
    if (!user || busy) return;
    setBusy(true); setErr("");
    const options = item.options.length
      ? item.options.map((o, i) => (o.trim() ? o : (fills[i] ?? "")))
      : [0, 1, 2, 3].map((i) => fills[i] ?? "");
    try {
      await submitRecall(user, {
        no:      item.no,
        text:    stem.trim() || item.text,
        options,
        answer,
        subject: item.subject,
        confidence,
        note:    "",
      });
      setOk(true);
      setTimeout(() => onSent(item.no), 650); // ไปข้อถัดไปเอง
    } catch (e) {
      console.error(e);
      setErr("ส่งไม่สำเร็จ ลองอีกครั้งนะ");
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="bg-white rounded-2xl px-5 py-10 text-center"
        style={{ border: "1.5px solid #BBF7D0" }}>
        <div className="text-[38px] mb-2">🙏</div>
        <p className="text-[16px] font-bold" style={{ color: "#15803D" }}>บันทึกแล้ว ขอบคุณมาก</p>
        <p className="text-[13px] mt-1" style={{ color: "#A8A8A6" }}>กำลังไปข้อถัดไป…</p>
      </div>
    );
  }

  const somethingTyped =
    typed.trim() || stem.trim() || Object.values(fills).some((v) => v.trim());

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1.5px solid #FCD34D" }}>
      <div className="px-5 py-5">

        {/* โจทย์ */}
        <div className="flex items-start gap-2.5 mb-1">
          <span className="text-[15px] font-extrabold flex-shrink-0" style={{ color: "#B45309" }}>
            {item.no}.
          </span>
          <p className="font-exam text-[16px] leading-relaxed text-gray-900 flex-1">
            {item.text}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-4 pl-6">
          <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${subjectColor(item.subject)}15`, color: subjectColor(item.subject) }}>
            {SUBJECT_DISPLAY[item.subject] ?? item.subject}
          </span>
          {item.note && (
            <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>{item.note}</span>
          )}
        </div>

        {/* ① ขาดโจทย์ */}
        {item.gaps.includes("stem") && (
          <div className="mb-4">
            <p className="text-[14px] font-bold mb-2" style={{ color: "#B45309" }}>
              ยังไม่มีใครจำโจทย์ข้อนี้ได้ — จำได้ไหม
            </p>
            <textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={3}
              placeholder="พิมพ์เท่าที่จำได้ ไม่ต้องเป๊ะ"
              className={INPUT} style={INPUT_STYLE} />
          </div>
        )}

        {/* ② แตะเลือกเฉลยจากตัวเลือกที่มี — ทางที่เร็วที่สุด */}
        {canTap && (
          <>
            <p className="text-[14px] font-bold mb-2.5 text-gray-800">
              ข้อนี้เฉลยข้อไหน — แตะได้เลย
            </p>
            <div className="space-y-2 mb-3">
              {item.options.map((o, i) => {
                if (!o.trim()) return null;
                const isCrowd = !!crowd && crowd.text.trim() === o.trim();
                const sel = picked === i;
                return (
                  <button key={i} onClick={() => setPicked(i)}
                    className="w-full text-left rounded-xl px-4 py-3.5 transition-colors"
                    style={{
                      backgroundColor: sel ? "#EBF5F3" : "#FAFAF8",
                      border: `2px solid ${sel ? BRAND.primary : isCrowd ? "#FCD34D" : "#EBEBEA"}`,
                    }}>
                    <span className="font-exam text-[16px] leading-relaxed"
                      style={{ color: sel ? BRAND.primary : "#374151", fontWeight: sel ? 600 : 400 }}>
                      {OPT[i]}. {o}
                    </span>
                    {isCrowd && !sel && (
                      <span className="block text-[11.5px] font-semibold mt-1" style={{ color: "#B45309" }}>
                        เพื่อนหลายคนตอบข้อนี้
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ③ เติมเฉพาะตัวเลือกที่ขาด */}
        {missingIdx.length > 0 && !item.gaps.includes("stem") && (
          <div className="rounded-xl px-3.5 py-3 mb-3"
            style={{ backgroundColor: "#FDF6E9", border: "1px dashed #FCD34D" }}>
            <p className="text-[13px] font-bold mb-2" style={{ color: "#B45309" }}>
              ข้อ {missingIdx.map((i) => OPT[i]).join(" และ ")} ยังไม่มีใครจำได้ — จำได้ช่วยเติมให้หน่อย
            </p>
            <div className="space-y-2">
              {missingIdx.map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[15px] font-bold w-5 flex-shrink-0" style={{ color: "#B45309" }}>
                    {OPT[i]}.
                  </span>
                  <input value={fills[i] ?? ""}
                    onChange={(e) => setFills((p) => ({ ...p, [i]: e.target.value }))}
                    placeholder="จำไม่ได้ก็ข้ามได้"
                    className={INPUT} style={{ ...INPUT_STYLE, backgroundColor: "white" }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ④ ไม่มีตัวเลือกเลย → พิมพ์เฉลยตรง ๆ */}
        {!canTap && (
          <div className="mb-3">
            <p className="text-[14px] font-bold mb-2 text-gray-800">
              เฉลยข้อนี้คืออะไร
            </p>
            {crowd && (
              <button onClick={() => setTyped(crowd.text)}
                className="w-full text-left rounded-xl px-4 py-3 mb-2"
                style={{ backgroundColor: "#FDF6E9", border: "2px solid #FCD34D" }}>
                <span className="block text-[11.5px] font-bold mb-0.5" style={{ color: "#B45309" }}>
                  แตะเพื่อใช้คำตอบที่เพื่อนในสนามสอบเสนอ
                </span>
                <span className="font-exam text-[15px]" style={{ color: "#7C2D12" }}>{crowd.text}</span>
              </button>
            )}
            <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={2}
              placeholder="พิมพ์เท่าที่จำได้"
              className={INPUT} style={INPUT_STYLE} />
          </div>
        )}

        {/* ไม่แน่ใจ — เลือกได้ ไม่บังคับ */}
        <button onClick={() => setUnsure((u) => !u)}
          className="flex items-center gap-2 mb-4 mt-1">
          <span className="w-5 h-5 rounded-md flex items-center justify-center text-[12px] font-bold"
            style={{
              backgroundColor: unsure ? "#FEF3C7" : "#F5F5F3",
              border: `1.5px solid ${unsure ? "#FCD34D" : "#E5E4E1"}`,
              color: "#B45309",
            }}>
            {unsure ? "✓" : ""}
          </span>
          <span className="text-[13.5px]" style={{ color: unsure ? "#B45309" : "#A8A8A6" }}>
            ไม่ค่อยแน่ใจ เดา ๆ
          </span>
        </button>

        {err && <p className="text-[13px] mb-2" style={{ color: "#DC2626" }}>{err}</p>}

        {/* ปุ่มส่ง */}
        <button
          onClick={() => {
            const answer = picked !== null ? item.options[picked] : typed.trim();
            send(answer, unsure ? "maybe" : "sure");
          }}
          disabled={busy || (picked === null && !somethingTyped)}
          className="btn-primary w-full py-4 text-[16px] disabled:opacity-35">
          {busy ? "กำลังส่ง…" : "ส่งคำตอบข้อนี้"}
        </button>

        <button onClick={onSkip}
          className="w-full py-3 mt-2 text-[14px] font-medium"
          style={{ color: "#A8A8A6" }}>
          จำข้อนี้ไม่ได้ ข้ามไปข้อถัดไป →
        </button>
      </div>
    </div>
  );
}

// ─── การ์ดในโหมด "ดูทั้งหมด" (อ่านอย่างเดียว + ปุ่มไปกรอก) ────────────────────

function ListCard({
  item, helpers, verdict, onPick,
}: {
  item: RecallSeedItem; helpers: number;
  verdict?: RecallVerdict; onPick: (no: number) => void;
}) {
  const color     = subjectColor(item.subject);
  const crowd     = crowdAnswerFor(item.no);
  const confirmed = verdict?.status === "confirmed";
  const gaps      = confirmed ? item.gaps.filter((g) => g !== "answer") : item.gaps;
  const done      = isComplete(item) || gaps.length === 0;

  return (
    <div className="bg-white rounded-2xl px-4 py-3.5"
      style={{ border: `1px solid ${done ? "#EBEBEA" : "#FCD34D"}` }}>
      <div className="flex items-start gap-2.5 mb-2">
        <span className="text-[13px] font-extrabold flex-shrink-0"
          style={{ color: done ? "#A8A8A6" : "#B45309" }}>{item.no}.</span>
        <p className="font-exam text-[14.5px] leading-relaxed text-gray-900 flex-1">{item.text}</p>
      </div>

      {item.options.length > 0 && (
        <div className="space-y-1 mb-2 pl-6">
          {item.options.map((o, i) => (
            <p key={i} className="font-exam text-[13.5px] leading-relaxed"
              style={{ color: o ? "#4B5563" : "#D97706" }}>
              {OPT[i]}. {o || "— ยังไม่มีใครจำได้ —"}
            </p>
          ))}
        </div>
      )}

      <div className="pl-6 mb-2">
        {confirmed ? (
          <p className="font-exam text-[13.5px] font-semibold" style={{ color: "#15803D" }}>
            ✓ {verdict.answer} <span className="text-[11.5px] font-normal">· ครูอ้อมตรวจแล้ว</span>
          </p>
        ) : item.answer ? (
          <p className="font-exam text-[13.5px]" style={{ color: "#15803D" }}>✓ {item.answer}</p>
        ) : crowd ? (
          <p className="text-[13px]" style={{ color: "#B45309" }}>
            เพื่อนเสนอว่า “{crowd.text}” · ยังไม่ยืนยัน
          </p>
        ) : (
          <p className="text-[13px] font-semibold" style={{ color: "#DC2626" }}>ยังไม่มีเฉลย</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}15`, color }}>
          {SUBJECT_DISPLAY[item.subject] ?? item.subject}
        </span>
        {gaps.map((g) => (
          <span key={g} className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>
            ขาด{GAP_LABEL[g]}
          </span>
        ))}
        {helpers > 0 && (
          <span className="text-[11.5px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
            มีคนช่วยแล้ว {helpers}
          </span>
        )}
      </div>

      {!done && (
        <button onClick={() => onPick(item.no)}
          className="mt-3 w-full py-2.5 rounded-xl text-[13.5px] font-semibold"
          style={{ backgroundColor: "#FDF6E9", border: "1.5px solid #FCD34D", color: "#B45309" }}>
          ช่วยเติมข้อนี้
        </button>
      )}
    </div>
  );
}

// ─── ฟอร์มข้อใหม่ ─────────────────────────────────────────────────────────────

function NewQuestionForm({ onSent }: { onSent: () => void }) {
  const { user } = useAuth();
  const [text,    setText]    = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer,  setAnswer]  = useState("");
  const [subject, setSubject] = useState<SubjectCode | "">("");
  const [unsure,  setUnsure]  = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err,  setErr]  = useState("");

  async function send() {
    if (!user || busy || !text.trim()) return;
    setBusy(true); setErr("");
    try {
      await submitRecall(user, {
        no: null, text, options, answer, subject,
        confidence: unsure ? "maybe" : "sure", note: "",
      });
      setSent(true);
      setText(""); setOptions(["", "", "", ""]); setAnswer("");
      onSent();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      setErr("ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะ");
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
      {sent && (
        <p className="text-[14px] font-semibold text-center py-2.5 rounded-xl mb-4"
          style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
          ส่งแล้ว ขอบคุณมาก 🙏 ส่งข้อถัดไปได้เลย
        </p>
      )}

      <p className="text-[14px] font-bold mb-2 text-gray-800">โจทย์ที่จำได้</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder="ไม่ต้องเป๊ะ จับใจความได้ก็มีค่ามากแล้ว"
        className={INPUT} style={INPUT_STYLE} />

      <p className="text-[14px] font-bold mb-2 mt-4 text-gray-800">
        ตัวเลือก <span className="font-normal text-[13px]" style={{ color: "#A8A8A6" }}>(จำได้กี่ข้อใส่เท่านั้น)</span>
      </p>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[15px] font-bold w-5 flex-shrink-0" style={{ color: "#A8A8A6" }}>
              {OPT[i]}.
            </span>
            <input value={o}
              onChange={(e) => setOptions((p) => p.map((x, xi) => (xi === i ? e.target.value : x)))}
              placeholder="—" className={INPUT} style={INPUT_STYLE} />
          </div>
        ))}
      </div>

      <p className="text-[14px] font-bold mb-2 mt-4 text-gray-800">เฉลยที่คิดว่าถูก</p>
      <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="—"
        className={INPUT} style={INPUT_STYLE} />

      <p className="text-[14px] font-bold mb-2 mt-4 text-gray-800">
        หมวด <span className="font-normal text-[13px]" style={{ color: "#A8A8A6" }}>(ไม่แน่ใจก็ข้ามได้)</span>
      </p>
      <select value={subject} onChange={(e) => setSubject(e.target.value as SubjectCode | "")}
        className="w-full rounded-xl px-3.5 py-3 text-[16px]" style={INPUT_STYLE}>
        <option value="">— ไม่แน่ใจ —</option>
        {SUBJECTS.filter((s) => s.code !== "MOCK").map((s) => (
          <option key={s.code} value={s.code}>{SUBJECT_DISPLAY[s.code]}</option>
        ))}
      </select>

      <button onClick={() => setUnsure((u) => !u)} className="flex items-center gap-2 my-4">
        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[12px] font-bold"
          style={{
            backgroundColor: unsure ? "#FEF3C7" : "#F5F5F3",
            border: `1.5px solid ${unsure ? "#FCD34D" : "#E5E4E1"}`, color: "#B45309",
          }}>
          {unsure ? "✓" : ""}
        </span>
        <span className="text-[13.5px]" style={{ color: unsure ? "#B45309" : "#A8A8A6" }}>
          ไม่ค่อยแน่ใจ เดา ๆ
        </span>
      </button>

      {err && <p className="text-[13px] mb-2" style={{ color: "#DC2626" }}>{err}</p>}

      <button onClick={send} disabled={busy || !text.trim()}
        className="btn-primary w-full py-4 text-[16px] disabled:opacity-35">
        {busy ? "กำลังส่ง…" : "ส่งข้อนี้ให้ครูอ้อม"}
      </button>
    </div>
  );
}

// ─── หน้า ─────────────────────────────────────────────────────────────────────

export default function RecallPage() {
  const guard = useLoginGuard();
  const [mode,     setMode]     = useState<Mode>("queue");
  const [counts,   setCounts]   = useState<Record<string, number>>({});
  const [verdicts, setVerdicts] = useState<Record<number, RecallVerdict>>({});
  const [myCount,  setMyCount]  = useState(0);
  const [cursor,   setCursor]   = useState(0);
  const [handled,  setHandled]  = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    getRecallCounts().then(setCounts).catch(() => {});
    getVerdicts().then(setVerdicts).catch(() => {});
  }, []);
  useEffect(() => { if (guard === "allowed") load(); }, [guard, load]);

  const progress = useMemo(recallProgress, []);
  const queue    = useMemo(buildQueue, []);
  const remaining = queue.filter((i) => !handled.has(i.no));
  const current   = remaining[Math.min(cursor, Math.max(remaining.length - 1, 0))];

  function markDone(no: number) {
    setMyCount((c) => c + 1);
    setCounts((c) => ({ ...c, [String(no)]: (c[String(no)] ?? 0) + 1 }));
    setHandled((h) => new Set(h).add(no));
    setCursor(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function skip() {
    setCursor((c) => (c + 1 >= remaining.length ? 0 : c + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** กด "ช่วยเติมข้อนี้" จากโหมดรายการ → เด้งกลับไปโหมดทีละข้อที่ข้อนั้น */
  function jumpTo(no: number) {
    const idx = remaining.findIndex((i) => i.no === no);
    setMode("queue");
    setCursor(idx >= 0 ? idx : 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (guard !== "allowed") return <AccessGuardSpinner />;

  const doneInQueue = queue.length - remaining.length;

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <div className="max-w-lg mx-auto px-5 pt-6">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: BRAND.primaryDark }}>
          <p className="text-[12px] font-semibold mb-1.5" style={{ color: "#9FE1CB" }}>
            ช่วยกันเก็บข้อสอบ · สป.สธ. 2569
          </p>
          <h1 className="text-[20px] font-bold text-white leading-snug mb-2">
            จำข้อไหนได้ ช่วยเติมให้หน่อยนะ
          </h1>
          <p className="text-[13px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
            รวบรวมได้แล้ว {progress.total} ข้อ ส่วนใหญ่แค่<span className="font-semibold text-white">แตะเลือก ก-ง</span>{" "}
            ไม่ต้องพิมพ์ · จำได้ข้อไหนก็ตอบข้อนั้น ข้ามได้ตลอด —
            <span style={{ color: "#FBBF24" }}> ความจำเลือนเร็ว ช่วยกันใน 2–3 วันนี้</span>
          </p>
          <div className="h-2 rounded-full overflow-hidden mb-2"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress.percent}%`, backgroundColor: "#9FE1CB" }} />
          </div>
          <div className="flex justify-between text-[12px]">
            <span style={{ color: "rgba(255,255,255,0.75)" }}>
              ครบแล้ว {progress.complete}/{progress.total} ข้อ
            </span>
            <span style={{ color: "#FBBF24" }}>ยังไม่มีเฉลย {progress.noAnswer} ข้อ</span>
          </div>
        </div>

        {myCount > 0 && (
          <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
            style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #BBF7D0" }}>
            <span className="text-[20px]">🎉</span>
            <p className="text-[13px] leading-snug" style={{ color: "#15803D" }}>
              คุณช่วยไปแล้ว <span className="font-extrabold">{myCount}</span> ข้อ —
              ขอบคุณมากจริง ๆ ข้อสอบชุดนี้จะกลายเป็นแนวข้อสอบให้รุ่นต่อไป
            </p>
          </div>
        )}

        {/* ── สลับโหมด ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-4">
          {([
            { v: "queue", label: "ช่วยทีละข้อ" },
            { v: "list",  label: `ดูทั้งหมด ${progress.total}` },
            { v: "new",   label: "เพิ่มข้อใหม่" },
          ] as const).map((t) => (
            <button key={t.v} onClick={() => setMode(t.v)}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-colors"
              style={{
                backgroundColor: mode === t.v ? BRAND.primary : "white",
                color: mode === t.v ? "white" : "#6B7280",
                border: `1.5px solid ${mode === t.v ? BRAND.primary : "#EBEBEA"}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── เนื้อหา ───────────────────────────────────────────────────── */}
        {mode === "queue" && (
          remaining.length === 0 ? (
            <div className="bg-white rounded-2xl px-5 py-12 text-center"
              style={{ border: "1px solid #EBEBEA" }}>
              <div className="text-[42px] mb-3">🎉</div>
              <p className="text-[16px] font-bold text-gray-900 mb-1.5">ช่วยครบทุกข้อแล้ว</p>
              <p className="text-[13.5px] leading-relaxed mb-6" style={{ color: "#A8A8A6" }}>
                ขอบคุณมากจริง ๆ นะ ถ้านึกข้อที่ยังไม่มีในลิสต์ออก ส่งเพิ่มได้ที่แท็บ “เพิ่มข้อใหม่”
              </p>
              <button onClick={() => setMode("new")} className="btn-primary px-6 py-3 text-[15px]">
                ส่งข้อที่ยังไม่มีในลิสต์
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[13px] font-semibold" style={{ color: "#B45309" }}>
                  เหลืออีก {remaining.length} ข้อที่ยังขาดข้อมูล
                </p>
                {doneInQueue > 0 && (
                  <p className="text-[12.5px]" style={{ color: "#15803D" }}>ช่วยแล้ว {doneInQueue}</p>
                )}
              </div>
              {current && (
                <QueueCard key={current.no} item={current} onSent={markDone} onSkip={skip} />
              )}
              <p className="text-center text-[12.5px] mt-3" style={{ color: "#A8A8A6" }}>
                ไม่ต้องตอบครบทุกข้อ — ตอบเท่าที่จำได้ก็ช่วยได้มากแล้ว
              </p>
            </>
          )
        )}

        {mode === "list" && (
          <div className="space-y-3">
            {RECALL_ALL.map((item) => (
              <ListCard key={item.no} item={item}
                helpers={counts[String(item.no)] ?? 0}
                verdict={verdicts[item.no]} onPick={jumpTo} />
            ))}
          </div>
        )}

        {mode === "new" && (
          <>
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: "#A8A8A6" }}>
              เจอข้อที่ไม่มีในลิสต์ {progress.total} ข้อนี้ใช่ไหม — ส่งได้ไม่จำกัดจำนวน
              {counts.new ? ` (มีข้อใหม่เข้ามาแล้ว ${counts.new} ข้อ)` : ""}
            </p>
            <NewQuestionForm onSent={() => { setMyCount((c) => c + 1);
              setCounts((c) => ({ ...c, new: (c.new ?? 0) + 1 })); }} />
          </>
        )}

        {/* ── ท้ายหน้า ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl px-4 py-3.5 mt-5"
          style={{ backgroundColor: "#FAFAF8", border: "1px solid #EBEBEA" }}>
          <p className="text-[12px] leading-relaxed" style={{ color: "#A8A8A6" }}>
            ข้อมูลชุดนี้เป็นการบันทึกจากความทรงจำของผู้เข้าสอบ ไม่ใช่ต้นฉบับข้อสอบ
            และยังไม่ผ่านการตรวจสอบ — ครูอ้อมจะตรวจทุกใบก่อนนำไปทำเฉลย
            เราไม่เผยแพร่ชื่อผู้ที่ส่งเข้ามา
          </p>
        </div>

        <Link href="/" className="btn-secondary w-full py-3 text-[14.5px] block text-center mt-4">
          กลับหน้าแรก
        </Link>
      </div>
      <BottomNav />
    </div>
  );
}
