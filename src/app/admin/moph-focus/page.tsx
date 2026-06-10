"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getAllMOPHFocus,
  deleteMOPHFocusById,
} from "@/lib/moph-focus-firestore";
import { MOPH_TAG_STYLE, type MOPHFocusItem, type MOPHTag } from "@/lib/moph-focus-types";

const ACCENT = "#0369A1";

// ── Tag chip (mini) ───────────────────────────────────────────────────────────
function TagPill({ tag }: { tag: MOPHTag }) {
  const s = MOPH_TAG_STYLE[tag];
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Confirm delete modal ───────────────────────────────────────────────────────
function DeleteModal({
  item, onCancel, onConfirm, loading,
}: {
  item: MOPHFocusItem;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-3xl mb-3 text-center">🗑️</div>
        <h3 className="text-[17px] font-extrabold text-gray-900 text-center mb-1">
          ยืนยันการลบ?
        </h3>
        <p className="text-[13px] text-center mb-1" style={{ color: "#374151" }}>
          {item.coverEmoji} <strong>{item.title}</strong>
        </p>
        <p className="text-[12px] text-center mb-5" style={{ color: "#9CA3AF" }}>
          ข้อมูลจะถูกลบถาวร ไม่สามารถกู้คืนได้
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold"
            style={{ backgroundColor: "#F3F4F6", color: "#374151" }}>
            ยกเลิก
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-[14px] font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: "#DC2626" }}>
            {loading ? "กำลังลบ…" : "ลบถาวร"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminMOPHFocusListPage() {
  const [items,   setItems]   = useState<MOPHFocusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MOPHFocusItem | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getAllMOPHFocus());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Search filter
  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [item.title, item.subtitle, item.summary, ...item.tags]
      .join(" ").toLowerCase().includes(q);
  });

  // Delete
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMOPHFocusById(deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          item={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          loading={deleting}
        />
      )}

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: "#64748B" }}>Admin</p>
            <h1 className="text-[22px] font-extrabold text-gray-900">
              🏥 จัดการ MOPH Focus
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "#64748B" }}>
              {loading ? "กำลังโหลด…" : `${items.length} ประเด็น`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/admin/moph-focus/import"
              className="px-4 py-2.5 rounded-xl text-[13px] font-semibold"
              style={{ backgroundColor: "#F0F9FF", color: ACCENT, border: `1px solid #BAE6FD` }}>
              ⬆ Import CSV
            </Link>
            <Link href="/admin/moph-focus/new"
              className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white"
              style={{ backgroundColor: ACCENT }}>
              + เพิ่มประเด็นใหม่
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="ค้นหาชื่อประเด็น หรือ tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[14px] bg-white focus:outline-none focus:ring-2"
            style={{ border: "1px solid #E5E7EB", "--tw-ring-color": ACCENT } as React.CSSProperties}
          />
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 flex gap-3"
                style={{ border: "1px solid #E5E7EB" }}>
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center"
            style={{ border: "1px dashed #BAE6FD" }}>
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-[16px] font-semibold text-gray-800 mb-1">
              {search ? "ไม่พบประเด็นที่ค้นหา" : "ยังไม่มีประเด็น"}
            </p>
            {!search && (
              <Link href="/admin/moph-focus/new"
                className="inline-block mt-4 px-5 py-2.5 rounded-xl text-[14px] font-bold text-white"
                style={{ backgroundColor: ACCENT }}>
                + เพิ่มประเด็นแรก
              </Link>
            )}
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((item) => {
              const date = item.publishedDate.toLocaleDateString("th-TH", {
                day: "numeric", month: "short", year: "numeric",
              });
              return (
                <div key={item.id}
                  className="bg-white rounded-2xl px-5 py-4 flex items-start gap-4"
                  style={{ border: "1px solid #E5E7EB" }}>

                  {/* Emoji */}
                  <span className="text-[28px] leading-none flex-shrink-0 mt-0.5">
                    {item.coverEmoji}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <p className="text-[15px] font-bold text-gray-900 leading-snug">
                        {item.title}
                      </p>
                      {/* Status badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        item.isPublished
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {item.isPublished ? "● เผยแพร่" : "○ ร่าง"}
                      </span>
                    </div>
                    {item.subtitle && (
                      <p className="text-[12px] mb-1.5" style={{ color: "#64748B" }}>
                        {item.subtitle}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {item.tags.map((t) => <TagPill key={t} tag={t} />)}
                    </div>
                    <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                      📅 {date}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <Link
                      href={`/admin/moph-focus/${item.id}`}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-center"
                      style={{ backgroundColor: "#F0F9FF", color: ACCENT }}>
                      แก้ไข
                    </Link>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                      style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                      ลบ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Back */}
        <div className="pt-2">
          <Link href="/admin"
            className="text-[13px] font-medium"
            style={{ color: "#9CA3AF" }}>
            ← กลับ Admin
          </Link>
        </div>

      </div>
    </>
  );
}
