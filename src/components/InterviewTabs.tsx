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
  ANSWER_PRINCIPLES, INTERVIEW_CHECKLIST, PRACTICE_CONFIG, PRESSURE_PROMPTS,
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

// ── คลิปหลายเวอร์ชันต่อข้อ (Aj 2026-10-17: ข้อแนะนำตัวอัดหลายแบบ
//    กันน้องซ้อมหลายรอบเจอคลิปเดิมทุกครั้ง) ──
// ตั้งชื่อไฟล์: SPS-C-001.mp4 = แบบแรก · SPS-C-001-2.mp4 ถึง -9 = แบบถัดไป
// ทุกเวอร์ชันแชร์รหัสคำถามเดิม — ตัวสุ่มเลือกให้เอง ไม่ซ้ำแบบที่เพิ่งเจอ

/** ทุกเวอร์ชันที่เล่นได้ของข้อนี้ (freeOnly = เอาเฉพาะข้อ 🎁 สำหรับ guest) */
function clipVariants(
  clips: Map<string, InterviewClip>, code: string, freeOnly = false,
): InterviewClip[] {
  const out: InterviewClip[] = [];
  const keep = (c?: InterviewClip) => {
    if (playableClip(c) && (!freeOnly || c!.isFreePreview)) out.push(c!);
  };
  keep(clips.get(code));
  for (let i = 2; i <= 9; i++) keep(clips.get(`${code}-${i}`));
  return out;
}

/** สุ่มเวอร์ชันมาเล่น — จำแบบล่าสุดไว้ใน localStorage กันสุ่มซ้ำติดกัน */
function pickClipVariant(
  clips: Map<string, InterviewClip>, code: string, freeOnly = false,
): InterviewClip | undefined {
  const vs = clipVariants(clips, code, freeOnly);
  if (vs.length === 0) return undefined;
  if (vs.length === 1) return vs[0];
  const key = `interview-clip-last-${code}`;
  let last = "";
  try { last = localStorage.getItem(key) ?? ""; } catch {}
  const fresh = vs.filter((v) => v.code !== last);
  const from = fresh.length > 0 ? fresh : vs;
  const pick = from[Math.floor(Math.random() * from.length)];
  try { localStorage.setItem(key, pick.code); } catch {}
  return pick;
}

// ─── การ์ดชวนสมัคร (จบโหมดทดลองฟรี — handoff 2.6) ────────────────────────────

export function JoinCta({ field }: { field: ExamFieldKey }) {
  // ขายแพ็กซ้อมภาค ค แยก (Aj 2026-10-17): สนามเดียว 159 · สองสนาม 199
  // สมาชิกคอร์สหลักไม่เห็นการ์ดนี้อยู่แล้ว (เมนูนี้ใช้ฟรี)
  const meta = EXAM_FIELDS.find((f) => f.id === field);
  const partcHref = field === "dcd" ? "/checkout/partc-dcd" : "/checkout/partc-moph";
  return (
    <div className="rounded-2xl px-5 py-5 text-center"
      style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FCD34D" }}>
      <p className="text-[16px] font-bold" style={{ color: "#92400E" }}>
        ชอบไหมคะ? คลังเต็มมีให้ซ้อมทุกหมวด 🎤
      </p>
      <p className="text-[13px] mt-1 mb-4 leading-relaxed" style={{ color: "#B45309" }}>
        ปลดล็อกครั้งเดียวซ้อมได้ไม่อั้นทุกข้อ ทั้งคลิปกรรมการอวตาร์
        แนวทางตอบจากพี่อ้อมทีละข้อ ห้องจำลองสัมภาษณ์ 5 นาที และห้องกดดัน
      </p>
      <a href={partcHref}
        className="block w-full py-3 rounded-xl text-[14.5px] font-bold text-white active:scale-[0.98] transition-transform"
        style={{ backgroundColor: BRAND.primary }}>
        ปลดล็อกซ้อมภาค ค {meta?.code ?? ""} — 159 บาท
      </a>
      <a href="/checkout/partc-duo"
        className="block w-full py-2.5 mt-2 rounded-xl text-[13.5px] font-bold"
        style={{ backgroundColor: "white", border: `1.5px solid ${BRAND.primary}`, color: BRAND.primary }}>
        สอบทั้ง สป.สธ. และ คร.? แพ็กคู่ 199 บาท
      </a>
      <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer"
        className="block w-full py-2.5 mt-2 rounded-xl text-[13.5px] font-semibold"
        style={{ backgroundColor: "white", border: "1px solid #E0DFDC", color: "#07A94D" }}>
        💬 ทัก LINE ถามพี่อ้อมก่อนได้
      </a>
      <p className="text-[11.5px] mt-3" style={{ color: "#B45309", opacity: 0.75 }}>
        น้องที่อยู่คอร์สหลักกับพี่อ้อมอยู่แล้ว เมนูนี้ใช้ฟรีเลย แค่เข้าสู่ระบบค่ะ
      </p>
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
                const vs = clipVariants(clips, q.code);
                const hasClip = vs.length > 0;
                const free = vs.some((v) => v.isFreePreview);
                const locked = !isMember && !free;
                return (
                  <div key={q.id} className="card-elev overflow-hidden"
                    style={locked ? { opacity: 0.8 } : undefined}>
                    <button type="button" onClick={() => toggle(q.id)}
                      className="w-full px-4 py-3 flex items-start gap-3 text-left active:bg-stone-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14.5px] font-semibold text-gray-900 leading-snug">{q.q}</p>
                        {(hasClip || free) && (
                          <p className="text-[11px] mt-1 flex items-center gap-1.5">
                            {hasClip && (
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

type Mode = "drill" | "sim" | "pressure";
type Sub = "listen" | "answer" | "pressure" | "revealed";

/** สุ่มคำถามจี้แบบไม่ซ้ำจนกว่าจะวนครบคลัง (จำตัวที่เจอแล้วใน localStorage) */
function pickPressurePrompt(): string {
  const KEY = "interview-pressure-seen";
  let seen: number[] = [];
  try { seen = JSON.parse(localStorage.getItem(KEY) ?? "[]") as number[]; } catch {}
  let unseen = PRESSURE_PROMPTS.map((_, i) => i).filter((i) => !seen.includes(i));
  if (unseen.length === 0) { seen = []; unseen = PRESSURE_PROMPTS.map((_, i) => i); }
  const pick = unseen[Math.floor(Math.random() * unseen.length)];
  try { localStorage.setItem(KEY, JSON.stringify([...seen, pick])); } catch {}
  return PRESSURE_PROMPTS[pick];
}

/** โหมดทดลองห้องซ้อมจริงของ guest — ฟรี 1 รอบต่อสนาม (Aj 2026-10-17) */
const trialKey = (field: ExamFieldKey) => `interview-sim-trial-${field}`;
function trialUsed(field: ExamFieldKey): boolean {
  try { return localStorage.getItem(trialKey(field)) === "1"; } catch { return false; }
}

/** 1 ขั้นของรอบซ้อม — โหมดจำลองห้องมีขั้น "แนะนำตัว" นำหน้า */
interface Step {
  kind: "intro" | "question";
  q?: InterviewQuestion;
  title: string;
}

export function PracticeMode({ ctx, onExit }: { ctx: TabCtx; onExit?: () => void }) {
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
  // หน่วง 3 วิ ก่อนคลิปเล่น — เว้นจังหวะให้ตั้งสติเหมือนห้องจริง (Aj 2026-10-17)
  const [preCount, setPreCount] = useState<number | null>(null);
  // ห้องกดดัน: คำจี้ของข้อปัจจุบัน + เวลาตอบช่วงแรก (ไว้รวมเวลาใช้จริง)
  const [pressureText, setPressureText] = useState("");
  const answerUsedRef = useRef<number | null>(null);
  const pressureCountRef = useRef(0);
  // guest: ทดลองห้องซ้อมจริงฟรี 1 รอบ
  const [simTrialUsed, setSimTrialUsed] = useState(false);
  useEffect(() => { setSimTrialUsed(trialUsed(field)); }, [field]);
  // นาฬิการวมของโหมดจำลองห้อง — เดินตลอดเหมือนเวลาจริงในห้อง (handoff 2.5)
  // หยุดเฉพาะตอนเปิดแนวทาง/ให้คะแนน (ช่วงนั้นหลุดจากบทสมมติแล้ว)
  const [simTotal, setSimTotal] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // player คุมเอง — ไม่ใช้แถบควบคุมของเบราว์เซอร์ (ปุ่มหยุด/±10 วิ ของ iOS
  // ลอยบังหน้ากรรมการตอนคำถามกำลังถาม — Aj แจ้ง 2026-10-17)
  // คลิปเล่นอยู่ = จอโล่งทั้งใบ · หยุด/เล่นไม่ได้ = ปุ่ม ▶ กลางจอปุ่มเดียว
  const [clipPaused, setClipPaused] = useState(true);
  const [clipEnded, setClipEnded] = useState(false);

  // ── อัดเสียงคำตอบไว้ฟังทบทวน (handoff 2.8) ──
  // เก็บเฉพาะในหน่วยความจำของรอบนี้ ไม่อัปโหลดขึ้นเซิร์ฟเวอร์เด็ดขาด (ข้อมูลส่วนบุคคล)
  // ขอไมค์เมื่อผู้ใช้กดเองเท่านั้น · iOS Safari ใช้ audio/mp4 · Chrome ใช้ audio/webm
  // ไม่ได้สิทธิ์ก็ซ้อมต่อได้ตามปกติ
  const [recEnabled, setRecEnabled] = useState(false);
  const [recDenied, setRecDenied] = useState(false);
  const [recLive, setRecLive] = useState(false);
  const [recordings, setRecordings] = useState<Record<number, string>>({});
  const recordingsRef = useRef<Record<number, string>>({});
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRec = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    try {
      const mime = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start();
      recorderRef.current = rec;
      setRecLive(true);
    } catch { setRecLive(false); }
  }, []);

  const stopRec = useCallback((saveIdx: number | null) => {
    const rec = recorderRef.current;
    setRecLive(false);
    if (!rec || rec.state === "inactive") return;
    rec.onstop = () => {
      if (saveIdx !== null && chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        const url = URL.createObjectURL(blob);
        recordingsRef.current = { ...recordingsRef.current, [saveIdx]: url };
        setRecordings(recordingsRef.current);
      }
      chunksRef.current = [];
    };
    try { rec.stop(); } catch {}
  }, []);

  async function enableRec() {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecEnabled(true);
      setRecDenied(false);
      if (phase === "run" && sub === "answer") startRec();
    } catch {
      setRecDenied(true);
    }
  }

  // เริ่มอัดอัตโนมัติเมื่อเข้าช่วงตอบ (ถ้าเปิดอัดไว้แล้ว) — ข้อถัดไปไม่ต้องกดซ้ำ
  useEffect(() => {
    if (phase === "run" && sub === "answer" && recEnabled && !recLive) startRec();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sub, idx, recEnabled]);

  // จบรอบ/ออกจากซ้อม → คืนไมค์ให้เครื่อง (ไฟล์เสียงที่อัดไว้ยังฟังได้จนกว่าจะเริ่มรอบใหม่)
  useEffect(() => {
    if (phase === "run") return;
    stopRec(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecEnabled(false);
  }, [phase, stopRec]);

  // คลังที่ซ้อมได้: สมาชิก = ทั้งสนาม · ทดลองฟรี = เฉพาะข้อ 🎁 ที่มีคลิปเผยแพร่
  const pool = useMemo(() => {
    const all = questionsForField(field);
    if (isMember) return all;
    return all.filter((q) => clipVariants(clips, q.code, true).length > 0);
  }, [field, isMember, clips]);

  useEffect(() => {
    if (phase === "run") return;
    setProgress(practiceProgress(field, loadPracticeStats(field)));
  }, [field, phase]);

  // นาฬิกาเดินช่วงตอบและช่วงโดนจี้ — เกินเวลาไม่หยุด (นับติดลบ เพื่อโชว์เวลาที่เกิน)
  useEffect(() => {
    if (phase !== "run" || (sub !== "answer" && sub !== "pressure")) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => setSecs((s) => s - 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, sub, idx]);

  // นาฬิการวม (โหมดจำลองห้อง/ห้องกดดัน) — เดินทั้งช่วงฟังคำถามและช่วงตอบ
  useEffect(() => {
    if (phase !== "run" || mode === "drill" || sub === "revealed") {
      if (totalRef.current) { clearInterval(totalRef.current); totalRef.current = null; }
      return;
    }
    totalRef.current = setInterval(() => setSimTotal((s) => s + 1), 1000);
    return () => { if (totalRef.current) clearInterval(totalRef.current); };
  }, [phase, mode, sub]);

  // นับถอยหลังตั้งสติ 3..2..1 ก่อนคลิปเล่น
  useEffect(() => {
    if (preCount === null) return;
    if (preCount <= 0) {
      setPreCount(null);
      videoRef.current?.play().catch(() => {});
      return;
    }
    const t = setTimeout(() => setPreCount((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [preCount]);

  /** เวลาเริ่มต้นของขั้นนี้ */
  const stepSeconds = (s: Step) => (s.kind === "intro" ? CFG.simIntroSeconds : CFG.answerSeconds);

  const playClip = useCallback(async (clipCode: string) => {
    setClipLoading(true);
    const media = await fetchClipUrl(clipCode, await getToken());
    setClipLoading(false);
    if (!media) { setSub("answer"); return; } // โหลดคลิปไม่ได้ → ใช้การ์ดข้อความ ไม่พัง flow
    setClipMedia(media);
    setClipPaused(true);
    setClipEnded(false);
    // หน่วง 3 วิ ให้ตั้งสติก่อนกรรมการถาม (Aj 2026-10-17) แล้วค่อยเล่นเอง —
    // ถ้าเครื่องไหนบล็อก autoplay น้องเห็นตัวเล่นพร้อมปุ่ม play จิ้มเองได้ ไม่ค้าง
    setPreCount(PRACTICE_CONFIG.preClipDelaySeconds);
  }, [getToken]);

  const beginStep = useCallback(async (list: Step[], i: number) => {
    const step = list[i];
    setIdx(i);
    setSecs(stepSeconds(step));
    setClipMedia(null);
    setPreCount(null);
    setPressureText("");
    answerUsedRef.current = null;
    // สุ่มเวอร์ชันคลิปของข้อนี้ (ข้อที่อัดหลายแบบ เช่น แนะนำตัว จะไม่เจอแบบเดิมซ้ำ)
    // guest เล่นได้เฉพาะเวอร์ชัน 🎁 — ข้อล็อกเป็นการ์ดข้อความตามเดิม
    const clip = step.q ? pickClipVariant(clips, step.q.code, !isMember) : undefined;
    if (clip && step.q) {
      setSub("listen");
      playClip(clip.code);
    } else {
      setSub("answer");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, playClip]);

  /** สุ่มแบบ "ข้อที่มีคลิปมาก่อนเสมอ" (Aj 2026-10-17) — คลิปไม่พอค่อยเติมการ์ดข้อความ
   *  Aj ผลิตคลิปเพิ่มเรื่อย ๆ ระบบจะดึงข้อใหม่ที่มีคลิปเข้ารอบซ้อมเองอัตโนมัติ */
  const pickWithClipsFirst = useCallback((n: number, exclude: string[] = []) => {
    const stats = loadPracticeStats(field);
    const ok = (q: InterviewQuestion) => !exclude.includes(q.id);
    const clipQs = pool.filter((q) => ok(q) && clipVariants(clips, q.code).length > 0);
    const textQs = pool.filter((q) => ok(q) && clipVariants(clips, q.code).length === 0);
    const picked = pickPracticeSet(field, n, stats, clipQs);
    if (picked.length < n) {
      picked.push(...pickPracticeSet(field, n - picked.length, stats, textQs));
    }
    return picked.slice(0, n);
  }, [field, pool, clips]);

  const start = (m: Mode) => {
    let list: Step[];
    if (m !== "drill") {
      // จำลองห้อง/ห้องกดดัน: แนะนำตัว + สุ่มคำถาม (คลิปมาก่อน) —
      // guest ที่ใช้สิทธิ์ทดลอง 1 รอบ ใช้คลังเต็มเหมือนสมาชิก (ข้อล็อกเป็นการ์ดข้อความ)
      const all = questionsForField(field);
      const intro = all.find((q) => q.id === "intro-self");
      const stats = loadPracticeStats(field);
      const clipQs = all.filter((q) => q.id !== "intro-self" && clipVariants(clips, q.code).length > 0);
      const textQs = all.filter((q) => q.id !== "intro-self" && clipVariants(clips, q.code).length === 0);
      const rest = pickPracticeSet(field, CFG.simQuestionCount, stats, clipQs);
      if (rest.length < CFG.simQuestionCount) {
        rest.push(...pickPracticeSet(field, CFG.simQuestionCount - rest.length, stats, textQs));
      }
      list = [
        { kind: "intro", q: intro, title: "แนะนำตัวเอง" },
        ...rest.map((q) => ({ kind: "question" as const, q, title: q.q })),
      ];
      pressureCountRef.current = 0;
    } else {
      // ทดลองฟรี: คลังเล็ก สุ่มจากที่มี (อาจน้อยกว่า 5)
      const picked = isMember
        ? pickWithClipsFirst(5)
        : [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
      list = picked.map((q) => ({ kind: "question" as const, q, title: q.q }));
    }
    if (list.length === 0) return;
    // รอบใหม่ — ล้างไฟล์เสียงรอบก่อน (เก็บเฉพาะในหน่วยความจำ ไม่อัปโหลด)
    Object.values(recordingsRef.current).forEach((u) => { if (u) URL.revokeObjectURL(u); });
    recordingsRef.current = {};
    setRecordings({});
    setMode(m);
    setSteps(list);
    setRatings([]);
    setUsed([]);
    setSimTotal(0);
    setPhase("run");
    beginStep(list, 0);
  };

  function replay() {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }

  /** แตะที่คลิป = สลับเล่น/หยุด (จบแล้วแตะ = เล่นใหม่ตั้งแต่ต้น) */
  function toggleClip() {
    const v = videoRef.current;
    if (!v) return;
    if (v.ended) { v.currentTime = 0; v.play().catch(() => {}); return; }
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }

  const finishStep = (r: Rating | null) => {
    const step = steps[idx];
    if (step.q && r) recordPracticeRating(field, step.q.id, r);
    setRatings((p) => [...p, r]);
    // เวลาใช้จริง: ข้อที่โดนจี้ = เวลาตอบหลัก + เวลาตอบคำจี้
    const timeUsed = answerUsedRef.current !== null
      ? answerUsedRef.current + (CFG.pressureSeconds - secs)
      : stepSeconds(step) - secs;
    setUsed((p) => [...p, timeUsed]);
    if (idx + 1 >= steps.length) {
      // guest จบรอบจำลองห้อง = ใช้สิทธิ์ทดลองฟรี 1 รอบแล้ว
      if (!isMember && mode !== "drill") {
        try { localStorage.setItem(trialKey(field), "1"); } catch {}
        setSimTrialUsed(true);
      }
      setPhase("done");
      return;
    }
    beginStep(steps, idx + 1);
  };

  /** กดตอบจบในช่วงตอบหลัก — ห้องกดดันมีโอกาสโดนกรรมการจี้ต่อก่อนเปิดแนวทาง */
  const finishAnswer = () => {
    const step = steps[idx];
    if (step.kind === "intro") {
      if (recEnabled) stopRec(idx);
      finishStep(null);
      return;
    }
    const isLast = idx + 1 >= steps.length;
    const shouldPress = mode === "pressure" && answerUsedRef.current === null &&
      (Math.random() < CFG.pressureChance || (isLast && pressureCountRef.current === 0));
    if (shouldPress) {
      answerUsedRef.current = stepSeconds(step) - secs;
      pressureCountRef.current += 1;
      setPressureText(pickPressurePrompt());
      setSecs(CFG.pressureSeconds);
      setSub("pressure");
      return; // ไมค์อัดต่อเนื่อง — เสียงช่วงโดนจี้คือของดีไว้ฟังย้อน
    }
    if (recEnabled) stopRec(idx);
    setSub("revealed");
  };

  // ── จอเริ่ม ──
  if (phase === "idle") {
    return (
      <div className="space-y-3">
        {/* จำลองห้องสัมภาษณ์ — สมาชิกเต็มรูปแบบ · guest ลองฟรี 1 รอบ (Aj 2026-10-17) */}
        {(isMember || !simTrialUsed) && (
          <div className="card-elev px-5 py-5">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[16px] font-bold text-gray-900">จำลองห้องสัมภาษณ์ 5 นาที</p>
              <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "#FDEEEE", color: "#B91C1C" }}>
                {isMember ? "เหมือนจริง" : "ลองฟรี 1 รอบ"}
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
              🎬 เข้าห้องสัมภาษณ์{!isMember && " (ฟรี 1 รอบ)"}
            </button>
          </div>
        )}

        {/* guest ใช้สิทธิ์ทดลองแล้ว → ชวนสมัคร */}
        {!isMember && simTrialUsed && <JoinCta field={field} />}

        {/* ห้องกดดัน — เฉพาะสมาชิก (Aj 2026-10-17: กรรมการจริงจี้เพื่อวัดการคุมอารมณ์) */}
        {isMember && (
          <div className="card-elev px-5 py-5" style={{ border: "1.5px solid #FCA5A5" }}>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[16px] font-bold text-gray-900">ห้องกดดัน</p>
              <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "#7F1D1D", color: "white" }}>
                🔥 วัดการคุมสติ
              </span>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed mb-3.5">
              เหมือนจำลองห้อง แต่ตอบจบแล้วกรรมการอาจ &ldquo;จี้ต่อทันที&rdquo; แบบห้องจริง —
              รีวิวรุ่นพี่บอกตรงกันว่าบางห้องกดดันเพื่อดูความนิ่ง ซ้อมรับแรงจี้ไว้ก่อน วันจริงจะไม่ลน
            </p>
            <button type="button" onClick={() => start("pressure")}
              className="w-full py-3 rounded-2xl text-[14.5px] font-bold text-white active:scale-[0.98]"
              style={{ backgroundColor: "#7F1D1D" }}>
              🔥 เข้าห้องกดดัน
            </button>
          </div>
        )}

        {/* ซ้อมเก็บข้อ */}
        {(isMember || pool.length > 0) && (
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
        )}
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
            {mode === "pressure" ? "รอดจากห้องกดดันแล้ว 🔥" : mode === "sim" ? "ออกจากห้องสัมภาษณ์ 🎉" : "จบรอบซ้อม 🎉"}
          </p>
          {mode !== "drill" && (
            <p className="text-[13px] text-gray-500 text-center mb-4">
              อยู่ในห้องรวม {fmtTime(simTotal)} นาที (เวลาตอบจริง {fmtTime(totalUsed)} นาที)
              {mode === "pressure" && ` · โดนจี้ ${pressureCountRef.current} ครั้ง`}
            </p>
          )}
          {mode !== "drill" ? (
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
          {Object.keys(recordings).length > 0 && (
            <div className="mb-5">
              <p className="text-[13px] font-bold text-gray-700 mb-2">
                🎧 เสียงคำตอบของเรารอบนี้ <span className="font-normal text-gray-400">(อยู่ในเครื่องเท่านั้น หายเมื่อเริ่มรอบใหม่)</span>
              </p>
              <div className="space-y-2">
                {steps.map((s, i) => recordings[i] ? (
                  <div key={i} className="rounded-xl px-3 py-2" style={{ backgroundColor: "#F5FAF9" }}>
                    <p className="text-[12px] text-gray-600 truncate mb-1">
                      {s.kind === "intro" ? "แนะนำตัว" : s.q?.q}
                    </p>
                    <audio controls src={recordings[i]} className="w-full" style={{ height: 36 }} />
                  </div>
                ) : null)}
              </div>
            </div>
          )}
          <button type="button" onClick={() => start(mode)}
            className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98]"
            style={{ backgroundColor: BRAND.primary }}>
            {isMember ? "ซ้อมอีกรอบ (สุ่มชุดใหม่)" : "ลองอีกรอบ"}
          </button>
          <button type="button"
            onClick={() => { setPhase("idle"); onExit?.(); }}
            className="w-full py-3 mt-2 rounded-2xl text-[14px] font-semibold active:scale-[0.98]"
            style={{ backgroundColor: "white", border: "1px solid #E0DFDC", color: "#6B7280" }}>
            ✓ ซ้อมเสร็จแล้ว — กลับหน้าเมนูภาค ค
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
  const hasClip = q ? clipVariants(clips, q.code, !isMember).length > 0 : false;
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
          {mode !== "drill"
            ? <>ขั้นที่ {idx + 1}/{steps.length} · <span style={{ color: "#B91C1C" }}>⏱ {fmtTime(simTotal)}</span></>
            : `ข้อ ${idx + 1}/${steps.length}`}
        </span>
      </div>

      <p className="text-[17px] font-bold text-gray-900 leading-snug mb-4">
        {step.kind === "intro"
          ? `เชิญแนะนำตัวเองให้คณะกรรมการรู้จักค่ะ (${Math.round(CFG.simIntroSeconds / 60)} นาที)`
          : q!.q}
      </p>

      {/* กำลังเชิญกรรมการ (โหลดคลิป) — เล่นต่อเองทันทีที่พร้อม */}
      {sub === "listen" && !clipMedia && clipLoading && (
        <div className="w-full py-6 rounded-2xl text-center mb-4"
          style={{ backgroundColor: "#F5FAF9" }}>
          <span className="inline-block w-5 h-5 border-[3px] border-[#C3E5DE] border-t-[#0B6E65] rounded-full animate-spin align-middle mr-2" />
          <span className="text-[13.5px] font-semibold" style={{ color: BRAND.primary }}>
            กรรมการกำลังจะถาม…
          </span>
        </div>
      )}

      {/* หน่วงตั้งสติ 3..2..1 ก่อนกรรมการถาม */}
      {preCount !== null && preCount > 0 && (
        <p className="text-[12.5px] font-semibold text-center mb-2 tabular-nums"
          style={{ color: BRAND.primary }}>
          หายใจลึก ๆ … กรรมการจะถามในอีก {preCount}
        </p>
      )}
      {clipMedia && (
        <div className="mb-4">
          <div className="relative">
            <video ref={videoRef} playsInline preload="metadata"
              poster={clipMedia.posterUrl}
              onClick={toggleClip}
              onPlay={() => { setClipPaused(false); setClipEnded(false); }}
              onPause={(e) => {
                // ตอนคลิปจบ event pause มาก่อน ended — เซ็ต ended ตรงนี้ด้วย
                // กันปุ่ม ▶ แวบขึ้นหนึ่งเฟรมก่อนเปลี่ยนไปช่วงตอบ
                setClipPaused(true);
                if (e.currentTarget.ended) setClipEnded(true);
              }}
              onEnded={() => { setClipEnded(true); if (sub === "listen") setSub("answer"); }}
              className="w-full rounded-2xl bg-black"
              style={{ maxHeight: "60vh" }}>
              <source src={clipMedia.videoUrl} type="video/mp4" />
              {clipMedia.captionsUrl && (
                <track src={clipMedia.captionsUrl} kind="subtitles" srcLang="th" label="ไทย" default />
              )}
            </video>
            {/* ปุ่มเล่นโผล่เฉพาะตอนคลิปหยุดจริง ๆ (ไม่โผล่ช่วงนับ 3..2..1 ตั้งสติ) —
                เครื่องที่บล็อก autoplay น้องแตะปุ่มนี้เริ่มเองได้ ไม่ค้าง */}
            {clipPaused && !clipEnded && preCount === null && (
              <button type="button" onClick={toggleClip} aria-label="เล่นคลิปคำถาม"
                className="absolute inset-0 flex items-center justify-center">
                <span className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
                  <svg viewBox="0 0 24 24" fill="white" className="w-8 h-8 ml-1">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </button>
            )}
          </div>
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
          {/* อัดเสียงคำตอบ — ขอไมค์เมื่อผู้ใช้กดเองเท่านั้น เก็บในเครื่อง ไม่อัปโหลด */}
          {!recEnabled && !recDenied && (
            <button type="button" onClick={enableRec}
              className="w-full py-2.5 mb-2.5 rounded-xl text-[12.5px] font-semibold"
              style={{ backgroundColor: "white", border: "1px dashed #D4D4D0", color: "#6B7280" }}>
              🎙 อัดเสียงคำตอบไว้ฟังทบทวน (เก็บในเครื่อง ไม่ส่งขึ้นระบบ)
            </button>
          )}
          {recLive && (
            <p className="text-[12px] font-semibold text-center mb-2.5" style={{ color: "#B91C1C" }}>
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 animate-pulse"
                style={{ backgroundColor: "#B91C1C" }} />
              กำลังอัดเสียง — จะหยุดเองตอนกดตอบจบ
            </p>
          )}
          {recDenied && (
            <p className="text-[11.5px] text-center mb-2.5 text-gray-400">
              ไม่ได้รับสิทธิ์ไมค์ — ซ้อมต่อได้ตามปกติ (เปิดสิทธิ์ได้ในตั้งค่าเบราว์เซอร์)
            </p>
          )}
          <button type="button" onClick={finishAnswer}
            className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98]"
            style={{ backgroundColor: BRAND.primary }}>
            ตอบจบแล้ว → {step.kind === "intro" ? "ไปข้อถัดไป" : "เปิดแนวทาง"}
          </button>
        </>
      )}

      {/* ── กรรมการจี้ต่อ (ห้องกดดัน) ── */}
      {sub === "pressure" && (
        <>
          <div className="rounded-2xl px-4 py-3.5 mb-3"
            style={{ backgroundColor: "#FDEEEE", border: "1.5px solid #FCA5A5" }}>
            <p className="text-[11.5px] font-bold mb-1" style={{ color: "#B91C1C" }}>
              กรรมการถามต่อทันที
            </p>
            <p className="font-exam text-[16px] font-semibold leading-snug" style={{ color: "#7F1D1D" }}>
              &ldquo;{pressureText}&rdquo;
            </p>
          </div>
          <div className="rounded-2xl px-4 py-4 text-center mb-4"
            style={{ backgroundColor: secs < 0 ? "#FDEEEE" : "#FFF7ED" }}>
            <p className="text-[30px] font-extrabold tabular-nums leading-none"
              style={{ color: secs < 0 ? "#B91C1C" : "#C2410C" }}>
              {secs < 0 ? `+${fmtTime(secs)}` : fmtTime(secs)}
            </p>
            <p className="text-[12.5px] mt-1.5" style={{ color: "#C2410C" }}>
              นิ่งไว้ หายใจ แล้วตอบสั้น ๆ ให้ตรงคำถาม — กรรมการวัดการคุมอารมณ์ ไม่ได้วัดความยาว
            </p>
          </div>
          <button type="button"
            onClick={() => { if (recEnabled) stopRec(idx); setSub("revealed"); }}
            className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98]"
            style={{ backgroundColor: "#B91C1C" }}>
            ตอบจบแล้ว → เปิดแนวทาง
          </button>
        </>
      )}

      {sub === "revealed" && q && (
          <>
            {recordings[idx] && (
              <div className="mb-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: "#F5FAF9" }}>
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: BRAND.primary }}>
                  🎧 ฟังเสียงคำตอบของเราก่อนเทียบแนวทาง
                </p>
                <audio controls src={recordings[idx]} className="w-full" style={{ height: 36 }} />
              </div>
            )}
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
