"use client";
/**
 * /games — "เกมทบทวน": ศูนย์รวมเกมฝึกความรู้ (ปุ่มกลางของ BottomNav)
 * ทยอยเพิ่มเกมได้เรื่อย ๆ — เพิ่มรายการใน GAMES อย่างเดียว
 * หน้านี้เปิดสาธารณะ (ตัวเกมแต่ละอันมี gate ของตัวเองอยู่แล้ว)
 */
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

const ACCENT = "#0B6E65";
const LINE   = "#ECEBE9";
const MUTED  = "#A8A29E";

interface GameEntry {
  title:  string;
  desc:   string;
  href?:  string;        // ไม่มี = ยังไม่เปิด (โชว์ "เร็ว ๆ นี้")
  badge?: string;
  icon:   React.ReactNode;
}

const IC = { width: 22, height: 22 };

const GAMES: GameEntry[] = [
  {
    title: "เกมเลือกสถิติ",
    desc:  "โจทย์แบบข้อสอบจริง — โหมดสอบ (ข้อผิดวนซ้ำ) + โหมดฝึกไล่เงื่อนไข",
    href:  "/stat-game",
    badge: "ใหม่",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={IC}>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: "Flash Card",
    desc:  "พลิกการ์ดทบทวน จำได้/ยังไม่ได้ ระบบจดให้",
    href:  "/flashcard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={IC}>
        <rect x="2" y="6" width="18" height="13" rx="2" />
        <path d="M6 6V4a2 2 0 012-2h12a2 2 0 012 2v11a2 2 0 01-2 2" />
      </svg>
    ),
  },
  {
    title: "จับคู่อัตราโทษ",
    desc:  "จับคู่ความผิด ↔ โทษตามกฎหมายสาธารณสุข",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={IC}>
        <path d="M9 3H5a2 2 0 00-2 2v4" /><path d="M15 3h4a2 2 0 012 2v4" />
        <path d="M9 21H5a2 2 0 01-2-2v-4" /><path d="M15 21h4a2 2 0 002-2v-4" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
];

export default function GamesPage() {
  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#FAFAF9" }}>

      {/* Header */}
      <div className="bg-white" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-2xl mx-auto px-5 py-5">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] mb-1"
            style={{ color: MUTED }}>
            Games
          </p>
          <h1 className="text-[21px] font-extrabold text-gray-900">เกมทบทวน</h1>
          <p className="text-[13px] mt-1" style={{ color: MUTED }}>
            ทบทวนแบบเพลิน ๆ จำแม่นโดยไม่รู้ตัว — เกมใหม่ทยอยเพิ่มเรื่อย ๆ
          </p>
        </div>
      </div>

      {/* Game list */}
      <div className="max-w-2xl mx-auto px-5 py-5 space-y-2.5">
        {GAMES.map((g) =>
          g.href ? (
            <Link key={g.title} href={g.href}
              className="flex items-center gap-3.5 rounded-2xl px-4 py-4 bg-white
                         active:scale-[0.98] transition-transform"
              style={{ border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#EBF5F3" }}>
                {g.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[15.5px] font-bold text-gray-900 leading-tight">{g.title}</p>
                  {g.badge && (
                    <span className="text-[10.5px] font-bold px-1.5 py-[2px] rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#FDF6E9", color: "#B45309" }}>
                      {g.badge}
                    </span>
                  )}
                </div>
                <p className="text-[13px] mt-0.5 leading-snug" style={{ color: MUTED }}>{g.desc}</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#D6D3D1"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="w-4 h-4 flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ) : (
            <div key={g.title}
              className="flex items-center gap-3.5 rounded-2xl px-4 py-4 bg-white opacity-70"
              style={{ border: `1px dashed #DDD9D4` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#F5F5F4" }}>
                {g.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[15.5px] font-bold leading-tight" style={{ color: "#78716C" }}>
                    {g.title}
                  </p>
                  <span className="text-[10.5px] font-bold px-1.5 py-[2px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: "#F5F5F4", color: MUTED }}>
                    เร็ว ๆ นี้
                  </span>
                </div>
                <p className="text-[13px] mt-0.5 leading-snug" style={{ color: MUTED }}>{g.desc}</p>
              </div>
            </div>
          )
        )}

        <p className="text-[12.5px] text-center pt-3" style={{ color: "#C9C5C0" }}>
          มีไอเดียเกมที่อยากได้? บอกครูอ้อมได้เลย
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
