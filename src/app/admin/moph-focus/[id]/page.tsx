"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMOPHFocusById,
  saveMOPHFocus,
  type MOPHFocusSaveData,
} from "@/lib/moph-focus-firestore";
import {
  MOPH_TAG_LIST,
  MOPH_TAG_STYLE,
  type MOPHTag,
} from "@/lib/moph-focus-types";

const ACCENT = "#0369A1";
const IS_NEW = "new";

// ── Textarea with auto-grow ───────────────────────────────────────────────────
function Textarea({
  label, value, onChange, placeholder, rows = 3, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[13px] font-bold mb-1" style={{ color: "#374151" }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 rounded-xl text-[14px] resize-none focus:outline-none focus:ring-2"
        style={{
          border: "1px solid #D1D5DB",
          lineHeight: "1.6",
          "--tw-ring-color": ACCENT,
        } as React.CSSProperties}
      />
    </div>
  );
}

// ── Text input ────────────────────────────────────────────────────────────────
function Input({
  label, value, onChange, placeholder, type = "text", required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[13px] font-bold mb-1" style={{ color: "#374151" }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-[14px] focus:outline-none focus:ring-2"
        style={{
          border: "1px solid #D1D5DB",
          "--tw-ring-color": ACCENT,
        } as React.CSSProperties}
      />
    </div>
  );
}

// ── Tag selector ──────────────────────────────────────────────────────────────
function TagSelector({
  value, onChange,
}: {
  value: MOPHTag[]; onChange: (v: MOPHTag[]) => void;
}) {
  function toggle(tag: MOPHTag) {
    onChange(
      value.includes(tag)
        ? value.filter((t) => t !== tag)
        : [...value, tag]
    );
  }

  return (
    <div>
      <label className="block text-[13px] font-bold mb-2" style={{ color: "#374151" }}>
        Tags
      </label>
      <div className="flex flex-wrap gap-2">
        {MOPH_TAG_LIST.map((tag) => {
          const s      = MOPH_TAG_STYLE[tag];
          const active = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="text-[12px] font-bold px-3 py-1.5 rounded-full transition-colors"
              style={{
                backgroundColor: active ? s.color : s.bg,
                color:           active ? "#fff"   : s.color,
                border:          `1px solid ${s.color}44`,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
      <div className="px-5 py-3" style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E5E7EB" }}>
        <p className="text-[13px] font-extrabold" style={{ color: ACCENT }}>{title}</p>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const BLANK: MOPHFocusSaveData = {
  title: "", subtitle: "", summary: "",
  mustKnow: "", examPoints: "", quickMemory: "", fullContent: "",
  coverEmoji: "🏥",
  tags: [],
  order: 1,
  isPublished: false,
  publishedDate: new Date(),
};

export default function AdminMOPHFocusEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id     = params.id;
  const isNew  = id === IS_NEW;

  const [form,    setForm]    = useState<MOPHFocusSaveData>(BLANK);
  const [loading, setLoading] = useState(!isNew);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [saved,   setSaved]   = useState(false);

  // Load existing item
  useEffect(() => {
    if (isNew) return;
    getMOPHFocusById(id).then((item) => {
      if (!item) { setError("ไม่พบประเด็นนี้"); setLoading(false); return; }
      setForm({
        title:         item.title,
        subtitle:      item.subtitle,
        summary:       item.summary,
        mustKnow:      item.mustKnow,
        examPoints:    item.examPoints,
        quickMemory:   item.quickMemory,
        fullContent:   item.fullContent,
        coverEmoji:    item.coverEmoji,
        tags:          item.tags,
        order:         item.order,
        isPublished:   item.isPublished,
        publishedDate: item.publishedDate,
      });
      setLoading(false);
    }).catch(() => { setError("โหลดข้อมูลไม่สำเร็จ"); setLoading(false); });
  }, [id, isNew]);

  // Field helper
  function set<K extends keyof MOPHFocusSaveData>(k: K, v: MOPHFocusSaveData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Save
  async function handleSave() {
    if (!form.title.trim()) { setError("กรุณากรอก title"); return; }
    if (!form.summary.trim()) { setError("กรุณากรอก summary"); return; }
    setSaving(true);
    setError("");
    try {
      const newId = await saveMOPHFocus(isNew ? null : id, form);
      setSaved(true);
      if (isNew) {
        router.replace(`/admin/moph-focus/${newId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // ── States ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-[3px] border-t-transparent animate-spin"
          style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (error && !form.title) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-10 text-center">
        <p className="text-red-500 text-[15px] mb-4">{error}</p>
        <button onClick={() => router.push("/admin/moph-focus")}
          className="px-5 py-2 rounded-xl text-[14px] font-semibold text-white"
          style={{ backgroundColor: ACCENT }}>กลับ</button>
      </div>
    );
  }

  const dateVal = form.publishedDate instanceof Date
    ? form.publishedDate.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "#64748B" }}>Admin › MOPH Focus</p>
          <h1 className="text-[20px] font-extrabold text-gray-900">
            {isNew ? "✏️ เพิ่มประเด็นใหม่" : "✏️ แก้ไขประเด็น"}
          </h1>
        </div>
        <button onClick={() => router.push("/admin/moph-focus")}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold"
          style={{ backgroundColor: "#F3F4F6", color: "#374151" }}>
          ← กลับ
        </button>
      </div>

      {/* Success banner */}
      {saved && (
        <div className="bg-green-50 rounded-xl px-4 py-3 flex items-center gap-2"
          style={{ border: "1px solid #BBF7D0" }}>
          <span>✅</span>
          <p className="text-[14px] font-semibold text-green-700">บันทึกสำเร็จแล้ว</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 rounded-xl px-4 py-3"
          style={{ border: "1px solid #FECACA" }}>
          <p className="text-[13px] text-red-600 font-semibold">{error}</p>
        </div>
      )}

      {/* ── Section 1: หัวข้อ ─────────────────────────────────────────── */}
      <Section title="📋 หัวข้อและข้อมูลทั่วไป">
        <div className="grid grid-cols-[60px_1fr] gap-3 items-start">
          <div>
            <label className="block text-[13px] font-bold mb-1" style={{ color: "#374151" }}>Icon</label>
            <input
              type="text"
              value={form.coverEmoji}
              onChange={(e) => set("coverEmoji", e.target.value)}
              className="w-full text-center text-[24px] py-1.5 rounded-xl border border-gray-200 focus:outline-none"
              maxLength={4}
            />
          </div>
          <Input label="Title" required value={form.title}
            onChange={(v) => set("title", v)} placeholder="หัวข้อหลัก" />
        </div>
        <Input label="Subtitle" value={form.subtitle}
          onChange={(v) => set("subtitle", v)} placeholder="หัวข้อรอง (ว่างได้)" />
        <Textarea label="Summary" required rows={3} value={form.summary}
          onChange={(v) => set("summary", v)}
          placeholder="สรุปสั้น 2-3 บรรทัด แสดงในหน้า List" />
      </Section>

      {/* ── Section 2: Tags & Meta ─────────────────────────────────────── */}
      <Section title="🏷 Tags และวันที่">
        <TagSelector value={form.tags} onChange={(v) => set("tags", v)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-bold mb-1" style={{ color: "#374151" }}>
              วันที่เผยแพร่
            </label>
            <input
              type="date"
              value={dateVal}
              onChange={(e) => set("publishedDate", new Date(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-[14px] focus:outline-none"
              style={{ border: "1px solid #D1D5DB" }}
            />
          </div>
          <div>
            <label className="block text-[13px] font-bold mb-1" style={{ color: "#374151" }}>
              ลำดับ (order)
            </label>
            <input
              type="number"
              value={form.order}
              onChange={(e) => set("order", parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2.5 rounded-xl text-[14px] focus:outline-none"
              style={{ border: "1px solid #D1D5DB" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => set("isPublished", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 rounded-full peer transition-colors
                            peer-checked:bg-[#0369A1] bg-gray-200" />
            <div className="absolute left-[2px] top-[2px] w-5 h-5 rounded-full bg-white
                            shadow transition-transform peer-checked:translate-x-5" />
          </label>
          <span className="text-[14px] font-semibold" style={{ color: "#374151" }}>
            {form.isPublished ? "✅ เผยแพร่แล้ว" : "○ ยังเป็นร่าง"}
          </span>
        </div>
      </Section>

      {/* ── Section 3: Content ────────────────────────────────────────── */}
      <Section title="📌 เนื้อหาสำหรับการสอบ">
        <Textarea label="สิ่งที่ต้องรู้ (mustKnow)" rows={4} value={form.mustKnow}
          onChange={(v) => set("mustKnow", v)}
          placeholder="รองรับ Markdown: **bold**, - bullet, # heading" />
        <Textarea label="อาจออกสอบตรงไหน (examPoints)" rows={4} value={form.examPoints}
          onChange={(v) => set("examPoints", v)}
          placeholder="ระบุจุดที่อาจออกสอบ" />
        <Textarea label="จำง่ายใน 10 วินาที (quickMemory)" rows={3} value={form.quickMemory}
          onChange={(v) => set("quickMemory", v)}
          placeholder="สูตรหรือวลีจำง่าย" />
        <Textarea label="อ่านเพิ่มเติม (fullContent) — ขยายได้" rows={6} value={form.fullContent}
          onChange={(v) => set("fullContent", v)}
          placeholder="รองรับ Markdown — แสดงในส่วน expandable ของหน้า Detail" />
      </Section>

      {/* ── Save button ───────────────────────────────────────────────── */}
      <div className="flex gap-3 pb-10">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-4 rounded-2xl font-bold text-[17px] text-white
                     transition-transform active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}>
          {saving ? "กำลังบันทึก…" : isNew ? "✅ สร้างประเด็นใหม่" : "💾 บันทึกการแก้ไข"}
        </button>
        <button
          onClick={() => router.push("/admin/moph-focus")}
          disabled={saving}
          className="px-5 py-4 rounded-2xl font-semibold text-[15px]"
          style={{ backgroundColor: "#F3F4F6", color: "#374151" }}>
          ยกเลิก
        </button>
      </div>

    </div>
  );
}
