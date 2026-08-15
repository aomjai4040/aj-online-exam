"use client";
/**
 * /recall — "ช่วยกันเก็บข้อสอบ 69"
 *
 * น้อง ๆ ที่เพิ่งออกจากห้องสอบช่วยกันเติมข้อสอบที่ยังจำได้ ก่อนความจำจะเลือน
 * โครงตั้งต้น 77 ข้อมาจาก recall-seed.ts — หน้านี้ชี้ว่า "ข้อไหนยังขาดอะไร"
 * แล้วรับคำตอบเป็นใบ ๆ ลง recallSubmissions (Aj ตรวจ/รวมเองที่ /admin/recall)
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
type Tab = "gaps" | "all" | "new";

// ─── ฟอร์มเติมข้อเดิม ─────────────────────────────────────────────────────────

function FillForm({
  item, onDone,
}: { item: RecallSeedItem; onDone: () => void }) {
  const { user } = useAuth();
  const [options, setOptions] = useState<string[]>(() => {
    const base = [...(item.options ?? [])];
    while (base.length < 4) base.push("");
    return base.slice(0, 4);
  });
  // เติมเฉลยที่กลุ่มเสนอไว้ให้เลย — คนที่จำได้แค่ "ยืนยัน/แก้" ก็ส่งได้ เร็วกว่าพิมพ์เอง
  const [answer,     setAnswer]     = useState(
    item.answer || crowdAnswerFor(item.no)?.text || "",
  );
  const [stem,       setStem]       = useState("");
  const [confidence, setConfidence] = useState<RecallConfidence>("sure");
  const [note,       setNote]       = useState("");
  const [busy,       setBusy]       = useState(false);
  const [err,        setErr]        = useState("");

  const needStem = item.gaps.includes("stem");
  const filled   = options.some((o) => o.trim()) || answer.trim() || stem.trim();

  async function send() {
    if (!user || busy || !filled) return;
    setBusy(true); setErr("");
    try {
      await submitRecall(user, {
        no:      item.no,
        text:    (needStem && stem.trim()) ? stem.trim() : item.text,
        options,
        answer,
        subject: item.subject,
        confidence,
        note,
      });
      onDone();
    } catch (e) {
      console.error(e);
      setErr("ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะ");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 pt-3.5" style={{ borderTop: "1px dashed #E5E4E1" }}>
      {needStem && (
        <>
          <p className="text-[12px] font-bold mb-1.5" style={{ color: "#B45309" }}>
            โจทย์ (ยังไม่มีใครจำได้ครบ)
          </p>
          <textarea
            value={stem} onChange={(e) => setStem(e.target.value)} rows={2}
            placeholder="พิมพ์โจทย์เท่าที่จำได้…"
            className="w-full rounded-xl px-3 py-2 text-[14px] leading-relaxed mb-3 font-exam"
            style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }}
          />
        </>
      )}

      <p className="text-[12px] font-bold mb-1.5" style={{ color: "#A8A8A6" }}>
        ตัวเลือก — เติมเฉพาะช่องที่จำได้
      </p>
      <div className="space-y-2 mb-3">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[13px] font-bold w-4 flex-shrink-0" style={{ color: "#A8A8A6" }}>
              {OPT[i]}.
            </span>
            <input
              value={o}
              onChange={(e) => setOptions((prev) => prev.map((p, pi) => (pi === i ? e.target.value : p)))}
              placeholder="—"
              className="flex-1 rounded-xl px-3 py-2 text-[14px] font-exam"
              style={{
                border: `1.5px solid ${o.trim() ? "#C3E5DE" : "#EBEBEA"}`,
                backgroundColor: o.trim() ? "#F5FAF9" : "#FAFAF8",
              }}
            />
          </div>
        ))}
      </div>

      <p className="text-[12px] font-bold mb-1.5" style={{ color: "#A8A8A6" }}>
        เฉลยที่คิดว่าถูก
      </p>
      <input
        value={answer} onChange={(e) => setAnswer(e.target.value)}
        placeholder="เช่น ข. อ่าน x-ray ช่วยวินิจฉัยวัณโรค"
        className="w-full rounded-xl px-3 py-2 text-[14px] mb-3 font-exam"
        style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }}
      />

      <p className="text-[12px] font-bold mb-1.5" style={{ color: "#A8A8A6" }}>
        มั่นใจแค่ไหน
      </p>
      <div className="flex gap-2 mb-3">
        {([
          { v: "sure",  label: "มั่นใจ จำได้ชัด" },
          { v: "maybe", label: "ไม่แน่ใจ เดา ๆ" },
        ] as const).map((c) => (
          <button key={c.v} type="button" onClick={() => setConfidence(c.v)}
            className="flex-1 rounded-xl py-2 text-[13px] font-semibold transition-colors"
            style={{
              backgroundColor: confidence === c.v ? BRAND.primarySoft : "#FAFAF8",
              border: `1.5px solid ${confidence === c.v ? BRAND.primary : "#EBEBEA"}`,
              color: confidence === c.v ? BRAND.primary : "#6B7280",
            }}>
            {c.label}
          </button>
        ))}
      </div>

      <input
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุถึงครูอ้อม (ไม่ใส่ก็ได้)"
        className="w-full rounded-xl px-3 py-2 text-[13px] mb-3"
        style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }}
      />

      {err && <p className="text-[12.5px] mb-2" style={{ color: "#DC2626" }}>{err}</p>}

      <button onClick={send} disabled={busy || !filled}
        className="btn-primary w-full py-3 text-[14.5px] disabled:opacity-40">
        {busy ? "กำลังส่ง…" : "ส่งให้ครูอ้อม"}
      </button>
      {!filled && (
        <p className="text-center text-[12px] mt-2" style={{ color: "#A8A8A6" }}>
          เติมอย่างน้อย 1 ช่องก่อนส่ง
        </p>
      )}
    </div>
  );
}

// ─── การ์ดข้อสอบ 1 ข้อ ────────────────────────────────────────────────────────

function QuestionCard({
  item, helpers, verdict, onSent,
}: {
  item: RecallSeedItem; helpers: number;
  verdict?: RecallVerdict; onSent: (no: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const done  = isComplete(item);
  const color = subjectColor(item.subject);
  const crowd = crowdAnswerFor(item.no);

  return (
    <div className="bg-white rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${done ? "#EBEBEA" : "#FCD34D"}` }}>
      <div className="px-4 py-3.5">
        {/* หัวการ์ด */}
        <div className="flex items-start gap-2.5 mb-2">
          <span className="text-[13px] font-extrabold flex-shrink-0"
            style={{ color: done ? "#A8A8A6" : "#B45309" }}>
            {item.no}.
          </span>
          <p className="font-exam text-[14.5px] leading-relaxed text-gray-900 flex-1">
            {item.text}
          </p>
        </div>

        {/* ตัวเลือกที่มี */}
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

        {/* เฉลย — 3 ระดับ: ครูอ้อมยืนยันแล้ว > จำกันมาได้ > กลุ่มเสนอ (ยังไม่ยืนยัน) */}
        <div className="pl-6 mb-2.5">
          {verdict?.status === "confirmed" ? (
            <p className="font-exam text-[13.5px] leading-relaxed font-semibold"
              style={{ color: "#15803D" }}>
              ✓ {verdict.answer} <span className="text-[11.5px] font-normal">· ครูอ้อมตรวจแล้ว</span>
            </p>
          ) : item.answer ? (
            <p className="font-exam text-[13.5px] leading-relaxed" style={{ color: "#15803D" }}>
              ✓ {item.answer}
            </p>
          ) : (
            <p className="text-[13px] font-semibold" style={{ color: "#DC2626" }}>
              ✗ ยังไม่มีเฉลย
            </p>
          )}

          {/* เฉลยที่กลุ่มผู้เข้าสอบเสนอ — แสดงเมื่อยังไม่มีเฉลยของเราและครูอ้อมยังไม่ตัดสิน */}
          {crowd && !item.answer && !verdict && (
            <div className="rounded-xl px-3 py-2 mt-2"
              style={{ backgroundColor: "#FDF6E9", border: "1px dashed #FCD34D" }}>
              <p className="text-[11.5px] font-bold mb-0.5" style={{ color: "#B45309" }}>
                เพื่อนในสนามสอบเสนอว่า {crowd.agree === "high" ? "(หลายคนตอบตรงกัน)" : "(ยังเถียงกันอยู่)"}
              </p>
              <p className="font-exam text-[13.5px] leading-relaxed" style={{ color: "#7C2D12" }}>
                {crowd.text}
              </p>
              <p className="text-[11.5px] mt-1" style={{ color: "#B45309" }}>
                ยังไม่ยืนยัน — ถ้าคุณจำได้ว่าตรงหรือไม่ตรง กดช่วยเติมด้านล่างได้เลย
              </p>
            </div>
          )}
        </div>

        {/* แถบล่าง */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}15`, color }}>
            {SUBJECT_DISPLAY[item.subject] ?? item.subject}
          </span>
          {item.gaps.map((g) => (
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
          {item.note && (
            <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>· {item.note}</span>
          )}
        </div>

        {/* ปุ่ม / ฟอร์ม */}
        {sent ? (
          <p className="mt-3 text-[13px] font-semibold text-center py-2 rounded-xl"
            style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
            ส่งแล้ว ขอบคุณมาก 🙏 ครูอ้อมจะตรวจแล้วรวมให้
          </p>
        ) : open ? (
          <FillForm item={item} onDone={() => { setSent(true); setOpen(false); onSent(item.no); }} />
        ) : (
          <button onClick={() => setOpen(true)}
            className="mt-3 w-full py-2.5 rounded-xl text-[13.5px] font-semibold transition-colors"
            style={{
              backgroundColor: done ? "#FAFAF8" : "#FDF6E9",
              border: `1.5px solid ${done ? "#EBEBEA" : "#FCD34D"}`,
              color: done ? "#6B7280" : "#B45309",
            }}>
            {done ? "แก้ไข / เพิ่มเติมข้อนี้" : "ช่วยเติมข้อนี้"}
          </button>
        )}
      </div>
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
  const [note,    setNote]    = useState("");
  const [confidence, setConfidence] = useState<RecallConfidence>("sure");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err,  setErr]  = useState("");

  async function send() {
    if (!user || busy || !text.trim()) return;
    setBusy(true); setErr("");
    try {
      await submitRecall(user, {
        no: null, text, options, answer, subject, confidence, note,
      });
      setSent(true);
      setText(""); setOptions(["", "", "", ""]); setAnswer(""); setNote("");
      onSent();
    } catch (e) {
      console.error(e);
      setErr("ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะ");
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-2xl p-4" style={{ border: "1px solid #EBEBEA" }}>
      {sent && (
        <p className="text-[13px] font-semibold text-center py-2 rounded-xl mb-3"
          style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
          ส่งแล้ว ขอบคุณมาก 🙏 ส่งข้อถัดไปได้เลย
        </p>
      )}

      <p className="text-[12px] font-bold mb-1.5" style={{ color: "#A8A8A6" }}>โจทย์</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder="พิมพ์โจทย์เท่าที่จำได้ — ไม่ต้องเป๊ะ จับใจความได้ก็มีค่ามาก"
        className="w-full rounded-xl px-3 py-2 text-[14px] leading-relaxed mb-3 font-exam"
        style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }} />

      <p className="text-[12px] font-bold mb-1.5" style={{ color: "#A8A8A6" }}>
        ตัวเลือก (จำได้กี่ข้อก็ใส่เท่านั้น)
      </p>
      <div className="space-y-2 mb-3">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[13px] font-bold w-4 flex-shrink-0" style={{ color: "#A8A8A6" }}>
              {OPT[i]}.
            </span>
            <input value={o}
              onChange={(e) => setOptions((p) => p.map((x, xi) => (xi === i ? e.target.value : x)))}
              placeholder="—"
              className="flex-1 rounded-xl px-3 py-2 text-[14px] font-exam"
              style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }} />
          </div>
        ))}
      </div>

      <p className="text-[12px] font-bold mb-1.5" style={{ color: "#A8A8A6" }}>เฉลยที่คิดว่าถูก</p>
      <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="—"
        className="w-full rounded-xl px-3 py-2 text-[14px] mb-3 font-exam"
        style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }} />

      <p className="text-[12px] font-bold mb-1.5" style={{ color: "#A8A8A6" }}>หมวด (ถ้าพอเดาได้)</p>
      <select value={subject} onChange={(e) => setSubject(e.target.value as SubjectCode | "")}
        className="w-full rounded-xl px-3 py-2 text-[14px] mb-3"
        style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }}>
        <option value="">— ไม่แน่ใจ —</option>
        {SUBJECTS.filter((s) => s.code !== "MOCK").map((s) => (
          <option key={s.code} value={s.code}>{SUBJECT_DISPLAY[s.code]} — {s.label}</option>
        ))}
      </select>

      <div className="flex gap-2 mb-3">
        {([
          { v: "sure",  label: "มั่นใจ จำได้ชัด" },
          { v: "maybe", label: "ไม่แน่ใจ เดา ๆ" },
        ] as const).map((c) => (
          <button key={c.v} type="button" onClick={() => setConfidence(c.v)}
            className="flex-1 rounded-xl py-2 text-[13px] font-semibold transition-colors"
            style={{
              backgroundColor: confidence === c.v ? BRAND.primarySoft : "#FAFAF8",
              border: `1.5px solid ${confidence === c.v ? BRAND.primary : "#EBEBEA"}`,
              color: confidence === c.v ? BRAND.primary : "#6B7280",
            }}>
            {c.label}
          </button>
        ))}
      </div>

      <input value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุถึงครูอ้อม (ไม่ใส่ก็ได้)"
        className="w-full rounded-xl px-3 py-2 text-[13px] mb-3"
        style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }} />

      {err && <p className="text-[12.5px] mb-2" style={{ color: "#DC2626" }}>{err}</p>}

      <button onClick={send} disabled={busy || !text.trim()}
        className="btn-primary w-full py-3 text-[14.5px] disabled:opacity-40">
        {busy ? "กำลังส่ง…" : "ส่งข้อนี้ให้ครูอ้อม"}
      </button>
    </div>
  );
}

// ─── หน้า ─────────────────────────────────────────────────────────────────────

export default function RecallPage() {
  const guard = useLoginGuard();
  const [tab,     setTab]     = useState<Tab>("gaps");
  const [counts,   setCounts]   = useState<Record<string, number>>({});
  const [verdicts, setVerdicts] = useState<Record<number, RecallVerdict>>({});
  const [myCount,  setMyCount]  = useState(0);

  const load = useCallback(() => {
    getRecallCounts().then(setCounts).catch(() => {});
    getVerdicts().then(setVerdicts).catch(() => {});
  }, []);
  useEffect(() => { if (guard === "allowed") load(); }, [guard, load]);

  const progress = useMemo(recallProgress, []);
  const items = useMemo(() => {
    const list = tab === "gaps" ? RECALL_ALL.filter((i) => !isComplete(i)) : RECALL_ALL;
    return tab === "gaps"
      ? [...list].sort((a, b) => b.gaps.length - a.gaps.length || a.no - b.no)
      : list;
  }, [tab]);

  function bump(no: number | null) {
    setMyCount((c) => c + 1);
    const key = no === null ? "new" : String(no);
    setCounts((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));
  }

  if (guard !== "allowed") return <AccessGuardSpinner />;

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
            รวบรวมได้แล้ว {progress.total} ข้อ และมีเฉลยที่เพื่อนในสนามสอบเสนอไว้อีก{" "}
            {progress.withCrowd} ข้อ <span className="font-semibold">รอคนยืนยันว่าตรงหรือไม่ตรง</span> —
            <span style={{ color: "#FBBF24" }}> ความจำเลือนเร็วมาก ช่วยกันภายใน 2–3 วันนี้</span> ได้ครบแน่นอน
          </p>

          {/* แถบความคืบหน้า */}
          <div className="h-2 rounded-full overflow-hidden mb-2"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress.percent}%`, backgroundColor: "#9FE1CB" }} />
          </div>
          <div className="flex justify-between text-[12px]">
            <span style={{ color: "rgba(255,255,255,0.75)" }}>
              ครบแล้ว {progress.complete}/{progress.total} ข้อ
            </span>
            <span style={{ color: "#FBBF24" }}>
              ยังไม่มีเฉลย {progress.noAnswer} ข้อ
            </span>
          </div>
        </div>

        {myCount > 0 && (
          <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
            style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #BBF7D0" }}>
            <span className="text-[20px]">🎉</span>
            <p className="text-[13px] leading-snug" style={{ color: "#15803D" }}>
              วันนี้คุณช่วยไปแล้ว <span className="font-extrabold">{myCount}</span> ครั้ง —
              ขอบคุณมากจริง ๆ นะ ข้อสอบชุดนี้จะกลายเป็นแนวข้อสอบให้รุ่นต่อไป
            </p>
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-4">
          {([
            { v: "gaps", label: `ยังขาด ${progress.incomplete}` },
            { v: "all",  label: `ทุกข้อ ${progress.total}` },
            { v: "new",  label: "เพิ่มข้อใหม่" },
          ] as const).map((t) => (
            <button key={t.v} onClick={() => setTab(t.v)}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-colors"
              style={{
                backgroundColor: tab === t.v ? BRAND.primary : "white",
                color: tab === t.v ? "white" : "#6B7280",
                border: `1.5px solid ${tab === t.v ? BRAND.primary : "#EBEBEA"}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── เนื้อหา ───────────────────────────────────────────────────── */}
        {tab === "new" ? (
          <>
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: "#A8A8A6" }}>
              เจอข้อที่ไม่มีในลิสต์ 77 ข้อนี้ใช่ไหม — ส่งมาได้เลย ส่งได้ไม่จำกัดจำนวน
              {counts.new ? ` (ตอนนี้มีข้อใหม่เข้ามาแล้ว ${counts.new} ข้อ)` : ""}
            </p>
            <NewQuestionForm onSent={() => bump(null)} />
          </>
        ) : (
          <>
            {tab === "gaps" && (
              <p className="text-[13px] leading-relaxed mb-3" style={{ color: "#A8A8A6" }}>
                เรียงข้อที่ขาดมากที่สุดไว้บนสุด — จำได้ข้อไหนกดเติมข้อนั้นได้เลย ไม่ต้องเรียงลำดับ
              </p>
            )}
            <div className="space-y-3">
              {items.map((item) => (
                <QuestionCard key={item.no} item={item}
                  helpers={counts[String(item.no)] ?? 0}
                  verdict={verdicts[item.no]} onSent={bump} />
              ))}
            </div>
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
