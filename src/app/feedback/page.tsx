"use client";
/**
 * /feedback — ประเมินการสอน แล้วรับโค้ดส่วนลด ฿100 สำหรับคอร์สถัดไป
 *
 * ทีละคำถามเหมือน /recall: เลือกเสร็จเลื่อนให้เอง ไม่ต้องกดถัดไป (ยกเว้นข้อ
 * ที่เลือกได้หลายอย่าง) — ยิ่งจบเร็ว ยิ่งได้คนตอบเยอะ ซึ่งสำคัญกว่าความละเอียด
 *
 * โค้ดออกจาก /api/feedback ฝั่ง server เท่านั้น และผูกกับบัญชี แชร์ต่อไม่ได้
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { BRAND } from "@/lib/subjects";
import { PRICING } from "@/lib/pricing";
import {
  SURVEY, FEEDBACK_REWARD, missingQuestions,
  type SurveyAnswers, type SurveyQuestion,
} from "@/lib/feedback-types";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

type View =
  | { s: "loading" }
  | { s: "no-access" }
  | { s: "error" }
  | { s: "survey" }
  | { s: "done"; code: string };

const CARD = { border: "1px solid #EBEBEA" } as const;

// ─── ตัวเลือกแบบปุ่มใหญ่ ──────────────────────────────────────────────────────

function Option({
  label, hint, selected, onClick,
}: { label: string; hint?: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl px-4 py-3.5 transition-colors"
      style={{
        backgroundColor: selected ? "#EBF5F3" : "#FAFAF8",
        border: `2px solid ${selected ? BRAND.primary : "#EBEBEA"}`,
      }}>
      <span className="block text-[15.5px] leading-snug"
        style={{ color: selected ? BRAND.primary : "#374151", fontWeight: selected ? 600 : 400 }}>
        {label}
      </span>
      {hint && (
        <span className="block text-[12.5px] mt-0.5" style={{ color: "#A8A8A6" }}>{hint}</span>
      )}
    </button>
  );
}

// ─── คำถามหนึ่งข้อ ────────────────────────────────────────────────────────────

function QuestionView({
  q, value, onChange, onNext,
}: {
  q: SurveyQuestion;
  value: SurveyAnswers[string] | undefined;
  onChange: (v: SurveyAnswers[string]) => void;
  onNext: () => void;
}) {
  /** เลือกแล้วเลื่อนเอง — ใช้กับข้อที่เลือกได้อย่างเดียว */
  function pickAndGo(v: SurveyAnswers[string]) {
    onChange(v);
    setTimeout(onNext, 260);
  }

  if (q.kind === "stars") {
    const cur = typeof value === "number" ? value : 0;
    return (
      <div className="flex justify-center gap-1.5 py-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => pickAndGo(n)}
            className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-[30px] transition-transform active:scale-90"
            style={{ backgroundColor: n <= cur ? "#FDF6E9" : "#FAFAF8",
                     border: `2px solid ${n <= cur ? "#FCD34D" : "#EBEBEA"}` }}>
            <span style={{ filter: n <= cur ? "none" : "grayscale(1) opacity(0.35)" }}>⭐</span>
          </button>
        ))}
      </div>
    );
  }

  if (q.kind === "single") {
    return (
      <div className="space-y-2.5">
        {q.choices!.map((c) => (
          <Option key={c.value} label={c.label} hint={c.hint}
            selected={value === c.value} onClick={() => pickAndGo(c.value)} />
        ))}
      </div>
    );
  }

  if (q.kind === "grid") {
    const rec = (value ?? {}) as Record<string, string>;
    return (
      <div className="space-y-3">
        {q.rows!.map((row) => (
          <div key={row.value}>
            <p className="text-[14.5px] font-semibold text-gray-800 mb-1.5">{row.label}</p>
            <div className="flex gap-2">
              {q.scale!.map((s) => {
                const sel = rec[row.value] === s.value;
                return (
                  <button key={s.value}
                    onClick={() => onChange({ ...rec, [row.value]: s.value })}
                    className="flex-1 rounded-xl py-2.5 text-[13.5px] font-semibold transition-colors"
                    style={{
                      backgroundColor: sel ? "#EBF5F3" : "#FAFAF8",
                      border: `2px solid ${sel ? BRAND.primary : "#EBEBEA"}`,
                      color: sel ? BRAND.primary : "#6B7280",
                    }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (q.kind === "multi") {
    const arr = Array.isArray(value) ? value : [];
    const full = q.max !== undefined && arr.length >= q.max;
    return (
      <div className="space-y-2.5">
        {q.choices!.map((c) => {
          const sel = arr.includes(c.value);
          return (
            <Option key={c.value} label={c.label} hint={c.hint} selected={sel}
              onClick={() => {
                if (sel) onChange(arr.filter((x) => x !== c.value));
                else if (!full) onChange([...arr, c.value]);
              }} />
          );
        })}
        {full && (
          <p className="text-[12.5px] text-center" style={{ color: "#B45309" }}>
            เลือกได้สูงสุด {q.max} ข้อ — เอาข้อเดิมออกก่อนถ้าอยากเปลี่ยน
          </p>
        )}
      </div>
    );
  }

  // text
  return (
    <textarea
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)} rows={5}
      placeholder="พิมพ์ได้เลยค่ะ จะติหรือชมก็ได้"
      className="w-full rounded-xl px-3.5 py-3 text-[16px] leading-relaxed"
      style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }} />
  );
}

// ─── หน้า ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();
  const [view,    setView]    = useState<View>({ s: "loading" });
  const [step,    setStep]    = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState("");
  const [copied,  setCopied]  = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res   = await fetch("/api/feedback", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403) { setView({ s: "no-access" }); return; }
      if (!res.ok) { setView({ s: "error" }); return; }
      const d = await res.json();
      setView(d.done ? { s: "done", code: d.code } : { s: "survey" });
    } catch { setView({ s: "error" }); }
  }, [user]);

  useEffect(() => { if (guard === "allowed") load(); }, [guard, load]);

  async function submit() {
    if (!user || busy) return;
    setBusy(true); setErr("");
    try {
      const token = await user.getIdToken();
      const res   = await fetch("/api/feedback", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ answers }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error === "incomplete" ? "ยังตอบไม่ครบทุกข้อนะคะ" : "ส่งไม่สำเร็จ ลองอีกครั้งนะคะ");
        setBusy(false);
        return;
      }
      setView({ s: "done", code: d.code });
      window.scrollTo({ top: 0 });
    } catch {
      setErr("ส่งไม่สำเร็จ ลองอีกครั้งนะคะ");
      setBusy(false);
    }
  }

  if (guard !== "allowed" || view.s === "loading") return <AccessGuardSpinner />;

  // ── ยังไม่มีคอร์ส ─────────────────────────────────────────────────────────
  if (view.s === "no-access") {
    return (
      <div className="min-h-screen bg-stone-50 pb-28">
        <div className="max-w-lg mx-auto px-5 pt-14 text-center">
          <div className="text-[42px] mb-3">📝</div>
          <h1 className="text-[19px] font-bold text-gray-900 mb-2">แบบประเมินสำหรับสมาชิกคอร์ส</h1>
          <p className="text-[13.5px] leading-relaxed mb-7 max-w-xs mx-auto" style={{ color: "#A8A8A6" }}>
            หน้านี้ให้น้อง ๆ ที่เรียนคอร์สกับพี่อ้อมช่วยประเมินการสอน
            เพื่อเอาไปปรับปรุงรอบหน้าค่ะ
          </p>
          <Link href="/packages" className="btn-primary px-6 py-3 text-[15px] inline-block">
            ดูแพ็กเกจ — เริ่ม ฿{PRICING.app.price}
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (view.s === "error") {
    return (
      <div className="min-h-screen bg-stone-50 pb-28">
        <div className="max-w-lg mx-auto px-5 pt-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-[15px] font-semibold text-gray-800 mb-5">โหลดแบบประเมินไม่สำเร็จ</p>
          <button onClick={load} className="btn-primary text-sm px-6 py-2.5">ลองใหม่</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── ตอบแล้ว → โชว์โค้ด ────────────────────────────────────────────────────
  if (view.s === "done") {
    return (
      <div className="min-h-screen bg-stone-50 pb-28">
        <div className="max-w-lg mx-auto px-5 pt-8">
          <div className="rounded-2xl p-6 text-center mb-4" style={{ backgroundColor: BRAND.primaryDark }}>
            <div className="text-[40px] mb-2">🎁</div>
            <p className="text-[14px] mb-1" style={{ color: "#9FE1CB" }}>
              ขอบคุณที่ช่วยประเมินนะคะ
            </p>
            <p className="text-[17px] font-bold text-white mb-4">
              นี่คือโค้ดส่วนลด ฿{FEEDBACK_REWARD.amount} ของน้อง
            </p>

            <div className="rounded-2xl px-4 py-4 mb-3"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1.5px dashed rgba(255,255,255,0.4)" }}>
              <p className="text-[26px] font-extrabold tracking-widest text-white">{view.code}</p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(view.code)
                  .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
                  .catch(() => {});
              }}
              className="w-full py-3 rounded-xl text-[14.5px] font-bold"
              style={{ backgroundColor: copied ? "#9FE1CB" : "white",
                       color: BRAND.primaryDark }}>
              {copied ? "คัดลอกแล้ว ✓" : "คัดลอกโค้ด"}
            </button>
          </div>

          <div className="bg-white rounded-2xl px-5 py-4 mb-4" style={CARD}>
            <p className="text-[12px] font-bold uppercase tracking-widest mb-3" style={{ color: "#A8A8A6" }}>
              วิธีใช้
            </p>
            <ul className="space-y-2.5 text-[13.5px] leading-relaxed text-gray-700">
              <li>• ใช้ได้กับ<span className="font-semibold">คอร์สไหนก็ได้</span>ที่พี่อ้อมเปิดต่อจากนี้ ไม่ล็อกสนาม</li>
              <li>• กรอกโค้ดตอนสมัครคอร์สในแอป ระบบจะลดให้ ฿{FEEDBACK_REWARD.amount} อัตโนมัติ</li>
              <li>• 1 บัญชีใช้ได้ 1 ครั้ง และผูกกับบัญชีนี้ — ส่งต่อให้คนอื่นใช้ไม่ได้นะคะ</li>
              <li>• ใช้ได้ถึง <span className="font-semibold">{FEEDBACK_REWARD.expiresLabel}</span></li>
            </ul>
            <p className="text-[12.5px] leading-relaxed mt-3 rounded-xl px-3 py-2.5"
              style={{ backgroundColor: "#F5FAF9", color: "#0B6E65" }}>
              ไม่ต้องจดก็ได้ค่ะ โค้ดนี้เก็บไว้ในแอปให้แล้ว
              กลับมาดูที่หน้านี้ได้ตลอดเลย
            </p>
          </div>

          <Link href="/" className="btn-primary w-full py-3.5 text-[15px] block text-center">
            กลับหน้าแรก
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── กำลังทำแบบประเมิน ─────────────────────────────────────────────────────
  const q      = SURVEY[step];
  const isLast = step === SURVEY.length - 1;
  const answered = missingQuestions(answers).every((m) => m.id !== q.id);
  const autoAdvance = q.kind === "stars" || q.kind === "single";

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <div className="max-w-lg mx-auto px-5 pt-6">

        {/* หัวเรื่อง + ของตอบแทน */}
        <div className="rounded-2xl px-4 py-3.5 mb-4 flex items-center gap-3"
          style={{ backgroundColor: "#FDF6E9", border: "1.5px solid #FCD34D" }}>
          <span className="text-[24px]">🎁</span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold leading-tight" style={{ color: "#7C2D12" }}>
              ตอบครบรับโค้ดลด ฿{FEEDBACK_REWARD.amount} ทันที
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "#B45309" }}>
              ใช้กับคอร์สไหนก็ได้ที่พี่อ้อมเปิดต่อจากนี้ · ใช้ได้ถึง {FEEDBACK_REWARD.expiresLabel}
            </p>
          </div>
        </div>

        {/* ความคืบหน้า */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12.5px] font-semibold" style={{ color: BRAND.primary }}>
            ข้อ {step + 1} จาก {SURVEY.length}
          </p>
          <p className="text-[12px]" style={{ color: "#A8A8A6" }}>ใช้เวลาประมาณ 2 นาที</p>
        </div>
        <div className="flex gap-1 mb-5">
          {SURVEY.map((s, i) => (
            <div key={s.id} className="flex-1 h-1.5 rounded-full transition-colors"
              style={{ backgroundColor: i < step ? "#8ECFBF" : i === step ? BRAND.primary : "#E5E4E1" }} />
          ))}
        </div>

        {/* คำถาม */}
        <div className="bg-white rounded-2xl px-5 py-5 mb-4" style={CARD}>
          <h2 className="text-[17px] font-bold text-gray-900 leading-snug mb-1">{q.title}</h2>
          {q.sub && (
            <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#A8A8A6" }}>{q.sub}</p>
          )}
          {!q.sub && <div className="mb-4" />}

          <QuestionView q={q} value={answers[q.id]}
            onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            onNext={() => setStep((s) => Math.min(s + 1, SURVEY.length - 1))} />
        </div>

        {err && (
          <p className="text-[13px] text-center mb-3" style={{ color: "#DC2626" }}>{err}</p>
        )}

        {/* ปุ่มเดิน */}
        <div className="flex gap-2.5">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)}
              className="btn-secondary px-5 py-3.5 text-[15px]">
              ←
            </button>
          )}
          {isLast ? (
            <button onClick={submit} disabled={busy || missingQuestions(answers).length > 0}
              className="btn-primary flex-1 py-3.5 text-[15.5px] disabled:opacity-40">
              {busy ? "กำลังส่ง…" : `ส่งแบบประเมิน · รับโค้ดลด ฿${FEEDBACK_REWARD.amount}`}
            </button>
          ) : (
            <button onClick={() => setStep((s) => s + 1)}
              disabled={!answered && !q.optional}
              className="btn-primary flex-1 py-3.5 text-[15.5px] disabled:opacity-35">
              {q.optional ? "ข้าม" : "ถัดไป →"}
            </button>
          )}
        </div>
        {autoAdvance && !answered && (
          <p className="text-center text-[12.5px] mt-2.5" style={{ color: "#A8A8A6" }}>
            แตะเลือกแล้วระบบเลื่อนให้เอง
          </p>
        )}

        <p className="text-[12px] leading-relaxed text-center mt-6" style={{ color: "#A8A8A6" }}>
          คำตอบใช้เพื่อปรับปรุงคอร์สเท่านั้น พี่อ้อมเห็นเป็นภาพรวม
          และจะไม่เอาไปเปิดเผยเป็นรายบุคคลค่ะ
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
