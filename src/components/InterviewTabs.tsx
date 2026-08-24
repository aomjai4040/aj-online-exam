"use client";
/**
 * InterviewTabs — 3 แท็บของเมนู "เตรียมสอบภาค ค." (/interview)
 *   QuestionBank  คลังคำถาม + แนวทางตอบ (กางทีละข้อ)
 *   PracticeMode  ซ้อมตอบ: สุ่ม 5 ข้อคละหมวด จับเวลาต่อข้อ เปิดแนวทางเทียบ แล้วประเมินตัวเอง
 *   Checklist     เช็คลิสต์เตรียมตัว (ติ๊กแล้วจำใน localStorage ต่อสนาม)
 * เนื้อหาทั้งหมดมาจาก src/lib/interview.ts
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExamFieldKey } from "@/lib/exam-fields";
import { BRAND } from "@/lib/subjects";
import {
  INTERVIEW_CATS, catOf, questionsForField, pickPracticeSet,
  loadPracticeStats, recordPracticeRating, practiceProgress,
  ANSWER_PRINCIPLES, INTERVIEW_CHECKLIST, PRACTICE_SECONDS,
  type InterviewQuestion, type PracticeRating,
} from "@/lib/interview";

// ─── คลังคำถาม ────────────────────────────────────────────────────────────────

function HintBox({ hints, title }: { hints: string[]; title: string }) {
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: "#F5FAF9" }}>
      <p className="text-[12px] font-bold mb-1.5" style={{ color: BRAND.primary }}>{title}</p>
      <ul className="space-y-1.5">
        {hints.map((h, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-gray-700 flex gap-2">
            <span className="flex-shrink-0" style={{ color: BRAND.primary }}>✓</span>{h}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function QuestionBank({ field }: { field: ExamFieldKey }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [showPrinciples, setShowPrinciples] = useState(false);
  const questions = useMemo(() => questionsForField(field), [field]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div>
      {/* หลักการตอบ — กล่องเดียวกางได้ */}
      <button type="button" onClick={() => setShowPrinciples((v) => !v)}
        className="card-elev w-full px-4 py-3.5 mb-4 text-left active:scale-[0.99]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #FBBF24, #F59E0B)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-gray-900">หลักการตอบสัมภาษณ์ อ่านก่อนซ้อม</p>
            <p className="text-[12px] text-gray-500 mt-0.5">โครงคำตอบ · สิ่งที่กรรมการดู · ข้อห้าม</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#A8A8A6" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className={`w-4 h-4 flex-shrink-0 transition-transform ${showPrinciples ? "rotate-90" : ""}`}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
        {showPrinciples && (
          <div className="mt-3 pt-3 space-y-3" style={{ borderTop: "1px solid #F0F0EE" }}>
            {ANSWER_PRINCIPLES.map((p) => (
              <div key={p.title}>
                <p className="text-[13.5px] font-bold mb-1" style={{ color: "#B45309" }}>{p.title}</p>
                <ul className="space-y-1">
                  {p.points.map((pt, i) => (
                    <li key={i} className="text-[13px] leading-relaxed text-gray-700 flex gap-2">
                      <span className="flex-shrink-0" style={{ color: "#F59E0B" }}>•</span>{pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </button>

      {INTERVIEW_CATS.map((cat) => {
        const list = questions.filter((q) => q.cat === cat.key);
        if (list.length === 0) return null;
        return (
          <section key={cat.key} className="mb-5">
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <p className="text-[15.5px] font-bold text-gray-900">{cat.name}</p>
              <span className="text-[12px] text-gray-400">{list.length} ข้อ</span>
            </div>
            <p className="text-[12.5px] text-gray-500 mb-2.5 px-1 leading-relaxed">{cat.desc}</p>
            <div className="space-y-2">
              {list.map((q) => {
                const open = openIds.has(q.id);
                return (
                  <div key={q.id} className="card-elev overflow-hidden">
                    <button type="button" onClick={() => toggle(q.id)}
                      className="w-full px-4 py-3 flex items-start gap-3 text-left active:bg-stone-50">
                      <p className="flex-1 text-[14.5px] font-semibold text-gray-900 leading-snug">{q.q}</p>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#A8A8A6" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                    {open && (
                      <div className="px-4 pb-3.5">
                        <HintBox hints={q.hints} title="แนวทางตอบ" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── ซ้อมตอบ ─────────────────────────────────────────────────────────────────

type Rating = PracticeRating;

const RATING_META: Record<Rating, { label: string; emoji: string; color: string; bg: string }> = {
  good: { label: "ตอบได้ลื่น",   emoji: "😄", color: "#15803D", bg: "#EBF5EF" },
  ok:   { label: "พอได้ มีสะดุด", emoji: "🙂", color: "#B45309", bg: "#FDF6E9" },
  weak: { label: "ยังตะกุกตะกัก", emoji: "😖", color: "#B91C1C", bg: "#FDEEEE" },
};

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function PracticeMode({ field }: { field: ExamFieldKey }) {
  const [set, setSet]           = useState<InterviewQuestion[]>([]);
  const [idx, setIdx]           = useState(0);
  const [phase, setPhase]       = useState<"idle" | "run" | "done">("idle");
  const [revealed, setRevealed] = useState(false);
  const [secs, setSecs]         = useState(PRACTICE_SECONDS);
  const [ratings, setRatings]   = useState<Rating[]>([]);
  const [progress, setProgress] = useState<{ seen: number; total: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // "เจอแล้ว x/y" — อ่านใน effect กัน hydration mismatch (localStorage ไม่มีตอน SSR)
  useEffect(() => {
    if (phase === "run") return;
    setProgress(practiceProgress(field, loadPracticeStats(field)));
  }, [field, phase]);

  // นาฬิกาเดินเฉพาะช่วงคิดคำตอบ (ก่อนเปิดแนวทาง)
  useEffect(() => {
    if (phase !== "run" || revealed) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => {
      setSecs((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, revealed, idx]);

  const start = () => {
    // สุ่มโดยดูประวัติ: ข้อใหม่มาก่อนจนครบคลัง · ข้อที่ตอบยังไม่ลื่นวนกลับมาบ่อยกว่า
    setSet(pickPracticeSet(field, 5, loadPracticeStats(field)));
    setIdx(0);
    setRatings([]);
    setRevealed(false);
    setSecs(PRACTICE_SECONDS);
    setPhase("run");
  };

  const rate = (r: Rating) => {
    recordPracticeRating(field, set[idx].id, r);
    setRatings((prev) => [...prev, r]);
    if (idx + 1 >= set.length) { setPhase("done"); return; }
    setIdx(idx + 1);
    setRevealed(false);
    setSecs(PRACTICE_SECONDS);
  };

  if (phase === "idle") {
    return (
      <div className="card-elev px-5 py-6 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #10857A, #0B6E65)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        <p className="text-[17px] font-bold text-gray-900 mb-1.5">ซ้อมเหมือนอยู่หน้ากรรมการ</p>
        <p className="text-[13.5px] text-gray-500 leading-relaxed mb-1">
          สุ่ม 5 คำถามคละหมวด · ข้อละ {PRACTICE_SECONDS / 60} นาที
        </p>
        <p className="text-[13.5px] text-gray-500 leading-relaxed mb-5">
          เห็นคำถามแล้ว <b>พูดตอบออกเสียงจริง ๆ</b> เหมือนกรรมการนั่งอยู่ตรงหน้า
          จบแล้วค่อยเปิดแนวทางเทียบ แล้วให้คะแนนตัวเองตามตรง
        </p>
        <button type="button" onClick={start}
          className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98]"
          style={{ backgroundColor: BRAND.primary }}>
          เริ่มซ้อม 5 ข้อ
        </button>
        <p className="text-[12px] text-gray-400 mt-3">
          {progress && progress.seen > 0
            ? `เจอคำถามไปแล้ว ${progress.seen}/${progress.total} ข้อ — ข้อใหม่มาก่อนเสมอ ข้อที่ยังตอบไม่ลื่นจะวนกลับมาให้ซ้อมซ้ำ`
            : "ซ้อมกี่รอบก็ได้ — ระบบจำให้ว่าเจอข้อไหนแล้ว ไม่สุ่มซ้ำจนกว่าจะครบคลัง"}
        </p>
      </div>
    );
  }

  if (phase === "done") {
    const count = (r: Rating) => ratings.filter((x) => x === r).length;
    const good = count("good");
    const msg =
      good >= 4 ? "เยี่ยมมาก! รักษาความลื่นนี้ไว้ ซ้อมทวนวันเว้นวันพอ" :
      good >= 2 ? "มาถูกทางแล้ว — ข้อที่ยังสะดุด กลับไปอ่านแนวทางในคลังคำถามแล้วซ้อมซ้ำ" :
      "ไม่เป็นไร ทุกคนเริ่มแบบนี้ — ซ้อมวันละรอบ อีกไม่กี่วันจะลื่นขึ้นชัดเจน";
    return (
      <div className="card-elev px-5 py-6">
        <p className="text-[17px] font-bold text-gray-900 text-center mb-4">จบรอบซ้อม 🎉</p>
        <div className="flex justify-center gap-3 mb-4">
          {(Object.keys(RATING_META) as Rating[]).map((r) => (
            <div key={r} className="flex-1 rounded-xl px-2 py-3 text-center"
              style={{ backgroundColor: RATING_META[r].bg }}>
              <p className="text-[22px] leading-none mb-1">{RATING_META[r].emoji}</p>
              <p className="text-[20px] font-extrabold leading-none" style={{ color: RATING_META[r].color }}>
                {count(r)}
              </p>
              <p className="text-[11px] mt-1" style={{ color: RATING_META[r].color }}>
                {RATING_META[r].label}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[13.5px] text-gray-600 text-center leading-relaxed mb-5">{msg}</p>
        <button type="button" onClick={start}
          className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98]"
          style={{ backgroundColor: BRAND.primary }}>
          ซ้อมอีกรอบ (สุ่มชุดใหม่)
        </button>
      </div>
    );
  }

  // phase === "run"
  const q = set[idx];
  const cat = catOf(q.cat);
  const timeUp = secs === 0;
  return (
    <div className="card-elev px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>
          {cat.short}
        </span>
        <span className="text-[13px] font-semibold text-gray-400">ข้อ {idx + 1}/{set.length}</span>
      </div>

      <p className="text-[17px] font-bold text-gray-900 leading-snug mb-4">{q.q}</p>

      {!revealed ? (
        <>
          <div className="rounded-2xl px-4 py-4 text-center mb-4"
            style={{ backgroundColor: timeUp ? "#FDEEEE" : "#F5FAF9" }}>
            <p className="text-[30px] font-extrabold tabular-nums leading-none"
              style={{ color: timeUp ? "#B91C1C" : BRAND.primary }}>
              {fmtTime(secs)}
            </p>
            <p className="text-[12.5px] mt-1.5" style={{ color: timeUp ? "#B91C1C" : "#6B7280" }}>
              {timeUp
                ? "หมดเวลาแนะนำ — สรุปคำตอบให้จบ แล้วเปิดแนวทางเทียบ"
                : "พูดตอบออกเสียงเลย เหมือนกรรมการนั่งอยู่ตรงหน้า"}
            </p>
          </div>
          <button type="button" onClick={() => setRevealed(true)}
            className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98]"
            style={{ backgroundColor: BRAND.primary }}>
            ตอบจบแล้ว → เปิดแนวทาง
          </button>
        </>
      ) : (
        <>
          <div className="mb-4">
            <HintBox hints={q.hints} title="แนวทางตอบ — คำตอบเรามีประเด็นพวกนี้ครบไหม" />
          </div>
          <p className="text-[13px] font-semibold text-gray-600 text-center mb-2.5">
            รอบนี้ตอบได้แค่ไหน (ตามตรงนะ)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(RATING_META) as Rating[]).map((r) => (
              <button key={r} type="button" onClick={() => rate(r)}
                className="rounded-xl px-2 py-3 text-center active:scale-[0.96] transition-transform"
                style={{ backgroundColor: RATING_META[r].bg }}>
                <p className="text-[20px] leading-none mb-1">{RATING_META[r].emoji}</p>
                <p className="text-[12px] font-bold" style={{ color: RATING_META[r].color }}>
                  {RATING_META[r].label}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── เช็คลิสต์ ────────────────────────────────────────────────────────────────

export function Checklist({ field }: { field: ExamFieldKey }) {
  const storageKey = `interview-check-${field}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {}
    setLoaded(true);
  }, [storageKey]);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      {INTERVIEW_CHECKLIST.map((group) => {
        const checked = group.items.filter((it) => done.has(it.id)).length;
        return (
          <section key={group.key} className="card-elev px-4 py-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[15px] font-bold text-gray-900">{group.title}</p>
              <span className="text-[12px] font-semibold"
                style={{ color: checked === group.items.length ? "#15803D" : "#A8A8A6" }}>
                {checked}/{group.items.length}
              </span>
            </div>
            <div className="space-y-1">
              {group.items.map((it) => {
                const isDone = done.has(it.id);
                return (
                  <button key={it.id} type="button" onClick={() => toggle(it.id)}
                    className="w-full flex items-start gap-3 py-2 text-left active:opacity-70">
                    <span className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors"
                      style={{
                        backgroundColor: isDone ? BRAND.primary : "white",
                        border: isDone ? "none" : "2px solid #D6D6D3",
                      }}>
                      {isDone && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"
                          strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-[14px] leading-relaxed ${isDone ? "text-gray-400 line-through" : "text-gray-800"}`}>
                      {it.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
