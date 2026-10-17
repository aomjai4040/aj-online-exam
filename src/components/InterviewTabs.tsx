"use client";
/**
 * InterviewTabs — 3 แท็บของเมนู "ภาค ค สัมภาษณ์" (/interview)
 *   QuestionBank  คลังคำถาม + แนวทางตอบ (กางทีละข้อ) — มีป้าย ▶ ข้อที่มีคลิปอวตาร์
 *   PracticeMode  ซ้อมตอบ 2 โหมด (handoff Aj 2026-10-17):
 *                   เก็บข้อ = สุ่ม 5 ข้อ · จำลองห้อง = แนะนำตัว 1 นาที + สุ่ม 3 ข้อ นาฬิการวมเดินตลอด
 *                 ข้อที่มีคลิป: กด "เริ่มฟังคำถาม" ก่อน (มือถือบล็อก autoplay เสียง)
 *                 → คลิปจบนับเวลาตอบ 1 นาทีอัตโนมัติ เตือนเหลือ 15 วิ เกินเวลาไม่ตัดแต่โชว์
 *   Checklist     เช็คลิสต์เตรียมตัว (ติ๊กแล้วจำใน localStorage ต่อสนาม)
 *
 * โหมดทดลองฟรี (ยังไม่สมัคร/ยังไม่ login): เห็นคลังทั้งหมดแบบล็อก ซ้อมได้เฉพาะข้อ 🎁
 * จบแล้วเจอการ์ดชวนสมัคร — เนื้อหามาจาก src/lib/interview.ts · คลิปจาก lib/interview-clips.ts
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExamFieldKey } from "@/lib/exam-fields";
import { EXAM_FIELDS } from "@/lib/exam-fields";
import { CONTACT_URL } from "@/lib/pricing";
import { BRAND } from "@/lib/subjects";
import {
  INTERVIEW_CATS, catOf, questionsForField, pickPracticeSet,
  loadPracticeStats, recordPracticeRating, practiceProgress,
  ANSWER_PRINCIPLES, INTERVIEW_CHECKLIST, PRACTICE_CONFIG,
  type InterviewQuestion, type PracticeRating,
} from "@/lib/interview";
import { fetchClipUrl, type InterviewClip } from "@/lib/interview-clips";

/** ของที่ทุกแท็บใช้ร่วม — หน้า /interview โหลดคลิปครั้งเดียวแล้วส่งลงมา */
export interface TabCtx {
  field: ExamFieldKey;
  isMember: boolean;
  clips: Map<string, InterviewClip>;
  getToken: () => Promise<string | null>;
}

const playableClip = (c?: InterviewClip) =>
  Boolean(c && c.videoPath && c.status === "published");

// ─── การ์ดชวนสมัคร (จบโหมดทดลองฟรี — handoff 2.6) ────────────────────────────

export function JoinCta({ field }: { field: ExamFieldKey }) {
  const meta = EXAM_FIELDS.find((f) => f.id === field);
  const buyHref = meta?.hrefBuy ?? "/packages";
  return (
    <div className="rounded-2xl px-5 py-5 text-center"
      style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FCD34D" }}>
      <p className="text-[16px] font-bold" style={{ color: "#92400E" }}>
        ชอบไหมคะ? คลังเต็มมีให้ซ้อมทุกหมวด 🎤
      </p>
      <p className="text-[13px] mt-1 mb-4 leading-relaxed" style={{ color: "#B45309" }}>
        สมัครคอร์สแล้วซ้อมได้ครบทุกข้อ พร้อมแนวทางตอบจากพี่อ้อมทีละข้อ
        โหมดจำลองห้องสัมภาษณ์ และเช็คลิสต์วันจริง
      </p>
      <a href={buyHref}
        className="block w-full py-3 rounded-xl text-[14.5px] font-bold text-white active:scale-[0.98] transition-transform"
        style={{ backgroundColor: BRAND.primary }}>
        สมัครคอร์ส {meta?.code ?? ""} →
      </a>
      <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer"
        className="block w-full py-2.5 mt-2 rounded-xl text-[13.5px] font-semibold"
        style={{ backgroundColor: "white", border: "1px solid #E0DFDC", color: "#07A94D" }}>
        💬 ทัก LINE ถามพี่อ้อมก่อนได้
      </a>
    </div>
  );
}

// ─── กล่องแนวทางตอบ ──────────────────────────────────────────────────────────

function HintBox({ hints, title }: { hints: string[]; title: string }) {
  // โทนโน้ตพี่อ้อมเขียนถึงน้อง — ไม่ใช้ ✓/ลูกศร ให้อ่านเหมือนคำแนะนำ ไม่ใช่แผนผัง
  return (
    <div className="rounded-xl px-3.5 py-3"
      style={{ backgroundColor: "#FFFDF5", border: "1px solid #F3EAD3" }}>
      <p className="text-[12px] font-bold mb-2" style={{ color: "#92400E" }}>💬 {title}</p>
      <div className="space-y-2">
        {hints.map((h, i) => (
          <p key={i} className="text-[13px] leading-relaxed text-gray-700 pl-2.5"
            style={{ borderLeft: "2px solid #F3EAD3" }}>
            {h}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── คลังคำถาม ────────────────────────────────────────────────────────────────

export function QuestionBank({ ctx }: { ctx: TabCtx }) {
  const { field, isMember, clips } = ctx;
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
                const clip = clips.get(q.code);
                const free = playableClip(clip) && clip!.isFreePreview;
                const locked = !isMember && !free;
                return (
                  <div key={q.id} className="card-elev overflow-hidden"
                    style={locked ? { opacity: 0.8 } : undefined}>
                    <button type="button" onClick={() => toggle(q.id)}
                      className="w-full px-4 py-3 flex items-start gap-3 text-left active:bg-stone-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14.5px] font-semibold text-gray-900 leading-snug">{q.q}</p>
                        {(playableClip(clip) || free) && (
                          <p className="text-[11px] mt-1 flex items-center gap-1.5">
                            {playableClip(clip) && (
                              <span className="font-semibold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
                                ▶ มีคลิปกรรมการถาม
                              </span>
                            )}
                            {free && (
                              <span className="font-semibold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
                                🎁 ทดลองฟรี
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {locked ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#C4C4C0" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 mt-0.5">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#A8A8A6" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round"
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </button>
                    {open && (
                      <div className="px-4 pb-3.5">
                        {locked ? (
                          <p className="text-[12.5px] rounded-xl px-3 py-2.5 leading-relaxed"
                            style={{ backgroundColor: "#F5FAF9", color: "#6B7280" }}>
                            🔒 แนวทางตอบของพี่อ้อมเปิดให้สมาชิกคอร์สค่ะ —
                            ลองซ้อมข้อที่มีป้าย 🎁 ได้ฟรีในแท็บ &quot;ซ้อมตอบ&quot; เลย
                          </p>
                        ) : (
                          <HintBox hints={q.hints} title="พี่อ้อมแนะนำ" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!isMember && <div className="mt-2 mb-4"><JoinCta field={field} /></div>}
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
  const a = Math.abs(s);
  return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}

type Mode = "drill" | "sim";
type Sub = "listen" | "answer" | "revealed";

/** 1 ขั้นของรอบซ้อม — โหมดจำลองห้องมีขั้น "แนะนำตัว" นำหน้า */
interface Step {
  kind: "intro" | "question";
  q?: InterviewQuestion;
  title: string;
}

export function PracticeMode({ ctx }: { ctx: TabCtx }) {
  const { field, isMember, clips, getToken } = ctx;
  const CFG = PRACTICE_CONFIG;

  const [mode, setMode]         = useState<Mode>("drill");
  const [steps, setSteps]       = useState<Step[]>([]);
  const [idx, setIdx]           = useState(0);
  const [phase, setPhase]       = useState<"idle" | "run" | "done">("idle");
  const [sub, setSub]           = useState<Sub>("answer");
  const [secs, setSecs]         = useState(CFG.answerSeconds); // ติดลบ = เกินเวลา
  const [ratings, setRatings]   = useState<(Rating | null)[]>([]);
  const [used, setUsed]         = useState<number[]>([]); // วินาทีที่ใช้จริงต่อขั้น
  const [progress, setProgress] = useState<{ seen: number; total: number } | null>(null);
  const [clipMedia, setClipMedia] = useState<{ videoUrl: string; posterUrl?: string; captionsUrl?: string } | null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  // นาฬิการวมของโหมดจำลองห้อง — เดินตลอดเหมือนเวลาจริงในห้อง (handoff 2.5)
  // หยุดเฉพาะตอนเปิดแนวทาง/ให้คะแนน (ช่วงนั้นหลุดจากบทสมมติแล้ว)
  const [simTotal, setSimTotal] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // คลังที่ซ้อมได้: สมาชิก = ทั้งสนาม · ทดลองฟรี = เฉพาะข้อ 🎁 ที่มีคลิปเผยแพร่
  const pool = useMemo(() => {
    const all = questionsForField(field);
    if (isMember) return all;
    return all.filter((q) => {
      const c = clips.get(q.code);
      return playableClip(c) && c!.isFreePreview;
    });
  }, [field, isMember, clips]);

  useEffect(() => {
    if (phase === "run") return;
    setProgress(practiceProgress(field, loadPracticeStats(field)));
  }, [field, phase]);

  // นาฬิกาเดินเฉพาะช่วงตอบ — เกินเวลาไม่หยุด (นับติดลบ เพื่อโชว์เวลาที่เกิน)
  useEffect(() => {
    if (phase !== "run" || sub !== "answer") {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => setSecs((s) => s - 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, sub, idx]);

  // นาฬิการวม (เฉพาะโหมดจำลองห้อง) — เดินทั้งช่วงฟังคำถามและช่วงตอบ
  useEffect(() => {
    if (phase !== "run" || mode !== "sim" || sub === "revealed") {
      if (totalRef.current) { clearInterval(totalRef.current); totalRef.current = null; }
      return;
    }
    totalRef.current = setInterval(() => setSimTotal((s) => s + 1), 1000);
    return () => { if (totalRef.current) clearInterval(totalRef.current); };
  }, [phase, mode, sub]);

  /** เวลาเริ่มต้นของขั้นนี้ */
  const stepSeconds = (s: Step) => (s.kind === "intro" ? CFG.simIntroSeconds : CFG.answerSeconds);

  const beginStep = useCallback(async (list: Step[], i: number) => {
    const step = list[i];
    setIdx(i);
    setSecs(stepSeconds(step));
    setClipMedia(null);
    // ข้อที่มีคลิป → เริ่มที่ขั้นฟังคำถาม (ให้ผู้ใช้กดเองก่อน กันมือถือบล็อกเสียง)
    const clip = step.q ? clips.get(step.q.code) : undefined;
    setSub(playableClip(clip) ? "listen" : "answer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);

  const start = (m: Mode) => {
    const stats = loadPracticeStats(field);
    let list: Step[];
    if (m === "sim") {
      const intro = pool.find((q) => q.id === "intro-self");
      const rest = pickPracticeSet(field, CFG.simQuestionCount + 1, stats)
        .filter((q) => q.id !== "intro-self").slice(0, CFG.simQuestionCount);
      list = [
        { kind: "intro", q: intro, title: "แนะนำตัวเอง" },
        ...rest.map((q) => ({ kind: "question" as const, q, title: q.q })),
      ];
    } else {
      // ทดลองฟรี: คลังเล็ก สุ่มจากที่มี (อาจน้อยกว่า 5)
      const picked = isMember
        ? pickPracticeSet(field, 5, stats)
        : [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
      list = picked.map((q) => ({ kind: "question" as const, q, title: q.q }));
    }
    if (list.length === 0) return;
    setMode(m);
    setSteps(list);
    setRatings([]);
    setUsed([]);
    setSimTotal(0);
    setPhase("run");
    beginStep(list, 0);
  };

  async function playClip() {
    const step = steps[idx];
    if (!step?.q) return;
    setClipLoading(true);
    const media = await fetchClipUrl(step.q.code, await getToken());
    setClipLoading(false);
    if (!media) { setSub("answer"); return; } // โหลดคลิปไม่ได้ → ใช้การ์ดข้อความ ไม่พัง flow
    setClipMedia(media);
    // autoplay ได้เพราะมาจาก user gesture (กดปุ่มเริ่มฟังคำถาม)
    setTimeout(() => videoRef.current?.play().catch(() => {}), 80);
  }

  function replay() {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }

  const finishStep = (r: Rating | null) => {
    const step = steps[idx];
    if (step.q && r) recordPracticeRating(field, step.q.id, r);
    setRatings((p) => [...p, r]);
    setUsed((p) => [...p, stepSeconds(step) - secs]);
    if (idx + 1 >= steps.length) { setPhase("done"); return; }
    beginStep(steps, idx + 1);
  };

  // ── จอเริ่ม ──
  if (phase === "idle") {
    if (!isMember && pool.length === 0) {
      return (
        <div>
          <div className="card-elev px-5 py-6 text-center mb-4">
            <p className="text-[15px] font-bold text-gray-900 mb-1">โหมดซ้อมตอบ</p>
            <p className="text-[13px] text-gray-500 leading-relaxed">
              ข้อทดลองฟรีกำลังจะเปิดเร็ว ๆ นี้ค่ะ — สมัครคอร์สแล้วซ้อมได้ครบทุกข้อเลย
            </p>
          </div>
          <JoinCta field={field} />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {/* จำลองห้องสัมภาษณ์ — เฉพาะสมาชิก (ต้องใช้คลังเต็ม) */}
        {isMember && (
          <div className="card-elev px-5 py-5">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[16px] font-bold text-gray-900">จำลองห้องสัมภาษณ์ 5 นาที</p>
              <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "#FDEEEE", color: "#B91C1C" }}>
                เหมือนจริง
              </span>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-3.5">
              แนะนำตัว {Math.round(CFG.simIntroSeconds / 60)} นาที แล้วตอบต่ออีก {CFG.simQuestionCount} ข้อ
              ข้อละ {Math.round(CFG.answerSeconds / 60)} นาที — นาฬิกาเดินยาวเหมือนนั่งอยู่หน้ากรรมการจริง
              จบแล้วสรุปว่าใช้เวลาข้อละเท่าไร
            </p>
            <button type="button" onClick={() => start("sim")}
              className="w-full py-3 rounded-2xl text-[14.5px] font-bold text-white active:scale-[0.98]"
              style={{ backgroundColor: "#B91C1C" }}>
              🎬 เข้าห้องสัมภาษณ์
            </button>
          </div>
        )}

        {/* ซ้อมเก็บข้อ */}
        <div className="card-elev px-5 py-5">
          <p className="text-[16px] font-bold text-gray-900 mb-1">
            {isMember ? "ซ้อมเก็บข้อ" : "ทดลองซ้อมฟรี"}
          </p>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-3.5">
            {isMember
              ? `สุ่ม 5 คำถามคละหมวด ข้อละ ${Math.round(CFG.answerSeconds / 60)} นาที — ข้อที่มีคลิป กรรมการอวตาร์จะถามเอง พูดตอบออกเสียงเหมือนอยู่หน้าห้องจริง`
              : `ลองซ้อมข้อทดลองฟรี ${pool.length} ข้อ ครบทุกขั้นเหมือนสมาชิก — กรรมการอวตาร์ถามแล้วจับเวลาตอบจริง`}
          </p>
          <button type="button" onClick={() => start("drill")}
            className="w-full py-3 rounded-2xl text-[14.5px] font-bold text-white active:scale-[0.98]"
            style={{ backgroundColor: BRAND.primary }}>
            {isMember ? `เริ่มซ้อม 5 ข้อ` : `ลองซ้อมฟรี ${pool.length} ข้อ`}
          </button>
          <p className="text-[12px] text-gray-400 mt-2.5 text-center">
            {progress && progress.seen > 0
              ? `เจอคำถามไปแล้ว ${progress.seen}/${progress.total} ข้อ — ข้อใหม่มาก่อน ข้อที่ยังไม่ลื่นวนกลับมาซ้ำ`
              : "ระบบจำให้ว่าเจอข้อไหนแล้ว ไม่สุ่มซ้ำจนกว่าจะครบคลัง"}
          </p>
        </div>
      </div>
    );
  }

  // ── จอสรุป ──
  if (phase === "done") {
    const qRatings = ratings.filter((r): r is Rating => r !== null);
    const count = (r: Rating) => qRatings.filter((x) => x === r).length;
    const good = count("good");
    const totalUsed = used.reduce((a, b) => a + b, 0);
    const msg =
      good >= Math.max(2, qRatings.length - 1) ? "เยี่ยมมาก! รักษาความลื่นนี้ไว้ ซ้อมทวนวันเว้นวันพอ" :
      good >= 1 ? "มาถูกทางแล้ว — ข้อที่ยังสะดุด กลับไปอ่านแนวทางในคลังคำถามแล้วซ้อมซ้ำ" :
      "ไม่เป็นไร ทุกคนเริ่มแบบนี้ — ซ้อมวันละรอบ อีกไม่กี่วันจะลื่นขึ้นชัดเจน";
    return (
      <div className="space-y-3">
        <div className="card-elev px-5 py-6">
          <p className="text-[17px] font-bold text-gray-900 text-center mb-1">
            {mode === "sim" ? "ออกจากห้องสัมภาษณ์ 🎉" : "จบรอบซ้อม 🎉"}
          </p>
          {mode === "sim" && (
            <p className="text-[13px] text-gray-500 text-center mb-4">
              อยู่ในห้องรวม {fmtTime(simTotal)} นาที (เวลาตอบจริง {fmtTime(totalUsed)} นาที)
            </p>
          )}
          {mode === "sim" ? (
            <div className="space-y-1.5 mb-4">
              {steps.map((s, i) => {
                const over = used[i] > stepSeconds(s);
                return (
                  <div key={i} className="flex items-center gap-2 text-[13px] rounded-xl px-3 py-2"
                    style={{ backgroundColor: "#F5FAF9" }}>
                    <span className="flex-1 truncate text-gray-700">
                      {s.kind === "intro" ? "แนะนำตัว" : s.q?.q}
                    </span>
                    <span className="font-bold tabular-nums flex-shrink-0"
                      style={{ color: over ? "#B91C1C" : BRAND.primary }}>
                      {fmtTime(used[i])}{over ? " (เกิน)" : ""}
                    </span>
                    {ratings[i] && <span className="flex-shrink-0">{RATING_META[ratings[i]!].emoji}</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex justify-center gap-3 mb-4 mt-3">
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
          )}
          <p className="text-[13.5px] text-gray-600 text-center leading-relaxed mb-5">{msg}</p>
          <button type="button" onClick={() => setPhase("idle")}
            className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98]"
            style={{ backgroundColor: BRAND.primary }}>
            {isMember ? "ซ้อมอีกรอบ" : "ลองอีกรอบ"}
          </button>
        </div>
        {!isMember && <JoinCta field={field} />}
      </div>
    );
  }

  // ── จอซ้อม ──
  const step = steps[idx];
  const q = step.q;
  const cat = q ? catOf(q.cat) : null;
  const clip = q ? clips.get(q.code) : undefined;
  const hasClip = playableClip(clip);
  const overtime = secs < 0;
  const warning = !overtime && secs <= CFG.warnAtSeconds;

  return (
    <div className="card-elev px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        {step.kind === "intro" ? (
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "#FDEEEE", color: "#B91C1C" }}>
            เปิดห้อง
          </span>
        ) : (
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${cat!.color}18`, color: cat!.color }}>
            {cat!.short}
          </span>
        )}
        <span className="text-[13px] font-semibold text-gray-400 tabular-nums">
          {mode === "sim"
            ? <>ขั้นที่ {idx + 1}/{steps.length} · <span style={{ color: "#B91C1C" }}>⏱ {fmtTime(simTotal)}</span></>
            : `ข้อ ${idx + 1}/${steps.length}`}
        </span>
      </div>

      <p className="text-[17px] font-bold text-gray-900 leading-snug mb-4">
        {step.kind === "intro"
          ? `เชิญแนะนำตัวเองให้คณะกรรมการรู้จักค่ะ (${Math.round(CFG.simIntroSeconds / 60)} นาที)`
          : q!.q}
      </p>

      {/* ขั้นฟังคำถามจากคลิป (ต้องให้ผู้ใช้กดเอง — มือถือบล็อก autoplay พร้อมเสียง) */}
      {sub === "listen" && !clipMedia && (
        <button type="button" onClick={playClip} disabled={clipLoading}
          className="w-full py-6 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98] mb-4 disabled:opacity-60"
          style={{ backgroundColor: BRAND.primary }}>
          {clipLoading ? "กำลังโหลดคลิป…" : "▶ เริ่มฟังคำถามจากกรรมการ"}
        </button>
      )}

      {clipMedia && (
        <div className="mb-4">
          <video ref={videoRef} controls playsInline preload="metadata"
            poster={clipMedia.posterUrl}
            onEnded={() => { if (sub === "listen") setSub("answer"); }}
            className="w-full rounded-2xl bg-black"
            style={{ maxHeight: "60vh" }}>
            <source src={clipMedia.videoUrl} type="video/mp4" />
            {clipMedia.captionsUrl && (
              <track src={clipMedia.captionsUrl} kind="subtitles" srcLang="th" label="ไทย" default />
            )}
          </video>
          {sub === "listen" && (
            <button type="button" onClick={() => setSub("answer")}
              className="w-full py-2 mt-2 text-[12.5px] font-semibold underline" style={{ color: "#6B7280" }}>
              ข้ามไปเริ่มตอบเลย
            </button>
          )}
        </div>
      )}

      {sub === "answer" && (
        <>
          {hasClip && clipMedia && (
            <button type="button" onClick={replay}
              className="text-[12px] font-semibold underline mb-2 block" style={{ color: BRAND.primary }}>
              🔁 ฟังคำถามซ้ำ (นาฬิกาเดินต่อนะ)
            </button>
          )}
          <div className="rounded-2xl px-4 py-4 text-center mb-4"
            style={{ backgroundColor: overtime ? "#FDEEEE" : warning ? "#FDF6E9" : "#F5FAF9" }}>
            <p className="text-[30px] font-extrabold tabular-nums leading-none"
              style={{ color: overtime ? "#B91C1C" : warning ? "#B45309" : BRAND.primary }}>
              {overtime ? `+${fmtTime(secs)}` : fmtTime(secs)}
            </p>
            <p className="text-[12.5px] mt-1.5"
              style={{ color: overtime ? "#B91C1C" : warning ? "#B45309" : "#6B7280" }}>
              {overtime
                ? "เกินเวลาแล้ว — สนามจริงกรรมการจะขัดตรงนี้ รีบสรุปให้จบประโยคสวย ๆ"
                : warning
                ? `เหลือ ${secs} วินาที — เริ่มสรุปปิดท้ายได้แล้ว`
                : "พูดตอบออกเสียงเลย เหมือนกรรมการนั่งอยู่ตรงหน้า"}
            </p>
          </div>
          <button type="button"
            onClick={() => (step.kind === "intro" ? finishStep(null) : setSub("revealed"))}
            className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98]"
            style={{ backgroundColor: BRAND.primary }}>
            ตอบจบแล้ว → {step.kind === "intro" ? "ไปข้อถัดไป" : "เปิดแนวทาง"}
          </button>
        </>
      )}

      {sub === "revealed" && q && (
          <>
            <div className="mb-4">
              <HintBox hints={q.hints} title="พี่อ้อมแนะนำ — ลองเทียบดูว่าที่เราตอบครบไหม" />
            </div>
            <p className="text-[13px] font-semibold text-gray-600 text-center mb-2.5">
              รอบนี้ตอบได้แค่ไหน (ตามตรงนะ)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(RATING_META) as Rating[]).map((r) => (
                <button key={r} type="button" onClick={() => finishStep(r)}
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
                    className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-xl text-left active:bg-stone-50">
                    <span className="w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center text-[11px] font-bold"
                      style={isDone
                        ? { backgroundColor: BRAND.primary, color: "white" }
                        : { border: "1.5px solid #D4D4D0", color: "transparent" }}>
                      ✓
                    </span>
                    <span className={`text-[13.5px] leading-relaxed ${isDone ? "line-through text-gray-400" : "text-gray-700"}`}>
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
