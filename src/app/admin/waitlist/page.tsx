"use client";
/**
 * /admin/waitlist — ยอดคนรอคอร์สรายสนาม + ส่งอีเมลแจ้งเปิดคอร์ส (Aj 2026-11-08)
 *
 * - ตารางต่อสนาม: ยังรับข่าวกี่คน · ใหม่ใน 30 วัน · แยกตามสถานะ · ป้าย 🔥 เมื่อครบ 300
 * - "แจ้งเปิดคอร์ส": เขียนหัวข้อ+เนื้อหา → พรีวิว → ยืนยัน → ส่งเฉพาะคนรอสนามนั้น
 *   เคยส่งแล้ว = รอบถัดไปส่งเฉพาะคนลงชื่อใหม่ (กันคนเดิมโดนซ้ำ — บันทึกเวลา/จำนวน)
 * - export CSV (UTF-8 BOM เปิด Excel ไทยไม่เพี้ยน) + ลบรายคนเมื่อมีคนขอลบ
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { BRAND } from "@/lib/subjects";
import {
  WAITLIST_FIELDS, WAITLIST_STATUSES, WAITLIST_ALERT_AT,
  fieldLabel, statusLabel, type WaitlistRow, type NotifyLog,
} from "@/lib/waitlist-types";

const fmt = (isoStr: string) => {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
    + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
};

export default function AdminWaitlistPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [logs, setLogs] = useState<NotifyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [openField, setOpenField] = useState<string | null>(null); // รายชื่อที่กางอยู่
  const [notifyField, setNotifyField] = useState<string | null>(null); // modal ส่งอีเมล

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/waitlist", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) { setRows(d.rows ?? []); setLogs(d.logs ?? []); }
    } finally { setLoading(false); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const now30 = Date.now() - 30 * 86_400_000;
  const stats = useMemo(() => WAITLIST_FIELDS.map((f) => {
    const inField = rows.filter((r) => r.fields.includes(f.key));
    const active  = inField.filter((r) => !r.unsub);
    return {
      key: f.key, label: f.label,
      active: active.length,
      unsub:  inField.length - active.length,
      new30:  active.filter((r) => r.createdAt && new Date(r.createdAt).getTime() > now30).length,
      byStatus: WAITLIST_STATUSES.map((s) => ({
        label: s.label, n: active.filter((r) => r.status === s.key).length,
      })),
      log: logs.find((l) => l.field === f.key) ?? null,
      people: inField,
    };
  }), [rows, logs, now30]);

  async function deletePerson(email: string) {
    if (!user) return;
    if (!confirm(`ลบข้อมูลของ ${email} ถาวร? (ใช้เมื่อเจ้าตัวขอลบข้อมูล)`)) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/admin/waitlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    if (res.ok) setRows((p) => p.filter((r) => r.email !== email));
  }

  function exportCsv() {
    const head = ["email", "ชื่อเล่น", "สนามที่รอ", "อื่นๆ", "สถานะ", "ที่มา", "รับข่าวอยู่", "ลงชื่อเมื่อ", "อัปเดตล่าสุด"];
    const lines = rows.map((r) => [
      r.email, r.name,
      r.fields.map(fieldLabel).join(" | "), r.otherText,
      statusLabel(r.status), r.source,
      r.unsub ? "ยกเลิกแล้ว" : "รับข่าว",
      r.createdAt ? new Date(r.createdAt).toLocaleString("th-TH") : "",
      r.updatedAt ? new Date(r.updatedAt).toLocaleString("th-TH") : "",
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    // BOM นำหน้า — Excel ภาษาไทยอ่าน UTF-8 ถูก ไม่เป็นตัวยึกยือ
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")],
      { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <div className="max-w-5xl mx-auto px-5 py-6 space-y-4">

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[20px] font-bold text-gray-900">📋 คิวรอคอร์ส</h1>
            <p className="text-[12.5px] mt-0.5" style={{ color: "#A8A8A6" }}>
              ลิงก์ฟอร์มแจกน้อง: <span className="font-mono font-semibold" style={{ color: BRAND.primary }}>
                aj-exam-online.vercel.app/waitlist</span>
              {" "}· เลือกสนามให้ก่อนได้ เช่น ?venue=local · ติดตามที่มา ?src=line|fb|app
            </p>
          </div>
          <button onClick={exportCsv} disabled={rows.length === 0}
            className="text-[13px] font-bold px-4 py-2 rounded-xl disabled:opacity-40"
            style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
            ⬇ Export CSV ({rows.length})
          </button>
        </div>

        {loading && <div className="card-elev h-40 animate-pulse" />}

        {!loading && stats.map((s) => (
          <div key={s.key} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[15.5px] font-bold text-gray-900">{s.label}</p>
                  {s.active >= WAITLIST_ALERT_AT && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                      🔥 ครบ {WAITLIST_ALERT_AT} คน — น่าเปิดคอร์สแล้ว
                    </span>
                  )}
                </div>
                <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>
                  {s.byStatus.filter((b) => b.n > 0).map((b) => `${b.label} ${b.n}`).join(" · ") || "ยังไม่มีคนรอ"}
                  {s.unsub > 0 && ` · ยกเลิกรับข่าว ${s.unsub}`}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <p className="text-[24px] font-extrabold leading-none" style={{ color: BRAND.primary }}>
                    {s.active}
                  </p>
                  <p className="text-[11px] font-semibold text-gray-400">รอรับข่าว</p>
                </div>
                <div className="text-right">
                  <p className="text-[24px] font-extrabold leading-none" style={{ color: "#B45309" }}>
                    +{s.new30}
                  </p>
                  <p className="text-[11px] font-semibold text-gray-400">ใหม่ 30 วัน</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={() => setNotifyField(s.key)} disabled={s.active === 0}
                className="text-[12.5px] font-bold px-3.5 py-2 rounded-xl text-white disabled:opacity-40"
                style={{ backgroundColor: BRAND.primary }}>
                📣 แจ้งเปิดคอร์ส
              </button>
              <button onClick={() => setOpenField(openField === s.key ? null : s.key)}
                className="text-[12.5px] font-semibold px-3.5 py-2 rounded-xl"
                style={{ backgroundColor: "#F5F5F3", color: "#6B7280" }}>
                {openField === s.key ? "ซ่อนรายชื่อ" : `รายชื่อ (${s.people.length})`}
              </button>
              {s.log && (
                <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>
                  ส่งแล้ว {s.log.rounds} รอบ รวม {s.log.totalSent} ฉบับ · ล่าสุด {fmt(s.log.lastSentAt)}
                  {" "}— รอบใหม่ส่งเฉพาะคนที่เพิ่งลงชื่อ
                </span>
              )}
            </div>

            {openField === s.key && s.people.length > 0 && (
              <div className="mt-3 max-h-80 overflow-y-auto rounded-xl" style={{ border: "1px solid #F3F2F0" }}>
                {s.people.map((r, i) => (
                  <div key={r.email} className="flex items-center gap-2.5 px-3 py-2 text-[12.5px]"
                    style={{ borderTop: i > 0 ? "1px solid #F7F6F4" : "none",
                             opacity: r.unsub ? 0.5 : 1 }}>
                    <span className="flex-1 min-w-0 truncate" style={{ color: "#374151" }}>
                      <span className="font-semibold">{r.name}</span>
                      <span style={{ color: "#A8A8A6" }}> · {r.email}</span>
                      {r.fields.includes("other") && r.otherText && (
                        <span style={{ color: "#B45309" }}> · {r.otherText}</span>
                      )}
                    </span>
                    <span className="flex-shrink-0" style={{ color: "#A8A8A6" }}>
                      {statusLabel(r.status)}{r.unsub ? " · ยกเลิกแล้ว" : ""} · {fmt(r.createdAt)}
                    </span>
                    <button onClick={() => deletePerson(r.email)}
                      className="flex-shrink-0 text-[11.5px] font-semibold px-2 py-1 rounded-lg"
                      style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {notifyField && (
          <NotifyModal field={notifyField}
            waiting={stats.find((s) => s.key === notifyField)?.active ?? 0}
            log={logs.find((l) => l.field === notifyField) ?? null}
            onClose={() => setNotifyField(null)}
            onSent={() => { setNotifyField(null); load(); }} />
        )}
      </div>
    </div>
  );
}

// ─── Modal แจ้งเปิดคอร์ส: เขียน → พรีวิว → ยืนยันส่ง ────────────────────────────

function NotifyModal({ field, waiting, log, onClose, onSent }: {
  field: string; waiting: number; log: NotifyLog | null;
  onClose: () => void; onSent: () => void;
}) {
  const { user } = useAuth();
  const label = fieldLabel(field);
  const [subject, setSubject] = useState(`เปิดคอร์ส${label.split(" — ")[0]}แล้วค่ะ 🎉`);
  const [bodyText, setBodyText] = useState(
    `คอร์สสนาม${label.split(" — ")[0]}ที่น้องลงชื่อรอไว้ เปิดรับสมัครแล้วนะคะ\n`
    + `ข้างในมีคลังข้อสอบพร้อมเฉลยละเอียด Mock Exam และ Daily Quiz เจาะจุดอ่อนรายคน\n`
    + `กดดูรายละเอียดและสมัครได้จากปุ่มด้านล่างเลยค่ะ`);
  const [step, setStep] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [result, setResult] = useState<{ sent: number; failedCount: number } | null>(null);

  async function send() {
    if (!user || busy) return;
    setBusy(true); setErr("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/waitlist/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ field, subject, bodyText }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "ส่งไม่สำเร็จ"); return; }
      setResult({ sent: d.sent, failedCount: d.failedCount ?? 0 });
    } catch { setErr("ส่งไม่สำเร็จ ลองใหม่"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #EBEBEA" }}>
          <h2 className="text-[15.5px] font-bold text-gray-900">📣 แจ้งเปิดคอร์ส — {label.split(" — ")[0]}</h2>
          <button onClick={onClose} className="text-[13px] font-semibold" style={{ color: "#A8A8A6" }}>ปิด</button>
        </div>

        {result ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[32px] mb-2">✅</p>
            <p className="text-[15px] font-bold text-gray-900">ส่งแล้ว {result.sent} ฉบับ</p>
            {result.failedCount > 0 && (
              <p className="text-[12.5px] mt-1" style={{ color: "#DC2626" }}>
                ส่งไม่ผ่าน {result.failedCount} ฉบับ (ดูรายละเอียดใน log ของ Vercel)
              </p>
            )}
            <button onClick={onSent}
              className="mt-5 px-6 py-2.5 rounded-xl text-[14px] font-bold text-white"
              style={{ backgroundColor: BRAND.primary }}>
              เรียบร้อย
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3.5">
            <p className="text-[12.5px] rounded-xl px-3.5 py-2.5 leading-relaxed"
              style={{ backgroundColor: "#FFFBEB", color: "#92400E" }}>
              {log
                ? `สนามนี้เคยส่งแล้ว ${log.rounds} รอบ (ล่าสุด ${fmt(log.lastSentAt)}) — รอบนี้จะส่งเฉพาะคนที่ลงชื่อใหม่หลังรอบก่อนเท่านั้น กันคนเดิมโดนซ้ำ`
                : `จะส่งถึงคนที่รอสนามนี้และยังรับข่าวอยู่ ${waiting} คน · ทุกฉบับมีลิงก์ยกเลิกรับข่าวท้ายอีเมลอัตโนมัติ`}
            </p>

            {step === "edit" ? (
              <>
                <div>
                  <label className="block text-[13px] font-bold text-gray-800 mb-1">หัวข้ออีเมล</label>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150}
                    className="w-full rounded-xl px-3.5 py-2.5 text-[16px]" style={{ border: "1.5px solid #E0DFDC" }} />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-800 mb-1">เนื้อหา (ขึ้นบรรทัดใหม่ได้)</label>
                  <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={6} maxLength={4000}
                    className="w-full rounded-xl px-3.5 py-2.5 text-[16px] resize-y"
                    style={{ border: "1.5px solid #E0DFDC" }} />
                </div>
                <button onClick={() => setStep("preview")}
                  disabled={!subject.trim() || !bodyText.trim()}
                  className="w-full py-3 rounded-xl text-[14px] font-bold text-white disabled:opacity-40"
                  style={{ backgroundColor: BRAND.primary }}>
                  ดูพรีวิวอีเมล →
                </button>
              </>
            ) : (
              <>
                {/* พรีวิว — โครงเดียวกับอีเมลจริง (หัวแบรนด์ + เนื้อหา + ปุ่ม + ท้ายยกเลิกรับข่าว) */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #EBEBEA" }}>
                  <div className="px-4 py-2.5 text-[12px] font-semibold"
                    style={{ backgroundColor: "#F5F5F3", color: "#6B7280" }}>
                    หัวข้อ: {subject}
                  </div>
                  <div className="px-4 py-3" style={{ background: "linear-gradient(135deg,#10857A,#0B4F48)" }}>
                    <p className="text-white text-[14px] font-bold">AJ ExamOnline</p>
                  </div>
                  <div className="px-4 py-4 bg-white">
                    <p className="text-[13.5px] text-gray-700 mb-2">สวัสดีค่ะ น้อง 💚</p>
                    {bodyText.split(/\n+/).map((p, i) => (
                      <p key={i} className="text-[13.5px] text-gray-700 leading-relaxed mb-2">{p}</p>
                    ))}
                    <div className="text-center py-2.5 rounded-xl text-[13.5px] font-bold text-white mt-3"
                      style={{ backgroundColor: BRAND.primary }}>
                      ดูรายละเอียดคอร์ส →
                    </div>
                    <p className="text-[10.5px] mt-3 pt-2.5" style={{ color: "#A8A8A6", borderTop: "1px solid #F3F2F0" }}>
                      คุณได้รับอีเมลนี้เพราะลงชื่อรอคอร์สไว้กับ AJ ExamOnline · ยกเลิกรับข่าว (กดครั้งเดียวมีผลทันที)
                    </p>
                  </div>
                </div>

                {err && (
                  <p className="text-[13px] font-semibold rounded-xl px-3.5 py-2.5"
                    style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                    {err}
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setStep("edit")}
                    className="flex-1 py-3 rounded-xl text-[14px] font-semibold"
                    style={{ border: "1.5px solid #E0DFDC", color: "#6B7280" }}>
                    ← แก้ข้อความ
                  </button>
                  <button onClick={send} disabled={busy}
                    className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white disabled:opacity-60"
                    style={{ backgroundColor: "#B45309" }}>
                    {busy ? "กำลังส่ง…" : "✓ ยืนยันส่งจริง"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
