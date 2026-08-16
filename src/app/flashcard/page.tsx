"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLoginGuard } from "@/lib/use-login-guard";
import { useAuth } from "@/lib/auth-context";
import { getUserAccess, EMPTY_ACCESS, type UserAccess } from "@/lib/access";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";
import { getPublishedDecks, getAllFCDeckStats } from "@/lib/flashcard-firestore";
import type { FCDeck, FCDeckStats } from "@/lib/flashcard-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const BG     = "#FAFAF9";
const ACCENT = "#0B6E65";
const LINE   = "#ECEBE9";
const MUTED  = "#A8A29E";

// แต่ละ deck type → สีของ "ช่องอีโมจิ" เท่านั้น — ตัวการ์ดขาวล้วนทุกหมวด
const DECK_THEME = {
  chapter: {
    groupLabel: "เรียนตามบท",
    chipBg: "#EBF5F3",
    accent: "#0B6E65",
  },
  pre_exam: {
    groupLabel: "ทบทวนก่อนสอบ",
    chipBg: "#FDF6E9",
    accent: "#B45309",
  },
  tag: {
    groupLabel: "จุดตาย / ตัวเลข / สับสนบ่อย",
    chipBg: "#FDF1F1",
    accent: "#B91C1C",
  },
  custom: {
    groupLabel: "คลังพิเศษ",
    chipBg: "#F5F2FC",
    accent: "#6D28D9",
  },
} as const satisfies Record<FCDeck["type"], {
  groupLabel: string; chipBg: string; accent: string;
}>;

// ลำดับกลุ่มที่จะแสดง
const GROUP_ORDER: FCDeck["type"][] = ["pre_exam", "tag", "chapter", "custom"];

// ─── DeckCard ─────────────────────────────────────────────────────────────────

function DeckCard({
  deck, stats, locked,
}: {
  deck:   FCDeck;
  stats:  FCDeckStats | undefined;
  locked: boolean;
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
      className="card-elev card-elev-hover flex items-center gap-3.5 px-4 py-3.5
                 active:scale-[0.98]"
    >
      {/* Emoji chip */}
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: theme.chipBg }}>
        <span className="text-[22px] leading-none">{deck.coverEmoji}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[15.5px] font-bold text-gray-900 leading-snug truncate flex-1">
            {deck.name}
          </p>
          {deck.isFree && (
            <span className="text-[11px] font-bold px-2 py-[3px] rounded-full flex-shrink-0"
              style={{ backgroundColor: "#EBF5F3", color: ACCENT }}>
              ฟรี
            </span>
          )}
          {locked && (
            <svg viewBox="0 0 24 24" fill="none" stroke={MUTED} className="w-3.5 h-3.5 flex-shrink-0"
              strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-label="ล็อก">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
          {hasLearning && !locked && (
            <span className="text-[11px] font-bold px-2 py-[3px] rounded-full flex-shrink-0"
              style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
              ↺ {learning}
            </span>
          )}
        </div>

        {deck.description ? (
          <p className="text-[13px] leading-snug line-clamp-1 mt-0.5"
            style={{ color: MUTED }}>
            {deck.description}
          </p>
        ) : null}

        {/* Progress bar — แสดงเมื่อมี stats */}
        {hasStats && total > 0 ? (
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-[4px] rounded-full overflow-hidden flex-1"
              style={{ backgroundColor: "#EDECEA" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${knownPct}%`, backgroundColor: ACCENT }}
              />
            </div>
            <p className="text-[11.5px] font-semibold tabular-nums flex-shrink-0"
              style={{ color: "#78716C" }}>
              {known}/{total} · {knownPct}%
            </p>
          </div>
        ) : (
          <p className="text-[12.5px] mt-1" style={{ color: MUTED }}>
            {total > 0 ? `${total} ใบ` : "ยังไม่มีการ์ด"}
          </p>
        )}
      </div>

      {/* Arrow */}
      <svg viewBox="0 0 24 24" fill="none" stroke="#D6D3D1"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-4 h-4 flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

// ─── GroupSection ─────────────────────────────────────────────────────────────

function GroupSection({
  type, decks, statsMap, access,
}: {
  type: FCDeck["type"]; decks: FCDeck[]; statsMap: Map<string, FCDeckStats>;
  access: UserAccess;
}) {
  if (!decks.length) return null;
  const theme = DECK_THEME[type];
  return (
    <section>
      <p className="text-[11.5px] font-semibold mb-2.5"
        style={{ color: MUTED }}>
        {theme.groupLabel}
      </p>
      <div className="space-y-2">
        {decks.map((d) => (
          <DeckCard
            key={d.id}
            deck={d}
            stats={statsMap.get(d.id)}
            locked={!d.isFree && !access.hasAny}
          />
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
  const guard    = useLoginGuard();
  const { user } = useAuth();
  const [decks,    setDecks]    = useState<FCDeck[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, FCDeckStats>>(new Map());
  const [access,   setAccess]   = useState<UserAccess>(EMPTY_ACCESS);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (guard !== "allowed") return;

    async function load() {
      try {
        // โหลด deck list + stats + สิทธิ์ พร้อมกัน
        const [fetchedDecks, fetchedStats, fetchedAccess] = await Promise.all([
          getPublishedDecks(),
          user ? getAllFCDeckStats(user.uid) : Promise.resolve(new Map<string, FCDeckStats>()),
          user ? getUserAccess(user.uid)     : Promise.resolve(EMPTY_ACCESS),
        ]);
        setDecks(fetchedDecks);
        setStatsMap(fetchedStats);
        setAccess(fetchedAccess);
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
      <div className="bg-white" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-2xl mx-auto px-5 py-5">
          <p className="text-[11.5px] font-semibold mb-1"
            style={{ color: MUTED }}>
            Flash Card
          </p>
          <h1 className="text-[21px] font-extrabold text-gray-900">
            ทบทวนความรู้
          </h1>
          {!loading && totalCards > 0 && (
            <p className="text-[13px] mt-1" style={{ color: MUTED }}>
              {totalCards.toLocaleString()} ใบ · {decks.length} คลัง
            </p>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 py-5 space-y-6">

        {loading && <Skeleton />}

        {error && (
          <div className="card-elev p-6 text-center">
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
          <GroupSection key={type} type={type} decks={grouped[type]} statsMap={statsMap} access={access} />
        ))}

      </div>

      <BottomNav />
    </div>
  );
}
