"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";
import {
  getWrongQuestions, resolveWrongQuestion, type WrongQuestion,
} from "@/lib/smart-review";
import { getSubjectShort } from "@/lib/types";
import { BRAND } from "@/lib/subjects";

// ─── /review — Smart Review: ทบทวนเฉพาะข้อที่เคยตอบผิด ────────────────────────
// ตอบถูก = หลุดจากคลังทันที | ตอบผิด = อยู่ต่อ ไว้เจอกันรอบหน้า

const OPTS = ["ก", "ข", "ค", "ง"] as const;

type Phase = "loading" | "empty" | "review" | "done";

export default function ReviewPage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();

  const [items,    setItems]    = useState<WrongQuestion[]>([]);
  const [phase,    setPhase]    = useState<Phase>("loading");
  const [index,    setIndex]    = useState(0);
  const [chosen,   setChosen]   = useState<number | null>(null); // null = ยังไม่ตอบข้อนี้
  const [mastered, setMastered] = useState(0);
  const [failed,   setFailed]   = useState(0);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (guard !== "allowed" || !user) return;
    getWrongQuestions(user.uid, 20)
      .then((list) => {
        setItems(list);
        setPhase(list.length > 0 ? "review" : "empty");
      })
      .catch(() => { setError("โหลดข้อทบทวนไม่สำเร็จ กรุณาลองใหม่"); setPhase("empty"); });
  }, [guard, user]);

  if (guard !== "allowed") return <AccessGuardSpinner />;

  const q = items[index];

  function select(oi: number) {
    if (chosen !== null || !q || !user) return; // ตอบได้ครั้งเดียวต่อข้อ
    setChosen(oi);
    if (oi === q.correctAnswer) {
      setMastered((m) => m + 1);
      resolveWrongQuestion(user.uid, q.id).catch(() => {});
    } else {
      setFailed((f) => f + 1);
    }
  }

  function next() {
    if (index + 1 >= items.length) { setPhase("done"); return; }
    setIndex((i) => i + 1);
    setChosen(null);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "#D0EDE9", borderTopColor: BRAND.primary }} />
        <p className="text-[13px]" style={{ color: "#A8A8A6" }}>กำลังเตรียมข้อทบทวน...</p>
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (phase === "empty") {
    return (
      <div className="min-h-screen bg-stone-50 pb-28">
        <div className="max-w-lg mx-auto px-5 pt-16 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ backgroundColor: "#EBF5F3" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="text-[19px] font-bold text-gray-900 mb-2">
            {error ? "โหลดไม่สำเร็จ" : "ไม่มีข้อค้างทบทวน 🎉"}
          </h1>
          <p className="text-[13.5px] leading-relaxed mb-7 max-w-xs mx-auto" style={{ color: "#A8A8A6" }}>
            {error
              ? error
              : "ข้อที่ตอบผิดจากการทำข้อสอบจะถูกเก็บมารอที่นี่โดยอัตโนมัติ ทำข้อสอบต่อได้เลย"}
          </p>
          <Link href="/exams" className="btn-primary text-[14px] px-6 py-3">
            ไปที่คลังข้อสอบ →
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="min-h-screen bg-stone-50 pb-28">
        <div className="max-w-lg mx-auto px-5 pt-14">
          <div className="rounded-2xl p-7 text-center"
            style={{ backgroundColor: "#EBF5F3", border: "1px solid #C3E5DE" }}>
            <p className="text-[12px] font-bold tracking-[0.14em] uppercase mb-4"
              style={{ color: BRAND.primary }}>
              จบรอบทบทวน
            </p>
            <div className="flex items-center justify-center gap-8 mb-5">
              <div>
                <p className="text-[36px] font-extrabold leading-none" style={{ color: BRAND.primary }}>
                  {mastered}
                </p>
                <p className="text-[12.5px] mt-1" style={{ color: "#0B6E65" }}>จำได้แล้ว ✓</p>
              </div>
              <div className="w-px h-12" style={{ backgroundColor: "#C3E5DE" }} />
              <div>
                <p className="text-[36px] font-extrabold leading-none text-red-500">{failed}</p>
                <p className="text-[12.5px] mt-1 text-red-500">ไว้เจอกันรอบหน้า</p>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "#0B6E65", opacity: 0.75 }}>
              {failed > 0
                ? "ข้อที่ยังผิดจะรออยู่ในคลังทบทวน กลับมาฝึกซ้ำได้เสมอ"
                : "เคลียร์หมดทุกข้อ เก่งมาก!"}
            </p>
          </div>

          <div className="flex gap-3 mt-5">
            {failed > 0 && (
              <button
                onClick={() => {
                  setPhase("loading"); setIndex(0); setChosen(null);
                  setMastered(0); setFailed(0);
                  getWrongQuestions(user!.uid, 20)
                    .then((list) => { setItems(list); setPhase(list.length > 0 ? "review" : "empty"); })
                    .catch(() => setPhase("empty"));
                }}
                className="btn-primary flex-1 py-3"
              >
                ทบทวนอีกรอบ ↻
              </button>
            )}
            <Link href="/dashboard" className="btn-secondary flex-1 py-3 text-center">
              กลับ Dashboard
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Review (ทีละข้อ ตอบแล้วเฉลยทันที) ─────────────────────────────────────
  const answered  = chosen !== null;
  const isCorrect = answered && chosen === q.correctAnswer;

  return (
    <div className="min-h-screen bg-stone-50 pb-32">
      {/* Top bar */}
      <div className="sticky top-14 z-30 bg-white/95 backdrop-blur-md"
        style={{ borderBottom: "1px solid #EBEBEA" }}>
        <div className="h-[3px]" style={{ backgroundColor: "#F3F2F0" }}>
          <div className="h-full transition-all duration-300"
            style={{ width: `${((index + 1) / items.length) * 100}%`, backgroundColor: BRAND.primary }} />
        </div>
        <div className="max-w-lg mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold text-gray-900">{index + 1}</span>
            <span className="text-[12px]" style={{ color: "#A8A8A6" }}>/ {items.length}</span>
          </div>
          <span className="text-[12.5px] font-semibold" style={{ color: BRAND.primary }}>
            ⚡ Smart Review
          </span>
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <span style={{ color: BRAND.primary }}>✓ {mastered}</span>
            <span className="text-red-500">✗ {failed}</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-6">
        {/* ที่มาของข้อ */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
            {getSubjectShort(q.subject)}
          </span>
          <span className="text-[12px] truncate" style={{ color: "#C4C4C0" }}>
            จาก: {q.examTitle}
          </span>
          {q.wrongCount > 1 && (
            <span className="text-[11.5px] font-bold px-2 py-[3px] rounded-full"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
              ผิดมาแล้ว {q.wrongCount} ครั้ง
            </span>
          )}
        </div>

        {/* โจทย์ — font-exam: ฟอนต์มีหัว อ่านง่ายกว่า */}
        <p className="font-exam text-[17px] font-semibold text-gray-900 leading-relaxed mb-6">
          {q.text}
        </p>

        {/* ตัวเลือก */}
        <div className="space-y-3">
          {q.options.map((opt, oi) => {
            const isAnswer = oi === q.correctAnswer;
            const isChosen = oi === chosen;
            let bg = "white", border = "1px solid #EBEBEA", color = "#374151";
            if (answered && isAnswer)  { bg = "#EBF5F3"; border = `1.5px solid ${BRAND.primary}`; color = BRAND.primary; }
            if (answered && isChosen && !isAnswer) { bg = "#FEF2F2"; border = "1.5px solid #EF4444"; color = "#DC2626"; }
            return (
              <button
                key={oi}
                onClick={() => select(oi)}
                disabled={answered}
                className="w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-2xl
                           transition-all duration-150 active:scale-[0.98] disabled:active:scale-100"
                style={{ backgroundColor: bg, border }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
                  style={{
                    backgroundColor: answered && isAnswer ? BRAND.primary
                      : answered && isChosen ? "#EF4444" : "#F5F5F3",
                    color: answered && (isAnswer || isChosen) ? "white" : "#6B6B6A",
                  }}>
                  {OPTS[oi]}
                </div>
                <span className="font-exam text-[16px] leading-snug flex-1" style={{ color }}>
                  {opt}
                </span>
                {answered && isAnswer && (
                  <span className="text-[12px] font-bold flex-shrink-0" style={{ color: BRAND.primary }}>
                    ✓ เฉลย
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback + คำอธิบาย */}
        {answered && (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl px-4 py-3 text-[14px] font-bold text-center"
              style={isCorrect
                ? { backgroundColor: "#EBF5F3", color: BRAND.primary }
                : { backgroundColor: "#FEF2F2", color: "#DC2626" }}>
              {isCorrect ? "ถูกต้อง! ข้อนี้หลุดจากคลังทบทวนแล้ว ✓" : "ยังไม่ถูก — ข้อนี้จะรอทบทวนรอบหน้า"}
            </div>
            {q.explanation && (
              <div className="font-exam px-4 py-3 rounded-2xl text-[14px] leading-relaxed"
                style={{ backgroundColor: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
                <span className="font-semibold">คำอธิบาย · </span>
                {q.explanation}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ปุ่มต่อไป */}
      {answered && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md"
          style={{ borderTop: "1px solid #EBEBEA" }}>
          <div className="max-w-lg mx-auto px-5 py-4">
            <button onClick={next} className="btn-primary w-full py-3.5 text-[15px]">
              {index + 1 >= items.length ? "ดูสรุปผล" : "ข้อต่อไป →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
