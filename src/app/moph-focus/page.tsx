"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAccessGuard } from "@/lib/use-access-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";
import {
  getPublishedMOPHFocus,
  filterMOPHFocus,
} from "@/lib/moph-focus-firestore";
import {
  MOPH_TAG_LIST,
  MOPH_TAG_STYLE,
  type MOPHFocusItem,
  type MOPHTag,
} from "@/lib/moph-focus-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#0369A1";
const BG     = "#F0F9FF";

// ─── Tag Chip ─────────────────────────────────────────────────────────────────

function TagChip({ tag, small }: { tag: MOPHTag; small?: boolean }) {
  const s = MOPH_TAG_STYLE[tag];
  return (
    <span
      className={`inline-flex items-center font-bold rounded-full whitespace-nowrap
                  ${small ? "text-[11px] px-2 py-[2px]" : "text-[12px] px-2.5 py-[3px]"}`}
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ─── FocusCard (List item) ────────────────────────────────────────────────────

function FocusCard({ item }: { item: MOPHFocusItem }) {
  const date = item.publishedDate.toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <Link
      href={`/moph-focus/${item.id}`}
      className="block bg-white rounded-2xl px-5 py-4
                 active:scale-[0.98] transition-transform"
      style={{ border: "1px solid #E0EFF9" }}
    >
      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.tags.slice(0, 3).map((t) => (
          <TagChip key={t} tag={t} small />
        ))}
      </div>

      {/* Title */}
      <div className="flex items-start gap-3 mb-2">
        <span className="text-[28px] leading-none mt-0.5 flex-shrink-0">
          {item.coverEmoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[18px] font-bold text-gray-900 leading-snug">
            {item.title}
          </p>
          {item.subtitle && (
            <p className="text-[14px] mt-0.5" style={{ color: "#4A5568" }}>
              {item.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Summary */}
      <p className="text-[15px] leading-relaxed line-clamp-3"
        style={{ color: "#374151" }}>
        {item.summary}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3"
        style={{ borderTop: "1px solid #F0F9FF" }}>
        <span className="text-[12px]" style={{ color: "#9CA3AF" }}>
          📅 {date}
        </span>
        <span className="text-[13px] font-semibold flex items-center gap-1"
          style={{ color: ACCENT }}>
          อ่านต่อ
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="w-3.5 h-3.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E0EFF9" }}>
          <div className="flex gap-1.5 mb-3">
            <div className="h-5 w-16 rounded-full bg-blue-100" />
            <div className="h-5 w-20 rounded-full bg-blue-100" />
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-5/6" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MOPHFocusListPage() {
  const guard = useAccessGuard();

  const [allItems, setAllItems]   = useState<MOPHFocusItem[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState("");
  const [search,   setSearch]     = useState("");
  const [activeTag, setActiveTag] = useState<MOPHTag | "ทั้งหมด">("ทั้งหมด");

  // Load
  useEffect(() => {
    if (guard !== "allowed") return;
    getPublishedMOPHFocus()
      .then(setAllItems)
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่"))
      .finally(() => setLoading(false));
  }, [guard]);

  // Filter (client-side)
  const items = useMemo(
    () => filterMOPHFocus(allItems, search, activeTag),
    [allItems, search, activeTag],
  );

  if (guard !== "allowed") return <AccessGuardSpinner />;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: BG }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="bg-white" style={{ borderBottom: "1px solid #BAE6FD" }}>
        <div className="max-w-2xl mx-auto px-5 pt-5 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "#64748B" }}>
            MOPH FOCUS
          </p>
          <h1 className="text-[22px] font-extrabold text-gray-900">
            คลังประเด็นสำคัญเพื่อการสอบ
          </h1>
          {!loading && allItems.length > 0 && (
            <p className="text-[13px] mt-0.5" style={{ color: "#64748B" }}>
              {allItems.length} ประเด็น · อัปเดตสม่ำเสมอ
            </p>
          )}
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto px-5 pb-3">
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="ค้นหาประเด็น..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[15px]
                         focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "#F0F9FF",
                border: "1px solid #BAE6FD",
                // @ts-expect-error custom focus ring color
                "--tw-ring-color": ACCENT,
              }}
            />
          </div>
        </div>

        {/* Tag filter — horizontal scroll */}
        <div className="max-w-2xl mx-auto px-5 pb-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {/* ทั้งหมด */}
            <button
              onClick={() => setActiveTag("ทั้งหมด")}
              className="flex-shrink-0 text-[12px] font-bold px-3 py-1.5 rounded-full
                         transition-colors"
              style={{
                backgroundColor: activeTag === "ทั้งหมด" ? ACCENT : "#E0F2FE",
                color:           activeTag === "ทั้งหมด" ? "#fff"  : "#64748B",
              }}
            >
              ทั้งหมด
            </button>
            {MOPH_TAG_LIST.map((tag) => {
              const s      = MOPH_TAG_STYLE[tag];
              const isActive = activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(isActive ? "ทั้งหมด" : tag)}
                  className="flex-shrink-0 text-[12px] font-bold px-3 py-1.5 rounded-full
                             transition-colors"
                  style={{
                    backgroundColor: isActive ? s.color : s.bg,
                    color:           isActive ? "#fff"   : s.color,
                    border:          `1px solid ${s.color}33`,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {loading && <Skeleton />}

        {error && (
          <div className="bg-white rounded-2xl p-6 text-center"
            style={{ border: "1px solid #FEE2E2" }}>
            <p className="text-red-500 text-[15px] mb-3">{error}</p>
            <button
              onClick={() => {
                setError(""); setLoading(true);
                getPublishedMOPHFocus()
                  .then(setAllItems)
                  .catch(() => setError("โหลดไม่สำเร็จ"))
                  .finally(() => setLoading(false));
              }}
              className="text-[14px] font-semibold px-5 py-2 rounded-xl text-white"
              style={{ backgroundColor: ACCENT }}>
              ลองใหม่
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center"
            style={{ border: "1px dashed #BAE6FD" }}>
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-[17px] font-semibold text-gray-800 mb-1">
              {search || activeTag !== "ทั้งหมด"
                ? "ไม่พบประเด็นที่ค้นหา"
                : "ยังไม่มีประเด็น"}
            </p>
            <p className="text-[14px]" style={{ color: "#64748B" }}>
              {search || activeTag !== "ทั้งหมด"
                ? "ลองเปลี่ยน keyword หรือ tag"
                : "Admin สามารถเพิ่มได้ที่ Admin › MOPH Focus Import"}
            </p>
            {(search || activeTag !== "ทั้งหมด") && (
              <button
                onClick={() => { setSearch(""); setActiveTag("ทั้งหมด"); }}
                className="mt-4 text-[14px] font-semibold px-5 py-2 rounded-xl text-white"
                style={{ backgroundColor: ACCENT }}>
                ล้างตัวกรอง
              </button>
            )}
          </div>
        )}

        {!loading && !error && items.map((item) => (
          <FocusCard key={item.id} item={item} />
        ))}

      </div>

      <BottomNav />
    </div>
  );
}
