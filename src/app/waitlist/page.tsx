"use client";
/**
 * /waitlist — ลงชื่อรอคอร์ส (Aj 2026-11-08)
 *
 * ลิงก์เดียวส่งให้คนที่ทักถามหาคอร์สสนามใหม่ — ไม่ต้องล็อกอิน ใช้บนมือถือ
 * รองรับ ?venue=moph|dcd|local|license|other (ติ๊กสนามไว้ให้ก่อน, คั่นด้วย , ได้)
 * และ ?src=line|fb|app (บันทึกช่องทางที่มา)
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/subjects";
import { CONTACT_URL } from "@/lib/pricing";
import {
  WAITLIST_FIELDS, WAITLIST_STATUSES, WAITLIST_CONSENT_TEXT,
  isValidEmail, type WaitlistFieldKey, type WaitlistStatus,
} from "@/lib/waitlist-types";

export default function WaitlistPage() {
  const [name,   setName]   = useState("");
  const [email,  setEmail]  = useState("");
  const [fields, setFields] = useState<WaitlistFieldKey[]>([]);
  const [otherText, setOtherText] = useState("");
  const [status, setStatus] = useState<WaitlistStatus | "">("");
  const [consent, setConsent] = useState(false);
  const [source,  setSource]  = useState("direct");
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [done, setDone] = useState(false);

  // พารามิเตอร์จากลิงก์ที่ Aj แชร์ — เลือกสนามไว้ให้ก่อน + จำช่องทางที่มา
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const venues = (q.get("venue") ?? "").split(",")
      .map((v) => v.trim())
      .filter((v): v is WaitlistFieldKey => WAITLIST_FIELDS.some((f) => f.key === v));
    if (venues.length) setFields(venues);
    const src = q.get("src") ?? "";
    if (["line", "fb", "app"].includes(src)) setSource(src);
  }, []);

  function toggleField(k: WaitlistFieldKey) {
    setFields((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  async function submit() {
    setErr("");
    if (!name.trim())          { setErr("กรุณากรอกชื่อเล่น"); return; }
    if (!isValidEmail(email.trim())) { setErr("รูปแบบอีเมลไม่ถูกต้อง — ตรวจอีกครั้งนะคะ"); return; }
    if (fields.length === 0)   { setErr("เลือกสนามที่สนใจอย่างน้อย 1 สนาม"); return; }
    if (fields.includes("other") && !otherText.trim()) { setErr("ระบุสนามในช่อง อื่นๆ ด้วยนะคะ"); return; }
    if (!status)               { setErr("เลือกสถานะของน้องตอนนี้"); return; }
    if (!consent)              { setErr("ติ๊กช่องยินยอมก่อนส่งนะคะ"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), fields,
          otherText: otherText.trim(), status, consent, source,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง"); return; }
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch { setErr("ส่งไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่นะคะ"); }
    finally { setBusy(false); }
  }

  // ── หน้าขอบคุณ ──
  if (done) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-3xl overflow-hidden bg-white"
            style={{ boxShadow: "0 12px 32px -12px rgba(11,79,72,.35)" }}>
            <div className="px-6 pt-8 pb-6 text-center text-white"
              style={{ background: "linear-gradient(150deg, #10857A 0%, #0B4F48 85%)" }}>
              <p className="text-[40px] leading-none mb-3">💌</p>
              <h1 className="text-[20px] font-bold">ลงชื่อแล้วค่ะ</h1>
            </div>
            <div className="px-6 py-6">
              <p className="text-[14.5px] leading-relaxed text-gray-700 text-center">
                พี่อ้อมจะแจ้งทางอีเมล <span className="font-bold">ทันทีที่เปิดคอร์ส</span>สนามที่น้องเลือกนะคะ
              </p>
              <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer"
                className="block w-full text-center py-3.5 rounded-2xl text-[15px] font-bold text-white mt-5 active:scale-[0.98] transition-transform"
                style={{ backgroundColor: "#07C160" }}>
                เพิ่มเพื่อน LINE OA พี่อ้อม
              </a>
              <p className="text-[12px] text-center mt-1.5 mb-3" style={{ color: "#A8A8A6" }}>
                ทักถามได้เลย · ข่าวคอร์สใหม่มาที่ไลน์ก่อนใคร
              </p>
              <Link href="/"
                className="block w-full text-center py-3 rounded-2xl text-[14px] font-semibold active:scale-[0.98] transition-transform"
                style={{ border: `1.5px solid ${BRAND.primary}`, color: BRAND.primary }}>
                ดูคอร์สที่เปิดอยู่
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ฟอร์ม ──
  const inputCls = "w-full rounded-xl px-4 py-3 text-[16px] bg-white focus:outline-none";
  const inputStyle = { border: "1.5px solid #E0DFDC" };

  return (
    <div className="min-h-screen bg-stone-50 font-sans pb-16">
      <div className="max-w-md mx-auto px-5 pt-8">

        <div className="rounded-3xl overflow-hidden mb-5"
          style={{ boxShadow: "0 12px 32px -12px rgba(11,79,72,.35)" }}>
          <div className="px-5 pt-6 pb-5 text-white"
            style={{ background: "linear-gradient(150deg, #10857A 0%, #0B4F48 85%)" }}>
            <h1 className="text-[21px] font-bold leading-tight">ลงชื่อรอคอร์ส 📋</h1>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
              สนามที่น้องรอยังไม่เปิดคอร์สใช่ไหมคะ — ฝากชื่อกับอีเมลไว้
              พี่อ้อมจะส่งอีเมลแจ้งทันทีที่เปิดคอร์สสนามนั้นค่ะ
            </p>
          </div>

          <div className="bg-white px-5 py-5 space-y-4">
            {/* ชื่อเล่น */}
            <div>
              <label className="block text-[13.5px] font-bold text-gray-800 mb-1.5">
                ชื่อเล่น <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
                placeholder="เช่น น้องมายด์" className={inputCls} style={inputStyle} />
            </div>

            {/* อีเมล */}
            <div>
              <label className="block text-[13.5px] font-bold text-gray-800 mb-1.5">
                อีเมล <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                inputMode="email" autoCapitalize="none" maxLength={120}
                placeholder="name@gmail.com" className={inputCls} style={inputStyle} />
              <p className="text-[11.5px] mt-1" style={{ color: "#A8A8A6" }}>
                ใช้อีเมลที่เปิดอ่านจริง — ข่าวเปิดคอร์สส่งทางนี้ทางเดียวค่ะ
              </p>
            </div>

            {/* สนามที่สนใจ */}
            <div>
              <label className="block text-[13.5px] font-bold text-gray-800 mb-1.5">
                สนามที่สนใจ (เลือกได้หลายสนาม) <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <div className="space-y-2">
                {WAITLIST_FIELDS.map((f) => {
                  const sel = fields.includes(f.key);
                  return (
                    <button key={f.key} type="button" onClick={() => toggleField(f.key)}
                      className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-left active:scale-[0.99] transition-transform"
                      style={{
                        border: `1.5px solid ${sel ? BRAND.primary : "#E0DFDC"}`,
                        backgroundColor: sel ? "#EBF5F3" : "white",
                      }}>
                      <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold"
                        style={{ backgroundColor: sel ? BRAND.primary : "#E0DFDC" }}>
                        {sel ? "✓" : ""}
                      </span>
                      <span className="text-[13.5px] font-semibold"
                        style={{ color: sel ? "#0B4F48" : "#374151" }}>
                        {f.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {fields.includes("other") && (
                <input value={otherText} onChange={(e) => setOtherText(e.target.value)} maxLength={100}
                  placeholder="พิมพ์ชื่อสนาม/หน่วยงานที่รอ เช่น กรมอนามัย"
                  className={`${inputCls} mt-2`} style={inputStyle} />
              )}
            </div>

            {/* สถานะ */}
            <div>
              <label className="block text-[13.5px] font-bold text-gray-800 mb-1.5">
                สถานะของน้องตอนนี้ <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {WAITLIST_STATUSES.map((s) => {
                  const sel = status === s.key;
                  return (
                    <button key={s.key} type="button" onClick={() => setStatus(s.key)}
                      className="py-2.5 rounded-xl text-[13px] font-semibold active:scale-[0.98] transition-transform"
                      style={{
                        border: `1.5px solid ${sel ? BRAND.primary : "#E0DFDC"}`,
                        backgroundColor: sel ? BRAND.primary : "white",
                        color: sel ? "white" : "#6B7280",
                      }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ยินยอม */}
            <button type="button" onClick={() => setConsent((c) => !c)}
              className="w-full flex items-start gap-3 rounded-xl px-3.5 py-3 text-left"
              style={{ border: `1.5px solid ${consent ? BRAND.primary : "#E0DFDC"}`,
                       backgroundColor: consent ? "#EBF5F3" : "#FAFAF9" }}>
              <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[12px] font-bold"
                style={{ backgroundColor: consent ? BRAND.primary : "#E0DFDC" }}>
                {consent ? "✓" : ""}
              </span>
              <span className="text-[12.5px] leading-relaxed" style={{ color: "#6B7280" }}>
                {WAITLIST_CONSENT_TEXT}
              </span>
            </button>

            {err && (
              <p className="text-[13px] font-semibold rounded-xl px-3.5 py-2.5"
                style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                {err}
              </p>
            )}

            <button onClick={submit} disabled={busy}
              className="w-full py-3.5 rounded-2xl text-[15.5px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ backgroundColor: BRAND.primary }}>
              {busy ? "กำลังส่ง…" : "ลงชื่อรอคอร์ส"}
            </button>
          </div>
        </div>

        <p className="text-[12px] text-center leading-relaxed" style={{ color: "#A8A8A6" }}>
          เคยลงชื่อแล้วกรอกซ้ำได้เลย — ระบบจะรวมสนามที่เลือกเพิ่มให้ ไม่ซ้ำซ้อนค่ะ
        </p>
      </div>
    </div>
  );
}
