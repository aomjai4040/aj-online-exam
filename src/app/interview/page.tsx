"use client";
/**
 * /interview — ภาค ค สัมภาษณ์
 *
 * v2 (handoff Aj 2026-10-17 — รองรับคลิปอวตาร์ + โหมดทดลองฟรี):
 *   - เปิดให้คนยังไม่สมัคร/ยังไม่ login เข้าดูได้ (deep link ใส่โพสต์ FB ได้เลย:
 *     /interview?field=moph หรือ ?field=dcd · ไม่ใส่ = สป.สธ.)
 *     เห็นคลังทั้งหมดแบบล็อก · ซ้อมได้เฉพาะข้อ 🎁 ทดลองฟรี · จบแล้วเจอการ์ดชวนสมัคร
 *   - สมาชิก: ครบทุกอย่าง + โหมดจำลองห้องสัมภาษณ์ 5 นาที
 *   - คลิปอวตาร์โหลดเมทาดาทาที่นี่ครั้งเดียว ส่งลงทุกแท็บ (ตัวคลิปขอ signed URL รายข้อ)
 *
 * 3 แท็บ: คลังคำถาม · ซ้อมตอบ · เช็คลิสต์ — เนื้อหาอยู่ src/lib/interview.ts
 */
import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getUserAccess, type UserAccess } from "@/lib/access";
import { effectiveField } from "@/lib/active-field";
import { FIELD_SHORT, type ExamFieldKey } from "@/lib/exam-fields";
import { DCD_PARTB_KEY, dcdResultAnnounced, type PartBStatus } from "@/lib/interview";
import { loadClips, type InterviewClip } from "@/lib/interview-clips";
import { BRAND } from "@/lib/subjects";
import { QuestionBank, PracticeMode, Checklist, JoinCta, type TabCtx } from "@/components/InterviewTabs";
import BottomNav from "@/components/BottomNav";

type Tab = "bank" | "practice" | "check";

export default function InterviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<UserAccess | null | "guest">(null);
  const [clips, setClips] = useState<Map<string, InterviewClip>>(new Map());
  const [guestField, setGuestField] = useState<ExamFieldKey>("moph");
  const [tab, setTab] = useState<Tab>("bank");
  // ผลภาค ข คร. (Aj 2026-09-27): ตั้งแต่วันประกาศ ถามก่อนเข้าเมนู — ตอบแตะเดียวเข้าได้เลย
  const [partB, setPartB] = useState<PartBStatus | null | undefined>(undefined);
  const [partBBusy, setPartBBusy] = useState(false);

  // deep link สนามสำหรับคนยังไม่มีสิทธิ์: /interview?field=dcd (อ่านเองกัน Suspense ของ useSearchParams)
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("field");
    if (f === "dcd") setGuestField("dcd");
  }, []);

  // เมทาดาทาคลิป — อ่านได้ทุกคนรวม guest (rules เปิด read)
  useEffect(() => {
    let cancelled = false;
    loadClips().then((m) => { if (!cancelled) setClips(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAccess("guest"); setPartB(null); return; }
    let cancelled = false;
    getUserAccess(user.uid)
      .then((a) => { if (!cancelled) setAccess(a); })
      .catch(() => { if (!cancelled) setAccess("guest"); });
    getDoc(doc(db, "users", user.uid))
      .then((d) => { if (!cancelled) setPartB((d.data()?.[DCD_PARTB_KEY] as PartBStatus) ?? null); })
      .catch(() => { if (!cancelled) setPartB(null); });
    return () => { cancelled = true; };
  }, [user, authLoading]);

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

  if (authLoading || access === null || partB === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5FAF9" }}>
        <span className="w-8 h-8 border-[3px] border-[#C3E5DE] border-t-[#0B6E65] rounded-full animate-spin" />
      </div>
    );
  }

  const isMember = access !== "guest" && (access.hasAny || access.hasDcd);
  const field: ExamFieldKey = isMember ? effectiveField(access as UserAccess) : guestField;

  const ctx: TabCtx = {
    field,
    isMember,
    clips,
    getToken: async () => (user ? await user.getIdToken() : null),
  };

  // ── ประตูแจ้งผลภาค ข (สมาชิก คร. เท่านั้น ตั้งแต่วันประกาศ) ──
  if (isMember && field === "dcd" && dcdResultAnnounced() && partB === null) {
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
              <button onClick={() => savePartB("absent")} disabled={partBBusy}
                className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ backgroundColor: "white", border: "1px solid #E0DFDC", color: "#6B7280" }}>
                ไม่ได้ไปสอบรอบนี้
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
          <h1 className="text-[22px] font-bold text-white leading-tight">ภาค ค สัมภาษณ์</h1>
          <p className="text-[13px] mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
            ซ้อมกับกรรมการอวตาร์เหมือนนั่งอยู่หน้าห้องจริง —
            คนที่ซ้อมมาก่อนจะนิ่งกว่าหน้ากรรมการเสมอ
          </p>
        </div>
      </section>

      {/* ── แถบโหมดทดลองฟรี ── */}
      {!isMember && (
        <div className="max-w-lg mx-auto px-5 pt-3">
          <div className="rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed"
            style={{ backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", color: "#92400E" }}>
            🎁 <b>โหมดทดลองฟรี</b> — ดูคลังคำถามได้ทั้งหมด และลองซ้อมข้อที่มีป้าย 🎁 ได้เลย
            {!user && (
              <>
                {" "}· มีคอร์สอยู่แล้ว? <a href="/login" className="underline font-semibold">เข้าสู่ระบบ</a>
              </>
            )}
          </div>
        </div>
      )}

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

        {tab === "bank"     && <QuestionBank ctx={ctx} />}
        {tab === "practice" && <PracticeMode ctx={ctx} />}
        {tab === "check"    && (
          isMember
            ? <Checklist field={field} />
            : <div className="space-y-4">
                <Checklist field={field} />
                <JoinCta field={field} />
              </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
