"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getResult, getQuestions } from "@/lib/firestore";
import { useAccessGuard } from "@/lib/use-access-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import type { ExamResult, Question } from "@/lib/types";

// ─── Grade helper ─────────────────────────────────────────────────────────────

function gradeInfo(pct: number) {
  if (pct >= 80)
    return {
      label:   "ผ่านเกณฑ์ดีมาก",
      color:   "#0B6E65",
      bgCard:  "#EBF5F3",
      border:  "#A7D9D3",
    };
  if (pct >= 60)
    return {
      label:   "ผ่านเกณฑ์",
      color:   "#2563EB",          // blue — passing but not excellent
      bgCard:  "#EFF6FF",
      border:  "#BFDBFE",
    };
  return {
    label:   "ไม่ผ่านเกณฑ์",
    color:   "#DC2626",
    bgCard:  "#FEF2F2",
    border:  "#FECACA",
  };
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function formatTime(s: number) {
  if (s < 60) return `${s} วินาที`;
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m} นาที ${sec} วินาที` : `${m} นาที`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultPage() {
  const guard = useAccessGuard();
  const { id } = useParams<{ id: string }>();
  const [result,    setResult]    = useState<ExamResult | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    getResult(id).then(async (r) => {
      if (r) {
        setResult(r);
        const qs = await getQuestions(r.examId);
        setQuestions(qs);
      }
      setLoading(false);
    });
  }, [id]);

  if (guard !== "allowed") return <AccessGuardSpinner />;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{ border: "3px solid #C8E6E3", borderTopColor: "#0B6E65" }}
        />
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="text-center py-24 px-6">
        <p className="text-[17px] font-semibold text-gray-800 mb-2">ไม่พบผลการสอบ</p>
        <p className="text-[13px] mb-8" style={{ color: "#A8A8A6" }}>
          ผลการสอบอาจหมดอายุหรือ URL ไม่ถูกต้อง
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#0B6E65" }}
        >
          ← กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  const g = gradeInfo(result.percentage);

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: "#FAFAF8" }}>
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">

        {/* ── Score card ──────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-7 text-center"
          style={{
            backgroundColor: g.bgCard,
            border: `1px solid ${g.border}`,
          }}
        >
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-0.5" style={{ color: "#A8A8A6" }}>
            ผลการสอบ
          </p>
          <h1 className="text-[17px] font-bold text-gray-900 mb-0.5 leading-snug">
            {result.studentName}
          </h1>
          <p className="text-[12px] mb-6" style={{ color: "#A8A8A6" }}>
            {result.examTitle}
          </p>

          {/* Big score */}
          <div className="inline-flex items-end gap-1.5 mb-2">
            <span className="text-[64px] font-extrabold leading-none" style={{ color: g.color }}>
              {result.score}
            </span>
            <span className="text-[22px] font-medium text-gray-400 mb-2">
              /{result.totalQuestions}
            </span>
          </div>

          <div className="text-[15px] font-semibold mb-6" style={{ color: g.color }}>
            {result.percentage}% · {g.label}
          </div>

          {/* Stats row */}
          <div
            className="flex justify-center gap-8 pt-5"
            style={{ borderTop: `1px solid ${g.border}` }}
          >
            <div className="text-center">
              <div className="text-[17px] font-bold text-gray-900">{result.score}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "#A8A8A6" }}>ตอบถูก</div>
            </div>
            <div className="text-center">
              <div className="text-[17px] font-bold text-gray-900">
                {result.totalQuestions - result.score}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "#A8A8A6" }}>ตอบผิด</div>
            </div>
            <div className="text-center">
              <div className="text-[17px] font-bold text-gray-900">
                {formatTime(result.timeSpent)}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "#A8A8A6" }}>เวลาที่ใช้</div>
            </div>
          </div>
        </div>

        {/* ── Answer review ────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 mb-3">
            เฉลยและคำอธิบาย
          </h2>

          <div className="space-y-3">
            {questions.map((q, qi) => {
              const chosen    = result.answers[qi] ?? -1;
              const isCorrect = chosen === q.correctAnswer;
              const isSkipped = chosen === -1;

              const borderColor = isSkipped
                ? "#D1D5DB"
                : isCorrect
                ? "#22C55E"
                : "#EF4444";

              return (
                <div
                  key={q.id}
                  className="rounded-xl p-5 bg-white"
                  style={{
                    border: "1px solid #EBEBEA",
                    borderLeft: `4px solid ${borderColor}`,
                  }}
                >
                  {/* Question header */}
                  <div className="flex items-start gap-3 mb-3">
                    {/* Status badge */}
                    <span
                      className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold text-white"
                      style={{
                        backgroundColor: isSkipped ? "#9CA3AF" : isCorrect ? "#22C55E" : "#EF4444",
                      }}
                    >
                      {isSkipped ? "–" : isCorrect ? "✓" : "✗"}
                    </span>
                    <p className="text-[13px] font-medium text-gray-900 leading-relaxed">
                      <span className="mr-1" style={{ color: "#A8A8A6" }}>ข้อ {qi + 1}.</span>
                      {q.text}
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-1.5 ml-9">
                    {q.options.map((opt, oi) => {
                      const isAnswer = oi === q.correctAnswer;
                      const isChosen = oi === chosen;
                      const wrongChoice = isChosen && !isCorrect;

                      return (
                        <div
                          key={oi}
                          className="flex items-start gap-2 px-3 py-2 rounded-lg text-[13px]"
                          style={{
                            backgroundColor: isAnswer
                              ? "#EBF5F3"
                              : wrongChoice
                              ? "#FEF2F2"
                              : "transparent",
                            color: isAnswer
                              ? "#0B6E65"
                              : wrongChoice
                              ? "#DC2626"
                              : "#6B7280",
                            textDecoration: wrongChoice ? "line-through" : "none",
                            fontWeight: isAnswer ? 500 : 400,
                          }}
                        >
                          <span className="flex-shrink-0 w-5 font-medium">
                            {["ก", "ข", "ค", "ง"][oi]}.
                          </span>
                          <span className="flex-1">{opt}</span>
                          {isAnswer && (
                            <span
                              className="flex-shrink-0 text-[11px] font-semibold"
                              style={{ color: "#0B6E65" }}
                            >
                              เฉลย
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {q.explanation && (
                    <div
                      className="mt-3 ml-9 p-3 rounded-lg text-[12px] leading-relaxed"
                      style={{
                        backgroundColor: "#FFFBEB",
                        border: "1px solid #FDE68A",
                        color: "#92400E",
                      }}
                    >
                      <span className="font-semibold">คำอธิบาย: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2 pb-4">
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[14px] font-medium transition-colors"
            style={{
              border: "1px solid #E0DFDC",
              color: "#6B7280",
              backgroundColor: "white",
            }}
          >
            ← หน้าหลัก
          </Link>
          <Link
            href={`/exam/${result.examId}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#0B6E65" }}
          >
            ทำอีกครั้ง ↺
          </Link>
        </div>

      </div>
    </div>
  );
}
