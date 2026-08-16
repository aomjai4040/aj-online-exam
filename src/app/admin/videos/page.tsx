"use client";
import { useEffect, useMemo, useState } from "react";
import {
  getAllVideos, saveVideo, deleteVideo, parseYouTubeId,
  type CourseVideo, type VideoInput, type VideoField,
} from "@/lib/video-firestore";

// ─── /admin/videos — จัดการคอร์สวิดีโอ (YouTube unlisted) ─────────────────────

const EMPTY_FORM = { title: "", url: "", chapter: "", order: "", duration: "", isSample: false, field: "dcd" as VideoField };

interface BulkRow {
  line:     number;
  ytId:     string | null;
  title:    string;
  chapter:  string;
  duration: string;
  order?:   number;   // ระบุลำดับเอง (ทศนิยมได้ — ใช้แทรกกลางลำดับเดิม)
  ok:       boolean;
  reason?:  string;
}

/** parse บรรทัด "ลิงก์ | ชื่อ | บท | ความยาว | ลำดับ"
 *  บทเว้นได้ = ใช้ของบรรทัดก่อน · ความยาว/ลำดับไม่บังคับ (ไม่ระบุ = ต่อท้ายอัตโนมัติ) */
function parseBulk(text: string): BulkRow[] {
  const rows: BulkRow[] = [];
  let lastChapter = "";
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split("|").map((s) => s.trim());
    const ytId = parseYouTubeId(parts[0] ?? "");
    const title = parts[1] ?? "";
    const chapter = parts[2] || lastChapter;
    const duration = parts[3] ?? "";
    const orderNum = parts[4] !== undefined && parts[4] !== "" ? parseFloat(parts[4]) : undefined;
    if (chapter) lastChapter = chapter;
    const ok = !!ytId && !!title && !!chapter
      && (orderNum === undefined || Number.isFinite(orderNum));
    rows.push({
      line: i + 1, ytId, title, chapter, duration, order: orderNum, ok,
      reason: !ytId ? "ลิงก์ไม่ถูกต้อง" : !title ? "ไม่มีชื่อคลิป" : !chapter ? "ไม่มีบท"
        : (orderNum !== undefined && !Number.isFinite(orderNum)) ? "ลำดับไม่ใช่ตัวเลข" : undefined,
    });
  });
  return rows;
}

export default function AdminVideosPage() {
  const [videos,  setVideos]  = useState<CourseVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [editing, setEditing] = useState<CourseVideo | null>(null); // null=สร้างใหม่
  const [showForm, setShowForm] = useState(false);
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [busy,    setBusy]    = useState<string | null>(null);

  // bulk import
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDone, setBulkDone] = useState<number | null>(null);
  const bulkRows = useMemo(() => parseBulk(bulkText), [bulkText]);

  async function load() {
    try { setVideos(await getAllVideos()); }
    catch { setError("โหลดรายการวิดีโอไม่สำเร็จ"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, order: String((videos.at(-1)?.order ?? 0) + 1) });
    setShowForm(true);
  }

  function openEdit(v: CourseVideo) {
    setEditing(v);
    setForm({
      title: v.title, url: `https://youtu.be/${v.ytId}`,
      chapter: v.chapter, order: String(v.order), duration: v.duration,
      isSample: v.isSample, field: v.field,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const ytId = parseYouTubeId(form.url);
    if (!form.title.trim())   { setError("กรุณากรอกชื่อวิดีโอ"); return; }
    if (!ytId)                { setError("ลิงก์ YouTube ไม่ถูกต้อง — วางลิงก์เต็มหรือ video ID 11 ตัวอักษร"); return; }
    if (!form.chapter.trim()) { setError("กรุณากรอกหัวข้อ/บท เช่น 1. ความรู้พื้นฐานสาธารณสุข"); return; }

    const data: VideoInput = {
      title:       form.title.trim(),
      ytId,
      chapter:     form.chapter.trim(),
      order:       parseInt(form.order) || 0,
      duration:    form.duration.trim(),
      isPublished: editing ? editing.isPublished : true,
      isSample:    form.isSample,
      field:       form.field,
    };
    setSaving(true);
    try {
      await saveVideo(editing?.id ?? null, data);
      setShowForm(false);
      setLoading(true);
      await load();
    } catch { setError("บันทึกไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setSaving(false); }
  }

  async function handleBulkSave() {
    const good = bulkRows.filter((r) => r.ok);
    if (good.length === 0) { setError("ยังไม่มีบรรทัดที่ข้อมูลครบ"); return; }
    setBulkBusy(true);
    setError("");
    let autoOrder = Math.floor(Math.max(0, ...videos.map((v) => v.order))) + 1;
    let saved = 0;
    try {
      for (const r of good) {
        await saveVideo(null, {
          title: r.title, ytId: r.ytId!, chapter: r.chapter,
          order: r.order ?? autoOrder++, duration: r.duration, isPublished: true, isSample: false, field: "dcd",
        });
        saved++;
      }
      setBulkDone(saved);
      setBulkText("");
      setLoading(true);
      await load();
    } catch {
      setError(`บันทึกได้ ${saved}/${good.length} คลิป — ลองกดบันทึกส่วนที่เหลืออีกครั้ง`);
      setLoading(true);
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  async function togglePublish(v: CourseVideo) {
    setBusy(v.id);
    try {
      await saveVideo(v.id, {
        title: v.title, ytId: v.ytId, chapter: v.chapter,
        order: v.order, duration: v.duration, isPublished: !v.isPublished, isSample: v.isSample, field: v.field,
      });
      setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, isPublished: !v.isPublished } : x));
    } catch { setError("บันทึกไม่สำเร็จ"); }
    finally { setBusy(null); }
  }

  async function toggleSample(v: CourseVideo) {
    setBusy(v.id);
    try {
      await saveVideo(v.id, {
        title: v.title, ytId: v.ytId, chapter: v.chapter,
        order: v.order, duration: v.duration, isPublished: v.isPublished, isSample: !v.isSample, field: v.field,
      });
      setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, isSample: !v.isSample } : x));
    } catch { setError("บันทึกไม่สำเร็จ"); }
    finally { setBusy(null); }
  }

  async function handleDelete(v: CourseVideo) {
    if (!confirm(`ลบวิดีโอ "${v.title}"?`)) return;
    await deleteVideo(v.id);
    setVideos((prev) => prev.filter((x) => x.id !== v.id));
  }

  // จัดกลุ่มตามบท (เรียงตาม order ของวิดีโอแรกในบท)
  const chapters = useMemo(() => {
    const map = new Map<string, CourseVideo[]>();
    for (const v of videos) {
      if (!map.has(v.chapter)) map.set(v.chapter, []);
      map.get(v.chapter)!.push(v);
    }
    return Array.from(map.entries());
  }, [videos]);

  const publishedCount = videos.filter((v) => v.isPublished).length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      {/* Header */}
      <div className="sticky top-14 z-30 bg-white"
        style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-bold text-gray-900">คอร์สวิดีโอ</h1>
            {!loading && (
              <span className="text-[12px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                {videos.length} คลิป · เผยแพร่ {publishedCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowBulk((s) => !s); setBulkDone(null); }}
              className="text-[12.5px] font-semibold px-4 py-1.5 rounded-xl border"
              style={{ borderColor: "#0B6E65", color: "#0B6E65" }}>
              📋 เพิ่มหลายคลิป
            </button>
            <button onClick={openCreate}
              className="text-[12.5px] font-semibold px-4 py-1.5 rounded-xl text-white"
              style={{ backgroundColor: "#0B6E65" }}>
              + เพิ่มวิดีโอ
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 pt-6 pb-16">
        {/* วิธีเตรียมวิดีโอ */}
        <div className="rounded-2xl px-4 py-3.5 mb-5 text-[12.5px] leading-relaxed"
          style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1D4ED8" }}>
          <span className="font-bold">วิธีเตรียม:</span> อัปโหลดวิดีโอเข้า YouTube ตั้งเป็น
          <span className="font-bold"> &ldquo;ไม่แสดงต่อสาธารณะ (Unlisted)&rdquo;</span> แล้ววางลิงก์ที่นี่
          — ผู้ชมจะดูได้เฉพาะในแอป (สมาชิกคอร์สเต็ม) พร้อมลายน้ำชื่อผู้ชม
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 text-[13px] font-medium"
            style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
            {error}
          </div>
        )}

        {/* Bulk import */}
        {showBulk && (
          <div className="bg-white rounded-2xl p-5 mb-5 space-y-3.5"
            style={{ border: "1.5px solid #0B6E65" }}>
            <div>
              <p className="text-[14px] font-bold text-gray-900 mb-1">เพิ่มหลายคลิปพร้อมกัน</p>
              <p className="text-[12.5px] leading-relaxed" style={{ color: "#A8A8A6" }}>
                วางทีละบรรทัด รูปแบบ: <span className="font-mono font-semibold text-gray-700">ลิงก์ | ชื่อคลิป | บท</span>
                {" "}— บทเว้นว่างได้ (ใช้บทเดียวกับบรรทัดก่อนหน้า) ลำดับรันต่อจากของเดิมอัตโนมัติ
              </p>
              <p className="text-[12px] mt-1 font-mono rounded-lg px-3 py-2"
                style={{ backgroundColor: "#F5F5F3", color: "#6B7280" }}>
                https://youtu.be/xxxx | EP.1 ระบาดวิทยาเบื้องต้น | 1. ความรู้พื้นฐานสาธารณสุข<br />
                https://youtu.be/yyyy | EP.2 การสอบสวนโรค |
              </p>
            </div>

            <textarea
              rows={7}
              className="w-full border rounded-xl px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20"
              style={{ borderColor: "#E0DFDC" }}
              placeholder="วางรายการที่นี่..."
              value={bulkText}
              onChange={(e) => { setBulkText(e.target.value); setBulkDone(null); }}
            />

            {/* Preview สรุปผล parse */}
            {bulkRows.length > 0 && (
              <div className="text-[12.5px] space-y-1">
                <p style={{ color: "#0B6E65" }} className="font-semibold">
                  ✓ พร้อมบันทึก {bulkRows.filter((r) => r.ok).length} คลิป
                  {bulkRows.some((r) => !r.ok) &&
                    <span className="text-red-500 font-semibold"> · มีปัญหา {bulkRows.filter((r) => !r.ok).length} บรรทัด</span>}
                </p>
                {bulkRows.filter((r) => !r.ok).slice(0, 5).map((r) => (
                  <p key={r.line} className="text-red-500">
                    บรรทัด {r.line}: {r.reason}
                  </p>
                ))}
              </div>
            )}

            {bulkDone !== null && (
              <p className="text-[13px] font-semibold rounded-xl px-4 py-3"
                style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                ✓ บันทึกแล้ว {bulkDone} คลิป
              </p>
            )}

            <div className="flex gap-2.5">
              <button type="button" onClick={() => setShowBulk(false)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border"
                style={{ borderColor: "#E0DFDC", color: "#6B7280" }}>
                ปิด
              </button>
              <button type="button" onClick={handleBulkSave}
                disabled={bulkBusy || bulkRows.filter((r) => r.ok).length === 0}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#0B6E65" }}>
                {bulkBusy ? "กำลังบันทึก…" : `บันทึก ${bulkRows.filter((r) => r.ok).length} คลิป`}
              </button>
            </div>
          </div>
        )}

        {/* ฟอร์มเพิ่ม/แก้ไข */}
        {showForm && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl p-5 mb-5 space-y-3.5"
            style={{ border: "1.5px solid #0B6E65" }}>
            <p className="text-[14px] font-bold text-gray-900">
              {editing ? "แก้ไขวิดีโอ" : "เพิ่มวิดีโอใหม่"}
            </p>
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                ชื่อวิดีโอ <span className="text-red-500">*</span>
              </label>
              <input className="w-full border rounded-xl px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20"
                style={{ borderColor: "#E0DFDC" }}
                placeholder="เช่น EP.1 ระบาดวิทยาเบื้องต้น"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                ลิงก์ YouTube (unlisted) <span className="text-red-500">*</span>
              </label>
              <input className="w-full border rounded-xl px-3 py-2.5 text-[13.5px] font-mono focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20"
                style={{ borderColor: "#E0DFDC" }}
                placeholder="https://youtu.be/xxxxxxxxxxx"
                value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                  หัวข้อ/บท <span className="text-red-500">*</span>
                </label>
                <input className="w-full border rounded-xl px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20"
                  style={{ borderColor: "#E0DFDC" }}
                  placeholder="เช่น 1. ความรู้พื้นฐานสาธารณสุข"
                  value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                  list="chapter-list" />
                <datalist id="chapter-list">
                  {chapters.map(([c]) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">ลำดับ</label>
                  <input type="number" className="w-full border rounded-xl px-3 py-2.5 text-[13.5px] focus:outline-none"
                    style={{ borderColor: "#E0DFDC" }}
                    value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">ความยาว</label>
                  <input className="w-full border rounded-xl px-3 py-2.5 text-[13.5px] focus:outline-none"
                    style={{ borderColor: "#E0DFDC" }} placeholder="12:34"
                    value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                </div>
              </div>
            </div>
            {/* สนามของคลิป — ตัดสินว่าใครเห็น (สป.สธ. = คอร์สเต็มเดิม / คร. = คนซื้อคอร์ส คร.) */}
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                สนามของคลิป
              </label>
              <div className="flex gap-2">
                {([
                  { v: "dcd",  label: "กรมควบคุมโรค (คร.)" },
                  { v: "moph", label: "สป.สธ. (คอร์สเดิม)" },
                ] as const).map((f) => (
                  <button key={f.v} type="button"
                    onClick={() => setForm({ ...form, field: f.v })}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
                    style={{
                      backgroundColor: form.field === f.v ? "#EBF5F3" : "#FAFAF8",
                      border: `1.5px solid ${form.field === f.v ? "#0B6E65" : "#EBEBEA"}`,
                      color: form.field === f.v ? "#0B6E65" : "#6B7280",
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* คลิปตัวอย่างฟรี */}
            <label className="flex items-start gap-2.5 cursor-pointer rounded-xl px-3.5 py-3"
              style={{ backgroundColor: form.isSample ? "#FEF9EC" : "#FAFAF8", border: `1px solid ${form.isSample ? "#FCD34D" : "#EBEBEA"}` }}>
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#B45309]"
                checked={form.isSample} onChange={(e) => setForm({ ...form, isSample: e.target.checked })} />
              <span className="text-[12.5px] leading-relaxed">
                <span className="font-bold text-gray-800">🎁 ตั้งเป็นคลิปตัวอย่างฟรี</span>
                <span className="block" style={{ color: "#A8A8A6" }}>
                  คนที่ยังไม่ซื้อคอร์สจะดูคลิปนี้ได้ (โผล่ในหน้าคอร์สวิดีโอ + หน้าแพ็กเกจ)
                </span>
              </span>
            </label>

            <div className="flex gap-2.5 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border"
                style={{ borderColor: "#E0DFDC", color: "#6B7280" }}>
                ยกเลิก
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#0B6E65" }}>
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </form>
        )}

        {/* รายการ */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse" style={{ border: "1px solid #EBEBEA" }}>
                <div className="h-5 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : videos.length === 0 && !showForm ? (
          <div className="bg-white rounded-2xl p-14 text-center" style={{ border: "1px solid #EBEBEA" }}>
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-[15px] font-semibold text-gray-800 mb-1">ยังไม่มีวิดีโอ</p>
            <p className="text-[13px] mb-5" style={{ color: "#A8A8A6" }}>
              เพิ่มวิดีโอแรกจากลิงก์ YouTube (unlisted)
            </p>
            <button onClick={openCreate}
              className="text-[13px] font-semibold px-5 py-2.5 rounded-xl text-white"
              style={{ backgroundColor: "#0B6E65" }}>
              + เพิ่มวิดีโอแรก
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {chapters.map(([chapter, list]) => (
              <div key={chapter}>
                <p className="text-[12.5px] font-bold uppercase tracking-wider mb-2.5"
                  style={{ color: "#A8A8A6" }}>
                  {chapter} · {list.length} คลิป
                </p>
                <div className="space-y-2.5">
                  {list.map((v) => (
                    <div key={v.id} className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3.5"
                      style={{ border: `1px solid ${v.isPublished ? "#EBEBEA" : "#FDE68A"}` }}>
                      {/* Thumbnail */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://i.ytimg.com/vi/${v.ytId}/mqdefault.jpg`} alt=""
                        className="w-20 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-bold text-gray-900 truncate">
                          {v.order}. {v.title}
                          {v.field === "dcd" && (
                            <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full align-middle"
                              style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>คร.</span>
                          )}
                          {v.isSample && (
                            <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full align-middle"
                              style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>🎁 ตัวอย่างฟรี</span>
                          )}
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>
                          {v.duration && `${v.duration} · `}
                          <span className="font-mono">{v.ytId}</span>
                          {!v.isPublished && <span className="font-bold" style={{ color: "#B45309" }}> · ซ่อนอยู่</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => toggleSample(v)} disabled={busy === v.id}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-40"
                          style={v.isSample
                            ? { borderColor: "#FCD34D", color: "#B45309", backgroundColor: "#FEF9EC" }
                            : { borderColor: "#E0DFDC", color: "#6B7280" }}>
                          {v.isSample ? "🎁 ตัวอย่าง" : "ตั้งตัวอย่าง"}
                        </button>
                        <button onClick={() => togglePublish(v)} disabled={busy === v.id}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-40"
                          style={{ borderColor: "#E0DFDC", color: "#6B7280" }}>
                          {v.isPublished ? "ซ่อน" : "เผยแพร่"}
                        </button>
                        <button onClick={() => openEdit(v)}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                          style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                          แก้ไข
                        </button>
                        <button onClick={() => handleDelete(v)}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                          style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
