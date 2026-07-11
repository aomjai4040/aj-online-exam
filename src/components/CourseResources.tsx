"use client";
import { COURSE_RESOURCES } from "@/lib/pricing";
import { BRAND } from "@/lib/subjects";

// ─── ปุ่มทรัพยากรคอร์สเต็ม: เข้ากลุ่ม LINE + ดาวน์โหลดชีทสรุป ──────────────────
// แสดงเฉพาะปุ่มที่มีลิงก์ตั้งค่าไว้ (COURSE_RESOURCES) — ถ้ายังไม่ใส่ลิงก์จะซ่อน

export default function CourseResources({ compact = false }: { compact?: boolean }) {
  const { lineOpenChat, driveDocs } = COURSE_RESOURCES;
  if (!lineOpenChat && !driveDocs) return null;

  return (
    <div className={compact ? "space-y-2.5" : "bg-white rounded-2xl p-4 space-y-2.5"}
      style={compact ? undefined : { border: "1px solid #C3E5DE" }}>
      {!compact && (
        <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND.primary }}>
          สมาชิกคอร์สเต็ม
        </p>
      )}

      {driveDocs && (
        <a href={driveDocs} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-4 py-3 active:scale-[0.99] transition-transform"
          style={{ backgroundColor: "#EBF5F3" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-bold" style={{ color: BRAND.primary }}>ดาวน์โหลดชีทสรุป</p>
            <p className="text-[11.5px]" style={{ color: "#5DA89F" }}>เนื้อหา 7 เรื่อง ~500 หน้า (Google Drive)</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 opacity-60">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </a>
      )}

      {lineOpenChat && (
        <a href={lineOpenChat} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-4 py-3 active:scale-[0.99] transition-transform"
          style={{ backgroundColor: "#EAF7EE" }}>
          <div className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center"
            style={{ backgroundColor: "#06C755" }}>
            <span className="text-white text-[10px] font-bold">L</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-bold" style={{ color: "#067A38" }}>เข้ากลุ่ม LINE ผู้เรียน</p>
            <p className="text-[11.5px]" style={{ color: "#3B9E63" }}>ถาม-ตอบ + อัปเดตข่าวสอบกับเพื่อน ๆ</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="#067A38" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 opacity-60">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </a>
      )}
    </div>
  );
}
