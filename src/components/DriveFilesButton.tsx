"use client";
/**
 * DriveFilesButton — ปุ่มดาวน์โหลดชีท/ไฟล์เรียนของสนาม (Google Drive)
 *
 * ลิงก์ไม่ฝังใน HTML — ขอจาก /api/line/[field] (endpoint เดียวกับปุ่ม LINE,
 * เช็คสิทธิ์เจ้าของสนามฝั่ง server) · ยังไม่มีลิงก์ = ปุ่มซ่อนตัวเอง
 * พอ Aj วางลิงก์ใน line-groups.server.ts ปุ่มโผล่เองทุกจุดที่วางไว้
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function DriveFilesButton({
  field, label = "ดาวน์โหลดชีท / ไฟล์เรียน", className = "",
}: { field: string; label?: string; className?: string }) {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setUrl(null); return; }
    let cancelled = false;
    user.getIdToken()
      .then((t) => fetch(`/api/line/${field}`, { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setUrl(d?.driveUrl ?? null); })
      .catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [user, field]);

  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`w-full py-3.5 rounded-xl text-[15px] font-bold
                  flex items-center justify-center gap-2.5
                  active:scale-[0.98] transition-all duration-150 ${className}`}
      style={{
        background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
        color: "#7C2D12",
        boxShadow: "0 4px 14px -4px rgba(245,158,11,0.45)",
      }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </a>
  );
}
