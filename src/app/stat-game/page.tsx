"use client";
/**
 * /stat-game — เกมเลือกสถิติ: อ่านโจทย์สถานการณ์ → กดเงื่อนไขไล่ตาม decision tree
 * → เฉลยเด้งว่าเป็นสถิติอะไร ถูก/ผิด + จุดสังเกตในโจทย์
 *
 * ตัดสินจาก "สถิติปลายทาง" ไม่ใช่เส้นทาง (บางสถิติเดินถึงได้หลายทางที่ถูก)
 * สิทธิ์: ต้อง login · สมาชิก (คอร์สไหนก็ได้) เล่นครบทุกข้อ · ยังไม่ซื้อเล่นได้ 3 ข้อแรก
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { getUserAccess } from "@/lib/access";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";
import { PRICING } from "@/lib/pricing";
import {
  TREE, STATS, shuffleScenarios, routeLabels, type Scenario, type TreeOption,
} from "@/lib/stat-game";

const ACCENT = "#0B6E65";
const LINE   = "#ECEBE9";
const MUTED  = "#A8A29E";
const CARD_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.05)";

const FREE_SCENARIOS = 3; // ยังไม่ซื้อคอร์ส เล่นได้กี่ข้อ

type Picked = { question: string; label: string };

export default function StatGamePage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();
  const router   = useRouter();

  const [isMember,  setIsMember]  = useState<boolean | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [index,     setIndex]     = useState(0);
  const [nodeId,    setNodeId]    = useState("start");
  const [picked,    setPicked]    = useState<Picked[]>([]);
  const [reached,   setReached]   = useState<string | null>(null); // stat id ที่ผู้เล่นเดินไปถึง
  const [score,     setScore]     = useState(0);
  const [wrong,     setWrong]     = useState(0);
  const [finished,  setFinished]  = useState(false);

  useEffect(() => {
    if (guard !== "allowed" || !user) return;
    getUserAccess(user.uid)
      .then((a) => setIsMember(a.hasAny))
      .catch(() => setIsMember(false));
    setScenarios(shuffleScenarios());
  }, [guard, user]);

  if (guard !== "allowed" || isMember === null || scenarios.length === 0) {
    return <AccessGuardSpinner />;
  }

  const limit    = isMember ? scenarios.length : Math.min(FREE_SCENARIOS, scenarios.length);
  const scenario = scenarios[index];
  const node     = TREE[nodeId];
  const answered = reached !== null;
  const correct  = answered && reached === scenario.answer;

  function pick(opt: TreeOption) {
    if (answered) return;
    setPicked((p) => [...p, { question: TREE[nodeId].question, label: opt.label }]);
    if (opt.stat) {
      setReached(opt.stat);
      if (opt.stat === scenario.answer) setScore((s) => s + 1);
      else setWrong((w) => w + 1);
    } else if (opt.next) {
      setNodeId(opt.next);
    }
  }

  function undo() {
    if (answered || picked.length === 0) return;
    // เดินย้อน: เริ่มจาก start ตามป้ายที่เลือกไว้ (ตัดตัวสุดท้ายทิ้ง)
    const rest = picked.slice(0, -1);
    let cur = "start";
    for (const p of rest) {
      const opt = TREE[cur].options.find((o) => o.label === p.label);
      cur = opt?.next ?? cur;
    }
    setPicked(rest);
    setNodeId(cur);
  }

  function next() {
    const atLimit = index + 1 >= limit;
    if (atLimit) { setFinished(true); return; }
    setIndex((i) => i + 1);
    setNodeId("start");
    setPicked([]);
    setReached(null);
  }

  function replay() {
    setScenarios(shuffleScenarios());
    setIndex(0); setNodeId("start"); setPicked([]);
    setReached(null); setScore(0); setWrong(0); setFinished(false);
  }

  // ── จบรอบ ──────────────────────────────────────────────────────────────────
  if (finished) {
    const total = score + wrong;
    const pct   = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <div className="min-h-screen flex items-center justify-center px-5 pb-24"
        style={{ backgroundColor: "#FAFAF9" }}>
        <div className="bg-white rounded-[28px] p-8 w-full max-w-sm text-center"
          style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: pct >= 80 ? "#EBF5F3" : "#FDF6E9" }}>
            <span className="text-[24px]">{pct >= 80 ? "🏆" : "💪"}</span>
          </div>
          <h2 className="text-[21px] font-extrabold text-gray-900 mb-1">
            ได้ {score} จาก {total} ข้อ
          </h2>
          <p className="text-[13.5px] mb-6" style={{ color: MUTED }}>
            {pct >= 80 ? "แม่นมาก! การเลือกสถิติของคุณคมแล้ว"
              : pct >= 50 ? "ใกล้แล้ว — ทวนจุดสังเกตในเฉลยแต่ละข้ออีกนิด"
              : "ไม่เป็นไร เล่นซ้ำอีกรอบ เดี๋ยวก็จับทางได้"}
          </p>

          {!isMember && (
            <Link href="/packages"
              className="block rounded-2xl px-4 py-3 mb-4 text-[13px] font-semibold text-left"
              style={{ backgroundColor: "#FDF6E9", color: "#92400E", border: "1px solid #FDE9C8" }}>
              🔓 สมาชิกเล่นได้ครบ {shuffleScenarios().length} โจทย์ + คลังข้อสอบเต็ม — เริ่ม ฿{PRICING.app.price} →
            </Link>
          )}

          <div className="space-y-2">
            <button onClick={replay}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white
                         transition-transform active:scale-[0.98]"
              style={{ backgroundColor: ACCENT }}>
              เล่นอีกรอบ (สุ่มลำดับใหม่)
            </button>
            <button onClick={() => router.push("/")}
              className="w-full py-3 rounded-2xl font-semibold text-[14px]"
              style={{ color: MUTED }}>
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── เล่นเกม ────────────────────────────────────────────────────────────────
  const answerStat  = STATS[scenario.answer];
  const reachedStat = reached ? STATS[reached] : null;

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#FAFAF9" }}>
      {/* Top bar */}
      <div className="sticky top-14 z-30 bg-white/95 backdrop-blur-md"
        style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="h-[3px]" style={{ backgroundColor: "#F3F2F0" }}>
          <div className="h-full transition-all duration-300"
            style={{ width: `${((index + 1) / limit) * 100}%`, backgroundColor: ACCENT }} />
        </div>
        <div className="max-w-lg mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold text-gray-900">{index + 1}</span>
            <span className="text-[12px]" style={{ color: MUTED }}>/ {limit}</span>
          </div>
          <span className="text-[12.5px] font-semibold" style={{ color: ACCENT }}>
            📊 เกมเลือกสถิติ
          </span>
          <div className="flex items-center gap-2 text-[12px] font-semibold tabular-nums">
            <span style={{ color: ACCENT }}>✓ {score}</span>
            <span className="text-red-500">✗ {wrong}</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-5 space-y-4">

        {/* โจทย์ */}
        <div className="bg-white rounded-2xl p-5"
          style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: MUTED }}>
            โจทย์สถานการณ์
          </p>
          <p className="font-exam text-[15.5px] font-semibold text-gray-900 leading-relaxed">
            {scenario.text}
          </p>
        </div>

        {/* เงื่อนไขที่เลือกแล้ว (breadcrumb) */}
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
            {!answered && (
              <button onClick={undo}
                className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#F5F5F4", color: "#78716C" }}>
                ← ย้อน
              </button>
            )}
          </div>
        )}

        {/* คำถามขั้นปัจจุบัน */}
        {!answered && (
          <div>
            <p className="text-[14px] font-bold text-gray-900 mb-2.5">
              {node.question}
            </p>
            <div className="space-y-2">
              {node.options.map((opt) => (
                <button key={opt.label} onClick={() => pick(opt)}
                  className="w-full text-left px-4 py-3.5 rounded-2xl bg-white text-[14px]
                             font-semibold leading-snug transition-all duration-150
                             active:scale-[0.98]"
                  style={{ border: `1px solid ${LINE}`, color: "#374151" }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* เฉลยเด้ง */}
        {answered && reachedStat && (
          <div className="space-y-3">
            <div className="rounded-2xl p-5 text-center"
              style={correct
                ? { backgroundColor: "#EBF5F3", border: "1.5px solid #C3E5DE" }
                : { backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA" }}>
              <p className="text-[12px] font-bold uppercase tracking-wider mb-1"
                style={{ color: correct ? ACCENT : "#DC2626" }}>
                {correct ? "ถูกต้อง!" : "ยังไม่ใช่"}
              </p>
              <p className="text-[19px] font-extrabold mb-1"
                style={{ color: correct ? ACCENT : "#DC2626" }}>
                {correct ? reachedStat.name : `คุณเลือกมาถึง ${reachedStat.name}`}
              </p>
              {!correct && (
                <p className="text-[14px] font-bold" style={{ color: ACCENT }}>
                  คำตอบที่ถูกคือ {answerStat.name}
                </p>
              )}
            </div>

            {/* จุดสังเกต + เส้นทางที่ถูก */}
            <div className="font-exam px-4 py-3.5 rounded-2xl text-[14px] leading-relaxed"
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

      {/* ปุ่มข้อต่อไป */}
      {answered && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md"
          style={{ borderTop: `1px solid ${LINE}` }}>
          <div className="max-w-lg mx-auto px-5 py-4">
            <button onClick={next}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white
                         transition-transform active:scale-[0.98]"
              style={{ backgroundColor: ACCENT }}>
              {index + 1 >= limit ? "ดูสรุปผล" : "ข้อต่อไป →"}
            </button>
          </div>
        </div>
      )}

      {!answered && <BottomNav />}
    </div>
  );
}
