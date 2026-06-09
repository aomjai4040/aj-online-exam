"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccessGuard } from "@/lib/use-access-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import { getMOPHFocusById } from "@/lib/moph-focus-firestore";
import { MOPH_TAG_STYLE, type MOPHFocusItem, type MOPHTag } from "@/lib/moph-focus-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#0369A1";
const BG     = "#F0F9FF";

// ─── Tag Chip ─────────────────────────────────────────────────────────────────

function TagChip({ tag }: { tag: MOPHTag }) {
  const s = MOPH_TAG_STYLE[tag];
  return (
    <span
      className="inline-flex items-center text-[12px] font-bold rounded-full
                 px-2.5 py-[3px] whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ─── Simple Markdown renderer ─────────────────────────────────────────────────
// Supports: **bold**, # heading, ## heading, - bullet, blank-line paragraph
// No external dependency.

function MdText({ text }: { text: string }) {
  if (!text) return null;

  const lines  = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (!listItems.length) return;
    nodes.push(
      <ul key={nodes.length} className="pl-4 space-y-1 my-2">
        {listItems.map((li, i) => (
          <li key={i} className="text-[16px] leading-relaxed flex gap-2"
            style={{ color: "#374151" }}>
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: ACCENT }} />
            <span>{renderInline(li)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  }

  function renderInline(s: string): React.ReactNode {
    // split on **bold**
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} className="font-bold" style={{ color: "#1E3A5F" }}>{p.slice(2, -2)}</strong>
        : p
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // h2
    if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <h3 key={i} className="text-[17px] font-extrabold mt-4 mb-1"
          style={{ color: ACCENT }}>
          {line.slice(3)}
        </h3>
      );
      continue;
    }
    // h1
    if (line.startsWith("# ")) {
      flushList();
      nodes.push(
        <h2 key={i} className="text-[18px] font-extrabold mt-4 mb-1"
          style={{ color: "#1E3A5F" }}>
          {line.slice(2)}
        </h2>
      );
      continue;
    }
    // bullet
    if (line.startsWith("- ") || line.startsWith("• ")) {
      listItems.push(line.slice(2));
      continue;
    }
    // blank
    if (!line.trim()) {
      flushList();
      continue;
    }
    // normal paragraph
    flushList();
    nodes.push(
      <p key={i} className="text-[16px] leading-relaxed" style={{ color: "#374151" }}>
        {renderInline(line)}
      </p>
    );
  }
  flushList();

  return <div className="space-y-1">{nodes}</div>;
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon, title, accentColor, children,
}: {
  icon: string; title: string; accentColor: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden"
      style={{ border: "1px solid #E0EFF9" }}>
      {/* Header strip */}
      <div className="px-5 py-3 flex items-center gap-2"
        style={{ backgroundColor: accentColor + "18", borderBottom: `2px solid ${accentColor}30` }}>
        <span className="text-[20px]">{icon}</span>
        <span className="text-[15px] font-extrabold" style={{ color: accentColor }}>
          {title}
        </span>
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  );
}

// ─── Expandable full content ──────────────────────────────────────────────────

function ExpandableContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden"
      style={{ border: "1px solid #E0EFF9" }}>
      {/* Header */}
      <button
        className="w-full px-5 py-3 flex items-center justify-between gap-2 text-left"
        style={{ backgroundColor: "#EFF6FF", borderBottom: expanded ? "2px solid #BFDBFE" : "none" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[20px]">📖</span>
          <span className="text-[15px] font-extrabold" style={{ color: "#1D4ED8" }}>
            อ่านเพิ่มเติม
          </span>
        </div>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="#1D4ED8"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`w-5 h-5 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 py-4">
          <MdText text={content} />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MOPHFocusDetailPage() {
  const guard  = useAccessGuard();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id     = params.id;

  const [item,    setItem]    = useState<MOPHFocusItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (guard !== "allowed") return;
    getMOPHFocusById(id)
      .then((data) => {
        if (!data) setError("ไม่พบประเด็นนี้");
        else       setItem(data);
      })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [guard, id]);

  if (guard !== "allowed") return <AccessGuardSpinner />;

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BG }}>
        <div className="w-9 h-9 rounded-full border-[3px] border-t-transparent animate-spin"
          style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
      </div>
    );
  }

  // Error / Not found
  if (error || !item) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5"
        style={{ backgroundColor: BG }}>
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full"
          style={{ border: "1px solid #E5E7EB" }}>
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-[17px] font-bold text-gray-800 mb-4">
            {error || "ไม่พบประเด็นนี้"}
          </p>
          <button onClick={() => router.push("/moph-focus")}
            className="text-[15px] font-semibold px-6 py-2.5 rounded-xl text-white"
            style={{ backgroundColor: ACCENT }}>
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  const date = item.publishedDate.toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: BG }}>

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="bg-white sticky top-0 z-10"
        style={{ borderBottom: "1px solid #BAE6FD" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/moph-focus")}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#F0F9FF" }}
            aria-label="กลับ"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "#64748B" }}>
              MOPH FOCUS
            </p>
            <p className="text-[14px] font-bold text-gray-900 truncate">
              {item.title}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl px-5 py-5"
          style={{ border: "1px solid #E0EFF9" }}>
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.tags.map((t) => <TagChip key={t} tag={t} />)}
          </div>

          {/* Emoji + Title */}
          <div className="flex items-start gap-3 mb-3">
            <span className="text-[44px] leading-none flex-shrink-0">{item.coverEmoji}</span>
            <div className="flex-1">
              <h1 className="text-[20px] font-extrabold text-gray-900 leading-snug">
                {item.title}
              </h1>
              {item.subtitle && (
                <p className="text-[15px] mt-1 leading-snug" style={{ color: "#4A5568" }}>
                  {item.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Summary */}
          <p className="text-[16px] leading-relaxed" style={{ color: "#374151" }}>
            {item.summary}
          </p>

          {/* Date */}
          <p className="text-[12px] mt-3" style={{ color: "#9CA3AF" }}>📅 {date}</p>
        </div>

        {/* ── Section 1: Must Know ───────────────────────────────────────── */}
        {item.mustKnow && (
          <SectionCard icon="📌" title="สิ่งที่ต้องรู้" accentColor="#0369A1">
            <MdText text={item.mustKnow} />
          </SectionCard>
        )}

        {/* ── Section 2: Exam Points ─────────────────────────────────────── */}
        {item.examPoints && (
          <SectionCard icon="🎯" title="อาจออกสอบตรงไหน" accentColor="#D97706">
            <MdText text={item.examPoints} />
          </SectionCard>
        )}

        {/* ── Section 3: Quick Memory ────────────────────────────────────── */}
        {item.quickMemory && (
          <SectionCard icon="🧠" title="จำง่ายใน 10 วินาที" accentColor="#7C3AED">
            <MdText text={item.quickMemory} />
          </SectionCard>
        )}

        {/* ── Section 4: Full Content (expandable) ──────────────────────── */}
        {item.fullContent && (
          <ExpandableContent content={item.fullContent} />
        )}

        {/* ── Back button (bottom) ───────────────────────────────────────── */}
        <button
          onClick={() => router.push("/moph-focus")}
          className="w-full py-3.5 rounded-2xl font-semibold text-[16px] mt-2
                     transition-transform active:scale-[0.97]"
          style={{ backgroundColor: "#E0F2FE", color: ACCENT }}>
          ← กลับรายการประเด็น
        </button>

      </div>
    </div>
  );
}
