"use client";
/**
 * /stat-game — เกมเลือกสถิติ 2 โหมด (ฟอนต์ Sarabun ทั้งหน้า — font-exam ที่ root)
 *
 * โหมดสอบจริง (recall): โจทย์ → ตอบสถิติทันทีจาก 4 ตัวเลือก (ตัวลวง = ญาติใกล้เคียง)
 *   ตอบผิด = ข้อถูกวนกลับมาถามซ้ำจนกว่าจะตอบถูกเอง (retrieval practice)
 *   เฉลยโชว์เส้นทางเงื่อนไข = ใช้ tree เป็นกระจกส่องจุดพลาด ไม่ใช่ไม้เท้า
 * โหมดฝึก (practice): ไล่เงื่อนไขทีละขั้นแบบเดิม — สำหรับคนเพิ่งเริ่มจับโครง
 *
 * สิทธิ์: login เท่านั้น — เล่นฟรีครบทุกข้อทุกโหมด (ของแจกชวนคนยังไม่ซื้อคอร์ส)
 */
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { getUserAccess } from "@/lib/access";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";
import { PRICING } from "@/lib/pricing";
import {
  TREE, STATS, SCENARIOS, shuffleScenarios, routeLabels, buildChoices,
  type Scenario, type TreeOption,
} from "@/lib/stat-game";
import { getStatGameBest, saveStatGameRun, type StatGameBest } from "@/lib/stat-game-stats";

const ACCENT = "#0B6E65";
const LINE   = "#ECEBE9";
const MUTED  = "#A8A29E";
const CARD_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.05)";

// ── ดีไซน์ "สดใสปุ่มหนา" (แนว A ที่ Aj เลือก 2026-07-27) ──
// ปุ่ม .chunky (globals.css) + ชุดสีนี้: ขาว/เขียว/แดง มีขอบล่างเข้มให้มิติกด
const CH_WHITE  = { backgroundColor: "white",   borderColor: "#E3E1DC", borderBottomColor: "#D2D0CB", color: "#374151" };
const CH_GREEN  = { backgroundColor: ACCENT,    borderColor: ACCENT,    borderBottomColor: "#063E38", color: "white" };
const CH_RED    = { backgroundColor: "#EF4444", borderColor: "#EF4444", borderBottomColor: "#B91C1C", color: "white" };
const QCARD     = { backgroundColor: "#F4FBF8", border: "2px solid #C3E5DE" };  // การ์ดโจทย์โทนมินต์
const HUD_GREEN = { backgroundColor: ACCENT };                                   // แถบบนสีแบรนด์
const TIMER_TRACK = "#E1F5EE";

// เกมนี้ "ฟรีทุกโหมดทุกข้อ" (Aj 2026-07-27) — แจกให้คนยังไม่ซื้อคอร์สมาลองเล่น
// เพื่อการตลาด · ยังต้อง login เพื่อเก็บสถิติสูงสุดต่อคน
const TIME_PER_Q     = 30;   // วินาทีต่อข้อในโหมดเกม (Aj ปรับจาก 20 — โจทย์ยาว อ่านไม่ทัน)
const MAX_HEARTS     = 3;

type Mode = "recall" | "practice" | "arcade";
type Picked = { label: string };

const CONFETTI_COLORS = ["#0B6E65", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899"];

export default function StatGamePage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();
  const router   = useRouter();

  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [mode,     setMode]     = useState<Mode | null>(null);

  // ── โหมดสอบจริง ──
  const [queue,    setQueue]    = useState<Scenario[]>([]);
  const [total,    setTotal]    = useState(0);
  const [chosen,   setChosen]   = useState<string | null>(null);
  const [attempt,  setAttempt]  = useState(0); // เพิ่มทุกครั้งที่เปลี่ยนข้อ — ให้ตัวเลือกสุ่มใหม่
  const [firstTry, setFirstTry] = useState<Map<string, boolean>>(new Map());

  // ── โหมดฝึก ──
  const [pIndex,  setPIndex]  = useState(0);
  const [nodeId,  setNodeId]  = useState("start");
  const [picked,  setPicked]  = useState<Picked[]>([]);
  const [reached, setReached] = useState<string | null>(null);
  const [pScore,  setPScore]  = useState(0);
  const [pWrong,  setPWrong]  = useState(0);
  const [pList,   setPList]   = useState<Scenario[]>([]);

  // ── โหมดเกม (ท้าเวลา ❤️×3 คอมโบ) ──
  const [aQueue,    setAQueue]    = useState<Scenario[]>([]);
  const [aIdx,      setAIdx]      = useState(0);
  const [aChosen,   setAChosen]   = useState<string | null>(null); // "timeout" = หมดเวลา
  const [hearts,    setHearts]    = useState(MAX_HEARTS);
  const [score,     setScore]     = useState(0);
  const [streak,    setStreak]    = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [secLeft,   setSecLeft]   = useState(TIME_PER_Q);
  const [floatPts,  setFloatPts]  = useState<number | null>(null);
  const [best,      setBest]      = useState<StatGameBest>({ bestScore: 0, bestStreak: 0 });
  const [rulesOpen, setRulesOpen] = useState(false); // หน้ากติกาก่อนเริ่มเกม
  const savedRef = useState({ done: false })[0];

  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (guard !== "allowed" || !user) return;
    getUserAccess(user.uid)
      .then((a) => setIsMember(a.hasAny))
      .catch(() => setIsMember(false));
    getStatGameBest(user.uid).then(setBest);
  }, [guard, user]);

  const current = queue[0] ?? null;
  const choices = useMemo(
    () => (current ? buildChoices(current.answer) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, attempt]
  );

  const aCur = aQueue[aIdx] ?? null;
  const aChoices = useMemo(
    () => (aCur ? buildChoices(aCur.answer) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aCur?.id, aIdx]
  );

  // นาฬิกาไหลเฉพาะตอนกำลังตอบในโหมดเกม (ยังไม่เริ่มถ้าหน้ากติกาเปิดอยู่)
  useEffect(() => {
    if (mode !== "arcade" || rulesOpen || finished || aChosen !== null || !aCur) return;
    const iv = setInterval(() => setSecLeft((s) => Math.max(0, s - 0.1)), 100);
    return () => clearInterval(iv);
  }, [mode, rulesOpen, finished, aChosen, aCur]);

  // เวลาหมด = ตอบผิด (เสียหัวใจ)
  useEffect(() => {
    if (mode === "arcade" && !finished && aChosen === null && aCur && secLeft <= 0) {
      answerArcade(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secLeft]);

  // จบเกม → บันทึกสถิติครั้งเดียว
  useEffect(() => {
    if (mode === "arcade" && finished && user && !savedRef.done) {
      savedRef.done = true;
      saveStatGameRun(user.uid, score, maxStreak, best);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, finished, user]);

  if (guard !== "allowed" || isMember === null) return <AccessGuardSpinner />;

  function startMode(m: Mode) {
    const list = shuffleScenarios(); // ฟรีครบทุกข้อทุกโหมด
    setMode(m);
    setFinished(false);
    if (m === "recall") {
      setQueue(list); setTotal(list.length);
      setChosen(null); setAttempt(0); setFirstTry(new Map());
    } else if (m === "arcade") {
      setAQueue(list); setAIdx(0); setAChosen(null);
      setHearts(MAX_HEARTS); setScore(0); setStreak(0); setMaxStreak(0);
      setSecLeft(TIME_PER_Q); setFloatPts(null);
      setRulesOpen(true); // แจ้งกติกาก่อนเริ่มทุกครั้ง — นาฬิกายังไม่เดิน
      savedRef.done = false;
    } else {
      setPList(list); setPIndex(0); setNodeId("start");
      setPicked([]); setReached(null); setPScore(0); setPWrong(0);
    }
  }

  // ── โหมดเกม: ตอบ / ไปข้อถัดไป ──
  function answerArcade(id: string | null) {
    if (!aCur || aChosen !== null) return;
    const ok = id !== null && id === aCur.answer;
    setAChosen(id ?? "timeout");
    if (ok) {
      const mult = 1 + Math.min(streak, 8) * 0.25;   // คอมโบ ×1 → ×3
      const pts  = Math.round((100 + secLeft * 10) * mult);
      setScore((s) => s + pts);
      setFloatPts(pts);
      const ns = streak + 1;
      setStreak(ns);
      if (ns > maxStreak) setMaxStreak(ns);
      window.setTimeout(() => nextArcade(), 950);     // ถูก = ไหลต่อเอง รักษาจังหวะเกม
    } else {
      setStreak(0);
      setHearts((h) => h - 1);
    }
  }

  function nextArcade() {
    setAChosen(null);
    setFloatPts(null);
    setSecLeft(TIME_PER_Q);
    setAIdx((i) => {
      if (i + 1 >= aQueue.length) { setFinished(true); return i; }
      return i + 1;
    });
  }

  // ═══ เลือกโหมด — หน้า landing ของเกม (ใช้แจกลิงก์ได้) ═══════════════════════
  if (!mode) {
    const symbols = [
      { t: "χ²",     top: "12%", left: "6%",  size: 26, rot: -12 },
      { t: "t-test", top: "22%", left: "78%", size: 14, rot: 8 },
      { t: "r",      top: "58%", left: "10%", size: 22, rot: 10 },
      { t: "p<.05",  top: "68%", left: "74%", size: 13, rot: -8 },
      { t: "σ",      top: "10%", left: "58%", size: 20, rot: 14 },
      { t: "ANOVA",  top: "72%", left: "38%", size: 12, rot: -5 },
    ];
    return (
      <div className="font-exam min-h-screen pb-28" style={{ backgroundColor: "#FAFAF9" }}>

        {/* ── Hero เขียวแบรนด์ + สัญลักษณ์สถิติลอย ── */}
        <div className="relative overflow-hidden px-5 pt-9 pb-14"
          style={{ background: "linear-gradient(160deg, #0B6E65 0%, #0d9488 100%)" }}>
          {symbols.map((s) => (
            <span key={s.t} className="absolute font-extrabold select-none pointer-events-none"
              style={{ top: s.top, left: s.left, fontSize: s.size, color: "white",
                       opacity: 0.14, transform: `rotate(${s.rot}deg)` }}>
              {s.t}
            </span>
          ))}
          <div className="relative max-w-lg mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/15">
              <span className="text-[32px] leading-none">📊</span>
            </div>
            <span className="inline-block text-[12px] font-extrabold px-3 py-1 rounded-full mb-3"
              style={{ backgroundColor: "#F59E0B", color: "#412402" }}>
              🎁 เล่นฟรี ไม่ต้องซื้อคอร์ส
            </span>
            <h1 className="text-[26px] font-extrabold text-white leading-tight mb-1.5">
              เกมเลือกสถิติ
            </h1>
            <p className="text-[13.5px]" style={{ color: "#C8EDE2" }}>
              อ่านโจทย์แบบข้อสอบจริง แล้วตอบให้ได้ว่าใช้สถิติตัวไหน
            </p>
          </div>
        </div>

        {/* ── แถวตัวเลข คร่อมรอยต่อ hero ── */}
        <div className="max-w-lg mx-auto px-5 -mt-7 relative">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { v: `${SCENARIOS.length}`, l: "โจทย์สถานการณ์" },
              { v: "12", l: "สถิติที่ต้องรู้" },
              { v: "3",  l: "โหมดเล่น" },
            ].map((x) => (
              <div key={x.l} className="bg-white rounded-2xl py-3 text-center"
                style={{ border: "2px solid #E3E1DC", borderBottomWidth: 4, borderBottomColor: "#D2D0CB" }}>
                <p className="text-[20px] font-extrabold leading-none tabular-nums" style={{ color: ACCENT }}>
                  {x.v}
                </p>
                <p className="text-[11px] mt-1" style={{ color: MUTED }}>{x.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-5 pt-5">
          {/* สถิติสูงสุดของคุณ */}
          {best.bestScore > 0 && (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4"
              style={{ backgroundColor: "#FDF6E9", border: "2px solid #FCD34D" }}>
              <span className="text-[22px]">🏆</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold" style={{ color: "#92400E" }}>
                  สถิติของคุณ: {best.bestScore.toLocaleString()} แต้ม · คอมโบ ×{best.bestStreak}
                </p>
                <p className="text-[12px]" style={{ color: "#B45309" }}>วันนี้ทำลายมันได้ไหม?</p>
              </div>
            </div>
          )}

          {/* โหมดเล่น 3 แบบ */}
          <div className="space-y-3">
            <button onClick={() => startMode("arcade")}
              className="chunky w-full text-left p-4 flex items-center gap-3.5"
              style={{ backgroundColor: "white", borderColor: ACCENT, borderBottomColor: "#063E38" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: ACCENT }}>
                <span className="text-[24px] leading-none">🎮</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[16.5px] font-extrabold" style={{ color: ACCENT }}>เล่นเกม</p>
                  <span className="text-[10.5px] font-bold px-1.5 py-[2px] rounded-full"
                    style={{ backgroundColor: "#F59E0B", color: "#412402" }}>
                    แนะนำ
                  </span>
                </div>
                <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: "#57534E" }}>
                  จับเวลา {TIME_PER_Q} วิ · หัวใจ {MAX_HEARTS} ดวง · คอมโบคูณแต้ม
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button onClick={() => startMode("recall")}
              className="chunky w-full text-left p-4 flex items-center gap-3.5"
              style={CH_WHITE}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#FDF6E9" }}>
                <span className="text-[24px] leading-none">📝</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-bold text-gray-900">โหมดสอบจริง</p>
                <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: "#57534E" }}>
                  ไม่จับเวลา · ข้อที่ผิดวนกลับมาจนกว่าจะตอบถูกเอง
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#D6D3D1"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button onClick={() => startMode("practice")}
              className="chunky w-full text-left p-4 flex items-center gap-3.5"
              style={CH_WHITE}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#F5F2FC" }}>
                <span className="text-[24px] leading-none">🧭</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-bold text-gray-900">โหมดฝึก</p>
                <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: "#57534E" }}>
                  มือใหม่เริ่มที่นี่ · มีตัวช่วยไล่เงื่อนไขทีละขั้น
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#D6D3D1"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <p className="text-[12px] text-center mt-5" style={{ color: "#C9C5C0" }}>
            เกมทบทวนสำหรับเตรียมสอบนักวิชาการสาธารณสุข · AJ ExamOnline
          </p>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ═══ โหมดเกม ═══════════════════════════════════════════════════════════════
  if (mode === "arcade") {
    // ── หน้ากติกา — เข้าใจง่าย อ่านจบใน 10 วินาที แล้วค่อยเริ่มจับเวลา ──
    if (rulesOpen) {
      return (
        <div className="font-exam min-h-screen flex items-center justify-center px-5 pb-24"
          style={{ backgroundColor: "#FAFAF9" }}>
          <div className="bg-white rounded-[28px] p-7 w-full max-w-sm"
            style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            <h2 className="text-[20px] font-extrabold text-gray-900 text-center mb-1">
              กติกา 4 ข้อ
            </h2>
            <p className="text-[13px] text-center mb-5" style={{ color: MUTED }}>
              อ่านโจทย์ แล้วตอบให้ได้ว่าใช้ &quot;สถิติ&quot; ตัวไหน
            </p>

            <div className="space-y-2.5 mb-6">
              {[
                { icon: "⏱️", head: `มีเวลา ${TIME_PER_Q} วินาทีต่อข้อ`,
                  body: "ยิ่งตอบเร็ว ยิ่งได้แต้มเยอะ" },
                { icon: "❤️", head: `มีหัวใจ ${MAX_HEARTS} ดวง`,
                  body: "ตอบผิดหรือหมดเวลา เสีย 1 ดวง — หมดเมื่อไหร่เกมจบ" },
                { icon: "🔥", head: "ตอบถูกติดกัน = คอมโบ",
                  body: "แต้มคูณเพิ่มเรื่อย ๆ สูงสุด ×3 (ผิดปุ๊บคอมโบแตก)" },
                { icon: "🏆", head: "ทำลายสถิติตัวเอง",
                  body: "คะแนนสูงสุดถูกบันทึกไว้ กลับมาแก้มือได้ทุกวัน" },
              ].map((r) => (
                <div key={r.head} className="flex items-start gap-3 rounded-xl px-3.5 py-3"
                  style={{ backgroundColor: "#FAFAF8", border: `1px solid ${LINE}` }}>
                  <span className="text-[20px] leading-none mt-0.5">{r.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900 leading-snug">{r.head}</p>
                    <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: "#78716C" }}>
                      {r.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setRulesOpen(false)}
              className="chunky w-full py-4 font-extrabold text-[16px]"
              style={CH_GREEN}>
              เริ่มเกม!
            </button>
            <button onClick={() => setMode(null)}
              className="w-full py-3 mt-1 rounded-2xl font-semibold text-[13.5px]"
              style={{ color: MUTED }}>
              ← กลับไปเลือกโหมด
            </button>
          </div>
        </div>
      );
    }

    // ── จอจบเกม ──
    if (finished || !aCur) {
      const newRecord = score > 0 && score > best.bestScore;
      return (
        <div className="font-exam min-h-screen flex items-center justify-center px-5 pb-24 relative overflow-hidden"
          style={{ backgroundColor: "#FAFAF9" }}>
          {newRecord && (
            <div className="absolute inset-x-0 top-0 h-32 pointer-events-none">
              {Array.from({ length: 18 }).map((_, i) => (
                <span key={i} className="game-confetti absolute w-2 h-2"
                  style={{
                    left: `${(i * 137) % 100}%`,
                    top: `${(i * 53) % 40}px`,
                    backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    borderRadius: i % 3 === 0 ? "9999px" : "2px",
                    animationDelay: `${(i % 6) * 0.12}s`,
                  }} />
              ))}
            </div>
          )}
          <div className="bg-white rounded-[28px] p-8 w-full max-w-sm text-center"
            style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            {newRecord ? (
              <span className="game-pop inline-block text-[13px] font-bold px-3 py-1 rounded-full mb-3"
                style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
                🏆 ทำลายสถิติตัวเอง!
              </span>
            ) : (
              <div className="text-[36px] mb-2">{hearts <= 0 ? "💔" : "🎉"}</div>
            )}
            <p className="text-[13px] font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED }}>
              {hearts <= 0 ? "หัวใจหมดแล้ว" : "รอดครบทุกข้อ!"}
            </p>
            <p className="text-[40px] font-extrabold leading-none mb-1 tabular-nums" style={{ color: ACCENT }}>
              {score.toLocaleString()}
            </p>
            <p className="text-[13px] mb-5" style={{ color: MUTED }}>แต้ม</p>

            <div className="grid grid-cols-2 gap-2 mb-6">
              <div className="rounded-2xl py-3" style={{ backgroundColor: "#F8F8F7" }}>
                <p className="text-[18px] font-extrabold tabular-nums" style={{ color: "#B45309" }}>
                  ×{maxStreak}
                </p>
                <p className="text-[11.5px]" style={{ color: MUTED }}>คอมโบสูงสุด</p>
              </div>
              <div className="rounded-2xl py-3" style={{ backgroundColor: "#F8F8F7" }}>
                <p className="text-[18px] font-extrabold tabular-nums" style={{ color: "#57534E" }}>
                  {Math.max(best.bestScore, score).toLocaleString()}
                </p>
                <p className="text-[11.5px]" style={{ color: MUTED }}>สถิติสูงสุดของคุณ</p>
              </div>
            </div>

            {!isMember && (
              <Link href="/packages"
                className="block rounded-2xl px-4 py-3 mb-4 text-[13px] font-semibold text-left"
                style={{ backgroundColor: "#FDF6E9", color: "#92400E", border: "1px solid #FDE9C8" }}>
                ชอบแนวนี้ใช่ไหม? คลังข้อสอบเต็ม 1,500+ ข้อ พร้อมเฉลยละเอียด — เริ่ม ฿{PRICING.app.price} →
              </Link>
            )}

            <div className="space-y-2">
              <button onClick={() => startMode("arcade")}
                className="chunky w-full py-3.5 font-bold text-[15px]"
                style={CH_GREEN}>
                เล่นอีกครั้ง
              </button>
              <button onClick={() => setMode(null)}
                className="chunky w-full py-3 font-semibold text-[14px]"
                style={CH_WHITE}>
                เปลี่ยนโหมด
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── กำลังเล่น ──
    const aAnswered = aChosen !== null;
    const aCorrect  = aAnswered && aChosen === aCur.answer;
    const aTimeout  = aChosen === "timeout";
    const timerPct  = (secLeft / TIME_PER_Q) * 100;
    const timerColor = secLeft > 5 ? "#F59E0B" : "#EF4444";
    const mult = 1 + Math.min(streak, 8) * 0.25;

    return (
      <div className="font-exam min-h-screen pb-32" style={{ backgroundColor: "#FAFAF9" }}>
        {/* HUD — แถบเขียวแบรนด์แบบเกม */}
        <div className="sticky top-14 z-30" style={HUD_GREEN}>
          <div className="max-w-lg mx-auto px-5 h-12 flex items-center justify-between">
            {/* หัวใจ */}
            <div className="flex items-center gap-1 text-[15px]">
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <span key={i} className={i === hearts ? "game-pop" : ""}
                  style={{ opacity: i < hearts ? 1 : 0.35 }}>
                  {i < hearts ? "❤️" : "🤍"}
                </span>
              ))}
            </div>
            {/* คอมโบ */}
            {streak >= 2 ? (
              <span key={streak} className="game-pop text-[13px] font-extrabold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#F59E0B", color: "#412402" }}>
                คอมโบ ×{mult.toFixed(2).replace(/\.?0+$/, "")}
              </span>
            ) : (
              <span className="text-[12px] font-semibold" style={{ color: "#9FE1CB" }}>
                ข้อ {aIdx + 1}/{aQueue.length}
              </span>
            )}
            {/* แต้ม + แต้มลอย */}
            <div className="relative text-right">
              <span className="text-[16px] font-extrabold tabular-nums text-white">
                {score.toLocaleString()}
              </span>
              {floatPts !== null && (
                <span key={score} className="game-float-up absolute -top-1 right-0 text-[13px] font-extrabold"
                  style={{ color: "#FCD34D" }}>
                  +{floatPts.toLocaleString()}
                </span>
              )}
            </div>
          </div>
          {/* แถบเวลา */}
          <div className="h-[8px]" style={{ backgroundColor: TIMER_TRACK }}>
            <div className="h-full rounded-r-full"
              style={{ width: `${timerPct}%`, backgroundColor: timerColor,
                       transition: "width 0.1s linear, background-color 0.3s" }} />
          </div>
        </div>

        <div className="max-w-lg mx-auto px-5 pt-5 space-y-4">
          {/* โจทย์ — การ์ดมินต์ สั่นเมื่อตอบผิด/หมดเวลา */}
          <div key={aIdx}
            className={`rounded-2xl p-5 ${aAnswered && !aCorrect ? "game-shake" : ""}`}
            style={aAnswered && !aCorrect
              ? { backgroundColor: "#FEF2F2", border: "2px solid #FCA5A5" }
              : QCARD}>
            <p className="text-[15.5px] font-semibold leading-relaxed" style={{ color: "#04342C" }}>
              {aCur.text}
            </p>
          </div>

          {/* ตัวเลือก — ปุ่มหนากดยุบ */}
          <div className="space-y-2.5">
            {aChoices.map((id) => {
              const st = STATS[id];
              const isAnswer = id === aCur.answer;
              const isChosen = id === aChosen;
              const sty = aAnswered && isAnswer ? CH_GREEN
                : aAnswered && isChosen ? CH_RED : CH_WHITE;
              return (
                <button key={id} onClick={() => answerArcade(id)} disabled={aAnswered}
                  className="chunky w-full text-left flex items-center gap-3 px-4 py-3.5"
                  style={sty}>
                  <span className="text-[15px] font-bold flex-1">{st.name}</span>
                  {aAnswered && isAnswer && (
                    <span className="text-[12px] font-bold flex-shrink-0">✓ เฉลย</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ผิด/หมดเวลา — โชว์จุดสังเกตสั้น ๆ แล้วไปต่อ */}
          {aAnswered && !aCorrect && (
            <div className="space-y-3">
              <div className="rounded-2xl px-4 py-3 text-[14px] font-bold text-center"
                style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                {aTimeout ? "⏰ หมดเวลา! เสียหัวใจ 1 ดวง" : "ยังไม่ใช่ — เสียหัวใจ 1 ดวง"}
              </div>
              <div className="px-4 py-3.5 rounded-2xl text-[14px] leading-relaxed"
                style={{ backgroundColor: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
                <span className="font-semibold">จุดสังเกต · </span>{aCur.clue}
              </div>
            </div>
          )}
        </div>

        {aAnswered && !aCorrect && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md"
            style={{ borderTop: `1px solid ${LINE}` }}>
            <div className="max-w-lg mx-auto px-5 py-4">
              <button
                onClick={() => (hearts <= 0 ? setFinished(true) : nextArcade())}
                className="chunky font-exam w-full py-3.5 font-bold text-[15px]"
                style={hearts <= 0 ? CH_RED : CH_GREEN}>
                {hearts <= 0 ? "ดูสรุปผล" : "ไปต่อ →"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══ จบรอบ ═════════════════════════════════════════════════════════════════
  if (finished) {
    const totalDone = mode === "recall" ? total : pScore + pWrong;
    const good      = mode === "recall"
      ? [...firstTry.values()].filter(Boolean).length
      : pScore;
    const pct = totalDone > 0 ? Math.round((good / totalDone) * 100) : 0;
    return (
      <div className="font-exam min-h-screen flex items-center justify-center px-5 pb-24"
        style={{ backgroundColor: "#FAFAF9" }}>
        <div className="bg-white rounded-[28px] p-8 w-full max-w-sm text-center"
          style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: pct >= 80 ? "#EBF5F3" : "#FDF6E9" }}>
            <span className="text-[24px]">{pct >= 80 ? "🏆" : "💪"}</span>
          </div>
          <h2 className="text-[21px] font-extrabold text-gray-900 mb-1">
            {mode === "recall" ? `ตอบถูกครั้งแรก ${good} จาก ${totalDone} ข้อ` : `ได้ ${good} จาก ${totalDone} ข้อ`}
          </h2>
          <p className="text-[13.5px] mb-6" style={{ color: MUTED }}>
            {mode === "recall" && good < totalDone
              ? "ข้อที่พลาดถูกวนซ้ำจนคุณตอบถูกเองครบแล้ว — แบบนี้แหละที่ทำให้จำเข้าหัว"
              : pct >= 80 ? "แม่นมาก! การเลือกสถิติของคุณคมแล้ว"
              : "เล่นซ้ำอีกรอบ เดี๋ยวก็จับทางได้"}
          </p>

          {!isMember && (
            <Link href="/packages"
              className="block rounded-2xl px-4 py-3 mb-4 text-[13px] font-semibold text-left"
              style={{ backgroundColor: "#FDF6E9", color: "#92400E", border: "1px solid #FDE9C8" }}>
              ชอบแนวนี้ใช่ไหม? คลังข้อสอบเต็ม 1,500+ ข้อ พร้อมเฉลยละเอียด — เริ่ม ฿{PRICING.app.price} →
            </Link>
          )}

          <div className="space-y-2">
            <button onClick={() => startMode(mode)}
              className="chunky w-full py-3.5 font-bold text-[15px]"
              style={CH_GREEN}>
              เล่นอีกรอบ (สุ่มลำดับใหม่)
            </button>
            <button onClick={() => setMode(null)}
              className="chunky w-full py-3 font-semibold text-[14px]"
              style={CH_WHITE}>
              เปลี่ยนโหมด
            </button>
            <button onClick={() => router.push("/games")}
              className="w-full py-3 rounded-2xl font-semibold text-[14px]"
              style={{ color: MUTED }}>
              กลับหน้าเกม
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ โหมดสอบจริง ═══════════════════════════════════════════════════════════
  if (mode === "recall" && current) {
    const answered   = chosen !== null;
    const correct    = answered && chosen === current.answer;
    const solved     = total - queue.length;
    const tries      = [...firstTry.values()];
    const answerStat = STATS[current.answer];

    const pickStat = (id: string) => {
      if (answered) return;
      setChosen(id);
      if (!firstTry.has(current.id)) {
        setFirstTry((m) => new Map(m).set(current.id, id === current.answer));
      }
    };

    const next = () => {
      setQueue((q) => {
        const [head, ...rest] = q;
        const nq = correct ? rest : [...rest, head]; // ผิด → วนกลับไปท้ายแถว
        if (nq.length === 0) setFinished(true);
        return nq;
      });
      setChosen(null);
      setAttempt((a) => a + 1);
    };

    return (
      <div className="font-exam min-h-screen pb-32" style={{ backgroundColor: "#FAFAF9" }}>
        {/* Top bar — เขียวแบรนด์ */}
        <div className="sticky top-14 z-30" style={HUD_GREEN}>
          <div className="max-w-lg mx-auto px-5 h-12 flex items-center justify-between">
            <span className="text-[13px] font-bold text-white tabular-nums">
              เคลียร์แล้ว {solved}<span className="font-normal" style={{ color: "#9FE1CB" }}> / {total}</span>
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: "#9FE1CB" }}>โหมดสอบจริง</span>
            <div className="flex items-center gap-2 text-[12px] font-semibold tabular-nums">
              <span className="text-white">✓ {tries.filter(Boolean).length}</span>
              <span style={{ color: "#FCA5A5" }}>✗ {tries.filter((v) => !v).length}</span>
            </div>
          </div>
          <div className="h-[8px]" style={{ backgroundColor: TIMER_TRACK }}>
            <div className="h-full rounded-r-full transition-all duration-300"
              style={{ width: `${(solved / total) * 100}%`, backgroundColor: "#F59E0B" }} />
          </div>
        </div>

        <div className="max-w-lg mx-auto px-5 pt-5 space-y-4">
          {/* โจทย์ — การ์ดมินต์ */}
          <div className="rounded-2xl p-5" style={QCARD}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "#1D9E75" }}>
                โจทย์สถานการณ์
              </p>
              {firstTry.has(current.id) && !answered && (
                <span className="text-[11px] font-bold px-2 py-[3px] rounded-full"
                  style={{ backgroundColor: "#F59E0B", color: "#412402" }}>
                  ข้อวนซ้ำ — รอบนี้ต้องได้
                </span>
              )}
            </div>
            <p className="text-[15.5px] font-semibold leading-relaxed" style={{ color: "#04342C" }}>
              {current.text}
            </p>
          </div>

          {/* ตัวเลือกสถิติ — ปุ่มหนากดยุบ */}
          <div className="space-y-2.5">
            {choices.map((id) => {
              const st = STATS[id];
              const isAnswer = id === current.answer;
              const isChosen = id === chosen;
              const sty = answered && isAnswer ? CH_GREEN
                : answered && isChosen ? CH_RED : CH_WHITE;
              return (
                <button key={id} onClick={() => pickStat(id)} disabled={answered}
                  className="chunky w-full text-left flex items-center gap-3 px-4 py-3.5"
                  style={sty}>
                  <span className="text-[15px] font-bold flex-1">{st.name}</span>
                  {answered && isAnswer && (
                    <span className="text-[12px] font-bold flex-shrink-0">✓ เฉลย</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* เฉลย */}
          {answered && (
            <div className="space-y-3">
              <div className="rounded-2xl px-4 py-3 text-[14px] font-bold text-center"
                style={correct
                  ? { backgroundColor: "#EBF5F3", color: ACCENT }
                  : { backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                {correct ? "ถูกต้อง!" : "ยังไม่ใช่ — ข้อนี้จะวนกลับมาอีกครั้ง"}
              </div>
              <div className="px-4 py-3.5 rounded-2xl text-[14px] leading-relaxed"
                style={{ backgroundColor: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
                <span className="font-semibold">จุดสังเกต · </span>{current.clue}
              </div>
              <div className="bg-white rounded-2xl px-4 py-3.5" style={{ border: `1px solid ${LINE}` }}>
                <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: MUTED }}>
                  ไล่เงื่อนไขให้ดู
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {routeLabels(current.route).map((step, i, arr) => (
                    <span key={i} className="inline-flex items-center gap-1.5 text-[12px] font-semibold
                                             px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
                      {step}
                      {i < arr.length - 1 && <span style={{ color: "#86EFAC" }}>→</span>}
                    </span>
                  ))}
                  <span className="text-[12px] font-bold px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: ACCENT }}>
                    {answerStat.name}
                  </span>
                </div>
                <p className="text-[12.5px] mt-2.5 leading-relaxed" style={{ color: "#78716C" }}>
                  {answerStat.hint}
                </p>
              </div>
            </div>
          )}
        </div>

        {answered && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md"
            style={{ borderTop: `1px solid ${LINE}` }}>
            <div className="max-w-lg mx-auto px-5 py-4">
              <button onClick={next}
                className="chunky font-exam w-full py-3.5 font-bold text-[15px]"
                style={CH_GREEN}>
                {queue.length === 1 && correct ? "ดูสรุปผล" : "ข้อต่อไป →"}
              </button>
            </div>
          </div>
        )}
        {!answered && <BottomNav />}
      </div>
    );
  }

  // ═══ โหมดฝึก (ไล่เงื่อนไขแบบเดิม) ═══════════════════════════════════════════
  const scenario = pList[pIndex];
  if (!scenario) return <AccessGuardSpinner />;
  const node       = TREE[nodeId];
  const pAnswered  = reached !== null;
  const pCorrect   = pAnswered && reached === scenario.answer;
  const answerStat = STATS[scenario.answer];
  const reachedStat = reached ? STATS[reached] : null;

  const pick = (opt: TreeOption) => {
    if (pAnswered) return;
    setPicked((p) => [...p, { label: opt.label }]);
    if (opt.stat) {
      setReached(opt.stat);
      if (opt.stat === scenario.answer) setPScore((s) => s + 1);
      else setPWrong((w) => w + 1);
    } else if (opt.next) {
      setNodeId(opt.next);
    }
  };

  const undo = () => {
    if (pAnswered || picked.length === 0) return;
    const rest = picked.slice(0, -1);
    let cur = "start";
    for (const p of rest) {
      const opt = TREE[cur].options.find((o) => o.label === p.label);
      cur = opt?.next ?? cur;
    }
    setPicked(rest);
    setNodeId(cur);
  };

  const pNext = () => {
    if (pIndex + 1 >= pList.length) { setFinished(true); return; }
    setPIndex((i) => i + 1);
    setNodeId("start");
    setPicked([]);
    setReached(null);
  };

  return (
    <div className="font-exam min-h-screen pb-32" style={{ backgroundColor: "#FAFAF9" }}>
      <div className="sticky top-14 z-30" style={HUD_GREEN}>
        <div className="max-w-lg mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold text-white">{pIndex + 1}</span>
            <span className="text-[12px]" style={{ color: "#9FE1CB" }}>/ {pList.length}</span>
          </div>
          <span className="text-[12.5px] font-semibold" style={{ color: "#9FE1CB" }}>โหมดฝึก</span>
          <div className="flex items-center gap-2 text-[12px] font-semibold tabular-nums">
            <span className="text-white">✓ {pScore}</span>
            <span style={{ color: "#FCA5A5" }}>✗ {pWrong}</span>
          </div>
        </div>
        <div className="h-[8px]" style={{ backgroundColor: TIMER_TRACK }}>
          <div className="h-full rounded-r-full transition-all duration-300"
            style={{ width: `${((pIndex + 1) / pList.length) * 100}%`, backgroundColor: "#F59E0B" }} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-5 space-y-4">
        <div className="rounded-2xl p-5" style={QCARD}>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "#1D9E75" }}>
            โจทย์สถานการณ์
          </p>
          <p className="text-[15.5px] font-semibold leading-relaxed" style={{ color: "#04342C" }}>
            {scenario.text}
          </p>
        </div>

        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {picked.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[12px] font-semibold
                                       px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#EBF5F3", color: ACCENT }}>
                {p.label.split(" (")[0]}
                {i < picked.length - 1 && <span style={{ color: "#8ECFBF" }}>→</span>}
              </span>
            ))}
            {!pAnswered && (
              <button onClick={undo}
                className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#F5F5F4", color: "#78716C" }}>
                ← ย้อน
              </button>
            )}
          </div>
        )}

        {!pAnswered && (
          <div>
            <p className="text-[14px] font-bold text-gray-900 mb-2.5">{node.question}</p>
            <div className="space-y-2">
              {node.options.map((opt) => (
                <button key={opt.label} onClick={() => pick(opt)}
                  className="chunky w-full text-left px-4 py-3.5 text-[14px] font-semibold leading-snug"
                  style={CH_WHITE}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {pAnswered && reachedStat && (
          <div className="space-y-3">
            <div className="rounded-2xl p-5 text-center"
              style={pCorrect
                ? { backgroundColor: "#EBF5F3", border: "1.5px solid #C3E5DE" }
                : { backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA" }}>
              <p className="text-[12px] font-bold uppercase tracking-wider mb-1"
                style={{ color: pCorrect ? ACCENT : "#DC2626" }}>
                {pCorrect ? "ถูกต้อง!" : "ยังไม่ใช่"}
              </p>
              <p className="text-[19px] font-extrabold mb-1"
                style={{ color: pCorrect ? ACCENT : "#DC2626" }}>
                {pCorrect ? reachedStat.name : `คุณเลือกมาถึง ${reachedStat.name}`}
              </p>
              {!pCorrect && (
                <p className="text-[14px] font-bold" style={{ color: ACCENT }}>
                  คำตอบที่ถูกคือ {answerStat.name}
                </p>
              )}
            </div>
            <div className="px-4 py-3.5 rounded-2xl text-[14px] leading-relaxed"
              style={{ backgroundColor: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
              <span className="font-semibold">จุดสังเกต · </span>{scenario.clue}
            </div>
            <div className="bg-white rounded-2xl px-4 py-3.5" style={{ border: `1px solid ${LINE}` }}>
              <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: MUTED }}>
                เส้นทางที่แนะนำ
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {routeLabels(scenario.route).map((step, i, arr) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[12px] font-semibold
                                           px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
                    {step}
                    {i < arr.length - 1 && <span style={{ color: "#86EFAC" }}>→</span>}
                  </span>
                ))}
                <span className="text-[12px] font-bold px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: ACCENT }}>
                  {answerStat.name}
                </span>
              </div>
              <p className="text-[12.5px] mt-2.5 leading-relaxed" style={{ color: "#78716C" }}>
                {answerStat.hint}
              </p>
            </div>
          </div>
        )}
      </div>

      {pAnswered && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md"
          style={{ borderTop: `1px solid ${LINE}` }}>
          <div className="max-w-lg mx-auto px-5 py-4">
            <button onClick={pNext}
              className="chunky font-exam w-full py-3.5 font-bold text-[15px]"
              style={CH_GREEN}>
              {pIndex + 1 >= pList.length ? "ดูสรุปผล" : "ข้อต่อไป →"}
            </button>
          </div>
        </div>
      )}
      {!pAnswered && <BottomNav />}
    </div>
  );
}
