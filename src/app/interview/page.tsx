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
import { getActiveField } from "@/lib/active-field";
import { FIELD_SHORT, type ExamFieldKey } from "@/lib/exam-fields";
import { partBAnnounced, partBAnswered, partBKeyOf, type PartBStatus } from "@/lib/interview";
import { loadClips, type InterviewClip } from "@/lib/interview-clips";
import { BRAND } from "@/lib/subjects";
import { QuestionBank, PracticeMode, Checklist, JoinCta, TutorClips, type TabCtx } from "@/components/InterviewTabs";
import BottomNav from "@/components/BottomNav";

type Tab = "bank" | "practice" | "check";

export default function InterviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<UserAccess | null | "guest">(null);
  const [clips, setClips] = useState<Map<string, InterviewClip>>(new Map());
  const [urlField, setUrlField] = useState<ExamFieldKey | null>(null);
  // คนที่ซ้อมได้สองสนาม (แพ็กคู่ / มีทั้งสองคอร์ส) กดสลับสนามเองได้
  const [fieldChoice, setFieldChoice] = useState<ExamFieldKey | null>(null);
  // เปิดหน้าเจอเช็คลิสต์ก่อน (Aj 2026-10-18: ลำดับ เช็คลิสต์ → ซ้อมตอบ → คลังคำถาม)
  const [tab, setTab] = useState<Tab>("check");
  // ผลภาค ข (Aj 2026-10-17): น้องในคอร์สทุกสนามต้องตอบ ผ่าน/ไม่ผ่าน/ไม่ได้ไปสอบ ก่อนเข้าเมนู
  const [partBByKey, setPartBByKey] = useState<Record<string, PartBStatus | null> | undefined>(undefined);
  const [partBBusy, setPartBBusy] = useState(false);

  // deep link ระบุสนาม: /interview?field=dcd|moph (อ่านเองกัน Suspense ของ useSearchParams)
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("field");
    if (f === "dcd" || f === "moph") setUrlField(f);
  }, []);

  // เมทาดาทาคลิป — อ่านได้ทุกคนรวม guest (rules เปิด read)
  useEffect(() => {
    let cancelled = false;
    loadClips().then((m) => { if (!cancelled) setClips(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAccess("guest"); setPartBByKey({}); return; }
    let cancelled = false;
    getUserAccess(user.uid)
      .then((a) => { if (!cancelled) setAccess(a); })
      .catch(() => { if (!cancelled) setAccess("guest"); });
    getDoc(doc(db, "users", user.uid))
      .then((d) => {
        if (cancelled) return;
        const x = d.data() ?? {};
        setPartBByKey({
          dcdPartB69:  (x.dcdPartB69 as PartBStatus) ?? null,
          mophPartB69: (x.mophPartB69 as PartBStatus) ?? null,
        });
      })
      .catch(() => { if (!cancelled) setPartBByKey({}); });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  async function savePartB(key: string, v: PartBStatus) {
    if (!user || partBBusy) return;
    setPartBBusy(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        [key]: v,
        [`${key}At`]: serverTimestamp(),
        email: user.email ?? "",
        displayName: user.displayName ?? "",
      }, { merge: true });
      setPartBByKey((p) => ({ ...(p ?? {}), [key]: v }));
    } catch {}
    finally { setPartBBusy(false); }
  }

  if (authLoading || access === null || partBByKey === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5FAF9" }}>
        <span className="w-8 h-8 border-[3px] border-[#C3E5DE] border-t-[#0B6E65] rounded-full animate-spin" />
      </div>
    );
  }

  // สิทธิ์เข้าเมนูนี้ต่อสนาม: คอร์สหลักของสนามนั้น หรือซื้อแพ็กซ้อมภาค ค แยก (159/199)
  const acc = access === "guest" ? null : access;
  const canField = (f: ExamFieldKey): boolean =>
    !!acc && (f === "dcd" ? acc.hasDcd || acc.hasPartCDcd
      : f === "moph" ? acc.hasAny || acc.hasPartCMoph : false);
  const bothFields = canField("moph") && canField("dcd");

  // เลือกสนาม: ปุ่มสลับ > ?field ใน URL > สนามที่จำไว้ > สนามแรกที่มีสิทธิ์
  const prefer = [fieldChoice, urlField, getActiveField(), "moph", "dcd"] as const;
  const field: ExamFieldKey = acc
    ? (prefer.find((f): f is ExamFieldKey => !!f && canField(f)) ?? urlField ?? "moph")
    : (urlField ?? "moph");
  const isMember = canField(field);
  // น้องในคอร์สหลักเท่านั้นที่ต้องแจ้งผลภาค ข — guest และคนซื้อแพ็กซ้อมแยกไม่ต้องตอบ
  const isMainMember = !!acc && (field === "dcd" ? acc.hasDcd : acc.hasAny);

  const ctx: TabCtx = {
    field,
    isMember,
    clips,
    getToken: async () => (user ? await user.getIdToken() : null),
  };

  // ── ประตูแจ้งผลภาค ข (เฉพาะน้องคอร์สหลัก — Aj 2026-10-17: ต้องตอบก่อนจึงเข้าได้
  //    ตัวเลือกมี 3 ทางตามที่ Aj กำหนด ไม่มีทางข้าม เพราะผลประกาศแล้ว) ──
  const partBKey = partBKeyOf(field);
  const myPartB = partBByKey?.[partBKey] ?? null;
  if (isMainMember && partBAnnounced(field) && !partBAnswered(myPartB)) {
    return (
      <div className="min-h-screen bg-stone-50 font-sans pb-28">
        <div className="max-w-lg mx-auto px-5 pt-12">
          <div className="rounded-2xl px-5 py-6 text-center"
            style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FCD34D" }}>
            <p className="text-[17px] font-bold" style={{ color: "#92400E" }}>
              📣 ประกาศผลภาค ข ({FIELD_SHORT[field]}) แล้ว
            </p>
            <p className="text-[13px] mt-1.5 mb-5 leading-relaxed" style={{ color: "#B45309" }}>
              ก่อนเข้าซ้อม บอก AJ หน่อยนะคะว่าผลเป็นอย่างไร —
              จะได้วางแผนติวภาค ค. ให้ตรงกับจำนวนคนจริง
            </p>
            <div className="space-y-2.5">
              <button onClick={() => savePartB(partBKey, "passed")} disabled={partBBusy}
                className="w-full py-3.5 rounded-xl text-[15px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ backgroundColor: BRAND.primary }}>
                🎉 ผ่าน — ได้ไปสัมภาษณ์
              </button>
              <button onClick={() => savePartB(partBKey, "failed")} disabled={partBBusy}
                className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ backgroundColor: "white", border: "1px solid #E0DFDC", color: "#6B7280" }}>
                ยังไม่ผ่านรอบนี้
              </button>
              <button onClick={() => savePartB(partBKey, "absent")} disabled={partBBusy}
                className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ backgroundColor: "white", border: "1px solid #E0DFDC", color: "#6B7280" }}>
                ไม่ได้ไปสอบรอบนี้
              </button>
            </div>
            <p className="text-[11.5px] mt-3" style={{ color: "#B45309", opacity: 0.7 }}>
              ตอบครั้งเดียวเข้าได้ตลอดค่ะ ไม่ว่าผลเป็นแบบไหนก็เข้าซ้อมได้เหมือนกัน
            </p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "check",    label: "เช็คลิสต์" },
    { key: "practice", label: "ซ้อมตอบ" },
    { key: "bank",     label: "คลังคำถาม" },
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
          {/* คนที่ซ้อมได้สองสนาม (แพ็กคู่ 199 / มีทั้งสองคอร์ส) สลับสนามตรงนี้ */}
          {bothFields && (
            <div className="flex gap-1.5 mt-3">
              {(["moph", "dcd"] as ExamFieldKey[]).map((f) => (
                <button key={f} type="button" onClick={() => setFieldChoice(f)}
                  className="px-3.5 py-1.5 rounded-full text-[12.5px] font-bold transition-colors"
                  style={field === f
                    ? { backgroundColor: "white", color: BRAND.primary }
                    : { backgroundColor: "rgba(255,255,255,0.16)", color: "white" }}>
                  {FIELD_SHORT[f]}
                </button>
              ))}
            </div>
          )}
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
        {tab === "practice" && (
          <PracticeMode ctx={ctx}
            onExit={() => { setTab("check"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        )}
        {tab === "check"    && (
          <div className="space-y-4">
            {/* คลิปติวจากพี่อ้อมอยู่บนสุดของหน้าแรก (Aj 2026-10-18) */}
            <TutorClips ctx={ctx} />
            <Checklist field={field} />
            {!isMember && <JoinCta field={field} />}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
