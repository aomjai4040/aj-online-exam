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
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { getUserAccess, type UserAccess } from "@/lib/access";
import { effectiveField } from "@/lib/active-field";
import { FIELD_SHORT } from "@/lib/exam-fields";
import { BRAND } from "@/lib/subjects";
import { QuestionBank, PracticeMode, Checklist } from "@/components/InterviewTabs";
import BottomNav from "@/components/BottomNav";

type Tab = "bank" | "practice" | "check";

export default function InterviewPage() {
  const guard = useLoginGuard();
  const { user } = useAuth();
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [tab, setTab] = useState<Tab>("bank");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getUserAccess(user.uid)
      .then((a) => { if (!cancelled) setAccess(a); })
      .catch(() => { if (!cancelled) setAccess(null); });
    return () => { cancelled = true; };
  }, [user]);

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
