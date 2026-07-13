"use client";
/**
 * /daily — Daily Quiz วันละ 10 ข้อ เก็บ streak 🔥 (สมาชิกเท่านั้น)
 * ข้อสอบ+เฉลยมาจาก /api/daily ฝั่ง server — เฉลยเปิดหลังส่งคำตอบเท่านั้น
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { PRICING } from "@/lib/pricing";
import { BRAND } from "@/lib/subjects";
import { SUBJECT_DISPLAY } from "@/lib/types";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";

interface Q { qid: string; text: string; options: string[] }
interface DetailRow {
  qid: string; text: string; options: string[];
  correctAnswer: number; explanation: string; your: number; correct: boolean;
}
type View =
  | { s: "loading" }
  | { s: "no-access" }
  | { s: "error" }
  | { s: "done"; score: number; total: number; streak: number; examTitle: string }
  | { s: "quiz"; examId: string; examTitle: string; subject: string; focus: string; questions: Q[]; streak: number }
  | { s: "result"; score: number; total: number; streak: number; detail: DetailRow[] };

const OPT = ["ก", "ข", "ค", "ง"];

export default function DailyQuizPage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();
  const [view, setView] = useState<View>({ s: "loading" });

  // quiz state
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setView({ s: "loading" });
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/daily", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403) { setView({ s: "no-access" }); return; }
      if (!res.ok) { setView({ s: "error" }); return; }
      const d = await res.json();
      if (d.done) {
        setView({ s: "done", score: d.score, total: d.total, streak: d.streak, examTitle: d.examTitle });
      } else {
        setView({
          s: "quiz", examId: d.quiz.examId, examTitle: d.quiz.examTitle,
          subject: d.quiz.subject ?? "", focus: d.quiz.focus ?? "general",
          questions: d.quiz.questions, streak: d.streak,
        });
        setCurrent(0);
        setAnswers({});
      }
    } catch { setView({ s: "error" }); }
  }, [user]);

  useEffect(() => { if (guard === "allowed") load(); }, [guard, load]);

  async function submit() {
    if (view.s !== "quiz" || !user || submitting) return;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          examId:  view.examId,
          answers: view.questions.map((q) => ({ qid: q.qid, answer: answers[q.qid] ?? -1 })),
        }),
      });
      if (!res.ok) { setView({ s: "error" }); return; }
      const d = await res.json();
      setView({ s: "result", score: d.score, total: d.total, streak: d.streak, detail: d.detail });
      window.scrollTo({ top: 0 });
    } catch { setView({ s: "error" }); }
    finally { setSubmitting(false); }
  }

  if (guard !== "allowed" || view.s === "loading") return <AccessGuardSpinner />;

  // ── ยังไม่มีสิทธิ์ → ชวนปลดล็อก ─────────────────────────────────────────────
  if (view.s === "no-access") {
    return (
      <div className="min-h-screen bg-stone-50 pb-28">
        <div className="max-w-lg mx-auto px-5 pt-14 text-center">
          <div className="text-[44px] mb-3">🔥</div>
          <h1 className="text-[19px] font-bold text-gray-900 mb-2">Daily Quiz — วันละ 10 ข้อ</h1>
          <p className="text-[13.5px] leading-relaxed mb-7 max-w-xs mx-auto" style={{ color: "#A8A8A6" }}>
            ข้อสอบชุดใหม่ทุกวัน เก็บ streak ต่อเนื่อง วัดความพร้อมก่อนสอบจริง
            — สำหรับสมาชิก (เริ่ม ฿{PRICING.app.price})
          </p>
          <div className="space-y-3 max-w-xs mx-auto">
            <Link href="/packages" className="btn-primary w-full py-3.5 text-[15px] block text-center">
              ดูแพ็กเกจ — เริ่ม ฿{PRICING.app.price}
            </Link>
            <Link href="/free" className="btn-secondary w-full py-3.5 text-[15px] block text-center">
              ทดลองทำข้อสอบฟรีก่อน
            </Link>
          </div>
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
          <p className="text-[15px] font-semibold text-gray-800 mb-5">โหลด Daily Quiz ไม่สำเร็จ</p>
          <button onClick={load} className="btn-primary text-sm px-6 py-2.5">ลองใหม่</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── วันนี้ทำแล้ว ────────────────────────────────────────────────────────────
  if (view.s === "done") {
    return (
      <div className="min-h-screen bg-stone-50 pb-28">
        <div className="max-w-lg mx-auto px-5 pt-12">
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "#0B4F48" }}>
            <p className="text-[13px] mb-1" style={{ color: "#9FE1CB" }}>Daily Quiz วันนี้ ✓ เสร็จแล้ว</p>
            <p className="text-[42px] font-extrabold text-white leading-tight">
              {view.score}<span className="text-[20px] font-bold" style={{ color: "#9FE1CB" }}>/{view.total}</span>
            </p>
            <p className="text-[12.5px] mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>จากชุด {view.examTitle}</p>
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
              <span className="text-[16px]">🔥</span>
              <span className="text-[15px] font-extrabold text-white">{view.streak}</span>
              <span className="text-[12px]" style={{ color: "#9FE1CB" }}>วันติดต่อกัน</span>
            </div>
          </div>
          <p className="text-center text-[13px] mt-4 mb-5" style={{ color: "#A8A8A6" }}>
            พรุ่งนี้มีชุดใหม่ — กลับมาต่อ streak นะ
          </p>
          <div className="space-y-3">
            <Link href="/exams" className="btn-primary w-full py-3.5 text-[15px] block text-center">
              ทำข้อสอบชุดเต็มต่อ
            </Link>
            <Link href="/review" className="btn-secondary w-full py-3.5 text-[15px] block text-center">
              ทบทวนข้อที่เคยผิด
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── ผลวันนี้ (หลังส่ง) ──────────────────────────────────────────────────────
  if (view.s === "result") {
    return (
      <div className="min-h-screen bg-stone-50 pb-28">
        <div className="max-w-lg mx-auto px-5 pt-8">
          <div className="rounded-2xl p-6 text-center mb-5" style={{ backgroundColor: "#0B4F48" }}>
            <p className="text-[13px] mb-1" style={{ color: "#9FE1CB" }}>คะแนน Daily Quiz วันนี้</p>
            <p className="text-[42px] font-extrabold text-white leading-tight">
              {view.score}<span className="text-[20px] font-bold" style={{ color: "#9FE1CB" }}>/{view.total}</span>
            </p>
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full mt-2"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
              <span className="text-[16px]">🔥</span>
              <span className="text-[15px] font-extrabold text-white">{view.streak}</span>
              <span className="text-[12px]" style={{ color: "#9FE1CB" }}>วันติดต่อกัน</span>
            </div>
          </div>

          <p className="text-[12.5px] font-bold uppercase tracking-wider mb-2.5" style={{ color: "#A8A8A6" }}>
            เฉลยรายข้อ
          </p>
          <div className="space-y-3 mb-6">
            {view.detail.map((d, i) => (
              <div key={d.qid} className="bg-white rounded-2xl p-4"
                style={{ border: `1px solid ${d.correct ? "#BBF7D0" : "#FECACA"}` }}>
                <p className="text-[13.5px] font-semibold text-gray-900 leading-relaxed mb-2.5">
                  <span className="font-bold" style={{ color: d.correct ? "#15803D" : "#DC2626" }}>
                    {d.correct ? "✓" : "✗"} ข้อ {i + 1}.
                  </span>{" "}
                  {d.text}
                </p>
                <div className="space-y-1.5">
                  {d.options.map((opt, oi) => {
                    const isKey  = oi === d.correctAnswer;
                    const isYour = oi === d.your && !d.correct;
                    return (
                      <div key={oi} className="text-[13px] rounded-lg px-3 py-1.5 leading-relaxed"
                        style={{
                          backgroundColor: isKey ? "#F0FDF4" : isYour ? "#FEF2F2" : "transparent",
                          color: isKey ? "#15803D" : isYour ? "#DC2626" : "#6B7280",
                          fontWeight: isKey || isYour ? 600 : 400,
                        }}>
                        {OPT[oi]}. {opt}{isYour && " ← ที่ตอบ"}
                      </div>
                    );
                  })}
                </div>
                {d.explanation && (
                  <p className="text-[12.5px] leading-relaxed mt-2.5 rounded-lg px-3 py-2"
                    style={{ backgroundColor: "#F5FAF9", color: "#0B6E65" }}>
                    💡 {d.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Link href="/" className="btn-primary w-full py-3.5 text-[15px] block text-center">
            เสร็จแล้ว — กลับหน้าแรก
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── กำลังทำ quiz ────────────────────────────────────────────────────────────
  const q        = view.questions[current];
  const isLast   = current === view.questions.length - 1;
  const answered = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <div className="max-w-lg mx-auto px-5 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[13px] font-bold" style={{ color: BRAND.primary }}>
            🔥 Daily Quiz วันนี้
          </p>
          <span className="text-[12px]" style={{ color: "#A8A8A6" }}>
            ตอบแล้ว {answered}/{view.questions.length}
          </span>
        </div>
        {view.focus === "weak" ? (
          <p className="text-[12px] mb-4">
            <span className="font-bold px-2 py-0.5 rounded-full mr-1.5"
              style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>
              🎯 เจาะจุดอ่อนของคุณ: {SUBJECT_DISPLAY[view.subject] ?? view.subject}
            </span>
            <span style={{ color: "#A8A8A6" }}>จากชุด {view.examTitle}</span>
          </p>
        ) : (
          <p className="text-[12px] mb-4 truncate" style={{ color: "#A8A8A6" }}>
            จากชุด {view.examTitle}
          </p>
        )}

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-5">
          {view.questions.map((qq, i) => (
            <button key={qq.qid} onClick={() => setCurrent(i)}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{
                backgroundColor:
                  i === current ? BRAND.primary
                  : answers[qq.qid] !== undefined ? "#8ECFBF" : "#E5E4E1",
              }} />
          ))}
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl p-5 mb-4" style={{ border: "1px solid #EBEBEA" }}>
          <p className="text-[16px] font-semibold text-gray-900 leading-relaxed mb-4">
            <span style={{ color: "#A8A8A6" }}>{current + 1}.</span> {q.text}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const selected = answers[q.qid] === oi;
              return (
                <button key={oi}
                  onClick={() => setAnswers((a) => ({ ...a, [q.qid]: oi }))}
                  className="w-full text-left rounded-xl px-4 py-3 text-[15px] leading-relaxed transition-colors"
                  style={{
                    backgroundColor: selected ? "#EBF5F3" : "#FAFAF8",
                    border: `1.5px solid ${selected ? BRAND.primary : "#EBEBEA"}`,
                    color: selected ? BRAND.primary : "#374151",
                    fontWeight: selected ? 600 : 400,
                  }}>
                  {OPT[oi]}. {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nav */}
        <div className="flex gap-2.5">
          <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}
            className="btn-secondary flex-1 py-3 disabled:opacity-40">
            ← ก่อนหน้า
          </button>
          {isLast ? (
            <button onClick={submit} disabled={submitting || answered < view.questions.length}
              className="btn-primary flex-1 py-3 disabled:opacity-50">
              {submitting ? "กำลังตรวจ…" : "ส่งคำตอบ ✓"}
            </button>
          ) : (
            <button onClick={() => setCurrent((c) => c + 1)} className="btn-primary flex-1 py-3">
              ถัดไป →
            </button>
          )}
        </div>
        {isLast && answered < view.questions.length && (
          <p className="text-center text-[12px] mt-2.5" style={{ color: "#B45309" }}>
            ยังไม่ได้ตอบ {view.questions.length - answered} ข้อ — แตะจุดด้านบนเพื่อกลับไปตอบ
          </p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
