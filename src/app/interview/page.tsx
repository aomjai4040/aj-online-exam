"use client";
/**
 * /interview — เตรียมสอบภาค ค. (สัมภาษณ์)
 *
 * สำหรับสนามที่สอบข้อเขียนเสร็จแล้ว รอเรียกสัมภาษณ์ (สป.สธ. ก่อน — คร. ค่อยเปิด
 * หลังสอบข้อเขียน). เนื้อหาทั้งหมดอยู่ src/lib/interview.ts แก้ที่เดียว.
 * ตัวแท็บอยู่ components/InterviewTabs.tsx
 *
 * 3 แท็บ: คลังคำถาม (แนวทางตอบต่อข้อ) · ซ้อมตอบ (สุ่ม 5 ข้อ จับเวลา ประเมินตัวเอง)
 * · เช็คลิสต์ (ติ๊กแล้วจำไว้ในเครื่อง)
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { getUserAccess, type UserAccess } from "@/lib/access";
import { effectiveField } from "@/lib/active-field";
import { FIELD_SHORT } from "@/lib/exam-fields";
import { DCD_PARTB_KEY, dcdResultAnnounced, type PartBStatus } from "@/lib/interview";
import { BRAND } from "@/lib/subjects";
import { QuestionBank, PracticeMode, Checklist } from "@/components/InterviewTabs";
import BottomNav from "@/components/BottomNav";

type Tab = "bank" | "practice" | "check";

export default function InterviewPage() {
  const guard = useLoginGuard();
  const { user } = useAuth();
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [tab, setTab] = useState<Tab>("bank");
  // ผลภาค ข คร. (Aj 2026-09-27): ตั้งแต่วันประกาศ ถามก่อนเข้าเมนู — ตอบแตะเดียวเข้าได้เลย
  const [partB, setPartB] = useState<PartBStatus | null | undefined>(undefined);
  const [partBBusy, setPartBBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getUserAccess(user.uid)
      .then((a) => { if (!cancelled) setAccess(a); })
      .catch(() => { if (!cancelled) setAccess(null); });
    getDoc(doc(db, "users", user.uid))
      .then((d) => { if (!cancelled) setPartB((d.data()?.[DCD_PARTB_KEY] as PartBStatus) ?? null); })
      .catch(() => { if (!cancelled) setPartB(null); });
    return () => { cancelled = true; };
  }, [user]);

  // นับผู้เข้าใช้เมนูติวภาค ค. — interviewUsage/{uid} (Aj 2026-10-02:
  // "มีคนเข้าใช้งานกี่คน ดูได้มั้ย") · การ์ด/เช็คลิสต์จำใน localStorage
  // ไม่ขึ้นเซิร์ฟเวอร์ เลยบันทึกการเข้าหน้าแทน — ดูยอดที่ /admin/insights
  useEffect(() => {
    if (!user || !access || (!access.hasAny && !access.hasDcd)) return;
    setDoc(doc(db, "interviewUsage", user.uid), {
      userId: user.uid,
      email:  user.email ?? "",
      name:   user.displayName ?? "",
      field:  effectiveField(access),
      lastAt: serverTimestamp(),
      visits: increment(1),
    }, { merge: true }).catch(() => {}); // นับพลาดห้ามกระทบการใช้งาน
  }, [user, access]);

  async function savePartB(v: PartBStatus) {
    if (!user || partBBusy) return;
    setPartBBusy(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        [DCD_PARTB_KEY]: v,
        [`${DCD_PARTB_KEY}At`]: serverTimestamp(),
        email: user.email ?? "",
        displayName: user.displayName ?? "",
      }, { merge: true });
      setPartB(v);
    } catch {}
    finally { setPartBBusy(false); }
  }

  if (guard !== "allowed" || !access) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5FAF9" }}>
        <span className="w-8 h-8 border-[3px] border-[#C3E5DE] border-t-[#0B6E65] rounded-full animate-spin" />
      </div>
    );
  }

  // สมาชิกเท่านั้น — คนไม่มีคอร์สเลยไม่ได้สอบข้อเขียนกับเรา ไม่มีอะไรให้ซ้อม
  if (!access.hasAny && !access.hasDcd) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans pb-28">
        <div className="max-w-lg mx-auto px-5 pt-12 text-center">
          <p className="text-[40px] mb-3">🔒</p>
          <p className="text-[17px] font-bold text-gray-900 mb-2">เมนูนี้สำหรับสมาชิกคอร์ส</p>
          <p className="text-[13.5px] text-gray-500 leading-relaxed mb-6">
            เตรียมสอบภาค ค. เปิดให้ผู้ที่เรียนคอร์สกับพี่อ้อมและสอบข้อเขียนเสร็จแล้ว
          </p>
          <Link href="/?pick=1"
            className="inline-block px-6 py-3 rounded-2xl text-[14.5px] font-bold text-white"
            style={{ backgroundColor: BRAND.primary }}>
            ดูคอร์สทั้งหมด
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const field = effectiveField(access);

  // ── ประตูแจ้งผลภาค ข (คร. เท่านั้น ตั้งแต่วันประกาศ 5 ต.ค.) ──
  // ยังไม่เคยตอบ → ถามก่อน 1 จอ ตอบอะไรก็เข้าเมนูได้ทันที ("ยังไม่ได้เช็ค" ก็ได้)
  if (field === "dcd" && dcdResultAnnounced() && partB === null) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans pb-28">
        <div className="max-w-lg mx-auto px-5 pt-12">
          <div className="rounded-2xl px-5 py-6 text-center"
            style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FCD34D" }}>
            <p className="text-[17px] font-bold" style={{ color: "#92400E" }}>
              📣 ประกาศผลภาค ข แล้ว
            </p>
            <p className="text-[13px] mt-1.5 mb-5 leading-relaxed" style={{ color: "#B45309" }}>
              ก่อนเข้าซ้อม บอก AJ หน่อยนะคะว่าผลเป็นอย่างไร —
              จะได้วางแผนติวภาค ค. ให้ตรงกับจำนวนคนจริง
            </p>
            <div className="space-y-2.5">
              <button onClick={() => savePartB("passed")} disabled={partBBusy}
                className="w-full py-3.5 rounded-xl text-[15px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ backgroundColor: BRAND.primary }}>
                🎉 ผ่าน — ได้ไปสัมภาษณ์
              </button>
              <button onClick={() => savePartB("failed")} disabled={partBBusy}
                className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ backgroundColor: "white", border: "1px solid #E0DFDC", color: "#6B7280" }}>
                ยังไม่ผ่านรอบนี้
              </button>
              <button onClick={() => savePartB("pending")} disabled={partBBusy}
                className="w-full py-2 text-[12.5px] font-medium underline disabled:opacity-50"
                style={{ color: "#B45309" }}>
                ยังไม่ได้เช็คผล — ขอเข้าซ้อมก่อน
              </button>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "bank",     label: "คลังคำถาม" },
    { key: "practice", label: "ซ้อมตอบ" },
    { key: "check",    label: "เช็คลิสต์" },
  ];

  return (
    <div className="min-h-screen bg-stone-50 font-sans pb-28">

      {/* ── หัวเมนู ── */}
      <section className="relative overflow-hidden px-5 pt-6 pb-5"
        style={{ background: "linear-gradient(150deg, #7C3AED 0%, #0B4F48 110%)" }}>
        <div aria-hidden className="absolute -top-16 -right-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.16), transparent)" }} />
        <div className="relative max-w-lg mx-auto">
          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md mb-2"
            style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "white" }}>
            {FIELD_SHORT[field]} · ภาค ค.
          </span>
          <h1 className="text-[22px] font-bold text-white leading-tight">เตรียมสอบสัมภาษณ์</h1>
          <p className="text-[13px] mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
            สอบข้อเขียนผ่านไปแล้ว — ช่วงรอประกาศผลคือเวลาทองของการซ้อม
            คนที่ซ้อมมาก่อนจะนิ่งกว่าหน้ากรรมการเสมอ
          </p>
        </div>
      </section>

      {/* ── แท็บ ── */}
      <div className="max-w-lg mx-auto px-5 pt-4">
        <div className="flex gap-1.5 p-1 rounded-2xl mb-4" style={{ backgroundColor: "#EBEBEA" }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-xl text-[13.5px] font-bold transition-colors"
              style={tab === t.key
                ? { backgroundColor: "white", color: BRAND.primary, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { color: "#7A7A78" }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "bank"     && <QuestionBank field={field} />}
        {tab === "practice" && <PracticeMode field={field} />}
        {tab === "check"    && <Checklist field={field} />}
      </div>

      <BottomNav />
    </div>
  );
}
