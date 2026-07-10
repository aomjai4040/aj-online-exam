"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getExam, getQuestions, saveResult } from "@/lib/firestore";
import { saveRecord } from "@/lib/exam-history";
import { saveUserRecord } from "@/lib/user-firestore";
import { useAuth } from "@/lib/auth-context";
import { getUserAccess, decideExamAccess } from "@/lib/access";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import type { Exam, Question } from "@/lib/types";

// ─── Types & helpers ─────────────────────────────────────────────────────────

type Phase = "loading" | "intro" | "exam" | "result" | "error" | "locked";

// ─── Autosave (กันคำตอบหายเมื่อ refresh / สลับแอปบนมือถือ) ────────────────────

interface SavedProgress {
  answers: number[];
  current: number;
  elapsed: number;  // วินาทีที่ใช้ไปแล้ว
  qCount:  number;  // ไว้เช็คว่าชุดข้อสอบยังเป็นชุดเดิม
  savedAt: number;
}

const PROGRESS_TTL = 24 * 60 * 60 * 1000; // เก็บไม่เกิน 24 ชม.

function progressKey(id: string) { return `exam-progress-${id}`; }

function loadProgress(id: string, qCount: number): SavedProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(id));
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedProgress;
    if (p.qCount !== qCount) return null;                 // ชุดข้อสอบถูกแก้ไประหว่างทาง
    if (Date.now() - p.savedAt > PROGRESS_TTL) return null;
    if (!p.answers.some((a) => a !== -1)) return null;    // ยังไม่ได้ตอบอะไรเลย
    return p;
  } catch { return null; }
}

function saveProgress(id: string, p: SavedProgress) {
  try { localStorage.setItem(progressKey(id), JSON.stringify(p)); } catch { /* quota */ }
}

function clearProgress(id: string) {
  try { localStorage.removeItem(progressKey(id)); } catch { /* noop */ }
}

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
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [exam,      setExam]      = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [phase,     setPhase]     = useState<Phase>("loading");
  const [locked,    setLocked]    = useState<Exam | null>(null); // ชุดที่ยังไม่มีสิทธิ์ (แสดงหน้าปลดล็อก)
  const [name,      setName]      = useState("");
  const [current,   setCurrent]   = useState(0);
  const [answers,   setAnswers]   = useState<number[]>([]);
  const [timeLeft,  setTimeLeft]  = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [saved,     setSaved]     = useState<SavedProgress | null>(null);

  const startRef    = useRef<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopwatchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // answers ตัวจริงสำหรับ submit — กัน stale closure ตอน timer หมดเวลา
  // (interval ของ countdown จับ state answers ณ ตอนเริ่มสอบ ถ้าใช้ state ตรง ๆ
  //  การ auto-submit ตอนหมดเวลาจะเห็นคำตอบว่างทั้งหมด)
  const answersRef = useRef<number[]>([]);

  function setAnswersBoth(next: number[]) {
    answersRef.current = next;
    setAnswers(next);
  }

  // ── Load data ──────────────────────────────────────────────────────────────
  // ลำดับ: โหลด meta ก่อน → ตรวจสิทธิ์ → ดึงคำถามเฉพาะเมื่อมีสิทธิ์
  // (ไม่ fetch คำถามของชุดที่ล็อก — กันเนื้อหารั่วไปให้คนที่ยังไม่ซื้อ)
  const loadExam = useCallback(async () => {
    if (authLoading) return;            // รอ auth พร้อมก่อน
    if (!user) {                        // ยังไม่ login → ไป login แล้วกลับมา
      router.replace(`/login?from=${encodeURIComponent(`/exam/${id}`)}`);
      return;
    }
    setPhase("loading");
    setLocked(null);
    try {
      const e = await getExam(id);
      if (!e) { setExam(null); setPhase("error"); return; }

      // ตรวจสิทธิ์แบบ per-package
      const access  = await getUserAccess(user.uid);
      const verdict = decideExamAccess(e, user.uid, access);
      if (verdict === "locked") { setLocked(e); setPhase("locked"); return; }

      // มีสิทธิ์ → ดึงคำถาม
      const qs = await getQuestions(id);
      if (qs.length === 0) { setExam(e); setPhase("error"); return; }
      setExam(e);
      setQuestions(qs);
      answersRef.current = new Array(qs.length).fill(-1);
      setAnswers(answersRef.current);
      setSaved(loadProgress(id, qs.length));
      setPhase("intro");
    } catch {
      setPhase("error");      // โหลดไม่สำเร็จ — แสดงปุ่มลองใหม่ ไม่ใช้ข้อมูลจำลอง
    }
  }, [id, user, authLoading, router]);

  useEffect(() => { loadExam(); }, [loadExam]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam" || !exam?.timeLimit) return;
    // หักเวลาที่ใช้ไปแล้ว (กรณีทำต่อจากที่ค้างไว้ startRef ถูกตั้งย้อนหลัง)
    const alreadyUsed = Math.round((Date.now() - startRef.current) / 1000);
    setTimeLeft(Math.max(exam.timeLimit * 60 - alreadyUsed, 0));
    countdownRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(countdownRef.current!); submitExam(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Autosave ทุกครั้งที่คำตอบ/ข้อปัจจุบันเปลี่ยน ─────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;
    saveProgress(id, {
      answers,
      current,
      elapsed: Math.round((Date.now() - startRef.current) / 1000),
      qCount:  questions.length,
      savedAt: Date.now(),
    });
  }, [answers, current, phase, id, questions.length]);

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
    clearProgress(id);          // เริ่มใหม่ = ทิ้งความคืบหน้าเก่า
    setSaved(null);
    setAnswersBoth(new Array(questions.length).fill(-1));
    startRef.current = Date.now();
    setCurrent(0);
    setPhase("exam");
  }

  /** ทำต่อจากที่ค้างไว้ (จาก autosave) */
  function resumeExam(p: SavedProgress) {
    setAnswersBoth([...p.answers]);
    setCurrent(Math.min(p.current, questions.length - 1));
    startRef.current = Date.now() - p.elapsed * 1000; // ให้ timer เดินต่อจากเดิม
    setPhase("exam");
  }

  function select(optIdx: number) {
    const n = [...answersRef.current];
    n[current] = optIdx;
    setAnswersBoth(n);
  }

  function goNext() { if (current < questions.length - 1) setCurrent((c) => c + 1); }
  function goPrev() { if (current > 0) setCurrent((c) => c - 1); }

  async function submitExam(forced = false) {
    // ใช้ ref ไม่ใช่ state — ตอน timer หมดเวลา closure ของ interval
    // เห็น state เก่า แต่ ref เห็นคำตอบล่าสุดเสมอ
    const finalAnswers = answersRef.current;

    if (!forced) {
      const unanswered = finalAnswers.filter((a) => a === -1).length;
      if (unanswered > 0 && !confirm(`ยังมี ${unanswered} ข้อที่ยังไม่ตอบ\nต้องการส่งเลยหรือไม่?`)) return;
    }
    clearInterval(countdownRef.current!);
    clearInterval(stopwatchRef.current!);
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    setTimeSpent(elapsed);
    setAnswers([...finalAnswers]); // sync state ให้หน้าเฉลยเห็นคำตอบชุดเดียวกัน
    clearProgress(id);             // ส่งแล้ว — ทิ้ง autosave

    const score = questions.reduce((acc, q, i) => acc + (finalAnswers[i] === q.correctAnswer ? 1 : 0), 0);
    const pct   = Math.round((score / questions.length) * 100);

    // Persist to localStorage
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

    if (exam) {
      try {
        await saveResult({
          examId: id,
          examTitle: exam.title,
          studentName: name.trim() || "ผู้สอบ",
          answers: finalAnswers,
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
    clearProgress(id);
    setAnswersBoth(new Array(questions.length).fill(-1));
    setCurrent(0);
    setTimeSpent(0);
    startRef.current = Date.now();
    setPhase("exam");
  }

  // รอ auth / กำลังพาไป login
  if (authLoading || !user) return <AccessGuardSpinner />;

  // ═══════════════════════════════════════════════════════════════════════════
  // ── LOCKED (ยังไม่มีสิทธิ์ในชุดนี้) ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "locked" && locked) {
    return (
      <div className="min-h-screen bg-stone-50 pb-16">
        <div className="max-w-lg mx-auto px-5 pt-8">
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

          {/* Lock hero */}
          <div className="rounded-2xl p-6 text-center mb-5"
            style={{ background: "linear-gradient(160deg, #0B6E65 0%, #0d9488 100%)" }}>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="white"
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <p className="text-[12px] font-bold tracking-widest uppercase text-white/70 mb-1">
              เนื้อหาล็อกอยู่
            </p>
            <h1 className="text-[19px] font-bold text-white leading-snug mb-1">{locked.title}</h1>
            <p className="text-[13px] text-white/80">
              {locked.subject} · {locked.questionCount} ข้อ
            </p>
          </div>

          <p className="text-[13px] text-center leading-relaxed mb-6" style={{ color: "#6B6B6A" }}>
            ปลดล็อกชุดนี้เพื่อทำข้อสอบพร้อมเฉลยละเอียด
            <br />
            หากมีรหัสเปิดใช้งานอยู่แล้ว กรอกได้เลย
          </p>

          <div className="space-y-3">
            <Link href="/packages" className="btn-primary w-full py-3.5 text-[15px] text-center block">
              ดูแพ็กเกจ & สั่งซื้อ
            </Link>
            <Link href="/activate" className="btn-secondary w-full py-3.5 text-[15px] text-center block">
              กรอกรหัสเปิดใช้งาน
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

  if (phase === "error" || !exam) {
    const notFound = phase === "error" && exam === null;
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 px-5 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
          style={{ backgroundColor: "#FEF2F2" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-[16px] font-bold text-gray-900">
          {notFound ? "ไม่พบชุดข้อสอบนี้" : "โหลดข้อสอบไม่สำเร็จ"}
        </p>
        <p className="text-[13px] max-w-xs" style={{ color: "#A8A8A6" }}>
          {notFound
            ? "ชุดข้อสอบอาจถูกลบหรือยังไม่เปิดใช้งาน"
            : "อาจเป็นปัญหาการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่อีกครั้ง"}
        </p>
        <div className="flex gap-3 mt-3">
          {!notFound && (
            <button onClick={loadExam} className="btn-primary text-sm px-6 py-2.5">
              ลองใหม่
            </button>
          )}
          <Link href="/exams" className="btn-secondary text-sm px-6 py-2.5">
            ← คลังข้อสอบ
          </Link>
        </div>
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
            className="inline-block text-[12px] font-bold tracking-wide px-2.5 py-1 rounded-full mb-3"
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
                  <div className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>{s.unit}</div>
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

          {/* Resume banner — มีความคืบหน้าค้างจาก autosave */}
          {saved && (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ backgroundColor: "#EBF5F3", border: "1px solid #C3E5DE" }}
            >
              <p className="text-[13.5px] font-bold mb-0.5" style={{ color: "#0B6E65" }}>
                มีข้อสอบที่ทำค้างไว้
              </p>
              <p className="text-[12px] mb-3" style={{ color: "#0B6E65", opacity: 0.75 }}>
                ตอบไปแล้ว {saved.answers.filter((a) => a !== -1).length}/{saved.qCount} ข้อ
                {exam.timeLimit > 0 && ` · ใช้เวลาไป ${Math.round(saved.elapsed / 60)} นาที`}
              </p>
              <button
                className="btn-primary w-full py-3 text-[14px]"
                onClick={() => resumeExam(saved)}
              >
                ทำต่อจากเดิม
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}

          {/* CTA */}
          <button
            className={saved ? "btn-secondary w-full py-3.5 text-[15px]" : "btn-primary w-full py-3.5 text-[15px]"}
            onClick={startExam}
          >
            {saved ? "เริ่มใหม่ตั้งแต่ข้อแรก" : "เริ่มทำข้อสอบ"}
            {!saved && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </button>
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
              className="text-[12px] font-bold tracking-[0.14em] uppercase mb-4"
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
                <div className="text-[12px]" style={{ color: "#A8A8A6" }}>ถูก</div>
              </div>
              <div>
                <div className="text-[1rem] font-bold text-red-500">{wrong}</div>
                <div className="text-[12px]" style={{ color: "#A8A8A6" }}>ผิด</div>
              </div>
              {skipped > 0 && (
                <div>
                  <div className="text-[1rem] font-bold" style={{ color: "#A8A8A6" }}>{skipped}</div>
                  <div className="text-[12px]" style={{ color: "#A8A8A6" }}>ข้าม</div>
                </div>
              )}
              <div>
                <div className="text-[1rem] font-bold text-gray-700">{formatTime(timeSpent)}</div>
                <div className="text-[12px]" style={{ color: "#A8A8A6" }}>เวลา</div>
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
          <p className="text-[12px] font-bold tracking-[0.12em] uppercase mb-5" style={{ color: "#A8A8A6" }}>
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
                                 text-[12px] font-bold text-white mt-0.5"
                      style={{ backgroundColor: borderColor }}
                    >
                      {isSkipped ? "–" : isCorrect ? "✓" : "✗"}
                    </div>
                    <p className="text-[14px] font-semibold text-gray-900 leading-relaxed">
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
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[14px]"
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
                            <span className="text-[11.5px] font-bold flex-shrink-0" style={{ color: "#0B6E65" }}>
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
                      className="mt-3 ml-9 px-3 py-2.5 rounded-xl text-[13.5px] leading-relaxed"
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
            className="text-[12px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
          >
            {exam.subject}
          </span>
          <span className="text-[12px]" style={{ color: "#C4C4C0" }}>
            ข้อที่ {current + 1}
          </span>
        </div>

        {/* Question text */}
        <p className="text-[16px] font-semibold text-gray-900 leading-relaxed mb-7">
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
                  className="text-[15px] leading-snug transition-colors duration-150"
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
