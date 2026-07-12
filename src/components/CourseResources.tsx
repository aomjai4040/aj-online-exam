"use client";
import Link from "next/link";
import { COURSE_RESOURCES, PRICING } from "@/lib/pricing";
import { BRAND } from "@/lib/subjects";

// ─── ทรัพยากรคอร์สเต็ม: ชีทสรุป (Drive) + กลุ่ม LINE OpenChat ──────────────────
// lock = "full"    → ยังไม่มีคอร์ส  : โชว์ล็อก + ปุ่มซื้อคอร์สเต็ม 699
// lock = "upgrade" → มี App Only แล้ว: โชว์ล็อก + ปุ่มอัปเกรด +400
// lock ไม่ระบุ      → สมาชิกคอร์สเต็ม : ปุ่มใช้งานได้จริง

type Lock = "full" | "upgrade";

/** สัญลักษณ์ LINE — ฟองแชทขาวบนพื้นเขียว (สื่อถึงแอป LINE) */
function LineMark() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
      <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.07.7.2.8.5.07.25.05.6.02.85l-.13.8c-.04.24-.19.94.82.51 1.01-.42 5.45-3.2 7.43-5.48C20.6 14.6 22 12.9 22 11c0-4.4-4.5-8-10-8z" />
    </svg>
  );
}

function ChevronOrLock({ locked }: { locked: boolean }) {
  return locked ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 opacity-60">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function Row({
  locked, bg, iconColor, icon, title, sub, textColor,
}: {
  locked: boolean; bg: string; iconColor: string; icon: React.ReactNode;
  title: string; sub: string; textColor: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ backgroundColor: locked ? "#F5F5F3" : bg, opacity: locked ? 0.7 : 1 }}>
      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center"
        style={{ color: locked ? "#9CA3AF" : iconColor }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold" style={{ color: locked ? "#6B7280" : textColor }}>{title}</p>
        <p className="text-[11.5px]" style={{ color: locked ? "#A8A8A6" : `${textColor}CC` }}>{sub}</p>
      </div>
      <ChevronOrLock locked={locked} />
    </div>
  );
}

export default function CourseResources({
  compact = false, lock, hideCta = false,
}: { compact?: boolean; lock?: Lock; hideCta?: boolean }) {
  const { lineOpenChat, driveDocs } = COURSE_RESOURCES;
  if (!lineOpenChat && !driveDocs) return null;
  const locked = !!lock;

  const driveIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );

  const body = (
    <>
      {!compact && (
        <p className="text-[12px] font-bold uppercase tracking-wider mb-1"
          style={{ color: locked ? "#A8A8A6" : BRAND.primary }}>
          {locked ? "สิทธิพิเศษคอร์สเต็ม" : "สมาชิกคอร์สเต็ม"}
        </p>
      )}

      {driveDocs && (locked ? (
        <Row locked bg="#EBF5F3" iconColor={BRAND.primary} icon={driveIcon}
          title="ชีทสรุป 7 เรื่อง (~500 หน้า)" sub="ดาวน์โหลดจาก Google Drive" textColor={BRAND.primary} />
      ) : (
        <a href={driveDocs} target="_blank" rel="noopener noreferrer"
          className="block active:scale-[0.99] transition-transform">
          <Row locked={false} bg="#EBF5F3" iconColor={BRAND.primary} icon={driveIcon}
            title="ดาวน์โหลดชีทสรุป" sub="เนื้อหา 7 เรื่อง ~500 หน้า (Google Drive)" textColor={BRAND.primary} />
        </a>
      ))}

      {lineOpenChat && (locked ? (
        <Row locked bg="#EAF7EE" iconColor="#06C755" icon={<LineMark />}
          title="กลุ่ม LINE ผู้เรียน" sub="ถาม-ตอบ + อัปเดตข่าวสอบ" textColor="#067A38" />
      ) : (
        <a href={lineOpenChat} target="_blank" rel="noopener noreferrer"
          className="block active:scale-[0.99] transition-transform">
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "#EAF7EE" }}>
            <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: "#06C755" }}>
              <LineMark />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold" style={{ color: "#067A38" }}>เข้ากลุ่ม LINE ผู้เรียน</p>
              <p className="text-[11.5px]" style={{ color: "#3B9E63" }}>ถาม-ตอบ + อัปเดตข่าวสอบกับเพื่อน ๆ</p>
            </div>
            <ChevronOrLock locked={false} />
          </div>
        </a>
      ))}

      {/* CTA ปลดล็อก */}
      {!hideCta && lock === "upgrade" && (
        <Link href="/checkout/upgrade"
          className="btn-primary w-full py-3 text-[14px] flex items-center justify-center gap-1.5 mt-1">
          อัปเกรด +฿{PRICING.upgradePrice} เพื่อปลดล็อก
        </Link>
      )}
      {!hideCta && lock === "full" && (
        <Link href="/checkout/full"
          className="btn-primary w-full py-3 text-[14px] flex items-center justify-center gap-1.5 mt-1">
          รวมในคอร์สเต็ม ฿{PRICING.full.price}
        </Link>
      )}
    </>
  );

  return (
    <div className={compact ? "space-y-2.5" : "bg-white rounded-2xl p-4 space-y-2.5"}
      style={compact ? undefined : { border: `1px solid ${locked ? "#EBEBEA" : "#C3E5DE"}` }}>
      {body}
    </div>
  );
}
