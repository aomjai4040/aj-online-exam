"use client";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ExamForm, QuestionForm } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_SUBJECTS = [
  "ระบาดวิทยา", "อนามัยสิ่งแวดล้อม", "กฎหมาย",
  "บริหารสาธารณสุข", "ชีวสถิติ", "นโยบาย สป.สธ.",
  "คณิตศาสตร์", "ภาษาไทย", "วิทยาศาสตร์", "ภาษาอังกฤษ",
];

const OPTS = ["ก", "ข", "ค", "ง"] as const;

const EMPTY_Q: QuestionForm = {
  text:          "",
  options:       ["", "", "", ""],
  correctAnswer: 0,
  explanation:   "",
};

// ─── Input focus helpers (inline styles because globals.css .input uses @apply) ─

const focusOn  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = "transparent";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(11,110,101,0.15)";
};
const focusOff = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = "#E0DFDC";
  e.currentTarget.style.boxShadow   = "none";
};

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-7 w-[52px] flex-shrink-0 items-center rounded-full
                 transition-all duration-200 focus:outline-none disabled:opacity-50"
      style={{ backgroundColor: checked ? "#0B6E65" : "#E5E7EB" }}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-md
                    transition-transform duration-200 ${checked ? "translate-x-[26px]" : "translate-x-1"}`}
      />
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastState { message: string; type: "success" | "error"; visible: boolean; }

function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const ok = toast.type === "success";
  return (
    <div
      className={`fixed inset-x-4 bottom-6 z-[100] max-w-2xl mx-auto
                  transition-all duration-300 ${
                    toast.visible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4 pointer-events-none"
                  }`}
    >
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl
                   text-white text-[13px] font-semibold"
        style={{ backgroundColor: ok ? "#0B6E65" : "#DC2626" }}
      >
        <span className="text-base flex-shrink-0">{ok ? "✓" : "✕"}</span>
        <span className="flex-1 leading-snug">{toast.message}</span>
        {ok && (
          <span className="text-[11px] font-normal opacity-70 flex-shrink-0">กำลังนำทาง…</span>
        )}
      </div>
    </div>
  );
}

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({
  q, qi, total,
  onUpdate, onUpdateOption, onMove, onRemove,
}: {
  q: QuestionForm;
  qi: number;
  total: number;
  onUpdate: <K extends keyof QuestionForm>(key: K, value: QuestionForm[K]) => void;
  onUpdateOption: (oi: number, value: string) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #EBEBEA" }}>

      {/* ── Card header ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ backgroundColor: "#FAFAF8", borderBottom: "1px solid #F3F2F0" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center
                       text-[12px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: "#0B6E65" }}
          >
            {qi + 1}
          </div>
          <span className="text-[13px] font-semibold text-gray-600">ข้อที่ {qi + 1}</span>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Move up */}
          <button
            onClick={() => onMove(-1)}
            disabled={qi === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-gray-400 hover:bg-gray-100 hover:text-gray-600
                       disabled:opacity-25 transition-colors"
            title="เลื่อนขึ้น"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          {/* Move down */}
          <button
            onClick={() => onMove(1)}
            disabled={qi === total - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-gray-400 hover:bg-gray-100 hover:text-gray-600
                       disabled:opacity-25 transition-colors"
            title="เลื่อนลง"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {/* Delete */}
          <button
            onClick={onRemove}
            disabled={total <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-gray-400 hover:bg-red-50 hover:text-red-500
                       disabled:opacity-25 transition-colors"
            title="ลบข้อนี้"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Card body ─────────────────────────────────────────────────── */}
      <div className="p-5 space-y-4">

        {/* Question text */}
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            คำถาม <span className="text-red-400">*</span>
          </label>
          <textarea
            className="w-full rounded-xl px-4 py-2.5 text-[14px] text-gray-900
                       placeholder-gray-400 resize-none focus:outline-none transition-all h-[76px]"
            style={{ border: "1px solid #E0DFDC" }}
            onFocus={focusOn}
            onBlur={focusOff}
            placeholder="พิมพ์คำถามที่นี่..."
            value={q.text}
            onChange={(e) => onUpdate("text", e.target.value)}
          />
        </div>

        {/* Options */}
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            ตัวเลือก — คลิก <span style={{ color: "#0B6E65" }}>ตัวอักษร</span> เพื่อกำหนดเฉลย
          </label>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const isCorrect = q.correctAnswer === oi;
              return (
                <div key={oi} className="flex items-center gap-2">
                  {/* Letter badge — click to set as correct answer */}
                  <button
                    type="button"
                    onClick={() => onUpdate("correctAnswer", oi)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center
                               text-[13px] font-bold flex-shrink-0 transition-all duration-150"
                    style={{
                      backgroundColor: isCorrect ? "#0B6E65" : "#F3F2F0",
                      color:           isCorrect ? "white"   : "#9CA3AF",
                      boxShadow:       isCorrect ? "0 0 0 3px rgba(11,110,101,0.2)" : "none",
                    }}
                    title={`กำหนดข้อ ${OPTS[oi]} เป็นเฉลย`}
                  >
                    {OPTS[oi]}
                  </button>

                  {/* Option text input */}
                  <input
                    className="flex-1 rounded-xl px-3.5 py-2 text-[13.5px] text-gray-900
                               focus:outline-none transition-all duration-150"
                    style={{
                      border:          `1.5px solid ${isCorrect ? "#0B6E65" : "#E0DFDC"}`,
                      backgroundColor: isCorrect ? "#EBF5F3" : "white",
                    }}
                    onFocus={(e) => {
                      if (!isCorrect) e.currentTarget.style.boxShadow = "0 0 0 3px rgba(11,110,101,0.1)";
                    }}
                    onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                    placeholder={`ตัวเลือก ${OPTS[oi]}`}
                    value={opt}
                    onChange={(e) => onUpdateOption(oi, e.target.value)}
                  />

                  {/* Correct indicator */}
                  {isCorrect && (
                    <span
                      className="flex-shrink-0 text-[11px] font-bold w-10 text-right"
                      style={{ color: "#0B6E65" }}
                    >
                      ✓ เฉลย
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            คำอธิบายเฉลย{" "}
            <span className="normal-case font-normal" style={{ color: "#C4C4C0" }}>(ถ้ามี)</span>
          </label>
          <textarea
            className="w-full rounded-xl px-4 py-2.5 text-[14px] text-gray-900
                       placeholder-gray-400 resize-none focus:outline-none transition-all h-14"
            style={{ border: "1px solid #E0DFDC" }}
            onFocus={focusOn}
            onBlur={focusOff}
            placeholder="อธิบายเหตุผลว่าทำไมถึงเป็นคำตอบที่ถูก..."
            value={q.explanation}
            onChange={(e) => onUpdate("explanation", e.target.value)}
          />
        </div>

      </div>
    </div>
  );
}

// ─── ExamEditor ───────────────────────────────────────────────────────────────

interface Props {
  title:     string;
  initial?:  ExamForm;
  onSave:    (form: ExamForm) => Promise<void>;
  backHref?: string;
}

export default function ExamEditor({
  title, initial, onSave, backHref = "/admin/exams",
}: Props) {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [meta, setMeta] = useState({
    title:       initial?.title       ?? "",
    description: initial?.description ?? "",
    subject:     initial?.subject     ?? "",
    timeLimit:   initial?.timeLimit   ?? 0,
    isPublished: initial?.isPublished ?? false,
  });

  const [questions, setQuestions] = useState<QuestionForm[]>(
    initial?.questions?.length
      ? initial.questions
      : [{ ...EMPTY_Q, options: ["", "", "", ""] as [string, string, string, string] }]
  );

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [toast,  setToast]  = useState<ToastState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function setMetaField<K extends keyof typeof meta>(key: K, value: (typeof meta)[K]) {
    setMeta((m) => ({ ...m, [key]: value }));
  }

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((t) => (t ? { ...t, visible: false } : null)), 2600);
    setTimeout(() => setToast(null), 3200);
  }, []);

  // ── Question helpers ───────────────────────────────────────────────────────

  function updateQuestion<K extends keyof QuestionForm>(qi: number, key: K, value: QuestionForm[K]) {
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, [key]: value } : q)));
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qi) return q;
        const opts = [...q.options] as [string, string, string, string];
        opts[oi] = value;
        return { ...q, options: opts };
      })
    );
  }

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      { ...EMPTY_Q, options: ["", "", "", ""] as [string, string, string, string] },
    ]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 80);
  }

  function removeQuestion(qi: number) {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== qi));
  }

  function moveQuestion(qi: number, dir: -1 | 1) {
    const arr = [...questions];
    const to  = qi + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[qi], arr[to]] = [arr[to], arr[qi]];
    setQuestions(arr);
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): string {
    if (!meta.title.trim())   return "กรุณากรอกชื่อชุดข้อสอบ";
    if (!meta.subject.trim()) return "กรุณาเลือกหรือพิมพ์หมวดวิชา";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return `ข้อที่ ${i + 1}: กรุณากรอกคำถาม`;
      for (let j = 0; j < 4; j++) {
        if (!q.options[j].trim())
          return `ข้อที่ ${i + 1}: กรุณากรอกตัวเลือก ${OPTS[j]}`;
      }
    }
    return "";
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    const err = validate();
    if (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave({ ...meta, questions });
      showToast("บันทึกสำเร็จ 🎉", "success");
      setTimeout(() => router.push(backHref), 1500);
    } catch {
      showToast("เกิดข้อผิดพลาด กรุณาลองอีกครั้ง", "error");
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <Toast toast={toast} />

      {/* ── Sticky top bar ────────────────────────────────────────────── */}
      <div
        className="sticky top-14 z-30 bg-white"
        style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          {/* Back */}
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: "#A8A8A6" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#6B7280")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#A8A8A6")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-[13px] font-medium">กลับ</span>
          </button>

          {/* Centred title */}
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold text-gray-900 whitespace-nowrap">
            {title}
          </h1>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-[13px] font-semibold px-4 py-1.5 rounded-xl text-white
                       hover:opacity-90 active:opacity-75 disabled:opacity-50
                       transition-opacity flex-shrink-0"
            style={{ backgroundColor: "#0B6E65" }}
          >
            {saving ? "บันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-14 space-y-4">

        {/* Error banner */}
        {error && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-[13px] font-medium"
            style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* ═══ Section 1: ข้อมูลพื้นฐาน ════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            📝 ข้อมูลพื้นฐาน
          </p>

          {/* Title */}
          <div className="mb-4">
            <label className="label">
              ชื่อชุดข้อสอบ <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              placeholder="เช่น แนวข้อสอบระบาดวิทยา ชุดที่ 1"
              value={meta.title}
              onChange={(e) => setMetaField("title", e.target.value)}
              maxLength={120}
            />
            <p className="text-[11px] text-right mt-1" style={{ color: "#C4C4C0" }}>
              {meta.title.length}/120
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="label">
              คำอธิบาย{" "}
              <span className="text-[12px] font-normal" style={{ color: "#C4C4C0" }}>(ไม่บังคับ)</span>
            </label>
            <textarea
              className="input resize-none h-[80px]"
              placeholder="อธิบายเนื้อหา วัตถุประสงค์ หรือข้อแนะนำสำหรับผู้สอบ..."
              value={meta.description}
              onChange={(e) => setMetaField("description", e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        {/* ═══ Section 2: หมวดวิชาและเวลา ══════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            🏷️ หมวดวิชาและเวลา
          </p>

          {/* Subject input + datalist */}
          <div className="mb-2">
            <label className="label">
              วิชา <span className="text-red-500">*</span>
            </label>
            <input
              list="subject-list"
              className="input"
              placeholder="เลือกจากรายการหรือพิมพ์เอง..."
              value={meta.subject}
              onChange={(e) => setMetaField("subject", e.target.value)}
            />
            <datalist id="subject-list">
              {PRESET_SUBJECTS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* Quick-pick chips */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {PRESET_SUBJECTS.map((s) => {
              const active = meta.subject === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMetaField("subject", active ? "" : s)}
                  className="text-[12px] font-medium px-2.5 py-1 rounded-full border
                             transition-all duration-150"
                  style={{
                    backgroundColor: active ? "#0B6E65" : "white",
                    borderColor:     active ? "#0B6E65" : "#E0DFDC",
                    color:           active ? "white"   : "#6B7280",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>

          {/* Time limit */}
          <div>
            <label className="label">เวลาทำข้อสอบ (นาที)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="600"
                inputMode="numeric"
                className="input pr-14"
                placeholder="0"
                value={meta.timeLimit === 0 ? "" : meta.timeLimit}
                onChange={(e) => setMetaField("timeLimit", Number(e.target.value) || 0)}
              />
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] pointer-events-none"
                style={{ color: "#C4C4C0" }}
              >
                นาที
              </span>
            </div>
            <p className="text-[12px] mt-1.5" style={{ color: "#A8A8A6" }}>
              {meta.timeLimit > 0
                ? `⏱ จำกัดเวลา ${meta.timeLimit} นาที`
                : "0 = ไม่จำกัดเวลา"}
            </p>
          </div>
        </div>

        {/* ═══ Section 3: การเผยแพร่ ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            🌐 การเผยแพร่
          </p>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-gray-900 mb-1">
                เผยแพร่ให้นักเรียนเห็น
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: "#A8A8A6" }}>
                {meta.isPublished
                  ? "✅ จะปรากฏในหน้าคลังข้อสอบทันที"
                  : "📝 ซ่อนอยู่ นักเรียนจะยังไม่เห็น"}
              </p>
            </div>
            <Toggle
              checked={meta.isPublished}
              onChange={(v) => setMetaField("isPublished", v)}
              disabled={saving}
            />
          </div>
        </div>

        {/* ═══ Questions section ════════════════════════════════════════ */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">ข้อสอบ</h2>
            <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>
              {questions.length} ข้อ · คลิกตัวอักษร ก ข ค ง เพื่อกำหนดเฉลย
            </p>
          </div>
          <button
            type="button"
            onClick={addQuestion}
            className="text-[13px] font-semibold px-3.5 py-2 rounded-xl
                       flex items-center gap-1.5 transition-colors"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            เพิ่มข้อ
          </button>
        </div>

        {/* Question cards */}
        <div className="space-y-3">
          {questions.map((q, qi) => (
            <QuestionCard
              key={qi}
              q={q}
              qi={qi}
              total={questions.length}
              onUpdate={(key, value) => updateQuestion(qi, key, value)}
              onUpdateOption={(oi, value) => updateOption(qi, oi, value)}
              onMove={(dir) => moveQuestion(qi, dir)}
              onRemove={() => removeQuestion(qi)}
            />
          ))}
        </div>

        {/* Dashed add button */}
        <button
          type="button"
          onClick={addQuestion}
          className="w-full py-4 rounded-2xl text-[13.5px] font-semibold
                     flex items-center justify-center gap-2
                     transition-all duration-150 hover:opacity-75 active:scale-[0.99]"
          style={{
            border:          "2px dashed #C3E5DE",
            color:           "#0B6E65",
            backgroundColor: "#F5FAF9",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          เพิ่มข้อสอบ
        </button>

        {/* Big save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl
                     text-white text-[15px] font-bold transition-all duration-150
                     hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
          style={{ backgroundColor: "#0B6E65" }}
        >
          {saving ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              บันทึกข้อสอบทั้งหมด ({questions.length} ข้อ)
            </>
          )}
        </button>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
