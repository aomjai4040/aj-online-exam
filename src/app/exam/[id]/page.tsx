"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getExam, saveResult } from "@/lib/firestore";
import { fetchExamQuestions, gradeExam, ExamApiError } from "@/lib/exam-client";
import { saveRecord } from "@/lib/exam-history";
import { saveUserRecord } from "@/lib/user-firestore";
import { recordExamMistakes } from "@/lib/smart-review";
import { PRICING, CONTACT_URL, COURSE_RESOURCES } from "@/lib/pricing";
import { daysToExam } from "@/lib/exam-config";
import { chapterForSubject } from "@/lib/curriculum";
import { useAuth } from "@/lib/auth-context";
import { getUserAccess, decideExamAccess } from "@/lib/access";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import { SUBJECT_DISPLAY, type Exam, type Question } from "@/lib/types";

// ─── Types & helpers ─────────────────────────────────────────────────────────

type Phase = "loading" | "intro" | "exam" | "result" | "error" | "locked";

// ─── Autosave (กันคำตอบหายเมื่อ refresh / สลับแอปบนมือถือ) ────────────────────
// helpers อยู่ที่ lib/exam-progress — dashboard ใช้ทำการ์ด "ทำต่อจากเดิม" ด้วย

import {
  loadProgress, saveProgress, clearProgress, type SavedProgress,
} from "@/lib/exam-progress";

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
  const [current,   setCurrent]   = useState(0);
  const [answers,   setAnswers]   = useState<number[]>([]);
  const [timeLeft,  setTimeLeft]  = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [saved,     setSaved]     = useState<SavedProgress | null>(null);
  const [grading,   setGrading]   = useState(false); // กำลังส่งคำตอบให้ server ตรวจ
  const [hasFull,   setHasFull]   = useState(false); // คอร์สเต็ม → โค้ชลิงก์ชีท/คลิปตรงบทได้

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
      setHasFull(access.hasFull);
      const verdict = decideExamAccess(e, user.uid, access);
      if (verdict === "locked") { setLocked(e); setPhase("locked"); return; }

      // มีสิทธิ์ → ดึง "โจทย์ไม่มีเฉลย" จาก API (เฉลยอยู่ฝั่ง server จนกว่าจะส่งคำตอบ)
      const qs = await fetchExamQuestions(user, id);
      if (qs.length === 0) { setExam(e); setPhase("error"); return; }
      setExam(e);
      setQuestions(qs);
      answersRef.current = new Array(qs.length).fill(-1);
      setAnswers(answersRef.current);
      setSaved(loadProgress(id, qs.length));
      setPhase("intro");
    } catch (err) {
      // server ยืนยันสิทธิ์อีกชั้น — ถ้า client เช็คพลาด server ตอบ locked มา
      if (err instanceof ExamApiError && err.code === "locked") {
        const e = await getExam(id).catch(() => null);
        if (e) { setLocked(e); setPhase("locked"); return; }
      }
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
      elapsed:   Math.round((Date.now() - startRef.current) / 1000),
      qCount:    questions.length,
      savedAt:   Date.now(),
      examTitle: exam?.title,
      subject:   exam?.subject,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // ตรวจคะแนนฝั่ง server — เฉลยเปิดหลังส่งคำตอบเท่านั้น
    // ล้มเหลว (เน็ตหลุด) → คำตอบยังอยู่ครบ กดส่งซ้ำได้ ไม่เสียรอบสอบ
    if (!user) return;
    let graded;
    try {
      setGrading(true);
      graded = await gradeExam(user, id, finalAnswers);
    } catch {
      alert("ส่งคำตอบไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วกด \"ส่งข้อสอบ\" อีกครั้ง (คำตอบยังอยู่ครบ)");
      return;
    } finally {
      setGrading(false);
    }
    clearProgress(id);             // ส่งสำเร็จแล้ว — ทิ้ง autosave

    // เติมเฉลยที่ได้จาก server เข้า questions ให้หน้าเฉลย/Smart Review ใช้
    // จับคู่ด้วย qid ก่อน — ถ้าไม่เจอ (admin บันทึกแก้ชุดระหว่างเราทำข้อสอบ ทำให้
    // id เปลี่ยน) ให้เทียบตามลำดับข้อแทน และรับ qid ใหม่มาใช้ด้วย
    const km = new Map(graded.detail.map((d) => [d.qid, d]));
    const enriched = questions.map((q, i) => {
      const d = km.get(q.id) ?? graded.detail[i];
      return {
        ...q,
        id:            d?.qid ?? q.id,
        correctAnswer: d?.correctAnswer ?? -1,
        explanation:   d?.explanation ?? "",
      };
    });
    setQuestions(enriched);
    const score = graded.score;
    const pct   = graded.percentage;

    // Persist to localStorage
    saveRecord({ examId: id, score, totalQuestions: questions.length, percentage: pct, doneAt: new Date().toISOString() });

    // Also save to Firestore when user is logged in
    if (exam) {
      saveUserRecord(user.uid, {
        examId:         id,
        examTitle:      exam.title,
        subject:        exam.subject,
        score,
        totalQuestions: questions.length,
        percentage:     pct,
      }).catch(console.error); // fire-and-forget

      // Smart Review: เก็บข้อที่ผิด/ข้ามเข้าคลังทบทวน (ตอบถูกรอบนี้ = เอาออก)
      recordExamMistakes(user.uid, { id, title: exam.title, subject: exam.subject },
        enriched, finalAnswers).catch(console.error);
    }

    if (exam) {
      try {
        await saveResult({
          examId: id,
          examTitle: exam.title,
          userId: user?.uid,
          userEmail: user?.email ?? undefined,
          studentName: user?.displayName || user?.email || "ผู้สอบ",
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

          <p className="text-[13px] text-center leading-relaxed mb-4" style={{ color: "#6B6B6A" }}>
            ปลดล็อกชุดนี้เพื่อทำข้อสอบพร้อมเฉลยละเอียด
            <br />
            หากมีรหัสเปิดใช้งานอยู่แล้ว กรอกได้เลย
          </p>

          {/* urgency — นับถอยหลังวันสอบจริง */}
          {daysToExam() > 0 && (
            <p className="text-[13px] font-semibold text-center mb-5 rounded-xl py-2.5 px-4"
              style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
              ⏳ สอบจริง 15 ส.ค. — เหลืออีก {daysToExam()} วัน · เริ่มวันนี้ยังทัน
            </p>
          )}

          <div className="space-y-3">
            <Link href="/packages" className="btn-primary w-full py-3.5 text-[15px] text-center block">
              ปลดล็อกทั้งหมด เริ่ม ฿{PRICING.app.price}
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

          {/* ดาวน์โหลดฉบับพิมพ์ (PDF) */}
          <Link
            href={`/exam/${id}/print`}
            className="flex items-center justify-center gap-2 w-full py-3 mt-3 rounded-2xl
                       text-[13.5px] font-semibold transition-colors hover:bg-stone-100"
            style={{ border: "1px dashed #C8C7C3", color: "#6B6B6A" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            ดาวน์โหลดข้อสอบ + เฉลย (PDF สำหรับปริ๊น)
          </Link>
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
              ผลการสอบ{user?.displayName ? ` · ${user.displayName}` : ""}
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

          {/* ═══ โค้ชครูอ้อม — ขั้นต่อไปตามผลของคุณ ═══════════════════════ */}
          {(() => {
            const subj    = exam?.subject ?? "";
            const isMockR = subj === "MOCK" || exam?.isMock === true;
            const ch      = chapterForSubject(subj);
            const subjTh  = SUBJECT_DISPLAY[subj] ?? subj;
            const missed  = wrong + skipped;
            const tone = pct >= 80
              ? { emoji: "🎉", msg: `เยี่ยมมาก! หมวดนี้แน่นแล้ว — ไล่ดูข้อที่พลาดด้านล่างอีกรอบ แล้วไปเก็บหมวดถัดไปเลย` }
              : pct >= 60
              ? { emoji: "💪", msg: `เกือบดีแล้ว! ยังพลาด ${missed} ข้อ — อ่านเฉลยด้านล่างให้เข้าใจ แล้วตามนี้ต่อ` }
              : { emoji: "📌", msg: isMockR
                  ? `คะแนนรวมยังไม่ถึงเป้า — ไปดูรายหมวดว่าอ่อนตรงไหน แล้วเก็บทีละหมวด`
                  : `คุณยังสับสนหมวด "${subjTh}" อยู่ (พลาด ${missed} ข้อ) — อย่าเพิ่งท้อ ตามนี้เลย` };
            return (
              <div className="rounded-2xl p-4 mb-5"
                style={{ backgroundColor: "#F5FAF9", border: "1.5px solid #C3E5DE" }}>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#0B6E65" }}>
                  โค้ชครูอ้อม · ขั้นต่อไปของคุณ
                </p>
                <p className="text-[13.5px] leading-relaxed text-gray-800 mb-3">
                  {tone.emoji} {tone.msg}
                </p>
                <div className="space-y-2">
                  {isMockR ? (
                    <>
                      <Link href="/review" className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 bg-white text-[13px] font-semibold text-gray-800"
                        style={{ border: "1px solid #EBEBEA" }}>
                        🔁 ทบทวนทุกข้อที่ผิด (Smart Review)
                      </Link>
                      <Link href="/dashboard" className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 bg-white text-[13px] font-semibold text-gray-800"
                        style={{ border: "1px solid #EBEBEA" }}>
                        📊 ดูจุดอ่อนรายหมวดของคุณ
                      </Link>
                    </>
                  ) : (
                    <>
                      {pct < 80 && ch && (
                        <Link
                          href={hasFull ? `/videos?chapter=${encodeURIComponent(ch.prefix)}` : "/videos"}
                          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 bg-white text-[13px] font-semibold text-gray-800"
                          style={{ border: "1px solid #EBEBEA" }}>
                          🎬 ดูคลิปติว {ch.label}
                        </Link>
                      )}
                      {pct < 80 && hasFull && COURSE_RESOURCES.driveDocs && (
                        <a href={COURSE_RESOURCES.driveDocs} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 bg-white text-[13px] font-semibold text-gray-800"
                          style={{ border: "1px solid #EBEBEA" }}>
                          📖 อ่านชีทสรุปหมวดนี้เพิ่ม
                        </a>
                      )}
                      {pct < 60 && (
                        <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 bg-white text-[13px] font-semibold"
                          style={{ border: "1px solid #EBEBEA", color: "#067A38" }}>
                          💬 ไม่เข้าใจตรงไหน ถามครูอ้อมได้เลย
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

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
                  className="font-exam bg-white rounded-2xl p-4"
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

        {/* Question text — font-exam (Sarabun มีหัว) + ขยับขนาดชดเชย x-height ที่เล็กกว่า */}
        <p className="font-exam text-[17px] font-semibold text-gray-900 leading-relaxed mb-7">
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
                  className="font-exam text-[16px] leading-snug transition-colors duration-150"
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
              disabled={grading}
              className="btn-primary flex-1 py-3 disabled:opacity-60"
            >
              {grading ? "กำลังตรวจ…" : "ส่งข้อสอบ ✓"}
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
