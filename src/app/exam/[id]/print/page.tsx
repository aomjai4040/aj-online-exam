"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getUserAccess, decideExamAccess } from "@/lib/access";
import { getExam } from "@/lib/firestore";
import { fetchExamFull, ExamApiError } from "@/lib/exam-client";
import { getSubjectShort } from "@/lib/types";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import type { Exam, Question } from "@/lib/types";

// ─── /exam/[id]/print — ฉบับพิมพ์ (ดาวน์โหลดเป็น PDF ผ่าน dialog พิมพ์ของเครื่อง) ──
// เฉลย+คำอธิบายอยู่ใต้แต่ละข้อ · ลายน้ำอีเมลผู้ดาวน์โหลดทุกหน้า (ตามรอยการเผยแพร่ต่อ)

const OPTS = ["ก", "ข", "ค", "ง"] as const;

type Phase = "loading" | "ready" | "locked" | "error";

export default function ExamPrintPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [exam,        setExam]        = useState<Exam | null>(null);
  const [questions,   setQuestions]   = useState<Question[]>([]);
  const [phase,       setPhase]       = useState<Phase>("loading");
  const [showAnswers, setShowAnswers] = useState(true);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?from=${encodeURIComponent(`/exam/${id}/print`)}`);
      return;
    }
    try {
      const e = await getExam(id);
      if (!e) { setPhase("error"); return; }
      setExam(e);

      const access  = await getUserAccess(user.uid);
      const verdict = decideExamAccess(e, user.uid, access);
      if (verdict !== "allowed") { setPhase("locked"); return; }

      // ดึงโจทย์+เฉลยผ่าน API (server ยืนยันสิทธิ์อีกชั้น)
      const qs = await fetchExamFull(user, id);
      if (qs.length === 0) { setPhase("error"); return; }
      setQuestions(qs);
      setPhase("ready");
    } catch (err) {
      if (err instanceof ExamApiError && err.code === "locked") { setPhase("locked"); return; }
      setPhase("error");
    }
  }, [id, user, authLoading, router]);

  useEffect(() => { load(); }, [load]);

  if (authLoading || !user || phase === "loading") return <AccessGuardSpinner />;

  if (phase === "locked") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 px-5 text-center">
        <p className="text-[16px] font-bold text-gray-900">ชุดนี้สำหรับสมาชิกคอร์ส</p>
        <p className="text-[13px]" style={{ color: "#A8A8A6" }}>
          ปลดล็อกก่อนจึงจะดาวน์โหลดฉบับพิมพ์ได้
        </p>
        <Link href={`/exam/${id}`} className="btn-primary text-sm px-6 py-2.5 mt-2">
          ← กลับหน้าข้อสอบ
        </Link>
      </div>
    );
  }

  if (phase === "error" || !exam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 px-5 text-center">
        <p className="text-[16px] font-bold text-gray-900">โหลดข้อสอบไม่สำเร็จ</p>
        <div className="flex gap-3 mt-2">
          <button onClick={load} className="btn-primary text-sm px-6 py-2.5">ลองใหม่</button>
          <Link href={`/exam/${id}`} className="btn-secondary text-sm px-6 py-2.5">← กลับ</Link>
        </div>
      </div>
    );
  }

  const printedAt = new Date().toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });
  const userLabel = user.displayName
    ? `${user.displayName} (${user.email})`
    : (user.email ?? "");

  return (
    <div className="min-h-screen bg-stone-50 print:bg-white">

      {/* พฤติกรรมเฉพาะตอนพิมพ์ */}
      <style>{`
        @media print {
          header, nav, .no-print { display: none !important; }
          main { min-height: 0 !important; }
          @page { margin: 14mm 12mm; }
          .print-doc { max-width: none !important; padding: 0 !important; }
          .q-block { break-inside: avoid; }
        }
      `}</style>

      {/* ── Toolbar (ไม่ติดไปในกระดาษ) ─────────────────────────────────── */}
      <div className="no-print sticky top-14 z-30 bg-white/95 backdrop-blur-md"
        style={{ borderBottom: "1px solid #EBEBEA" }}>
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3 flex-wrap">
          <Link href={`/exam/${id}`}
            className="text-[13px] flex items-center gap-1" style={{ color: "#A8A8A6" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            กลับ
          </Link>

          <label className="flex items-center gap-2 text-[13px] text-gray-700 select-none ml-auto">
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={(e) => setShowAnswers(e.target.checked)}
              className="w-4 h-4 accent-[#0B6E65]"
            />
            แสดงเฉลยใต้ข้อ
          </label>

          <button
            onClick={() => window.print()}
            className="btn-primary text-[13.5px] px-5 py-2.5 flex items-center gap-2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            บันทึกเป็น PDF / พิมพ์
          </button>
        </div>
        <p className="max-w-2xl mx-auto px-5 pb-2.5 text-[12px]" style={{ color: "#A8A8A6" }}>
          บนมือถือ: กดปุ่มแล้วเลือก &ldquo;บันทึกเป็น PDF&rdquo; ในหน้าจอพิมพ์
        </p>
      </div>

      {/* ── ลายน้ำ (ทุกหน้าเมื่อพิมพ์ — position:fixed ซ้ำทุกหน้ากระดาษ) ── */}
      <div
        aria-hidden
        className="hidden print:flex fixed inset-0 items-center justify-center pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <p style={{
          transform: "rotate(-30deg)", fontSize: "22px", color: "#000",
          opacity: 0.06, whiteSpace: "nowrap", fontWeight: 700,
        }}>
          {userLabel} · AJ ExamOnline
        </p>
      </div>
      <div
        aria-hidden
        className="hidden print:block fixed bottom-0 left-0 right-0 text-center"
        style={{ fontSize: "10.5px", color: "#888" }}
      >
        จัดทำเฉพาะสำหรับ {userLabel} · ห้ามคัดลอกหรือเผยแพร่ต่อ · aj-exam-online.vercel.app
      </div>

      {/* ── ตัวเอกสาร ───────────────────────────────────────────────────── */}
      <div className="print-doc max-w-2xl mx-auto px-5 py-6 relative" style={{ zIndex: 1 }}>

        {/* หัวกระดาษ */}
        <div className="pb-4 mb-5" style={{ borderBottom: "2px solid #0B6E65" }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-[13px] font-bold" style={{ color: "#0B6E65" }}>
              AJ ExamOnline
            </p>
            <p className="text-[11.5px]" style={{ color: "#888" }}>
              พิมพ์เมื่อ {printedAt}
            </p>
          </div>
          <h1 className="text-[19px] font-bold text-gray-900 leading-snug mt-1.5">
            {exam.title}
          </h1>
          <p className="text-[12.5px] mt-1" style={{ color: "#666" }}>
            {getSubjectShort(exam.subject)} · {questions.length} ข้อ
            {exam.timeLimit > 0 && ` · เวลาแนะนำ ${exam.timeLimit} นาที`}
            {showAnswers ? " · ฉบับมีเฉลย" : " · ฉบับไม่มีเฉลย"}
          </p>
        </div>

        {/* รายข้อ */}
        <div className="space-y-5">
          {questions.map((q, qi) => (
            <div key={q.id} className="q-block">
              <p className="text-[14px] font-semibold text-gray-900 leading-relaxed mb-2">
                {qi + 1}. {q.text}
              </p>
              {/* ตัวเลือกเป็นกลางเสมอ — ไม่ชี้คำตอบ ให้ฝึกทำเองก่อนแล้วดูเฉลยใต้ข้อ */}
              <div className="space-y-1 ml-5 mb-2">
                {q.options.map((opt, oi) => (
                  <p key={oi} className="text-[13.5px] leading-relaxed" style={{ color: "#374151" }}>
                    {OPTS[oi]}. {opt}
                  </p>
                ))}
              </div>
              {showAnswers && (
                <div className="ml-5 px-3 py-2 rounded-lg text-[12.5px] leading-relaxed"
                  style={{ backgroundColor: "#F6F5F1", border: "1px solid #E8E7E2", color: "#444" }}>
                  <span className="font-bold" style={{ color: "#0B6E65" }}>
                    เฉลย: {OPTS[q.correctAnswer]}
                  </span>
                  {q.explanation && <span> — {q.explanation}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ท้ายเอกสาร */}
        <p className="mt-8 pt-4 text-center text-[11.5px]"
          style={{ borderTop: "1px solid #E8E7E2", color: "#999" }}>
          — จบชุดข้อสอบ · รวม {questions.length} ข้อ —
        </p>
      </div>
    </div>
  );
}
