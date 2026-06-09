"use client";
import { useCallback, useEffect, useState } from "react";
import {
  getAllCodes, createCode, setCodeStatus, deleteCode, getCodeUsers,
  type ActivationCode, type UserCourse, type CreateCodeInput,
} from "@/lib/activation";
import { getUserTotalAttempts } from "@/lib/user-firestore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtCreated(d: Date): string {
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function isExpired(code: ActivationCode): boolean {
  return !!code.expiresAt && code.expiresAt < new Date();
}

function isFull(code: ActivationCode): boolean {
  return code.maxUses > 0 && code.usedCount >= code.maxUses;
}

// ─── Create modal ─────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState<{
    code: string; courseId: string; courseName: string;
    maxUses: string; expiresAt: string;
  }>({ code: "", courseId: "", courseName: "", maxUses: "0", expiresAt: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim())       { setError("กรุณากรอก Code"); return; }
    if (!form.courseId.trim())   { setError("กรุณากรอก Course ID"); return; }
    if (!form.courseName.trim()) { setError("กรุณากรอกชื่อคอร์ส"); return; }

    const input: CreateCodeInput = {
      code:       form.code.trim().toUpperCase(),
      courseId:   form.courseId.trim(),
      courseName: form.courseName.trim(),
      maxUses:    Math.max(0, parseInt(form.maxUses) || 0),
      expiresAt:  form.expiresAt ? new Date(form.expiresAt) : null,
    };

    setSaving(true);
    try {
      await createCode(input);
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg === "CODE_EXISTS" ? "Code นี้มีในระบบแล้ว" : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #EBEBEA" }}>
          <h2 className="text-[16px] font-bold text-gray-900">สร้าง Activation Code</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-700">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Code */}
          <div>
            <label className="block text-[18px] font-semibold text-gray-600 mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded-xl px-3 py-2.5 text-[16px] font-mono uppercase
                         focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20 focus:border-[#0B6E65]"
              style={{ borderColor: "#E0DFDC" }}
              placeholder="เช่น SAXA2025"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              maxLength={32}
            />
          </div>

          {/* Course ID */}
          <div>
            <label className="block text-[18px] font-semibold text-gray-600 mb-1.5">
              Course ID <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded-xl px-3 py-2.5 text-[16px] font-mono
                         focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20 focus:border-[#0B6E65]"
              style={{ borderColor: "#E0DFDC" }}
              placeholder="เช่น course-saxa-2025"
              value={form.courseId}
              onChange={(e) => set("courseId", e.target.value)}
            />
            <p className="text-[17px] mt-1" style={{ color: "#4A5568" }}>ใช้อ้างอิงภายใน ไม่แสดงต่อผู้ใช้</p>
          </div>

          {/* Course name */}
          <div>
            <label className="block text-[18px] font-semibold text-gray-600 mb-1.5">
              ชื่อคอร์ส <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded-xl px-3 py-2.5 text-[16px]
                         focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20 focus:border-[#0B6E65]"
              style={{ borderColor: "#E0DFDC" }}
              placeholder="เช่น คอร์สติวสอบ สป.สธ. รุ่น 2025"
              value={form.courseName}
              onChange={(e) => set("courseName", e.target.value)}
            />
          </div>

          {/* Max uses + expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[18px] font-semibold text-gray-600 mb-1.5">
                จำนวนใช้ได้สูงสุด
              </label>
              <input
                type="number" min="0"
                className="w-full border rounded-xl px-3 py-2.5 text-[16px]
                           focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20 focus:border-[#0B6E65]"
                style={{ borderColor: "#E0DFDC" }}
                value={form.maxUses}
                onChange={(e) => set("maxUses", e.target.value)}
              />
              <p className="text-[17px] mt-1" style={{ color: "#4A5568" }}>0 = ไม่จำกัด</p>
            </div>
            <div>
              <label className="block text-[18px] font-semibold text-gray-600 mb-1.5">
                วันหมดอายุ
              </label>
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2.5 text-[16px]
                           focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20 focus:border-[#0B6E65]"
                style={{ borderColor: "#E0DFDC" }}
                value={form.expiresAt}
                onChange={(e) => set("expiresAt", e.target.value)}
              />
              <p className="text-[17px] mt-1" style={{ color: "#4A5568" }}>เว้นว่าง = ไม่มีวันหมดอายุ</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-[16px] font-medium"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[16px] font-semibold border transition-colors"
              style={{ borderColor: "#E0DFDC", color: "#6B7280" }}
            >
              ยกเลิก
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-[16px] font-semibold text-white
                         transition-colors disabled:opacity-60"
              style={{ backgroundColor: "#0B6E65" }}
            >
              {saving ? "กำลังบันทึก…" : "สร้าง Code"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Users modal ──────────────────────────────────────────────────────────────

interface UserRow extends UserCourse {
  totalAttempts: number | null; // null = loading
}

interface UsersModalProps {
  code: ActivationCode;
  onClose: () => void;
}

function UsersModal({ code, onClose }: UsersModalProps) {
  const [rows,    setRows]    = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 1. ดึงรายชื่อผู้ใช้ Code นี้
      const users = await getCodeUsers(code.code);

      // ตั้ง placeholder ก่อนเพื่อให้เห็น skeleton ต่อ col
      setRows(users.map((u) => ({ ...u, totalAttempts: null })));
      setLoading(false);

      // 2. ดึง attempts แบบ parallel
      const attempts = await Promise.all(
        users.map((u) => getUserTotalAttempts(u.userId).catch(() => 0))
      );
      setRows(users.map((u, i) => ({ ...u, totalAttempts: attempts[i] })));
    }
    load();
  }, [code.code]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid #EBEBEA" }}>
          <div>
            <p className="text-[18px] font-bold text-gray-900">ผู้ใช้ Code</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[16px] font-mono font-bold" style={{ color: "#0B6E65" }}>
                {code.code}
              </span>
              <span className="text-[17px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                {code.usedCount} คน
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-600">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Column headers ───────────────────────────────────────────── */}
        {!loading && rows.length > 0 && (
          <div
            className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-2.5 shrink-0"
            style={{ borderBottom: "1px solid #F3F2F0", backgroundColor: "#FAFAF9" }}
          >
            <span className="text-[17px] font-bold uppercase tracking-wider" style={{ color: "#4A5568" }}>
              อีเมล
            </span>
            <span className="text-[17px] font-bold uppercase tracking-wider text-right w-28"
              style={{ color: "#4A5568" }}>
              วันที่ Activate
            </span>
            <span className="text-[17px] font-bold uppercase tracking-wider text-right w-20"
              style={{ color: "#4A5568" }}>
              ใช้งานแล้ว
            </span>
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="flex-1 h-4 bg-gray-100 rounded-full" />
                  <div className="w-24 h-4 bg-gray-100 rounded-full" />
                  <div className="w-16 h-4 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="text-4xl mb-3">👤</div>
              <p className="text-[17px] font-semibold text-gray-700 mb-1">ยังไม่มีผู้ใช้</p>
              <p className="text-[16px]" style={{ color: "#4A5568" }}>
                Code นี้ยังไม่ถูกนำไปใช้งาน
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#F3F2F0" }}>
              {rows.map((u, idx) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-6 py-3.5
                             hover:bg-stone-50 transition-colors"
                >
                  {/* Email + index */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[17px]
                                 font-bold flex-shrink-0"
                      style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[16px] text-gray-900 font-medium truncate">
                      {u.email}
                    </span>
                  </div>

                  {/* Activate date */}
                  <div className="flex items-center gap-1.5 w-28 justify-end flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#5A6478"
                      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                      className="w-3.5 h-3.5 flex-shrink-0">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8"  y1="2" x2="8"  y2="6" />
                      <line x1="3"  y1="10" x2="21" y2="10" />
                    </svg>
                    <span className="text-[18px]" style={{ color: "#6B7280" }}>
                      {fmt(u.activatedAt)}
                    </span>
                  </div>

                  {/* Total attempts */}
                  <div className="w-20 flex justify-end flex-shrink-0">
                    {u.totalAttempts === null ? (
                      <span className="w-10 h-4 rounded-full bg-gray-100 animate-pulse inline-block" />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[17px] font-bold"
                          style={{ color: u.totalAttempts > 0 ? "#0B6E65" : "#5A6478" }}
                        >
                          {u.totalAttempts}
                        </span>
                        <span className="text-[17px]" style={{ color: "#4A5568" }}>ครั้ง</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {!loading && rows.length > 0 && (
          <div
            className="px-6 py-3 flex items-center justify-between shrink-0"
            style={{ borderTop: "1px solid #F3F2F0", backgroundColor: "#FAFAF9" }}
          >
            <p className="text-[18px]" style={{ color: "#4A5568" }}>
              คอร์ส: <span className="font-medium text-gray-700">{code.courseName}</span>
            </p>
            <p className="text-[18px]" style={{ color: "#4A5568" }}>
              รวมใช้งาน{" "}
              <span className="font-bold" style={{ color: "#0B6E65" }}>
                {rows.reduce((s, r) => s + (r.totalAttempts ?? 0), 0)}
              </span>{" "}
              ครั้ง
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Code row ─────────────────────────────────────────────────────────────────

interface CodeRowProps {
  code: ActivationCode;
  onToggle: (id: string, status: "active" | "inactive") => void;
  onDelete: (id: string, codeStr: string) => void;
  onViewUsers: (code: ActivationCode) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback สำหรับ browser เก่า
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      title="คัดลอก Code"
      className="flex items-center gap-1.5 text-[17px] font-semibold px-3 py-1.5
                 rounded-lg transition-all duration-150"
      style={
        copied
          ? { backgroundColor: "#EBF5F3", color: "#0B6E65" }
          : { backgroundColor: "#F5F5F3", color: "#6B7280" }
      }
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          คัดลอกแล้ว!
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          คัดลอก
        </>
      )}
    </button>
  );
}

function CodeRow({ code, onToggle, onDelete, onViewUsers }: CodeRowProps) {
  const expired = isExpired(code);
  const full    = isFull(code);

  let statusColor = "#16A34A";
  let statusBg    = "#F0FDF4";
  let statusLabel = "เปิดใช้งาน";

  if (code.status === "inactive") {
    statusColor = "#6B7280"; statusBg = "#F3F4F6"; statusLabel = "ปิดใช้งาน";
  } else if (expired) {
    statusColor = "#DC2626"; statusBg = "#FEF2F2"; statusLabel = "หมดอายุ";
  } else if (full) {
    statusColor = "#B45309"; statusBg = "#FFFBEB"; statusLabel = "ใช้ครบแล้ว";
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #EBEBEA" }}>
      {/* Status bar */}
      <div className="h-[3px]" style={{ backgroundColor: statusColor }} />

      <div className="px-5 py-4">
        {/* Row 1: code + copy + status badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[18px] font-bold font-mono text-gray-900 tracking-wider">
                {code.code}
              </p>
              <CopyButton text={code.code} />
            </div>
            <p className="text-[18px] mt-0.5 truncate" style={{ color: "#4A5568" }}>
              {code.courseName}
            </p>
          </div>
          <span
            className="text-[17px] font-bold px-2.5 py-[5px] rounded-full flex-shrink-0"
            style={{ backgroundColor: statusBg, color: statusColor }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg px-2.5 py-2 text-center" style={{ backgroundColor: "#F5F5F3" }}>
            <p className="text-[18px] font-extrabold text-gray-900 leading-none">
              {code.usedCount}
            </p>
            <p className="text-[16px] mt-0.5" style={{ color: "#4A5568" }}>
              {code.maxUses > 0 ? `จาก ${code.maxUses}` : "ครั้ง"}
            </p>
          </div>
          <div className="rounded-lg px-2.5 py-2 text-center" style={{ backgroundColor: "#F5F5F3" }}>
            <p className="text-[16px] font-bold text-gray-900 leading-tight">
              {code.maxUses > 0 ? code.maxUses : "∞"}
            </p>
            <p className="text-[16px] mt-0.5" style={{ color: "#4A5568" }}>สูงสุด</p>
          </div>
          <div className="rounded-lg px-2.5 py-2 text-center" style={{ backgroundColor: "#F5F5F3" }}>
            <p className="text-[16px] font-bold text-gray-900 leading-tight truncate">
              {fmt(code.expiresAt)}
            </p>
            <p className="text-[16px] mt-0.5" style={{ color: "#4A5568" }}>หมดอายุ</p>
          </div>
        </div>

        {/* Use bar */}
        {code.maxUses > 0 && (
          <div className="mb-4">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F3F2F0" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (code.usedCount / code.maxUses) * 100)}%`,
                  backgroundColor: full ? "#DC2626" : "#0B6E65",
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[17px]" style={{ color: "#5A6478" }}>
            สร้าง {fmtCreated(code.createdAt)}
          </p>
          <div className="flex items-center gap-2">
            {/* View users */}
            <button
              onClick={() => onViewUsers(code)}
              className="text-[17px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
            >
              ดูผู้ใช้ ({code.usedCount})
            </button>
            {/* Toggle */}
            <button
              onClick={() => onToggle(code.id, code.status === "active" ? "inactive" : "active")}
              className="text-[17px] font-semibold px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "#E0DFDC", color: "#6B7280" }}
            >
              {code.status === "active" ? "ปิด" : "เปิด"}
            </button>
            {/* Delete */}
            <button
              onClick={() => onDelete(code.id, code.code)}
              className="text-[17px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
            >
              ลบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CodesPage() {
  const [codes,      setCodes]      = useState<ActivationCode[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [drawer,     setDrawer]     = useState<ActivationCode | null>(null);
  const [filter,     setFilter]     = useState<"all" | "active" | "inactive">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllCodes();
      setCodes(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(id: string, status: "active" | "inactive") {
    await setCodeStatus(id, status);
    setCodes((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
  }

  async function handleDelete(id: string, codeStr: string) {
    if (!confirm(`ลบ Code "${codeStr}" ออกจากระบบ?\n\nผู้ที่เคยแอคติเวตแล้วยังคงเข้าถึงได้`)) return;
    await deleteCode(id);
    setCodes((prev) => prev.filter((c) => c.id !== id));
  }

  const displayed = codes.filter((c) => {
    if (filter === "active")   return c.status === "active" && !isExpired(c) && !isFull(c);
    if (filter === "inactive") return c.status === "inactive" || isExpired(c) || isFull(c);
    return true;
  });

  const activeCount   = codes.filter((c) => c.status === "active" && !isExpired(c) && !isFull(c)).length;
  const inactiveCount = codes.length - activeCount;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      {/* Header */}
      <div className="sticky top-14 z-30 bg-white" style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[18px] font-bold text-gray-900">Activation Codes</h1>
            {!loading && (
              <span className="text-[17px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                {codes.length} รายการ
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-[18px] font-semibold px-4 py-1.5 rounded-xl
                       text-white transition-colors"
            style={{ backgroundColor: "#0B6E65" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            สร้าง Code
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 pt-6 pb-16">
        {/* Summary */}
        {!loading && codes.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Code ทั้งหมด", value: codes.length, color: "#0B6E65", bg: "#EBF5F3" },
              { label: "เปิดใช้งาน",   value: activeCount,  color: "#16A34A", bg: "#F0FDF4" },
              { label: "ปิด/หมดอายุ",  value: inactiveCount, color: "#DC2626", bg: "#FEF2F2" },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-2xl p-4 text-center"
                style={{ border: "1px solid #EBEBEA" }}>
                <div className="text-[28px] font-extrabold" style={{ color: item.color }}>{item.value}</div>
                <div className="text-[17px] font-semibold text-gray-700 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        {!loading && codes.length > 0 && (
          <div className="flex gap-2 mb-5">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-[18px] font-semibold px-3.5 py-[6px] rounded-full transition-all"
                style={{
                  backgroundColor: filter === f ? "#111110" : "white",
                  color:           filter === f ? "white"   : "#6B6B6A",
                  border:          filter === f ? "1px solid #111110" : "1px solid #E0DFDC",
                }}
              >
                {f === "all" ? "ทั้งหมด" : f === "active" ? "เปิดใช้งาน" : "ปิด/หมดอายุ"}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse" style={{ border: "1px solid #EBEBEA" }}>
                <div className="h-6 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="bg-white rounded-2xl p-14 text-center" style={{ border: "1px solid #EBEBEA" }}>
            <div className="text-4xl mb-3">🔑</div>
            <p className="text-[18px] font-semibold text-gray-800 mb-1">ยังไม่มี Activation Code</p>
            <p className="text-[16px] mb-6" style={{ color: "#4A5568" }}>
              สร้าง Code เพื่อให้นักเรียนเปิดใช้งานคอร์ส
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-[16px] font-semibold px-5 py-2.5 rounded-xl text-white"
              style={{ backgroundColor: "#0B6E65" }}
            >
              + สร้าง Code แรก
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[17px] font-semibold text-gray-700 mb-1">ไม่พบรายการ</p>
            <button onClick={() => setFilter("all")} className="text-[16px]" style={{ color: "#0B6E65" }}>
              ดูทั้งหมด
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((code) => (
              <CodeRow
                key={code.id}
                code={code}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onViewUsers={setDrawer}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {drawer && (
        <UsersModal code={drawer} onClose={() => setDrawer(null)} />
      )}
    </div>
  );
}
