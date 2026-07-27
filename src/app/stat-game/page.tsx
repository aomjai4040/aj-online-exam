"use client";
/**
 * /stat-game — เกมเลือกสถิติ 2 โหมด (ฟอนต์ Sarabun ทั้งหน้า — font-exam ที่ root)
 *
 * โหมดสอบจริง (recall): โจทย์ → ตอบสถิติทันทีจาก 4 ตัวเลือก (ตัวลวง = ญาติใกล้เคียง)
 *   ตอบผิด = ข้อถูกวนกลับมาถามซ้ำจนกว่าจะตอบถูกเอง (retrieval practice)
 *   เฉลยโชว์เส้นทางเงื่อนไข = ใช้ tree เป็นกระจกส่องจุดพลาด ไม่ใช่ไม้เท้า
 * โหมดฝึก (practice): ไล่เงื่อนไขทีละขั้นแบบเดิม — สำหรับคนเพิ่งเริ่มจับโครง
 *
 * สิทธิ์: login · สมาชิกเล่นครบ · ยังไม่ซื้อเล่น 3 ข้อแรก
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

const ACCENT = "#0B6E65";
const LINE   = "#ECEBE9";
const MUTED  = "#A8A29E";
const CARD_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.05)";

const FREE_SCENARIOS = 3;

type Mode = "recall" | "practice";
type Picked = { label: string };

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

  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (guard !== "allowed" || !user) return;
    getUserAccess(user.uid)
      .then((a) => setIsMember(a.hasAny))
      .catch(() => setIsMember(false));
  }, [guard, user]);

  const current = queue[0] ?? null;
  const choices = useMemo(
    () => (current ? buildChoices(current.answer) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, attempt]
  );

  if (guard !== "allowed" || isMember === null) return <AccessGuardSpinner />;

  const limit = (list: Scenario[]) =>
    isMember ? list : list.slice(0, FREE_SCENARIOS);

  function startMode(m: Mode) {
    const list = limit(shuffleScenarios());
    setMode(m);
    setFinished(false);
    if (m === "recall") {
      setQueue(list); setTotal(list.length);
      setChosen(null); setAttempt(0); setFirstTry(new Map());
    } else {
      setPList(list); setPIndex(0); setNodeId("start");
      setPicked([]); setReached(null); setPScore(0); setPWrong(0);
    }
  }

  // ═══ เลือกโหมด ══════════════════════════════════════════════════════════════
  if (!mode) {
    return (
      <div className="font-exam min-h-screen pb-28" style={{ backgroundColor: "#FAFAF9" }}>
        <div className="max-w-lg mx-auto px-5 pt-10">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "#EBF5F3" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT}
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h1 className="text-[21px] font-extrabold text-gray-900 mb-1">เกมเลือกสถิติ</h1>
            <p className="text-[13.5px]" style={{ color: MUTED }}>
              อ่านโจทย์สถานการณ์ แล้วตอบให้ได้ว่าใช้สถิติตัวไหน
            </p>
          </div>

          <div className="space-y-3">
            <button onClick={() => startMode("recall")}
              className="w-full text-left rounded-2xl p-5 bg-white active:scale-[0.98] transition-transform"
              style={{ border: `1.5px solid ${ACCENT}`, boxShadow: CARD_SHADOW }}>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[16px] font-bold" style={{ color: ACCENT }}>โหมดสอบจริง</p>
                <span className="text-[10.5px] font-bold px-1.5 py-[2px] rounded-full"
                  style={{ backgroundColor: "#EBF5F3", color: ACCENT }}>
                  แนะนำ
                </span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "#57534E" }}>
                ตอบสถิติทันทีจาก 4 ตัวเลือกเหมือนในห้องสอบ —
                ข้อที่ผิดจะวนกลับมาถามซ้ำจนกว่าจะตอบถูกเอง
              </p>
            </button>

            <button onClick={() => startMode("practice")}
              className="w-full text-left rounded-2xl p-5 bg-white active:scale-[0.98] transition-transform"
              style={{ border: `1px solid ${LINE}` }}>
              <p className="text-[16px] font-bold text-gray-900 mb-1">โหมดฝึก</p>
              <p className="text-[13px] leading-relaxed" style={{ color: "#57534E" }}>
                มีตัวช่วยไล่เงื่อนไขทีละขั้น (วัตถุประสงค์ → ชนิดข้อมูล → ลักษณะกลุ่ม)
                เหมาะกับรอบแรก ๆ ที่ยังจำโครงไม่ได้
              </p>
            </button>
          </div>

          {!isMember && (
            <p className="text-[12.5px] text-center mt-4" style={{ color: MUTED }}>
              ทดลองเล่นฟรี {FREE_SCENARIOS} ข้อ · สมาชิกเล่นครบ {SCENARIOS.length} ข้อ
            </p>
          )}
        </div>
        <BottomNav />
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
              🔓 สมาชิกเล่นได้ครบ {SCENARIOS.length} โจทย์ + คลังข้อสอบเต็ม — เริ่ม ฿{PRICING.app.price} →
            </Link>
          )}

          <div className="space-y-2">
            <button onClick={() => startMode(mode)}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white
                         transition-transform active:scale-[0.98]"
              style={{ backgroundColor: ACCENT }}>
              เล่นอีกรอบ (สุ่มลำดับใหม่)
            </button>
            <button onClick={() => setMode(null)}
              className="w-full py-3 rounded-2xl font-semibold text-[14px] bg-white"
              style={{ border: `1px solid ${LINE}`, color: "#44403C" }}>
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
        {/* Top bar */}
        <div className="sticky top-14 z-30 bg-white/95 backdrop-blur-md"
          style={{ borderBottom: `1px solid ${LINE}` }}>
          <div className="h-[3px]" style={{ backgroundColor: "#F3F2F0" }}>
            <div className="h-full transition-all duration-300"
              style={{ width: `${(solved / total) * 100}%`, backgroundColor: ACCENT }} />
          </div>
          <div className="max-w-lg mx-auto px-5 h-12 flex items-center justify-between">
            <span className="text-[13px] font-bold text-gray-900 tabular-nums">
              เคลียร์แล้ว {solved}<span className="font-normal" style={{ color: MUTED }}> / {total}</span>
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: ACCENT }}>โหมดสอบจริง</span>
            <div className="flex items-center gap-2 text-[12px] font-semibold tabular-nums">
              <span style={{ color: ACCENT }}>✓ {tries.filter(Boolean).length}</span>
              <span className="text-red-500">✗ {tries.filter((v) => !v).length}</span>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-5 pt-5 space-y-4">
          {/* โจทย์ */}
          <div className="bg-white rounded-2xl p-5"
            style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>
                โจทย์สถานการณ์
              </p>
              {firstTry.has(current.id) && !answered && (
                <span className="text-[11px] font-bold px-2 py-[3px] rounded-full"
                  style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
                  ข้อวนซ้ำ — รอบนี้ต้องได้
                </span>
              )}
            </div>
            <p className="text-[15.5px] font-semibold text-gray-900 leading-relaxed">
              {current.text}
            </p>
          </div>

          {/* ตัวเลือกสถิติ */}
          <div className="space-y-2">
            {choices.map((id) => {
              const st = STATS[id];
              const isAnswer = id === current.answer;
              const isChosen = id === chosen;
              let bg = "white", border = `1px solid ${LINE}`, color = "#374151";
              if (answered && isAnswer)  { bg = "#EBF5F3"; border = `1.5px solid ${ACCENT}`; color = ACCENT; }
              if (answered && isChosen && !isAnswer) { bg = "#FEF2F2"; border = "1.5px solid #EF4444"; color = "#DC2626"; }
              return (
                <button key={id} onClick={() => pickStat(id)} disabled={answered}
                  className="w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-2xl
                             transition-all duration-150 active:scale-[0.98] disabled:active:scale-100"
                  style={{ backgroundColor: bg, border }}>
                  <span className="text-[15px] font-bold flex-1" style={{ color }}>{st.name}</span>
                  {answered && isAnswer && (
                    <span className="text-[12px] font-bold flex-shrink-0" style={{ color: ACCENT }}>
                      ✓ เฉลย
                    </span>
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
                className="font-exam w-full py-3.5 rounded-2xl font-bold text-[15px] text-white
                           transition-transform active:scale-[0.98]"
                style={{ backgroundColor: ACCENT }}>
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
      <div className="sticky top-14 z-30 bg-white/95 backdrop-blur-md"
        style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="h-[3px]" style={{ backgroundColor: "#F3F2F0" }}>
          <div className="h-full transition-all duration-300"
            style={{ width: `${((pIndex + 1) / pList.length) * 100}%`, backgroundColor: ACCENT }} />
        </div>
        <div className="max-w-lg mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold text-gray-900">{pIndex + 1}</span>
            <span className="text-[12px]" style={{ color: MUTED }}>/ {pList.length}</span>
          </div>
          <span className="text-[12.5px] font-semibold" style={{ color: ACCENT }}>โหมดฝึก</span>
          <div className="flex items-center gap-2 text-[12px] font-semibold tabular-nums">
            <span style={{ color: ACCENT }}>✓ {pScore}</span>
            <span className="text-red-500">✗ {pWrong}</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-5 space-y-4">
        <div className="bg-white rounded-2xl p-5"
          style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: MUTED }}>
            โจทย์สถานการณ์
          </p>
          <p className="text-[15.5px] font-semibold text-gray-900 leading-relaxed">
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
                  className="w-full text-left px-4 py-3.5 rounded-2xl bg-white text-[14px]
                             font-semibold leading-snug transition-all duration-150 active:scale-[0.98]"
                  style={{ border: `1px solid ${LINE}`, color: "#374151" }}>
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
              className="font-exam w-full py-3.5 rounded-2xl font-bold text-[15px] text-white
                         transition-transform active:scale-[0.98]"
              style={{ backgroundColor: ACCENT }}>
              {pIndex + 1 >= pList.length ? "ดูสรุปผล" : "ข้อต่อไป →"}
            </button>
          </div>
        </div>
      )}
      {!pAnswered && <BottomNav />}
    </div>
  );
}
