"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAccessGuard } from "@/lib/use-access-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import {
  getDeckById,
  getFCDeckStats,
  resetDeckProgress,
} from "@/lib/flashcard-firestore";
import type { FCDeck, FCDeckStats } from "@/lib/flashcard-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#0B6E65";
const BG     = "#A8D5BF";

// ─── DonutChart ───────────────────────────────────────────────────────────────

function DonutChart({
  known, learning, skipped, total,
}: {
  known: number; learning: number; skipped: number; total: number;
}) {
  const R = 40;
  const C = 2 * Math.PI * R; // ≈ 251.3
  const newCount = Math.max(0, total - known - learning - skipped);

  if (total === 0) {
    return (
      <svg viewBox="0 0 100 100" className="w-44 h-44">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#E5E7EB" strokeWidth="13" />
        <text x="50" y="54" textAnchor="middle"
          className="text-[14px] font-bold" fill="#9CA3AF"
          style={{ fontSize: "12px", fontWeight: "bold" }}>
          ยังไม่เริ่ม
        </text>
      </svg>
    );
  }

  const segments = [
    { value: known,    color: ACCENT,    label: "จำได้"  },
    { value: learning, color: "#D97706", label: "ทบทวน" },
    { value: skipped,  color: "#9CA3AF", label: "ข้าม"  },
    { value: newCount, color: "#E5E7EB", label: "ใหม่"  },
  ];

  let accumulated = 0;
  const knownPct = Math.round((known / total) * 100);

  return (
    <div className="relative inline-block">
      <svg viewBox="0 0 100 100" className="w-44 h-44" style={{ transform: "rotate(-90deg)" }}>
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * C;
          const el = (
            <circle
              key={i}
              cx="50" cy="50" r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth="13"
              strokeDasharray={`${dash} ${C}`}
              strokeDashoffset={-accumulated}
            />
          );
          accumulated += dash;
          return el;
        })}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[34px] font-extrabold leading-none" style={{ color: ACCENT }}>
          {knownPct}%
        </span>
        <span className="text-[13px] mt-1 font-semibold" style={{ color: "#6B7280" }}>จำได้</span>
      </div>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, bg, color, sub,
}: {
  label: string; value: number; bg: string; color: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl p-5 text-center flex flex-col items-center"
      style={{ backgroundColor: bg }}>
      <p className="text-[38px] font-extrabold leading-none mb-1.5" style={{ color }}>
        {value}
      </p>
      <p className="text-[16px] font-semibold" style={{ color }}>
        {label}
      </p>
      {sub && (
        <p className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>{sub}</p>
      )}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ color, label, value, total }: {
  color: string; label: string; value: number; total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[15px] flex-1" style={{ color: "#374151" }}>{label}</span>
      <span className="text-[15px] font-bold" style={{ color }}>
        {value} <span className="text-[12px] font-normal text-gray-400">({pct}%)</span>
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeckStatsPage() {
  const guard    = useAccessGuard();
  const { user } = useAuth();
  const router   = useRouter();
  const params   = useParams<{ deckId: string }>();
  const deckId   = params.deckId;

  const [deck,    setDeck]    = useState<FCDeck | null>(null);
  const [stats,   setStats]   = useState<FCDeckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // reset flow
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting,    setResetting]    = useState(false);
  const [resetDone,    setResetDone]    = useState(false);

  useEffect(() => {
    if (guard !== "allowed") return;

    async function load() {
      try {
        const d = await getDeckById(deckId);
        if (!d) { setError("ไม่พบ Deck นี้"); return; }
        setDeck(d);

        if (user) {
          const s = await getFCDeckStats(user.uid, deckId);
          setStats(s);
        }
      } catch {
        setError("โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard, deckId, user?.uid]);

  const handleReset = useCallback(async () => {
    if (!user || !deck) return;
    setResetting(true);
    try {
      await resetDeckProgress(user.uid, deck.id, deck.slug);
      setStats(null);
      setResetDone(true);
      setConfirmReset(false);
    } catch {
      setError("รีเซ็ตไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setResetting(false);
    }
  }, [user, deck]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (guard !== "allowed") return <AccessGuardSpinner />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BG }}>
        <div
          className="w-9 h-9 border-[3px] border-t-transparent rounded-full animate-spin"
          style={{ borderColor: ACCENT, borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5"
        style={{ backgroundColor: BG }}>
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full"
          style={{ border: "1px solid #E5E7EB" }}>
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-[17px] font-bold text-gray-800 mb-4">
            {error || "ไม่พบ Deck นี้"}
          </p>
          <button onClick={() => router.push("/flashcard")}
            className="text-[15px] font-semibold px-6 py-2.5 rounded-xl text-white"
            style={{ backgroundColor: ACCENT }}>
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  // ── คำนวณ stats ───────────────────────────────────────────────────────────
  const total    = deck.totalCards;
  const known    = stats?.known    ?? 0;
  const learning = stats?.learning ?? 0;
  const skipped  = stats?.skipped  ?? 0;
  const newCount = Math.max(0, total - known - learning - skipped);

  const lastStudied = stats?.lastStudiedAt
    ? stats.lastStudiedAt.toLocaleDateString("th-TH", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: BG }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white" style={{ borderBottom: "1px solid #EBEBEA" }}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/flashcard/${deckId}`)}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#F3F4F6" }}
              aria-label="กลับ"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#374151"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="w-4 h-4">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest leading-none mb-0.5"
                style={{ color: "#9CA3AF" }}>
                {deck.coverEmoji} {deck.name}
              </p>
              <p className="text-[17px] font-extrabold text-gray-900">สถิติการทบทวน</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">

        {/* ── Reset done notice ──────────────────────────────────────────── */}
        {resetDone && (
          <div className="bg-white rounded-2xl p-4 flex items-center gap-3"
            style={{ border: "1px solid #C3E5DE" }}>
            <span className="text-xl">✅</span>
            <p className="text-[14px] font-semibold" style={{ color: ACCENT }}>
              รีเซ็ตสถิติเรียบร้อย — พร้อมเริ่มทบทวนใหม่
            </p>
          </div>
        )}

        {/* ── Donut + Legend ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6"
          style={{ border: "1px solid #E5E7EB" }}>

          <div className="flex items-center justify-center mb-5">
            <DonutChart
              known={known} learning={learning}
              skipped={skipped} total={total}
            />
          </div>

          <div className="space-y-2.5">
            <Legend color={ACCENT}    label="จำได้แล้ว"   value={known}    total={total} />
            <Legend color="#D97706"   label="ยังจำไม่ได้" value={learning} total={total} />
            <Legend color="#9CA3AF"   label="ข้าม"         value={skipped}  total={total} />
            <Legend color="#D1D5DB"   label="ยังไม่เปิด"   value={newCount} total={total} />
            <div className="border-t pt-2.5 mt-2.5" style={{ borderColor: "#F3F4F6" }}>
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#374151" }} />
                <span className="text-[15px] flex-1 font-semibold" style={{ color: "#374151" }}>รวมทั้งหมด</span>
                <span className="text-[15px] font-bold text-gray-700">{total} ใบ</span>
              </div>
            </div>
          </div>

          {lastStudied && (
            <p className="text-[13px] text-center mt-4" style={{ color: "#9CA3AF" }}>
              ทบทวนล่าสุด: {lastStudied}
            </p>
          )}
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="จำได้แล้ว"   value={known}    bg="#EBF5F3" color={ACCENT}    />
          <StatCard label="ยังจำไม่ได้" value={learning} bg="#FFFBEB" color="#D97706"   />
          <StatCard label="ยังไม่เปิด"  value={newCount} bg="#F3F4F6" color="#6B7280"   />
          <StatCard label="ข้าม"        value={skipped}  bg="#F9FAFB" color="#9CA3AF"   />
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="space-y-2.5">
          <button
            onClick={() => router.push(`/flashcard/${deckId}`)}
            className="w-full py-4 rounded-2xl font-bold text-[18px] text-white
                       transition-transform active:scale-[0.97]"
            style={{ backgroundColor: ACCENT }}>
            ▶ เริ่มทบทวน{learning > 0 ? `เฉพาะที่จำไม่ได้ (${learning} ใบ)` : ""}
          </button>

          {/* Reset section */}
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={!stats}
              className="w-full py-3.5 rounded-2xl font-semibold text-[16px]
                         transition-transform active:scale-[0.97] disabled:opacity-30"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626",
                       border: "1px solid #FECACA" }}>
              รีเซ็ตสถิติทั้งหมด
            </button>
          ) : (
            <div className="bg-white rounded-2xl p-4 space-y-3"
              style={{ border: "1px solid #FECACA" }}>
              <p className="text-[14px] font-semibold text-center text-red-600">
                ยืนยันการรีเซ็ต?
              </p>
              <p className="text-[13px] text-center" style={{ color: "#6B7280" }}>
                สถิติทั้งหมด {total} ใบใน deck นี้จะถูกลบ ไม่สามารถกู้คืนได้
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  disabled={resetting}
                  className="flex-1 py-3 rounded-xl font-semibold text-[15px]"
                  style={{ backgroundColor: "#F3F4F6", color: "#374151" }}>
                  ยกเลิก
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex-1 py-3 rounded-xl font-bold text-[15px] text-white
                             disabled:opacity-50"
                  style={{ backgroundColor: "#DC2626" }}>
                  {resetting ? "กำลังรีเซ็ต…" : "ยืนยัน รีเซ็ต"}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
