"use client";
/**
 * /course/[field] — "หน้าคอร์ส" ของแต่ละสนาม (Aj 2026-08-21)
 *
 * หน้าแรกไม่มีเมนูอีกแล้ว — เมนูหลัก / การ์ดโค้ช / เพิ่มล่าสุด ย้ายมาที่นี่
 * และโชว์เฉพาะของสนามนั้น (moph = สป.สธ. · dcd = กรมควบคุมโรค) แยกกันชัด
 *
 * กติกาเข้า:
 *   ยังไม่ login          → กลับหน้าแรก
 *   ไม่มีสิทธิ์สนามนี้     → พาไปหน้าสมัครของสนามนั้นทันที (Aj เลือกข้อนี้)
 *   มีสิทธิ์              → จำสนามนี้เป็น "สนามล่าสุด" แล้วเปิดแอปครั้งหน้าเด้งมาที่นี่เลย
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getPublishedExams } from "@/lib/firestore";
import { isMockExam, type Exam } from "@/lib/types";
import { isFinalLapExam } from "@/lib/final-review";
import { useAuth } from "@/lib/auth-context";
import { BRAND } from "@/lib/subjects";
import { getUserAccess, EMPTY_ACCESS, type UserAccess } from "@/lib/access";
import {
  EXAM_FIELDS, FIELD_SHORT, examSetField, type ExamFieldKey,
} from "@/lib/exam-fields";
import { setActiveField, ownsFieldKey, ownedFields, courseHref } from "@/lib/active-field";
import { dcdCurrentPrice } from "@/lib/pricing";
import BottomNav from "@/components/BottomNav";
import { OtherCourses } from "@/components/ExamFieldGrid";
import TodayPlanCard from "@/components/TodayPlanCard";
import TodayTasksCard from "@/components/TodayTasksCard";
import CourseProgressCard from "@/components/CourseProgressCard";
import CourseQuickLinks, { LineJoinSheet, useDriveUrl } from "@/components/CourseQuickLinks";
import {
  LatestCard, LatestSkeleton, PreExamSheetCard, FeedbackCard, RecallCard,
} from "@/components/HomeCards";

// ─── เมนูต่อสนาม ────────────────────────────────────────────────────────────

interface MenuItem {
  title: string; desc: string; href?: string; badge?: string; external?: boolean;
  /** ไม่มี href = ปุ่มกดแล้วทำ action (เช่น เปิดแผ่น LINE) */
  onClick?: () => void;
  icon: React.ReactNode;
  /** สีพื้นไอคอน (ค่าเริ่มต้น = โทนแบรนด์) */
  iconBg?: string;
}

const ic = (paths: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    {paths}
  </svg>
);

const ICONS = {
  flame: ic(<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />),
  game:  ic(<><rect x="2" y="6" width="20" height="12" rx="6" /><line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="15" y1="13" x2="15.01" y2="13" /><line x1="18" y1="11" x2="18.01" y2="11" /></>),
  video: ic(<><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>),
  clock: ic(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  check: ic(<><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /><polyline points="10 9 12 11 16 7" /></>),
  mic:   ic(<><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>),
  user:  ic(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  docs:  ic(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>),
  line: (
    <svg viewBox="0 0 24 24" fill="white" style={{ width: 20, height: 20 }}>
      <path d="M12 3C6.48 3 2 6.64 2 11.13c0 4.03 3.58 7.4 8.41 8.04.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.01.89.55 1.09-.46 5.87-3.46 8.01-5.92C21.62 14.4 22 12.83 22 11.13 22 6.64 17.52 3 12 3z" />
    </svg>
  ),
};

function menuFor(field: ExamFieldKey, extra: { driveUrl: string | null; openLine: () => void }): MenuItem[] {
  const video: MenuItem = { title: "คอร์สวิดีโอ", desc: field === "dcd" ? "คลิปติว คร. ทยอยลง" : "ติวครบทุกหัวข้อ", href: "/videos", icon: ICONS.video };
  const mock:  MenuItem = { title: "Mock Exam",  desc: "จำลองสอบเสมือนจริง", href: "/mock-exam", icon: ICONS.clock };
  const game:  MenuItem = { title: "เกมทบทวน",  desc: "เกมเลือกสถิติ · Flash Card", href: "/games", badge: "ฟรี", icon: ICONS.game };
  const me:    MenuItem = { title: "บันทึกของฉัน", desc: "ผลสอบและคะแนน", href: "/dashboard", icon: ICONS.user };

  if (field === "moph") {
    return [
      // สนามติวจบแล้ว รอเรียกสัมภาษณ์ — เมนูภาค ค. ขึ้นก่อนเพื่อน (คร. ค่อยเปิดหลังสอบข้อเขียน)
      { title: "เตรียมภาค ค.", desc: "ซ้อมสัมภาษณ์ · เช็คลิสต์วันจริง", href: "/interview", badge: "ใหม่", icon: ICONS.mic },
      { title: "ติวโค้งสุดท้าย", desc: "จบแคมป์แล้ว · ดูคลิป/ชีทย้อนหลัง", href: "/final-review", icon: ICONS.flame },
      game, video, mock, me,
      { title: "Checklist วิดีโอ", desc: "ติดตามวิดีโอที่ดู", href: "https://jade-fenglisu-32fb47.netlify.app", external: true, icon: ICONS.check },
    ];
  }
  // คร. (Aj 2026-08-23): เอกสาร + กลุ่ม LINE เป็นการ์ดในแผง เรียงตามการใช้งาน
  return [
    video, mock,
    { title: "เอกสารประกอบ", desc: extra.driveUrl ? "ชีท / ไฟล์เรียนของคอร์ส" : "พี่อ้อมกำลังเตรียม",
      ...(extra.driveUrl ? { href: extra.driveUrl, external: true } : {}), icon: ICONS.docs,
      iconBg: "#FDF6E9" },
    { title: "กลุ่ม LINE", desc: "ประกาศคลิปใหม่ · ถามพี่อ้อม", onClick: extra.openLine, icon: ICONS.line,
      iconBg: "#07C160" },
    game, me,
  ];
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CoursePage() {
  const params = useParams<{ field: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const field: ExamFieldKey | null =
    params.field === "dcd" ? "dcd" : params.field === "moph" ? "moph" : null;
  const meta = EXAM_FIELDS.find((f) => f.id === field);

  const [access, setAccess]   = useState<UserAccess | null>(null);
  const [exams, setExams]     = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [planShown, setPlanShown] = useState(false);
  const [pct, setPct] = useState(0); // % ความคืบหน้าคอร์ส (จาก CourseProgressCard)
  const [lineOpen, setLineOpen] = useState(false);
  const driveUrl = useDriveUrl(field ?? "moph");

  // ── สิทธิ์ ──
  // ไม่มีสิทธิ์ (ยังไม่ login / ยังไม่ซื้อ / ซื้อสนามอื่น) → หน้า "ล็อก" บอกให้สมัคร
  // (Aj 2026-08-23: ไม่เด้งไปหน้าสมัครทันที จะได้ไม่งงเวลากดผิดคอร์ส)
  const [locked, setLocked] = useState<UserAccess | "guest" | null>(null);
  useEffect(() => {
    if (!field || !meta) { router.replace("/"); return; }
    if (authLoading) return;
    if (!user) { setLocked("guest"); return; }
    let cancelled = false;
    getUserAccess(user.uid)
      .then((a) => {
        if (cancelled) return;
        if (!ownsFieldKey(a, field)) { setLocked(a); return; }
        setLocked(null);
        setActiveField(field);
        setAccess(a);
      })
      .catch(() => router.replace("/"));
    return () => { cancelled = true; };
  }, [field, meta, user, authLoading, router]);

  // ── ชุดข้อสอบของสนามนี้ (เพิ่มล่าสุด) ──
  useEffect(() => {
    if (!access || !field) return;
    getPublishedExams()
      .then((all) => setExams(
        all.filter((e) => !isMockExam(e) && !isFinalLapExam(e) && examSetField(e) === field)))
      .finally(() => setLoading(false));
  }, [access, field]);

  // ── หน้าล็อก: ยังไม่มีสิทธิ์คอร์สนี้ ──
  if (field && meta && locked) {
    const other = locked !== "guest" ? ownedFields(locked).filter((f) => f !== field) : [];
    const price = field === "dcd" ? dcdCurrentPrice().amount : meta.price;
    return (
      <div className="min-h-screen bg-stone-50 font-sans pb-28">
        <div className="max-w-lg mx-auto px-5 pt-10">
          <div className="rounded-3xl overflow-hidden" style={{ boxShadow: "0 12px 32px -12px rgba(11,79,72,.35)" }}>
            <div className="px-5 pt-6 pb-5 text-white"
              style={{ background: `linear-gradient(150deg, ${meta.accent} 0%, #0B4F48 85%)` }}>
              <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md mb-2"
                style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>{meta.code}</span>
              <h1 className="text-[22px] font-bold leading-tight">{meta.name}</h1>
              <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>{meta.blurb}</p>
            </div>
            <div className="bg-white px-5 py-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-[22px] leading-none">🔒</span>
                <div>
                  <p className="text-[15px] font-bold text-gray-900">
                    {locked === "guest" ? "เข้าสู่ระบบแล้วสมัครคอร์สนี้ก่อนนะคะ" : "คุณยังไม่ได้สมัครคอร์สนี้"}
                  </p>
                  <p className="text-[13px] mt-1 leading-relaxed" style={{ color: "#6B7280" }}>
                    คลังข้อสอบ · Mock Exam · คลิปติว · กลุ่ม LINE ของสนาม {meta.code}{" "}
                    เปิดให้เฉพาะผู้ที่สมัครคอร์ส{meta.name}
                    {other.length > 0 && ` — คอร์สที่คุณมีอยู่คือ ${other.map((f) => FIELD_SHORT[f]).join(", ")} ถ้ากดมาผิด กลับไปคอร์สของคุณได้เลย`}
                  </p>
                </div>
              </div>
              {meta.status === "open" && meta.hrefBuy ? (
                <Link href={meta.hrefBuy}
                  className="block w-full text-center py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: BRAND.primary }}>
                  สมัครคอร์ส{meta.code}{price ? ` · ฿${price}` : ""}
                </Link>
              ) : (
                <p className="text-[13px] text-center py-3 rounded-2xl" style={{ backgroundColor: "#F5F5F3", color: "#A8A8A6" }}>
                  คอร์สนี้ยังไม่เปิดรับสมัคร
                </p>
              )}
              {other.length > 0 ? (
                <Link href={courseHref(other[0])}
                  className="block w-full text-center py-3 rounded-2xl text-[14px] font-semibold mt-2"
                  style={{ backgroundColor: BRAND.primarySoft, color: BRAND.primary }}>
                  ← กลับไปคอร์ส{FIELD_SHORT[other[0]]}ของฉัน
                </Link>
              ) : (
                <Link href="/?pick=1"
                  className="block w-full text-center py-3 rounded-2xl text-[14px] font-semibold mt-2"
                  style={{ backgroundColor: BRAND.primarySoft, color: BRAND.primary }}>
                  ← ดูคอร์สทั้งหมด
                </Link>
              )}
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!field || !meta || !access) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5FAF9" }}>
        <span className="w-8 h-8 border-[3px] border-[#C3E5DE] border-t-[#0B6E65] rounded-full animate-spin" />
      </div>
    );
  }

  const canSwitch = ownedFields(access).length > 1;
  const latest = exams.slice(0, 5);
  const examsHref = field === "dcd" ? "/exams?field=dcd" : "/exams";
  const menu = menuFor(field, { driveUrl, openLine: () => setLineOpen(true) });

  return (
    <div className="min-h-screen bg-stone-50 font-sans pb-28">

      {/* แถบหัวใช้ Navbar กลางของแอป (layout) — ไม่วาดซ้ำ (Aj 2026-08-23: ซ้อนกัน 2 แถว) */}

      {/* ── แถบชื่อคอร์ส ── */}
      <section className="relative overflow-hidden px-5 pt-6 pb-5"
        style={{ background: `linear-gradient(150deg, ${meta.accent} 0%, #0B4F48 85%)` }}>
        <div aria-hidden className="absolute -top-16 -right-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.16), transparent)" }} />
        <div className="relative max-w-lg md:max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "white" }}>
              {meta.code} · คอร์สของฉัน
            </span>
            {/* โผล่ทุกคน (Aj 2026-08-23): ทั้งสลับคอร์สที่มี และไปดู/สมัครคอร์สอื่น */}
            <Link href="/?pick=1" className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.16)", color: "white" }}>
              {canSwitch ? "สลับ / คอร์สทั้งหมด ›" : "คอร์สทั้งหมด ›"}
            </Link>
          </div>
          <h1 className="text-[22px] font-bold text-white leading-tight">{meta.name}</h1>
          <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>
            {meta.blurb}{meta.examLabel ? ` · ${meta.examLabel}` : ""}
          </p>
        </div>
      </section>

      {/* ── การ์ด + เมนู ── */}
      <section className="max-w-lg md:max-w-4xl mx-auto px-5 py-5">

        {/* คร. (Aj 2026-08-23 แบบ A): ลิงก์ด่วนแถวเดียว — กลุ่ม LINE / ชีท
            น้องใหม่ 3 วันแรกที่ยังไม่เข้ากลุ่มเห็นเป็นการ์ดเต็มใบ แล้วหดเป็นชิปถาวร */}
        {field === "dcd" && <CourseQuickLinks field="dcd" />}

        {/* ความคืบหน้าคอร์ส — อัตโนมัติจากคลิปที่ดู/ข้อสอบที่ส่ง/Mock (Aj 2026-08-21) */}
        <CourseProgressCard field={field} access={access} onPct={setPct} />

        {/* วันนี้ทำอะไร — ปฏิทินของสนามนี้ (/api/course-plan/[field]) */}
        <TodayTasksCard />

        {field === "moph" && <RecallCard />}
        {/* ประเมินการสอน: สป.สธ. โชว์ตามเดิม · คร. ค่อยโผล่หลังจบคอร์ส (Aj 2026-08-23) */}
        {(field === "moph" || pct >= 100) && <FeedbackCard />}
        {field === "moph" && <PreExamSheetCard />}
        {field === "moph" && <TodayPlanCard onVisible={setPlanShown} />}

        <div className="section-head mb-4">
          <p className="text-[17px] font-bold text-gray-900">เมนูหลัก</p>
        </div>

        {/* คลังข้อสอบ — แบนเนอร์หลัก */}
        <Link href={examsHref}
          className="flex items-center gap-3.5 w-full rounded-2xl px-5 py-4 mb-3
                     hover:opacity-95 active:scale-[0.98] transition-all duration-150"
          style={{
            background: "linear-gradient(135deg, #10857A 0%, #0B6E65 60%, #095B54 100%)",
            boxShadow: "0 4px 16px -4px rgba(11,110,101,0.45)",
          }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold tracking-wider uppercase mb-0.5 text-white/70">เริ่มต้นที่นี่</p>
            <p className="font-bold text-[20px] text-white leading-none">คลังข้อสอบ</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="white"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0 opacity-70">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        {/* Daily Quiz — ซ่อนเมื่อการ์ดแผนมีข้อนี้อยู่แล้ว */}
        {!planShown && (
          <Link href="/daily"
            className="card-elev card-elev-hover flex items-center gap-3 w-full px-4 py-3.5 mb-3 active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #FBBF24, #F59E0B)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white"
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14.5px] font-bold text-gray-900 leading-tight">Daily Quiz วันนี้</p>
              <p className="text-[12px] mt-0.5" style={{ color: "#B45309" }}>10 ข้อเจาะจุดอ่อนของคุณ · เก็บ streak ทุกวัน</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#C4C4C0"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {menu.map((item) => {
            const cls = "card-elev card-elev-hover px-4 py-4 flex items-center gap-3 active:scale-[0.97] text-left w-full";
            const body = (
              <>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: item.iconBg ?? BRAND.primarySoft }}>
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-[15px] text-gray-900 leading-tight truncate">{item.title}</p>
                    {item.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-[2px] rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[12.5px] mt-0.5 truncate text-gray-500">{item.desc}</p>
                </div>
              </>
            );
            if (item.href) {
              return (
                <Link key={item.title} href={item.href}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={cls}>
                  {body}
                </Link>
              );
            }
            return (
              <button key={item.title} type="button" onClick={item.onClick}
                className={`${cls} ${item.onClick ? "" : "opacity-60"}`} disabled={!item.onClick}>
                {body}
              </button>
            );
          })}
        </div>
      </section>

      {/* แผ่นล่าง "เข้ากลุ่ม LINE" — เปิดจากการ์ดเมนู (คร.) */}
      <LineJoinSheet field={field} open={lineOpen} onClose={() => setLineOpen(false)} />

      <div className="max-w-lg md:max-w-4xl mx-auto px-5">
        <div className="h-px" style={{ backgroundColor: "#EBEBEA" }} />
      </div>

      {/* ── เพิ่มล่าสุด (เฉพาะสนามนี้) ── */}
      <section className="max-w-lg md:max-w-4xl mx-auto py-5">
        <div className="flex items-center justify-between mb-4 px-5">
          <div className="section-head">
            <p className="text-[17px] font-bold text-gray-900">เพิ่มล่าสุด</p>
          </div>
          <Link href={examsHref} className="text-[15px] font-medium" style={{ color: "#0B6E65" }}>
            ดูทั้งหมด →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 pb-1">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <LatestSkeleton key={i} />)
            : latest.length > 0
              ? latest.map((exam) => <LatestCard key={exam.id} exam={exam} />)
              : (
                <p className="text-[13px] py-8" style={{ color: "#A8A8A6" }}>
                  {field === "dcd" ? "ข้อสอบสนามกรมควบคุมโรคกำลังทยอยมา" : "ยังไม่มีชุดข้อสอบ"}
                </p>
              )}
        </div>
      </section>

      {/* ── คอร์สอื่นที่เปิดรับสมัคร (เฉพาะที่ยังไม่มี) — ทางไปสมัครคอร์สใหม่จากในคอร์ส
          (Aj 2026-08-23: น้อง สป.สธ. หาคอร์ส คร. ไม่เจอ) ── */}
      <OtherCourses access={access} />

      <BottomNav />
    </div>
  );
}
