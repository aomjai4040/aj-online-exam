"use client";
/**
 * /admin/interview-clips — อัปโหลดคลิปอวตาร์ "กรรมการถาม" (handoff Aj 2026-10-17)
 *
 * วิธีใช้ (ขั้นตอนสำหรับ Aj):
 *   1. ตั้งชื่อไฟล์ตามรหัสข้อ เช่น SPS-C-001.mp4 (คลิป) · SPS-C-001.jpg (ภาพปก ถ้ามี)
 *      · SPS-C-001.vtt (ซับ ถ้ามี) — รหัสดูจากตารางข้างล่างหรือไฟล์ interview_questions.csv
 *   2. กดปุ่มเลือกไฟล์ เลือกทีเดียวหลายไฟล์ได้เลย ระบบจับคู่กับคำถามจากชื่อไฟล์เอง
 *   3. รอขึ้น ✓ ครบ เสร็จแล้ว — คลิปขึ้นสถานะเผยแพร่ทันที (กดพักเป็นร่างรายข้อได้)
 *
 * อัปโหลดตรงเข้า GCS ผ่าน signed URL (ไม่ผ่านเซิร์ฟเวอร์ — เลี่ยงลิมิต 4.5MB ของ Vercel)
 * เมทาดาทาเขียนเข้า Firestore interviewClips/{code} ด้วย client SDK (rules ให้เฉพาะ admin)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { QUESTIONS, PRESSURE_CLIPS, TUTOR_CLIPS, catOf } from "@/lib/interview";
import {
  fetchClipUrl, loadClips, removeClipDoc, saveClip, type InterviewClip,
} from "@/lib/interview-clips";
import type { ExamFieldKey } from "@/lib/exam-fields";
import { BRAND } from "@/lib/subjects";

type UpLog = { name: string; msg: string; ok: boolean | null };

const KIND_OF_EXT: Record<string, "video" | "poster" | "captions" | "doc"> = {
  mp4: "video", jpg: "poster", jpeg: "poster", vtt: "captions",
  pdf: "doc", // เอกสารประกอบ EP คลิปติว (คู่มือ 9 EP — Aj 2026-11-01)
};
const CONTENT_TYPE: Record<string, string> = {
  video: "video/mp4", poster: "image/jpeg", captions: "text/vtt", doc: "application/pdf",
};

/** อ่านความยาวคลิป (วินาที) จากไฟล์ในเครื่องก่อนอัปโหลด */
function probeDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(v.duration)); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
    v.src = url;
  });
}

export default function AdminInterviewClipsPage() {
  const { user } = useAuth();
  const [clips, setClips] = useState<Map<string, InterviewClip>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [logs, setLogs] = useState<UpLog[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setClips(await loadClips()); } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ผู้เข้าเรียนคลิปติวราย EP (tutorViews — admin อ่านได้ตาม rules)
  const [epViews, setEpViews] = useState<Map<string, { email: string; name: string }[]>>(new Map());
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { collection, getDocs } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const snap = await getDocs(collection(db, "tutorViews"));
        if (cancelled) return;
        const m = new Map<string, { email: string; name: string }[]>();
        snap.forEach((d) => {
          const x = d.data();
          const code = String(x.code ?? "");
          if (!code) return;
          const arr = m.get(code) ?? [];
          arr.push({ email: String(x.email ?? ""), name: String(x.displayName ?? "") });
          m.set(code, arr);
        });
        setEpViews(m);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user]);

  const log = (name: string, msg: string, ok: boolean | null) =>
    setLogs((p) => [...p.filter((l) => l.name !== name), { name, msg, ok }]);

  async function handleFiles(files: FileList | null) {
    if (!files || !user || busy) return;
    setBusy(true);
    setLogs([]);
    const token = await user.getIdToken();

    for (const file of Array.from(files)) {
      // รหัส + เวอร์ชัน (ไม่บังคับ): SPS-C-001.mp4 = แบบแรก · SPS-C-001-v2.mp4 = แบบที่สอง
      const m = /^([A-Z]{3}-[A-Z]-\d{3}(?:-V?[2-9])?)\.(\w+)$/i.exec(file.name.trim());
      if (!m) { log(file.name, "ชื่อไฟล์ไม่ตรงรูปแบบ รหัส.นามสกุล เช่น SPS-C-001.mp4 หรือ SPS-C-001-v2.mp4", false); continue; }
      const code = m[1].toUpperCase();
      const baseCode = code.replace(/-V?[2-9]$/, "");
      const kind = KIND_OF_EXT[m[2].toLowerCase()];
      if (!kind) { log(file.name, "รองรับเฉพาะ .mp4 (คลิป) .jpg (ปก) .vtt (ซับ) .pdf (เอกสาร EP)", false); continue; }
      // รับรหัสคำถาม (SPS-C/DCD-C) คลิปจี้ (PRS-P) และคลิปติวก่อนซ้อม (SPS-T/DCD-T)
      if (!QUESTIONS.some((q) => q.code === baseCode)
        && !PRESSURE_CLIPS.some((p) => p.code === baseCode)
        && !TUTOR_CLIPS.some((t) => t.code === baseCode)) {
        log(file.name, `ไม่พบคำถามรหัส ${baseCode} ในคลัง`, false); continue;
      }
      try {
        log(file.name, "กำลังอัปโหลด…", null);
        // 1) ขอ signed PUT URL
        const signRes = await fetch("/api/interview/clip", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "sign-upload", code, kind, contentType: CONTENT_TYPE[kind] }),
        });
        if (!signRes.ok) throw new Error("ขอ URL อัปโหลดไม่สำเร็จ");
        const { uploadUrl, path } = await signRes.json();
        // 2) PUT ตรงเข้า bucket
        const putRes = await fetch(uploadUrl, {
          method: "PUT", headers: { "Content-Type": CONTENT_TYPE[kind] }, body: file,
        });
        if (!putRes.ok) throw new Error(`อัปโหลดไม่สำเร็จ (${putRes.status})`);
        // 3) บันทึกเมทาดาทา
        const existing = clips.get(code);
        const durationSec = kind === "video" ? await probeDuration(file) : existing?.durationSec;
        const next: InterviewClip = {
          code,
          videoPath: kind === "video" ? path : existing?.videoPath ?? "",
          posterPath: kind === "poster" ? path : existing?.posterPath,
          captionsPath: kind === "captions" ? path : existing?.captionsPath,
          docPath: kind === "doc" ? path : existing?.docPath,
          durationSec,
          isFreePreview: existing?.isFreePreview ?? false,
          status: existing?.status ?? "published",
        };
        if (!next.videoPath) {
          // อัปโหลดปก/ซับมาก่อนคลิป — เก็บไว้ได้ แต่เตือน
          log(file.name, "บันทึกแล้ว (ข้อนี้ยังไม่มีไฟล์คลิป .mp4 นะ)", true);
        } else {
          log(file.name, `✓ เรียบร้อย (${code})`, true);
        }
        await saveClip(next);
        setClips((p) => new Map(p).set(code, next));
      } catch (e) {
        log(file.name, e instanceof Error ? e.message : "ผิดพลาด", false);
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── ฟังตรวจคลิปรายข้อ (Aj 2026-10-18: เจอคลิปกับการ์ดคำถามไม่ตรง จากตั้งชื่อไฟล์พลาด) ──
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [prevMedia, setPrevMedia] = useState<{ videoUrl?: string; posterUrl?: string; ytId?: string } | null>(null);
  const [prevErr, setPrevErr] = useState("");

  async function preview(code: string) {
    if (openCode === code) { setOpenCode(null); setPrevMedia(null); return; }
    if (!user) return;
    setOpenCode(code); setPrevMedia(null); setPrevErr("");
    const token = await user.getIdToken();
    const m = await fetchClipUrl(code, token);
    if (!m) { setPrevErr("เปิดคลิปไม่สำเร็จ ลองใหม่อีกครั้ง"); return; }
    setPrevMedia(m);
  }

  /** คลิปติวแบบวางลิงก์ YouTube (Aj 2026-11-01: ไฟล์ EP ยาว อัปตรงยาก)
   *  id เก็บลับฝั่ง server — สมาชิกขอผ่าน API เท่านั้น ไม่โผล่ใน Firestore สาธารณะ */
  async function setYt(code: string) {
    if (!user) return;
    const input = window.prompt(
      `วางลิงก์ YouTube (unlisted) ของ ${code}\nเช่น https://youtu.be/XXXXXXXXXXX`);
    if (!input) return;
    const m = input.trim().match(
      /^([A-Za-z0-9_-]{11})$|(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
    const ytId = m ? (m[1] || m[2]) : null;
    if (!ytId) { alert("อ่านลิงก์ไม่ออก ลองก๊อปลิงก์จากปุ่มแชร์ของ YouTube อีกครั้งนะคะ"); return; }
    const token = await user.getIdToken();
    const res = await fetch("/api/interview/clip", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "set-yt", code, ytId }),
    });
    if (!res.ok) { alert("บันทึกลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง"); return; }
    const existing = clips.get(code);
    const next: InterviewClip = {
      code,
      videoPath: existing?.videoPath ?? "",
      posterPath: existing?.posterPath,
      captionsPath: existing?.captionsPath,
      docPath: existing?.docPath,
      durationSec: existing?.durationSec,
      hasYt: true,
      isFreePreview: false,
      status: "published",
    };
    setClips((p) => new Map(p).set(code, next));
  }

  /** ติ๊กสนามที่คลิปตัวนี้ขึ้น — ไม่ติ๊กเลยไม่ได้ (อย่างน้อย 1 สนาม) */
  async function toggleClipField(code: string, f: ExamFieldKey) {
    const c = clips.get(code);
    if (!c) return;
    const cur: ExamFieldKey[] = c.fields && c.fields.length > 0 ? c.fields : ["moph", "dcd"];
    const next = cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f];
    if (next.length === 0) return;
    const updated: InterviewClip = { ...c, fields: next };
    await saveClip(updated);
    setClips((p) => new Map(p).set(code, updated));
  }

  async function toggleFree(code: string) {
    const c = clips.get(code);
    if (!c) return;
    const next = { ...c, isFreePreview: !c.isFreePreview };
    await saveClip(next);
    setClips((p) => new Map(p).set(code, next));
  }

  async function toggleStatus(code: string) {
    const c = clips.get(code);
    if (!c) return;
    const next: InterviewClip = { ...c, status: c.status === "published" ? "draft" : "published" };
    await saveClip(next);
    setClips((p) => new Map(p).set(code, next));
  }

  async function removeClip(code: string) {
    if (!user) return;
    if (!confirm(`ลบคลิปของข้อ ${code}? (คำถามยังอยู่ แสดงเป็นการ์ดข้อความตามเดิม)`)) return;
    const token = await user.getIdToken();
    await fetch("/api/interview/clip", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "delete-file", code }),
    }).catch(() => {});
    await removeClipDoc(code);
    setClips((p) => { const n = new Map(p); n.delete(code); return n; });
  }

  // จัดกลุ่มรายการ: สป.สธ.+กลาง (SPS) ก่อน แล้ว คร. (DCD) แล้วคลิปจี้ (PRS) — เรียงตามรหัส
  const groups = useMemo(() => {
    const row = (q: { code: string; q: string; cat: Parameters<typeof catOf>[0] }) => {
      const cat = catOf(q.cat);
      return { code: q.code, text: q.q, sub: cat.short, subColor: cat.color };
    };
    const sps = QUESTIONS.filter((q) => q.code.startsWith("SPS"))
      .sort((a, b) => a.code.localeCompare(b.code)).map(row);
    const dcd = QUESTIONS.filter((q) => q.code.startsWith("DCD"))
      .sort((a, b) => a.code.localeCompare(b.code)).map(row);
    const prs = PRESSURE_CLIPS.map((p) =>
      ({ code: p.code, text: p.label, sub: "ห้องกดดัน", subColor: "#DC2626" }));
    const tut = TUTOR_CLIPS.map((t) =>
      ({ code: t.code, text: t.title, sub: t.field === "dcd" ? "ติวก่อนซ้อม · คร." : "ติวก่อนซ้อม · สป.สธ.", subColor: "#0B6E65" }));
    return [
      { title: "สป.สธ. + คำถามกลาง (SPS-C)", list: sps },
      { title: "กรมควบคุมโรค (DCD-C)", list: dcd },
      { title: "คลิปจี้ห้องกดดัน (PRS-P) — ระหว่างรอคลิป ระบบใช้ข้อความจี้แทน", list: prs },
      { title: "คลิปติวก่อนซ้อม (SPS-T / DCD-T) — ยังไม่อัป เมนูขึ้นการ์ดอัปเร็ว ๆ นี้ให้เอง", list: tut },
    ];
  }, []);

  // นับเป็น "ข้อ" — เวอร์ชันสำรอง (-v2..-v9) ของข้อเดียวกันไม่นับเพิ่ม
  const haveVideo = new Set(
    [...clips.values()].filter((c) => c.videoPath)
      .map((c) => c.code.replace(/-V?[2-9]$/, ""))
  ).size;
  const freeCount = [...clips.values()].filter((c) => c.isFreePreview).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h1 className="text-2xl font-bold text-gray-900">คลิปสัมภาษณ์ (อวตาร์)</h1>
        <Link href="/admin" className="text-[13px] underline" style={{ color: BRAND.primary }}>
          ← กลับ Admin
        </Link>
      </div>
      <p className="text-[13px] text-gray-500 mb-4">
        มีคลิปแล้ว {haveVideo}/{QUESTIONS.length} ข้อ · ทดลองฟรี {freeCount} ข้อ
        (ควรมี ~3 ข้อ) · ตั้งชื่อไฟล์ = รหัสข้อ เช่น <b>SPS-C-001.mp4</b> แล้วเลือกได้ทีละหลายไฟล์
        · ข้อเดียวอัดหลายแบบได้ ตั้งชื่อ <b>SPS-C-001-v2.mp4</b> ถึง <b>-v9</b> ระบบสุ่มสลับให้เอง
      </p>

      {/* อัปโหลด */}
      <label className="block rounded-2xl px-5 py-6 text-center mb-4 cursor-pointer"
        style={{ border: "2px dashed #C3E5DE", backgroundColor: "#F5FAF9" }}>
        <input ref={fileRef} type="file" multiple accept=".mp4,.jpg,.jpeg,.vtt,.pdf"
          className="hidden" disabled={busy}
          onChange={(e) => handleFiles(e.target.files)} />
        <p className="text-[15px] font-bold" style={{ color: BRAND.primary }}>
          {busy ? "กำลังอัปโหลด…" : "📤 แตะเพื่อเลือกไฟล์คลิป (เลือกหลายไฟล์พร้อมกันได้)"}
        </p>
        <p className="text-[12px] text-gray-400 mt-1">
          .mp4 = คลิป · .jpg = ภาพปก · .vtt = ซับ · .pdf = เอกสารประกอบ EP คลิปติว — ระบบจับคู่จากชื่อไฟล์อัตโนมัติ
        </p>
      </label>

      {logs.length > 0 && (
        <div className="rounded-xl px-3.5 py-2.5 mb-4 space-y-1 text-[12.5px]"
          style={{ backgroundColor: "white", border: "1px solid #EBEBEA" }}>
          {logs.map((l) => (
            <p key={l.name} style={{ color: l.ok === false ? "#DC2626" : l.ok ? "#15803D" : "#B45309" }}>
              {l.name} — {l.msg}
            </p>
          ))}
        </div>
      )}

      {/* รายการคำถาม × สถานะคลิป */}
      {!loaded ? (
        <p className="text-center text-[13px] py-10 text-gray-400">กำลังโหลด…</p>
      ) : groups.map((g) => (
        <section key={g.title} className="mb-6">
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-2">{g.title}</p>
          <div className="card divide-y divide-gray-100">
            {g.list.map((q) => {
              // ข้อที่อัดหลายแบบ (เช่น แนะนำตัว): ไฟล์ -v2..-v9 โผล่เป็นแถวย่อยใต้ข้อหลัก
              const variantCodes = Array.from({ length: 8 }, (_, k) => k + 2)
                .flatMap((n) => [`${q.code}-V${n}`, `${q.code}-${n}`])
                .filter((vc) => clips.has(vc));
              const rows = [
                { code: q.code, text: q.text, sub: q.sub, subColor: q.subColor, isVariant: false },
                ...variantCodes.map((vc) => ({
                  code: vc,
                  text: `แบบที่ ${vc.slice(-1)} ของข้อนี้ — ระบบสุ่มสลับกับแบบอื่นให้เอง`,
                  sub: "เวอร์ชันสำรอง", subColor: "#7C3AED", isVariant: true,
                })),
              ];
              return (
                <div key={q.code}>
                  {rows.map((r) => {
                    const c = clips.get(r.code);
                    const tagFields: ExamFieldKey[] =
                      c?.fields && c.fields.length > 0 ? c.fields : ["moph", "dcd"];
                    return (
                      <div key={r.code}>
                      <div className="px-4 py-2.5 flex items-center gap-3">
                        <span className={`text-[12px] font-mono font-bold flex-shrink-0 w-20 ${r.isVariant ? "pl-3" : ""}`}
                          style={{ color: c?.videoPath || c?.hasYt ? "#15803D" : "#A8A8A6" }}>
                          {r.isVariant ? `↳ แบบ ${r.code.slice(-1)}` : r.code}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-gray-800 truncate">{r.text}</p>
                          <p className="text-[11px]" style={{ color: r.subColor }}>{r.sub}
                            {c?.durationSec ? <span className="text-gray-400"> · {c.durationSec} วิ</span> : null}
                            {c?.posterPath ? <span className="text-gray-400"> · มีปก</span> : null}
                            {c?.docPath ? <span style={{ color: "#0B6E65" }}> · 📄 มีเอกสาร</span> : null}
                            {c?.hasYt ? <span style={{ color: "#DC2626" }}> · 📺 YouTube</span> : null}
                            {/-T-/.test(r.code) ? (
                              <span style={{ color: "#7C3AED" }}>
                                {" "}· 👥 เข้าเรียน {epViews.get(r.code)?.length ?? 0} คน
                              </span>
                            ) : null}
                            {c?.status === "draft" ? <span style={{ color: "#B45309" }}> · ร่าง</span> : null}
                            {c?.videoPath && c.fields && c.fields.length === 1 ? (
                              <span style={{ color: "#7C3AED" }}>
                                {" "}· เฉพาะ {c.fields[0] === "dcd" ? "คร." : "สป.สธ."}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        {c?.videoPath || c?.hasYt ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => preview(r.code)}
                              className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                              style={openCode === r.code
                                ? { backgroundColor: "#0B6E65", color: "white" }
                                : { backgroundColor: "#EBF5F3", color: "#0B6E65", border: "1px solid #C3E5DE" }}>
                              {openCode === r.code ? "ปิด" : "▶ ฟัง"}
                            </button>
                            {/* EP คลิปติว — เปลี่ยนลิงก์ YouTube ได้ตลอด */}
                            {/-T-/.test(r.code) && (
                              <button onClick={() => setYt(r.code)}
                                className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                                style={{ backgroundColor: "#F5F5F3", color: "#6B7280", border: "1px solid #E0DFDC" }}>
                                📺
                              </button>
                            )}
                            {/* คลิปติว (T) เป็นของสมาชิกเสมอ — ไม่มีปุ่มเปิดฟรี */}
                            {!/-T-/.test(r.code) && (
                              <button onClick={() => toggleFree(r.code)}
                                className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                                style={c.isFreePreview
                                  ? { backgroundColor: "#F0FDF4", color: "#15803D", border: "1px solid #86EFAC" }
                                  : { backgroundColor: "#F5F5F3", color: "#A8A8A6", border: "1px solid #E0DFDC" }}>
                                {c.isFreePreview ? "🎁 ฟรี" : "ล็อก"}
                              </button>
                            )}
                            <button onClick={() => toggleStatus(r.code)}
                              className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                              style={{ backgroundColor: "#F5F5F3", color: "#6B7280", border: "1px solid #E0DFDC" }}>
                              {c.status === "published" ? "พัก" : "เผยแพร่"}
                            </button>
                            <button onClick={() => removeClip(r.code)}
                              className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                              style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                              ลบ
                            </button>
                          </div>
                        ) : /-T-/.test(r.code) ? (
                          // EP คลิปติว — วางลิงก์ YouTube แทนอัปไฟล์ได้ (ไฟล์ยาวอัปยาก)
                          <button onClick={() => setYt(r.code)}
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                            📺 วางลิงก์ YouTube
                          </button>
                        ) : (
                          <span className="text-[11px] flex-shrink-0 text-gray-300">ยังไม่มีคลิป</span>
                        )}
                      </div>

                      {/* ฟังตรวจ + ติ๊กสนาม — กางใต้แถวเมื่อกด ▶ ฟัง */}
                      {openCode === r.code && (
                        <div className="px-4 pb-3.5">
                          {prevErr ? (
                            <p className="text-[12.5px] py-3 text-center" style={{ color: "#DC2626" }}>{prevErr}</p>
                          ) : !prevMedia ? (
                            <p className="text-[12.5px] py-3 text-center" style={{ color: "#A8A8A6" }}>กำลังเปิดคลิป…</p>
                          ) : prevMedia.ytId ? (
                            <iframe
                              src={`https://www.youtube-nocookie.com/embed/${prevMedia.ytId}`}
                              allow="autoplay; encrypted-media; picture-in-picture"
                              allowFullScreen
                              className="w-full max-w-md mx-auto rounded-xl bg-black aspect-video block"
                              title={`ตรวจคลิป ${r.code}`} />
                          ) : (
                            // eslint-disable-next-line jsx-a11y/media-has-caption
                            <video controls autoPlay playsInline preload="metadata"
                              src={prevMedia.videoUrl} poster={prevMedia.posterUrl}
                              className="w-full max-w-md mx-auto rounded-xl bg-black"
                              style={{ maxHeight: "50vh" }} />
                          )}
                          <p className="text-[12px] text-center mt-2 mb-2" style={{ color: "#A8A8A6" }}>
                            เทียบกับคำถามด้านบน — ถ้าไม่ตรง ลบคลิปนี้แล้วอัปไฟล์ใหม่ชื่อรหัสที่ถูก
                          </p>
                          {/* รายชื่อผู้เข้าเรียน EP (Aj 2026-11-01) */}
                          {/-T-/.test(r.code) && (epViews.get(r.code)?.length ?? 0) > 0 && (
                            <div className="mt-1 mb-2 max-w-md mx-auto">
                              <p className="text-[12px] font-bold text-gray-600 mb-1">
                                👥 ผู้เข้าเรียน EP นี้ ({epViews.get(r.code)!.length} คน)
                              </p>
                              <div className="max-h-48 overflow-y-auto rounded-xl"
                                style={{ border: "1px solid #F3F2F0" }}>
                                {epViews.get(r.code)!.map((v, i) => (
                                  <p key={`${v.email}-${i}`} className="px-3 py-1.5 text-[12.5px] text-gray-600"
                                    style={{ borderTop: i > 0 ? "1px solid #F7F6F4" : "none" }}>
                                    {v.name || v.email}
                                    {v.name && <span style={{ color: "#C4C4C0" }}> · {v.email}</span>}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {/^(SPS|DCD)-C-/.test(r.code) && (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-[12px]" style={{ color: "#6B7280" }}>คลิปนี้ขึ้นสนาม:</span>
                              {(["moph", "dcd"] as ExamFieldKey[]).map((f) => {
                                const on = tagFields.includes(f);
                                return (
                                  <button key={f} onClick={() => toggleClipField(r.code, f)}
                                    className="text-[12px] font-bold px-3 py-1 rounded-full"
                                    style={on
                                      ? { backgroundColor: "#EBF5F3", color: "#0B6E65", border: "1.5px solid #0B6E65" }
                                      : { backgroundColor: "#F5F5F3", color: "#A8A8A6", border: "1.5px solid #E0DFDC" }}>
                                    {on ? "✓ " : ""}{f === "dcd" ? "คร." : "สป.สธ."}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
