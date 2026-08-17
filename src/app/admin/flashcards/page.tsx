"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllDecks, setDeckFlags } from "@/lib/flashcard-firestore";
import DripScheduler from "@/components/DripScheduler";
import type { FCDeck } from "@/lib/flashcard-types";

// ─── /admin/flashcards — จัดการ deck: เผยแพร่ / ทดลองฟรี ─────────────────────

const TYPE_LABEL: Record<FCDeck["type"], string> = {
  chapter:  "เรียนตามบท",
  pre_exam: "ทบทวนก่อนสอบ",
  tag:      "จุดตาย/ตัวเลข",
  custom:   "คลังพิเศษ",
};

function MiniToggle({
  checked, onChange, disabled, activeColor,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; activeColor: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 disabled:opacity-40"
      style={{ backgroundColor: checked ? activeColor : "#D1D5DB" }}
    >
      <span
        className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all"
        style={{ left: checked ? 20 : 2 }}
      />
    </button>
  );
}

export default function AdminFlashcardsPage() {
  const [decks,   setDecks]   = useState<FCDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState<string | null>(null); // deckId ที่กำลังบันทึก
  const [error,   setError]   = useState("");

  useEffect(() => {
    getAllDecks()
      .then(setDecks)
      .catch(() => setError("โหลดรายการ deck ไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  async function flip(deck: FCDeck, key: "isFree" | "isPublished", value: boolean) {
    setBusy(deck.id);
    try {
      await setDeckFlags(deck.id, { [key]: value });
      setDecks((prev) => prev.map((d) => (d.id === deck.id ? { ...d, [key]: value } : d)));
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(null);
    }
  }

  const freeCount = decks.filter((d) => d.isFree).length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      {/* Header */}
      <div className="sticky top-14 z-30 bg-white"
        style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-bold text-gray-900">Flash Card Decks</h1>
            {!loading && (
              <span className="text-[12px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                {decks.length} คลัง · ฟรี {freeCount}
              </span>
            )}
          </div>
          <Link href="/admin/flashcards/import"
            className="text-[12.5px] font-semibold px-4 py-1.5 rounded-xl text-white"
            style={{ backgroundColor: "#0B6E65" }}>
            + Import การ์ด
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 pt-6 pb-16">
        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 text-[13px] font-medium"
            style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse" style={{ border: "1px solid #EBEBEA" }}>
                <div className="h-5 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : decks.length === 0 ? (
          <div className="bg-white rounded-2xl p-14 text-center" style={{ border: "1px solid #EBEBEA" }}>
            <div className="text-4xl mb-3">🃏</div>
            <p className="text-[15px] font-semibold text-gray-800 mb-1">ยังไม่มี Deck</p>
            <p className="text-[13px] mb-5" style={{ color: "#A8A8A6" }}>
              Import การ์ดจากไฟล์ Excel เพื่อสร้าง deck แรก
            </p>
            <Link href="/admin/flashcards/import"
              className="text-[13px] font-semibold px-5 py-2.5 rounded-xl text-white inline-block"
              style={{ backgroundColor: "#0B6E65" }}>
              + Import การ์ด
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {decks.map((deck) => (
              <div key={deck.id} className="bg-white rounded-2xl px-5 py-4"
                style={{ border: `1px solid ${deck.isFree ? "#BBF7D0" : "#EBEBEA"}` }}>
                <div className="flex items-center gap-4">
                  {/* Emoji + name */}
                  <span className="text-[26px] leading-none flex-shrink-0">{deck.coverEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14.5px] font-bold text-gray-900 truncate">{deck.name}</p>
                      {deck.isFree && (
                        <span className="text-[11.5px] font-bold px-2 py-[3px] rounded-full"
                          style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}>
                          ทดลองฟรี
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] mt-0.5" style={{ color: "#A8A8A6" }}>
                      {TYPE_LABEL[deck.type]} · {deck.totalCards} ใบ · slug: {deck.slug}
                    </p>
                    <DripScheduler deck={deck} />
                  </div>

                  {/* Toggles */}
                  <div className="flex items-center gap-5 flex-shrink-0">
                    <div className="flex flex-col items-center gap-1">
                      <MiniToggle
                        checked={deck.isPublished}
                        disabled={busy === deck.id}
                        onChange={(v) => flip(deck, "isPublished", v)}
                        activeColor="#0B6E65"
                      />
                      <span className="text-[11.5px] font-semibold" style={{ color: "#A8A8A6" }}>
                        เผยแพร่
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <MiniToggle
                        checked={deck.isFree}
                        disabled={busy === deck.id}
                        onChange={(v) => flip(deck, "isFree", v)}
                        activeColor="#16A34A"
                      />
                      <span className="text-[11.5px] font-semibold" style={{ color: "#A8A8A6" }}>
                        🎁 ฟรี
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
