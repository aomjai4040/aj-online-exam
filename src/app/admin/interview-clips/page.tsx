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
import { QUESTIONS, PRESSURE_CLIPS, catOf } from "@/lib/interview";
import {
  loadClips, removeClipDoc, saveClip, type InterviewClip,
} from "@/lib/interview-clips";
import { BRAND } from "@/lib/subjects";

type UpLog = { name: string; msg: string; ok: boolean | null };

const KIND_OF_EXT: Record<string, "video" | "poster" | "captions"> = {
  mp4: "video", jpg: "poster", jpeg: "poster", vtt: "captions",
};
const CONTENT_TYPE: Record<string, string> = {
  video: "video/mp4", poster: "image/jpeg", captions: "text/vtt",
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
      if (!kind) { log(file.name, "รองรับเฉพาะ .mp4 (คลิป) .jpg (ปก) .vtt (ซับ)", false); continue; }
      // รับทั้งรหัสคำถาม (SPS-C/DCD-C) และคลิปจี้ห้องกดดัน (PRS-P-001..005)
      if (!QUESTIONS.some((q) => q.code === baseCode)
        && !PRESSURE_CLIPS.some((p) => p.code === baseCode)) {
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
    return [
      { title: "สป.สธ. + คำถามกลาง (SPS-C)", list: sps },
      { title: "กรมควบคุมโรค (DCD-C)", list: dcd },
      { title: "คลิปจี้ห้องกดดัน (PRS-P) — ระหว่างรอคลิป ระบบใช้ข้อความจี้แทน", list: prs },
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
        <input ref={fileRef} type="file" multiple accept=".mp4,.jpg,.jpeg,.vtt"
          className="hidden" disabled={busy}
          onChange={(e) => handleFiles(e.target.files)} />
        <p className="text-[15px] font-bold" style={{ color: BRAND.primary }}>
          {busy ? "กำลังอัปโหลด…" : "📤 แตะเพื่อเลือกไฟล์คลิป (เลือกหลายไฟล์พร้อมกันได้)"}
        </p>
        <p className="text-[12px] text-gray-400 mt-1">
          .mp4 = คลิป · .jpg = ภาพปก · .vtt = ซับ — ระบบจับคู่กับคำถามจากชื่อไฟล์อัตโนมัติ
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
                    return (
                      <div key={r.code} className="px-4 py-2.5 flex items-center gap-3">
                        <span className={`text-[12px] font-mono font-bold flex-shrink-0 w-20 ${r.isVariant ? "pl-3" : ""}`}
                          style={{ color: c?.videoPath ? "#15803D" : "#A8A8A6" }}>
                          {r.isVariant ? `↳ แบบ ${r.code.slice(-1)}` : r.code}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-gray-800 truncate">{r.text}</p>
                          <p className="text-[11px]" style={{ color: r.subColor }}>{r.sub}
                            {c?.durationSec ? <span className="text-gray-400"> · {c.durationSec} วิ</span> : null}
                            {c?.posterPath ? <span className="text-gray-400"> · มีปก</span> : null}
                            {c?.status === "draft" ? <span style={{ color: "#B45309" }}> · ร่าง</span> : null}
                          </p>
                        </div>
                        {c?.videoPath ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => toggleFree(r.code)}
                              className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                              style={c.isFreePreview
                                ? { backgroundColor: "#F0FDF4", color: "#15803D", border: "1px solid #86EFAC" }
                                : { backgroundColor: "#F5F5F3", color: "#A8A8A6", border: "1px solid #E0DFDC" }}>
                              {c.isFreePreview ? "🎁 ฟรี" : "ล็อก"}
                            </button>
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
                        ) : (
                          <span className="text-[11px] flex-shrink-0 text-gray-300">ยังไม่มีคลิป</span>
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
