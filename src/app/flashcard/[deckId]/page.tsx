"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAccessGuard } from "@/lib/use-access-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import {
  getDeckById,
  getCardsByDeck,
  getFCProgress,
  setFCProgress,
  shuffleCards,
} from "@/lib/flashcard-firestore";
import {
  FC_IMPORTANCE_LABEL,
  type FCDeck,
  type FlashCard,
  type FCProgress,
  type FCStatus,
  type FCSessionResult,
} from "@/lib/flashcard-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#0B6E65";
const BG     = "#A8D5BF";

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  "จุดตาย":   { bg: "#FEF2F2", color: "#DC2626" },
  "ตัวเลข":   { bg: "#EFF6FF", color: "#2563EB" },
  "ก่อนสอบ":  { bg: "#FFFBEB", color: "#D97706" },
  "สับสนบ่อย":{ bg: "#F5F3FF", color: "#7C3AED" },
};

// ─── FlipCard component ───────────────────────────────────────────────────────

function FlipCard({
  card,
  flipped,
  onFlip,
}: {
  card:    FlashCard;
  flipped: boolean;
  onFlip:  () => void;
}) {
  const imp = FC_IMPORTANCE_LABEL[card.importance];

  return (
    <button
      onClick={onFlip}
      className="w-full text-left focus:outline-none"
      style={{ perspective: "1200px" }}
      aria-label={flipped ? "แสดงด้านหน้า" : "แสดงคำตอบ"}
    >
      <div
        className="relative transition-transform duration-500 w-full"
        style={{
          transformStyle:  "preserve-3d",
          transform:       flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          minHeight:       "240px",
        }}
      >
        {/* ── Front ───────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 rounded-3xl bg-white flex flex-col
                     items-center justify-center p-7"
          style={{ backfaceVisibility: "hidden", border: "1px solid #E5E7EB" }}
        >
          {/* Tags */}
          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5 justify-center">
              {card.tags.map((tag) => {
                const s = TAG_STYLE[tag] ?? { bg: "#F3F4F6", color: "#374151" };
                return (
                  <span key={tag}
                    className="text-[12px] font-bold px-2.5 py-[3px] rounded-full"
                    style={{ backgroundColor: s.bg, color: s.color }}>
                    {tag}
                  </span>
                );
              })}
            </div>
          )}

          <p className="text-[20px] font-bold text-gray-900 text-center
                        leading-relaxed whitespace-pre-wrap">
            {card.front}
          </p>

          {card.hint && (
            <p className="text-[14px] mt-5 text-center px-2"
              style={{ color: "#6B7280" }}>
              💡 {card.hint}
            </p>
          )}

          <p className="text-[12px] mt-6" style={{ color: "#D1D5DB" }}>
            แตะการ์ดเพื่อดูคำตอบ
          </p>
        </div>

        {/* ── Back ────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 rounded-3xl flex flex-col
                     items-center justify-center p-7"
          style={{
            backfaceVisibility: "hidden",
            transform:          "rotateY(180deg)",
            backgroundColor:    "#EBF5F3",
            border:             `1px solid ${ACCENT}33`,
          }}
        >
          {/* Category + importance */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[12px] font-semibold px-2.5 py-[3px] rounded-full"
              style={{ backgroundColor: "#fff", color: ACCENT, border: `1px solid ${ACCENT}33` }}>
              {card.category}
            </span>
            <span className="text-[13px]" title={imp} style={{ color: "#F59E0B" }}>
              {"★".repeat(card.importance)}{"☆".repeat(3 - card.importance)}
            </span>
          </div>

          <p className="text-[19px] font-bold text-gray-900 text-center
                        leading-relaxed whitespace-pre-wrap">
            {card.back}
          </p>

          <p className="text-[12px] mt-6" style={{ color: "#6B7280" }}>
            แตะการ์ดเพื่อกลับด้านหน้า
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  current, total, known, learning,
}: {
  current: number; total: number; known: number; learning: number;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-semibold" style={{ color: "#4A5568" }}>
          {current} / {total}
        </span>
        <div className="flex gap-3 text-[12px]">
          <span style={{ color: ACCENT }}>✓ {known}</span>
          <span style={{ color: "#D97706" }}>↺ {learning}</span>
        </div>
      </div>
      <div className="h-[6px] rounded-full overflow-hidden"
        style={{ backgroundColor: "#D1FAE5" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: ACCENT }}
        />
      </div>
    </div>
  );
}

// ─── Result screen ────────────────────────────────────────────────────────────

function ResultScreen({
  deck, result, onReplay, onShuffle, onBack,
}: {
  deck:     FCDeck;
  result:   FCSessionResult;
  onReplay: () => void;
  onShuffle:() => void;
  onBack:   () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5"
      style={{ backgroundColor: BG }}>
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-xl"
        style={{ border: "1px solid #E5E7EB" }}>

        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-[22px] font-extrabold text-gray-900 mb-1">
            ทบทวนครบแล้ว!
          </h2>
          <p className="text-[14px]" style={{ color: "#4A5568" }}>
            {deck.coverEmoji} {deck.name}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-7">
          {[
            { label: "จำได้",       value: result.known,    bg: "#EBF5F3", color: ACCENT    },
            { label: "ทบทวนอีก",    value: result.learning, bg: "#FFFBEB", color: "#D97706" },
            { label: "ยังไม่ตัดสิน", value: result.skipped,  bg: "#F3F4F6", color: "#6B7280" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-3 text-center"
              style={{ backgroundColor: s.bg }}>
              <p className="text-[24px] font-extrabold leading-none mb-1"
                style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-[11px]" style={{ color: "#6B7280" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button onClick={onReplay}
            className="w-full py-3.5 rounded-2xl font-bold text-[16px] text-white"
            style={{ backgroundColor: ACCENT }}>
            ทบทวนอีกครั้ง
          </button>
          <button onClick={onShuffle}
            className="w-full py-3.5 rounded-2xl font-bold text-[16px]"
            style={{ backgroundColor: "#F5F3FF", color: "#7C3AED" }}>
            🎲 สุ่มใหม่
          </button>
          <button onClick={onBack}
            className="w-full py-3.5 rounded-2xl font-semibold text-[16px]"
            style={{ backgroundColor: "#F3F4F6", color: "#374151" }}>
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlashCardDeckPage() {
  const guard    = useAccessGuard();
  const { user } = useAuth();
  const router   = useRouter();
  const params   = useParams<{ deckId: string }>();
  const deckId   = params.deckId;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [deck,     setDeck]     = useState<FCDeck | null>(null);
  const [cards,    setCards]    = useState<FlashCard[]>([]);
  const [progress, setProgress] = useState<Map<string, FCProgress>>(new Map());
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // ── Session ───────────────────────────────────────────────────────────────
  const [index,    setIndex]    = useState(0);
  const [flipped,  setFlipped]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [finished, setFinished] = useState(false);

  // session counters (ref ไม่ trigger re-render ทุกครั้ง)
  const knownSet    = useRef(new Set<string>());
  const learningSet = useRef(new Set<string>());
  // tick เพื่อ force re-render แสดง counter ใน ProgressBar
  const [tick, setTick] = useState(0);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (guard !== "allowed") return;

    async function load() {
      setLoading(true);
      try {
        const d = await getDeckById(deckId);
        if (!d) { setError("ไม่พบ Deck นี้"); return; }
        setDeck(d);

        const fetched = await getCardsByDeck(deckId, d.slug);
        setCards(fetched);

        if (user && fetched.length) {
          const prog = await getFCProgress(user.uid, fetched.map((c) => c.id));
          setProgress(prog);
        }
      } catch {
        setError("โหลดการ์ดไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard, deckId]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const flip = useCallback(() => setFlipped((f) => !f), []);

  const go = useCallback((dir: 1 | -1) => {
    setFlipped(false);
    setIndex((i) => {
      const next = i + dir;
      if (next >= cards.length) { setFinished(true); return i; }
      return Math.max(0, next);
    });
  }, [cards.length]);

  const mark = useCallback(async (status: FCStatus) => {
    if (!user || !cards[index] || saving || !deck) return;
    const card = cards[index];
    setSaving(true);
    try {
      await setFCProgress(user.uid, card.id, status, deck.id);

      // อัพเดต local progress map
      setProgress((prev) => {
        const m = new Map(prev);
        m.set(card.id, {
          cardId:      card.id,
          status,
          reviewCount: (prev.get(card.id)?.reviewCount ?? 0) + 1,
          knownAt:     status === "known" ? (prev.get(card.id)?.knownAt ?? new Date()) : (prev.get(card.id)?.knownAt ?? null),
          updatedAt:   new Date(),
        });
        return m;
      });

      // อัพเดต session counter
      if (status === "known") {
        knownSet.current.add(card.id);
        learningSet.current.delete(card.id);
      } else if (status === "learning") {
        learningSet.current.add(card.id);
        knownSet.current.delete(card.id);
      }
      setTick((t) => t + 1);

      // ไปการ์ดถัดไปอัตโนมัติ
      go(1);
    } finally {
      setSaving(false);
    }
  }, [user, cards, index, saving, go]);

  const doShuffle = useCallback(() => {
    setCards((c) => shuffleCards(c));
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    knownSet.current.clear();
    learningSet.current.clear();
    setTick(0);
  }, []);

  const replay = useCallback(() => {
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    knownSet.current.clear();
    learningSet.current.clear();
    setTick(0);
  }, []);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (guard !== "allowed") return <AccessGuardSpinner />;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BG }}>
        <div className="text-center">
          <div
            className="w-9 h-9 border-[3px] border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: ACCENT, borderTopColor: "transparent" }}
          />
          <p className="text-[15px]" style={{ color: "#4A5568" }}>กำลังโหลด…</p>
        </div>
      </div>
    );
  }

  // ── Error / Empty ─────────────────────────────────────────────────────────
  if (error || !deck || cards.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5"
        style={{ backgroundColor: BG }}>
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full"
          style={{ border: "1px solid #E5E7EB" }}>
          <div className="text-4xl mb-3">{error ? "⚠️" : "🃏"}</div>
          <p className="text-[17px] font-bold text-gray-800 mb-1">
            {error || "ยังไม่มีการ์ดในคลังนี้"}
          </p>
          <button onClick={() => router.push("/flashcard")}
            className="mt-5 text-[15px] font-semibold px-6 py-2.5 rounded-xl text-white"
            style={{ backgroundColor: ACCENT }}>
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  // ── Result screen ─────────────────────────────────────────────────────────
  if (finished) {
    const known    = knownSet.current.size;
    const learning = learningSet.current.size;
    return (
      <ResultScreen
        deck={deck}
        result={{ total: cards.length, known, learning, skipped: cards.length - known - learning }}
        onReplay={replay}
        onShuffle={doShuffle}
        onBack={() => router.push("/flashcard")}
      />
    );
  }

  // ── Session ───────────────────────────────────────────────────────────────
  const card       = cards[index];
  const cardStatus = progress.get(card.id)?.status ?? "new";

  const STATUS_LABEL: Record<FCStatus, { label: string; bg: string; color: string }> = {
    new:      { label: "ใหม่",        bg: "#F3F4F6", color: "#6B7280" },
    learning: { label: "กำลังเรียน",  bg: "#FFFBEB", color: "#D97706" },
    known:    { label: "จำได้",        bg: "#EBF5F3", color: ACCENT    },
    skipped:  { label: "ข้าม",        bg: "#F3F4F6", color: "#9CA3AF" },
  };
  const sl = STATUS_LABEL[cardStatus];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BG }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white flex-shrink-0"
        style={{ borderBottom: "1px solid #EBEBEA" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">

          {/* row 1: back + title + status */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/flashcard")}
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
              <p className="text-[15px] font-bold text-gray-900 truncate leading-tight">
                {card.category}
              </p>
            </div>

            <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full flex-shrink-0"
              style={{ backgroundColor: sl.bg, color: sl.color }}>
              {sl.label}
            </span>

            {/* Stats link */}
            <button
              onClick={() => router.push(`/flashcard/${deckId}/stats`)}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#F3F4F6" }}
              aria-label="ดูสถิติ"
              title="ดูสถิติ"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#374151"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="w-4 h-4">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4"  />
                <line x1="6"  y1="20" x2="6"  y2="14" />
              </svg>
            </button>
          </div>

          {/* row 2: progress bar */}
          <ProgressBar
            current={index + 1}
            total={cards.length}
            known={knownSet.current.size}
            learning={learningSet.current.size}
          />
        </div>
      </div>

      {/* ── Card area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-5 py-5
                      max-w-2xl mx-auto w-full">

        <FlipCard card={card} flipped={flipped} onFlip={flip} />

        {/* ── Show answer button (when not flipped) ─────────────────────── */}
        {!flipped && (
          <button
            onClick={flip}
            className="mt-4 w-full py-3.5 rounded-2xl font-semibold text-[16px] bg-white"
            style={{ border: "1px solid #E5E7EB", color: ACCENT }}>
            ดูคำตอบ
          </button>
        )}

        {/* ── Mark buttons (when flipped) ───────────────────────────────── */}
        {flipped && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              onClick={() => mark("learning")}
              disabled={saving}
              className="py-4 rounded-2xl font-bold text-[16px]
                         transition-transform active:scale-[0.97] disabled:opacity-40"
              style={{ backgroundColor: "#FFFBEB", color: "#D97706",
                       border: "1px solid #FDE68A" }}>
              🔄 ยังจำไม่ได้
            </button>
            <button
              onClick={() => mark("known")}
              disabled={saving}
              className="py-4 rounded-2xl font-bold text-[16px]
                         transition-transform active:scale-[0.97] disabled:opacity-40"
              style={{ backgroundColor: "#EBF5F3", color: ACCENT,
                       border: "1px solid #C3E5DE" }}>
              ✓ จำได้แล้ว
            </button>
          </div>
        )}

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <div className="mt-3 flex items-center gap-2">
          {/* ก่อนหน้า */}
          <button
            onClick={() => go(-1)}
            disabled={index === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5
                       rounded-2xl font-semibold text-[15px] bg-white
                       transition-transform active:scale-[0.97] disabled:opacity-30"
            style={{ border: "1px solid #E5E7EB", color: "#374151" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            ก่อนหน้า
          </button>

          {/* สุ่ม */}
          <button
            onClick={doShuffle}
            className="w-12 h-12 flex items-center justify-center rounded-2xl
                       flex-shrink-0 transition-transform active:scale-[0.97]
                       text-[20px]"
            style={{ backgroundColor: "#F5F3FF", border: "1px solid #DDD6FE" }}
            title="สุ่มการ์ด">
            🎲
          </button>

          {/* ถัดไป */}
          <button
            onClick={() => go(1)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5
                       rounded-2xl font-bold text-[15px] text-white
                       transition-transform active:scale-[0.97]"
            style={{ backgroundColor: ACCENT }}>
            ถัดไป
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}
