"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccessGuard } from "@/lib/use-access-guard";
import { useAuth } from "@/lib/auth-context";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";
import { getPublishedDecks, getAllFCDeckStats } from "@/lib/flashcard-firestore";
import type { FCDeck, FCDeckStats } from "@/lib/flashcard-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const BG = "#A8D5BF";

// แต่ละ deck type → visual token
const DECK_THEME = {
  chapter: {
    groupLabel: "เรียนตามบท",
    bg:    "#EBF5F3",
    ring:  "#C3E5DE",
    badge: "#0B6E65",
    text:  "#0B6E65",
  },
  pre_exam: {
    groupLabel: "ทบทวนก่อนสอบ",
    bg:    "#FFFBEB",
    ring:  "#FDE68A",
    badge: "#D97706",
    text:  "#92400E",
  },
  tag: {
    groupLabel: "จุดตาย / ตัวเลข / สับสนบ่อย",
    bg:    "#FEF2F2",
    ring:  "#FECACA",
    badge: "#DC2626",
    text:  "#991B1B",
  },
  custom: {
    groupLabel: "คลังพิเศษ",
    bg:    "#F5F3FF",
    ring:  "#DDD6FE",
    badge: "#7C3AED",
    text:  "#4C1D95",
  },
} as const satisfies Record<FCDeck["type"], {
  groupLabel: string; bg: string; ring: string; badge: string; text: string;
}>;

// ลำดับกลุ่มที่จะแสดง
const GROUP_ORDER: FCDeck["type"][] = ["pre_exam", "tag", "chapter", "custom"];

// ─── DeckCard ─────────────────────────────────────────────────────────────────

function DeckCard({
  deck, stats,
}: {
  deck:  FCDeck;
  stats: FCDeckStats | undefined;
}) {
  const theme = DECK_THEME[deck.type];
  const total = deck.totalCards;

  // คำนวณ progress
  const known    = stats?.known    ?? 0;
  const learning = stats?.learning ?? 0;
  const hasStats = !!stats;
  const knownPct = total > 0 ? Math.round((known / total) * 100) : 0;

  // Badge สีส้มเมื่อยังมีการ์ดที่จำไม่ได้
  const hasLearning = learning > 0;

  return (
    <Link
      href={`/flashcard/${deck.id}`}
      className="flex items-center gap-4 rounded-2xl px-4 py-4
                 active:scale-[0.97] transition-transform"
      style={{ backgroundColor: theme.bg, border: `1px solid ${theme.ring}` }}
    >
      {/* Emoji */}
      <span className="text-[32px] leading-none w-10 text-center flex-shrink-0">
        {deck.coverEmoji}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[16px] font-bold text-gray-900 leading-snug truncate flex-1">
            {deck.name}
          </p>
          {hasLearning && (
            <span className="text-[10px] font-bold px-2 py-[2px] rounded-full flex-shrink-0"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}>
              ↺ {learning}
            </span>
          )}
        </div>

        {deck.description ? (
          <p className="text-[13px] leading-snug line-clamp-1 mb-1"
            style={{ color: "#4A5568" }}>
            {deck.description}
          </p>
        ) : null}

        {/* Progress bar — แสดงเมื่อมี stats */}
        {hasStats && total > 0 ? (
          <div className="mt-1">
            <div className="h-[5px] rounded-full overflow-hidden"
              style={{ backgroundColor: "#D1FAE5" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${knownPct}%`, backgroundColor: theme.badge }}
              />
            </div>
            <p className="text-[11px] mt-1 font-semibold" style={{ color: theme.badge }}>
              {known} / {total} ใบ · {knownPct}% จำได้
            </p>
          </div>
        ) : (
          <p className="text-[12px] mt-1 font-semibold" style={{ color: theme.badge }}>
            {total > 0 ? `${total} ใบ` : "ยังไม่มีการ์ด"}
          </p>
        )}
      </div>

      {/* Arrow */}
      <svg viewBox="0 0 24 24" fill="none" stroke={theme.badge} strokeOpacity="0.5"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-4 h-4 flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

// ─── GroupSection ─────────────────────────────────────────────────────────────

function GroupSection({
  type, decks, statsMap,
}: {
  type: FCDeck["type"]; decks: FCDeck[]; statsMap: Map<string, FCDeckStats>;
}) {
  if (!decks.length) return null;
  const theme = DECK_THEME[type];
  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5"
        style={{ color: "#4A5568" }}>
        {theme.groupLabel}
      </p>
      <div className="space-y-2.5">
        {decks.map((d) => (
          <DeckCard key={d.id} deck={d} stats={statsMap.get(d.id)} />
        ))}
      </div>
    </section>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      {[3, 2, 4].map((n, gi) => (
        <div key={gi} className="animate-pulse">
          <div className="h-3 w-28 bg-white/60 rounded mb-2.5" />
          <div className="space-y-2.5">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-2xl bg-white/70" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlashCardListPage() {
  const guard    = useAccessGuard();
  const { user } = useAuth();
  const [decks,    setDecks]    = useState<FCDeck[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, FCDeckStats>>(new Map());
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (guard !== "allowed") return;

    async function load() {
      try {
        // โหลด deck list + stats พร้อมกัน
        const [fetchedDecks, fetchedStats] = await Promise.all([
          getPublishedDecks(),
          user ? getAllFCDeckStats(user.uid) : Promise.resolve(new Map<string, FCDeckStats>()),
        ]);
        setDecks(fetchedDecks);
        setStatsMap(fetchedStats);
      } catch {
        setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        setLoading(false);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard, user?.uid]);

  if (guard !== "allowed") return <AccessGuardSpinner />;

  // จัดกลุ่มตาม type
  const grouped = GROUP_ORDER.reduce<Record<FCDeck["type"], FCDeck[]>>(
    (acc, t) => ({ ...acc, [t]: decks.filter((d) => d.type === t) }),
    { pre_exam: [], tag: [], chapter: [], custom: [] },
  );

  const totalCards = decks.reduce((s, d) => s + d.totalCards, 0);
  const isEmpty    = !loading && !error && decks.length === 0;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: BG }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white" style={{ borderBottom: "1px solid #EBEBEA" }}>
        <div className="max-w-2xl mx-auto px-5 py-5">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "#4A5568" }}>
            Flash Card
          </p>
          <h1 className="text-[22px] font-extrabold text-gray-900">
            ทบทวนความรู้
          </h1>
          {!loading && totalCards > 0 && (
            <p className="text-[13px] mt-1" style={{ color: "#4A5568" }}>
              {totalCards.toLocaleString()} ใบ · {decks.length} คลัง
            </p>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 py-5 space-y-6">

        {loading && <Skeleton />}

        {error && (
          <div className="bg-white rounded-2xl p-6 text-center"
            style={{ border: "1px solid #EBEBEA" }}>
            <p className="text-[15px] text-red-500 mb-3">{error}</p>
            <button
              onClick={() => {
                setError(""); setLoading(true);
                Promise.all([
                  getPublishedDecks(),
                  user ? getAllFCDeckStats(user.uid) : Promise.resolve(new Map<string, FCDeckStats>()),
                ])
                  .then(([d, s]) => { setDecks(d); setStatsMap(s); })
                  .catch(() => setError("โหลดไม่สำเร็จ"))
                  .finally(() => setLoading(false));
              }}
              className="text-[14px] font-semibold px-4 py-2 rounded-xl text-white"
              style={{ backgroundColor: "#0B6E65" }}>
              ลองใหม่
            </button>
          </div>
        )}

        {isEmpty && (
          <div className="bg-white rounded-2xl p-10 text-center"
            style={{ border: "1px dashed #E0DFDC" }}>
            <div className="text-4xl mb-3">🃏</div>
            <p className="text-[17px] font-semibold text-gray-800 mb-1">
              ยังไม่มี Flash Card
            </p>
            <p className="text-[14px]" style={{ color: "#4A5568" }}>
              Admin สามารถเพิ่มการ์ดได้ที่ Admin › Flash Card Import
            </p>
          </div>
        )}

        {!loading && !error && GROUP_ORDER.map((type) => (
          <GroupSection key={type} type={type} decks={grouped[type]} statsMap={statsMap} />
        ))}

      </div>

      <BottomNav />
    </div>
  );
}
