"use client";
/**
 * DcdPartBCard — การ์ดแจ้งผลภาค ข คร. บนหน้าคอร์ส (Aj 2026-09-27)
 *
 * โผล่ตั้งแต่วันประกาศผู้มีสิทธิสัมภาษณ์ (5 ต.ค.) ถึงวันสัมภาษณ์วันสุดท้าย
 * ตอบแตะเดียว: ผ่าน / ไม่ผ่าน / ยังไม่ได้เช็ค — เก็บที่ users/{uid}.dcdPartB69
 * (พร้อม email/ชื่อ ให้ Aj นับยอดผ่านได้จาก /admin/progress)
 *
 * กันเคส "น้องไม่ตอบ": การ์ดอยู่หน้าคอร์สหลัก เจอทุกครั้งที่เข้าแอป —
 * "ยังไม่ได้เช็ค" การ์ดยังอยู่ (ย่อเป็นแถบเตือน) จนกว่าจะตอบผ่าน/ไม่ผ่าน
 * ตอบแล้ว: ผ่าน → การ์ดยินดี+ลิงก์ภาค ค. · ไม่ผ่าน → ให้กำลังใจสั้น ๆ แล้วหาย
 */
import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { DCD_PARTB_KEY, dcdResultAnnounced, type PartBStatus } from "@/lib/interview";
import { BRAND } from "@/lib/subjects";

/** เลิกโชว์หลังสัมภาษณ์จบ (เก็บข้อมูลพอแล้ว) */
const HIDE_AFTER = "2026-10-21T00:00:00+07:00";

export default function DcdPartBCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PartBStatus | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);

  const show = dcdResultAnnounced() && Date.now() < new Date(HIDE_AFTER).getTime();

  useEffect(() => {
    if (!user || !show) return;
    let cancelled = false;
    getDoc(doc(db, "users", user.uid))
      .then((d) => { if (!cancelled) setStatus((d.data()?.[DCD_PARTB_KEY] as PartBStatus) ?? null); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [user, show]);

  async function answer(v: PartBStatus) {
    if (!user || busy) return;
    setBusy(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        [DCD_PARTB_KEY]: v,
        [`${DCD_PARTB_KEY}At`]: serverTimestamp(),
        // แนบตัวตนไว้ในเอกสารเดียวกัน — แผง admin อ่านชื่อ/อีเมลได้เลย
        email: user.email ?? "",
        displayName: user.displayName ?? "",
      }, { merge: true });
      setStatus(v);
      setJustAnswered(true);
    } catch {}
    finally { setBusy(false); }
  }

  if (!user || !show || status === undefined) return null;

  // ── ตอบ "ผ่าน" แล้ว → การ์ดยินดี + ทางลัดภาค ค. (ค้างไว้เป็นเมนูได้เลย) ──
  if (status === "passed") {
    return (
      <a href="/interview" className="block rounded-2xl px-4 py-3.5 mb-4 card-elev card-elev-hover"
        style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #86EFAC" }}>
        <p className="text-[14px] font-bold" style={{ color: "#15803D" }}>
          🎉 ผ่านภาค ข แล้ว — ยินดีด้วยค่ะ!
        </p>
        <p className="text-[12.5px] mt-0.5" style={{ color: "#15803D" }}>
          ต่อไปคือสัมภาษณ์ 14–20 ต.ค. · แตะเข้าเมนูเตรียมภาค ค. ได้เลย →
        </p>
      </a>
    );
  }

  // ── ตอบ "ไม่ผ่าน" (เพิ่งตอบ) → ให้กำลังใจสั้น ๆ ครั้งเดียวแล้วไม่กวนอีก ──
  if (status === "failed") {
    if (!justAnswered) return null;
    return (
      <div className="rounded-2xl px-4 py-3.5 mb-4"
        style={{ backgroundColor: "#F5FAF9", border: "1px solid #E7F0EE" }}>
        <p className="text-[13.5px] font-bold text-gray-800">ขอบคุณที่แจ้งนะคะ 💚</p>
        <p className="text-[12.5px] mt-0.5 leading-relaxed text-gray-500">
          รอบนี้ยังไม่ใช่ของเรา แต่ความรู้ที่ติวมาไม่หายไปไหน —
          คลังข้อสอบและคลิปยังอยู่ให้ทบทวนสำหรับสนามต่อไปเสมอค่ะ
        </p>
      </div>
    );
  }

  // ── ยังไม่ตอบ / ตอบ "ยังไม่ได้เช็ค" → ถามจนกว่าจะได้คำตอบจริง ──
  return (
    <div className="rounded-2xl px-4 py-3.5 mb-4"
      style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FCD34D" }}>
      <p className="text-[14px] font-bold" style={{ color: "#92400E" }}>
        📣 ประกาศผลภาค ข แล้ว — ผลของคุณเป็นอย่างไรคะ?
      </p>
      <p className="text-[12px] mt-0.5 mb-2.5" style={{ color: "#B45309" }}>
        แจ้งผลให้ AJ หน่อยนะคะ จะได้วางแผนติวภาค ค. ให้ตรงกับจำนวนคนจริง
        {status === "pending" && " · เช็คผลได้แล้วอย่าลืมกลับมาบอกนะคะ"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => answer("passed")} disabled={busy}
          className="py-2.5 rounded-xl text-[13.5px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ backgroundColor: BRAND.primary }}>
          🎉 ผ่าน ได้สัมภาษณ์
        </button>
        <button onClick={() => answer("failed")} disabled={busy}
          className="py-2.5 rounded-xl text-[13.5px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ backgroundColor: "white", border: "1px solid #E0DFDC", color: "#6B7280" }}>
          ยังไม่ผ่าน
        </button>
      </div>
      {status !== "pending" && (
        <button onClick={() => answer("pending")} disabled={busy}
          className="mt-2 w-full py-1.5 text-[12px] font-medium underline"
          style={{ color: "#B45309" }}>
          ยังไม่ได้เช็คผล — ไว้มาตอบทีหลัง
        </button>
      )}
    </div>
  );
}
