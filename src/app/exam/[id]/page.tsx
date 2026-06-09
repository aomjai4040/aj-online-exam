"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam, getQuestions, saveResult } from "@/lib/firestore";
import { MOCK_EXAM_LIST, MOCK_EXAM, MOCK_QUESTIONS } from "@/lib/mock-data";
import { saveRecord } from "@/lib/exam-history";
import { saveUserRecord } from "@/lib/user-firestore";
import { useAuth } from "@/lib/auth-context";
import { useAccessGuard } from "@/lib/use-access-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import type { Exam, Question } from "@/lib/types";

// ─── Shuffle helpers ─────────────────────────────────────────────────────────

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle a question's options and remap correctAnswer. Safe for inline review. */
function shuffleOptions(q: Question): Question {
  const perm = shuffleArr([0, 1, 2, 3]);
  return {
    ...q,
    options:       perm.map((i) => q.options[i]) as [string, string, string, string],
    correctAnswer: perm.indexOf(q.correctAnswer),
  };
}

// ─── Types & helpers ─────────────────────────────────────────────────────────

type Phase = "loading" | "intro" | "exam" | "result";

const OPTS = ["ก", "ข", "ค", "ง"] as const;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function gradeInfo(pct: number) {
  if (pct >= 80) return { label: "ผ่านเกณฑ์ดีมาก",   accent: "#0B6E65", bg: "#EBF5F3", border: "#C3E5DE" };
  if (pct >= 60) return { label: "ผ่านเกณฑ์",         accent: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" };
  return         { label: "ยังไม่ผ่านเกณฑ์",          accent: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ExamPage() {
  const guard    = useAccessGuard();
  const { id }   = useParams<{ id: string }>();
  const { user } = useAuth();

  const [exam,      setExam]      = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [phase,     setPhase]     = useState<Phase>("loading");
  const [isMock,    setIsMock]    = useState(false);
  const [name,      setName]      = useState("");
  const [current,   setCurrent]   = useState(0);
  const [answers,   setAnswers]   = useState<number[]>([]);
  const [timeLeft,  setTimeLeft]  = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);

  const startRef    = useRef<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopwatchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [e, qs] = await Promise.all([getExam(id), getQuestions(id)]);
        if (e && qs.length > 0) {
          setExam(e);
          setQuestions(qs);
          setAnswers(new Array(qs.length).fill(-1));
          setIsMock(false);
        } else {
          // Firebase has no questions → use mock data
          const mockMeta = MOCK_EXAM_LIST.find((m) => m.id === id) ?? MOCK_EXAM;
          setExam({ ...mockMeta, id } as Exam);
          setQuestions(MOCK_QUESTIONS);
          setAnswers(new Array(MOCK_QUESTIONS.length).fill(-1));
          setIsMock(true);
        }
      } catch {
        // Firebase not reachable → use mock data
        const mockMeta = MOCK_EXAM_LIST.find((m) => m.id === id) ?? MOCK_EXAM;
        setExam({ ...mockMeta, id } as Exam);
        setQuestions(MOCK_QUESTIONS);
        setAnswers(new Array(MOCK_QUESTIONS.length).fill(-1));
        setIsMock(true);
      }
      setPhase("intro");
    })();
  }, [id]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam" || !exam?.timeLimit) return;
    setTimeLeft(exam.timeLimit * 60);
    countdownRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(countdownRef.current!); submitExam(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Stopwatch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;
    stopwatchRef.current = setInterval(() => {
      setTimeSpent(Math.round((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(stopwatchRef.current!);
  }, [phase]);

  // ── Actions ────────────────────────────────────────────────────────────────
  function startExam() {
    // Mock exams: shuffle question order + options (inline result so no Firestore index issue)
    if (isMock) {
      const shuffled = shuffleArr(questions).map(shuffleOptions);
      setQuestions(shuffled);
      setAnswers(new Array(shuffled.length).fill(-1));
    }
    startRef.current = Date.now();
    setCurrent(0);
    setPhase("exam");
  }

  function select(optIdx: number) {
    setAnswers((prev) => { const n = [...prev]; n[current] = optIdx; return n; });
  }

  function goNext() { if (current < questions.length - 1) setCurrent((c) => c + 1); }
  function goPrev() { if (current > 0) setCurrent((c) => c - 1); }

  async function submitExam(forced = false) {
    if (!forced) {
      const unanswered = answers.filter((a) => a === -1).length;
      if (unanswered > 0 && !confirm(`ยังมี ${unanswered} ข้อที่ยังไม่ตอบ\nต้องการส่งเลยหรือไม่?`)) return;
    }
    clearInterval(countdownRef.current!);
    clearInterval(stopwatchRef.current!);
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    setTimeSpent(elapsed);

    const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0), 0);
    const pct   = Math.round((score / questions.length) * 100);

    // Always persist to localStorage (mock or real exam)
    saveRecord({ examId: id, score, totalQuestions: questions.length, percentage: pct, doneAt: new Date().toISOString() });

    // Also save to Firestore when user is logged in
    if (user && exam) {
      saveUserRecord(user.uid, {
        examId:         id,
        examTitle:      exam.title,
        subject:        exam.subject,
        score,
        totalQuestions: questions.length,
        percentage:     pct,
      }).catch(console.error); // fire-and-forget
    }

    if (!isMock && exam) {
      try {
        await saveResult({
          examId: id,
          examTitle: exam.title,
          studentName: name.trim() || "ผู้สอบ",
          answers,
          score,
          totalQuestions: questions.length,
          percentage: pct,
          timeSpent: elapsed,
        });
      } catch { /* show inline result even if save fails */ }
    }
    setPhase("result");
  }

  function retakeExam() {
    setAnswers(new Array(questions.length).fill(-1));
    setCurrent(0);
    setTimeSpent(0);
    startRef.current = Date.now();
    setPhase("exam");
  }

  if (guard !== "allowed") return <AccessGuardSpinner />;

  // ═══════════════════════════════════════════════════════════════════════════
  // ── LOADING ────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "#D0EDE9", borderTopColor: "#0B6E65" }}
        />
        <p className="text-[13px]" style={{ color: "#A8A8A6" }}>กำลังโหลดข้อสอบ...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-5 text-center">
        <p className="text-[15px] font-semibold text-gray-700">ไม่พบชุดข้อสอบนี้</p>
        <Link href="/" className="btn-primary text-sm">← กลับหน้าหลัก</Link>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── INTRO ──────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-stone-50 pb-16">
        <div className="max-w-lg mx-auto px-5 pt-8">

          {/* Back link */}
          <Link
            href="/exams"
            className="inline-flex items-center gap-1.5 text-[13px] mb-8 transition-colors"
            style={{ color: "#A8A8A6" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            คลังข้อสอบ
          </Link>

          {/* Subject badge */}
          <span
            className="inline-block text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-full mb-3"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
          >
            {exam.subject}
          </span>

          {/* Title */}
          <h1 className="text-[1.5rem] font-bold text-gray-900 leading-snug tracking-tight mb-2">
            {exam.title}
          </h1>
          {exam.description && (
            <p className="text-[13px] leading-relaxed mb-7" style={{ color: "#A8A8A6" }}>
              {exam.description}
            </p>
          )}

          {/* Stat row */}
          <div
            className="flex gap-8 py-5 mb-7"
            style={{ borderTop: "1px solid #EBEBEA", borderBottom: "1px solid #EBEBEA" }}
          >
            {[
              { value: exam.questionCount, unit: "ข้อสอบ" },
              ...(exam.timeLimit > 0 ? [{ value: exam.timeLimit, unit: "นาที" }] : []),
              { value: 4, unit: "ตัวเลือก" },
            ].map((s, i, arr) => (
              <div key={i} className="flex items-center gap-8">
                <div>
                  <div className="text-[1.75rem] font-extrabold text-gray-900 leading-none">{s.value}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#A8A8A6" }}>{s.unit}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="w-px h-8" style={{ backgroundColor: "#EBEBEA" }} />
                )}
              </div>
            ))}
          </div>

          {/* Name input (optional) */}
          <div className="mb-7">
            <label className="label">ชื่อผู้สอบ <span style={{ color: "#C4C4C0" }}>(ไม่บังคับ)</span></label>
            <input
              className="input"
              placeholder="กรอกชื่อ-นามสกุล..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startExam()}
            />
          </div>

          {/* CTA */}
          <button className="btn-primary w-full py-3.5 text-[15px]" onClick={startExam}>
            เริ่มทำข้อสอบ
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {isMock && (
            <p className="text-center mt-4 text-[11px]" style={{ color: "#C4C4C0" }}>
              ข้อมูลจำลอง (Demo Mode)
            </p>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── RESULT ─────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "result") {
    const score   = questions.reduce((acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0), 0);
    const pct     = Math.round((score / questions.length) * 100);
    const g       = gradeInfo(pct);
    const skipped = answers.filter((a) => a === -1).length;
    const wrong   = questions.length - score - skipped;

    return (
      <div className="min-h-screen bg-stone-50 pb-16">
        <div className="max-w-lg mx-auto px-5 pt-8">

          {/* Score card */}
          <div
            className="rounded-2xl p-6 mb-5 text-center"
            style={{ backgroundColor: g.bg, border: `1px solid ${g.border}` }}
          >
            <p
              className="text-[10.5px] font-bold tracking-[0.14em] uppercase mb-4"
              style={{ color: g.accent }}
            >
              ผลการสอบ{name ? ` · ${name}` : ""}
            </p>

            {/* Score display */}
            <div className="flex items-end justify-center gap-1 mb-1">
              <span className="text-[4.5rem] font-extrabold leading-none" style={{ color: g.accent }}>
                {score}
              </span>
              <span className="text-[1.75rem] font-bold pb-3" style={{ color: `${g.accent}60` }}>
                /{questions.length}
              </span>
            </div>
            <p className="text-[14px] font-semibold mb-5" style={{ color: g.accent }}>
              {pct}% · {g.label}
            </p>

            {/* Stats */}
            <div
              className="flex items-center justify-center gap-8 pt-4"
              style={{ borderTop: `1px solid ${g.border}` }}
            >
              <div>
                <div className="text-[1rem] font-bold" style={{ color: "#0B6E65" }}>{score}</div>
                <div className="text-[11px]" style={{ color: "#A8A8A6" }}>ถูก</div>
              </div>
              <div>
                <div className="text-[1rem] font-bold text-red-500">{wrong}</div>
                <div className="text-[11px]" style={{ color: "#A8A8A6" }}>ผิด</div>
              </div>
              {skipped > 0 && (
                <div>
                  <div className="text-[1rem] font-bold" style={{ color: "#A8A8A6" }}>{skipped}</div>
                  <div className="text-[11px]" style={{ color: "#A8A8A6" }}>ข้าม</div>
                </div>
              )}
              <div>
                <div className="text-[1rem] font-bold text-gray-700">{formatTime(timeSpent)}</div>
                <div className="text-[11px]" style={{ color: "#A8A8A6" }}>เวลา</div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mb-8">
            <button className="btn-secondary flex-1 py-3" onClick={retakeExam}>
              ทำซ้ำ
            </button>
            <Link href="/exams" className="btn-primary flex-1 py-3 text-center">
              ชุดอื่น →
            </Link>
          </div>

          {/* Divider */}
          <div className="h-px mb-6" style={{ backgroundColor: "#EBEBEA" }} />

          {/* Review label */}
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-5" style={{ color: "#A8A8A6" }}>
            เฉลยและคำอธิบาย
          </p>

          {/* Answer review */}
          <div className="space-y-4 pb-4">
            {questions.map((q, qi) => {
              const chosen    = answers[qi];
              const correct   = q.correctAnswer;
              const isCorrect = chosen === correct;
              const isSkipped = chosen === -1;
              const borderColor = isSkipped ? "#D4D4D0" : isCorrect ? "#0B6E65" : "#EF4444";

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl p-4"
                  style={{ border: "1px solid #EBEBEA", borderLeft: `3px solid ${borderColor}` }}
                >
                  {/* Q header */}
                  <div className="flex items-start gap-3 mb-3.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                                 text-[11px] font-bold text-white mt-0.5"
                      style={{ backgroundColor: borderColor }}
                    >
                      {isSkipped ? "–" : isCorrect ? "✓" : "✗"}
                    </div>
                    <p className="text-[13px] font-semibold text-gray-900 leading-relaxed">
                      <span className="font-normal" style={{ color: "#A8A8A6" }}>ข้อ {qi + 1} · </span>
                      {q.text}
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-1.5 ml-9">
                    {q.options.map((opt, oi) => {
                      const isAnswer    = oi === correct;
                      const isWrong     = oi === chosen && !isCorrect && !isSkipped;
                      return (
                        <div
                          key={oi}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px]"
                          style={{
                            backgroundColor: isAnswer ? "#EBF5F3" : isWrong ? "#FEF2F2" : "transparent",
                            color:           isAnswer ? "#0B6E65" : isWrong ? "#DC2626" : "#6B6B6A",
                            textDecoration:  isWrong ? "line-through" : "none",
                          }}
                        >
                          <span
                            className="font-bold w-5 flex-shrink-0"
                            style={{ color: isAnswer ? "#0B6E65" : isWrong ? "#DC2626" : "#C4C4C0" }}
                          >
                            {OPTS[oi]}.
                          </span>
                          <span className="flex-1">{opt}</span>
                          {isAnswer && (
                            <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#0B6E65" }}>
                              ✓ เฉลย
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {q.explanation && (
                    <div
                      className="mt-3 ml-9 px-3 py-2.5 rounded-xl text-[12px] leading-relaxed"
                      style={{ backgroundColor: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}
                    >
                      <span className="font-semibold">คำอธิบาย · </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── EXAM (one question at a time) ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const q        = questions[current];
  const answered = answers.filter((a) => a !== -1).length;
  const isLast   = current === questions.length - 1;
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-stone-50 pb-28">

      {/* ── Sticky top bar ──────────────────────────────────────────────────── */}
      <div
        className="sticky top-14 z-30 bg-white/95 backdrop-blur-md"
        style={{ borderBottom: "1px solid #EBEBEA" }}
      >
        {/* Thin progress bar */}
        <div className="h-[3px]" style={{ backgroundColor: "#F3F2F0" }}>
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%`, backgroundColor: "#0B6E65" }}
          />
        </div>

        <div className="max-w-lg mx-auto px-5 h-12 flex items-center justify-between">
          {/* Counter */}
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold text-gray-900">{current + 1}</span>
            <span className="text-[12px]" style={{ color: "#A8A8A6" }}>/ {questions.length}</span>
          </div>

          {/* Title (truncated) */}
          <span className="text-[12px] truncate max-w-[120px]" style={{ color: "#A8A8A6" }}>
            {exam.title}
          </span>

          {/* Timer or answered count */}
          {exam.timeLimit > 0 ? (
            <span
              className="text-[13px] font-semibold font-mono tabular-nums"
              style={{ color: timeLeft < 60 ? "#EF4444" : "#6B6B6A" }}
            >
              {formatTime(timeLeft)}
            </span>
          ) : (
            <span className="text-[12px]" style={{ color: "#A8A8A6" }}>
              ตอบแล้ว {answered}/{questions.length}
            </span>
          )}
        </div>
      </div>

      {/* ── Question area ──────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 pt-6">

        {/* Subject + question number */}
        <div className="flex items-center gap-2 mb-5">
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
          >
            {exam.subject}
          </span>
          <span className="text-[12px]" style={{ color: "#C4C4C0" }}>
            ข้อที่ {current + 1}
          </span>
        </div>

        {/* Question text */}
        <p className="text-[15px] font-semibold text-gray-900 leading-relaxed mb-7">
          {q.text}
        </p>

        {/* Options */}
        <div className="space-y-3">
          {q.options.map((opt, oi) => {
            const selected = answers[current] === oi;
            return (
              <button
                key={oi}
                onClick={() => select(oi)}
                className="w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-2xl
                           transition-all duration-150 active:scale-[0.98]"
                style={{
                  backgroundColor: selected ? "#EBF5F3" : "white",
                  border: selected ? "1.5px solid #0B6E65" : "1px solid #EBEBEA",
                  boxShadow: selected ? "0 0 0 3px rgba(11,110,101,0.08)" : "none",
                }}
              >
                {/* Letter badge */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                             text-[13px] font-bold transition-all duration-150"
                  style={{
                    backgroundColor: selected ? "#0B6E65" : "#F5F5F3",
                    color:           selected ? "white"   : "#6B6B6A",
                  }}
                >
                  {OPTS[oi]}
                </div>
                <span
                  className="text-[13.5px] leading-snug transition-colors duration-150"
                  style={{
                    color:      selected ? "#0B6E65" : "#374151",
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {opt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dot progress navigator */}
        <div className="flex justify-center items-center gap-1.5 mt-8 flex-wrap">
          {questions.map((_, qi) => {
            const isCurrent  = qi === current;
            const isAnswered = answers[qi] !== -1;
            return (
              <button
                key={qi}
                onClick={() => setCurrent(qi)}
                className="rounded-full transition-all duration-200"
                style={{
                  width:           isCurrent ? 22 : 8,
                  height:          8,
                  backgroundColor: isCurrent   ? "#0B6E65"
                                 : isAnswered  ? "#86C5BE"
                                 :               "#E0DFDC",
                }}
                title={`ข้อ ${qi + 1}`}
              />
            );
          })}
        </div>
      </div>

      {/* ── Fixed bottom navigation ─────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md"
        style={{ borderTop: "1px solid #EBEBEA" }}
      >
        <div className="max-w-lg mx-auto px-5 py-4 flex gap-3">
          <button
            onClick={goPrev}
            disabled={current === 0}
            className="btn-secondary flex-1 py-3 disabled:opacity-30"
          >
            ← ข้อก่อน
          </button>

          {isLast ? (
            <button
              onClick={() => submitExam()}
              className="btn-primary flex-1 py-3"
            >
              ส่งข้อสอบ ✓
            </button>
          ) : (
            <button
              onClick={goNext}
              className="btn-primary flex-1 py-3"
            >
              ข้อต่อไป →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
