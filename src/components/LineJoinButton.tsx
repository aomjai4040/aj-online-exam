"use client";
/**
 * LineJoinButton — ปุ่มเข้ากลุ่ม LINE ของสนามที่ซื้อแล้ว
 *
 * ลิงก์+รหัสไม่ฝังใน HTML — โหลดจาก /api/line/[field] (เช็คสิทธิ์ฝั่ง server)
 * ห้องแบบต้องกรอกรหัสอนุมัติ: รหัสโชว์ใต้ปุ่มพร้อมปุ่มคัดลอก (Aj 2026-08-16)
 * — LINE จะถามรหัสตอนกดเข้าร่วม น้องคัดลอกจากตรงนี้ไปวางได้เลย
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface LineInfo { url: string; joinCode: string | null }

export default function LineJoinButton({
  field, label = "เข้ากลุ่ม LINE คอร์ส", className = "",
}: { field: string; label?: string; className?: string }) {
  const { user } = useAuth();
  const [info,   setInfo]   = useState<LineInfo | null>(null);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState("");
  const [copied, setCopied] = useState(false);

  async function fetchInfo(): Promise<LineInfo | null> {
    if (!user) return null;
    const token = await user.getIdToken();
    const res = await fetch(`/api/line/${field}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(res.status === 403
        ? "ปุ่มนี้สำหรับผู้ที่สมัครคอร์สแล้วเท่านั้น"
        : "ขอลิงก์ไม่สำเร็จ ลองอีกครั้งนะคะ");
    }
    const d = await res.json();
    return { url: d.url, joinCode: d.joinCode ?? null };
  }

  // โหลดตอน mount เพื่อให้รหัสโชว์ใต้ปุ่มเลย (component นี้ถูกวางเฉพาะจุดของคนมีสิทธิ์)
  useEffect(() => {
    let cancelled = false;
    fetchInfo()
      .then((i) => { if (!cancelled) setInfo(i); })
      .catch(() => {}); // เงียบไว้ — ถ้าพลาดค่อย fetch ใหม่ตอนกด
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, field]);

  async function join() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const i = info ?? await fetchInfo();
      if (!i) return;
      setInfo(i);
      window.location.href = i.url; // เปิดแอป LINE / หน้าเข้าร่วม OpenChat
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ขอลิงก์ไม่สำเร็จ ลองอีกครั้งนะคะ");
    } finally { setBusy(false); }
  }

  function copyCode() {
    if (!info?.joinCode) return;
    navigator.clipboard.writeText(info.joinCode)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
      .catch(() => {});
  }

  return (
    <div className={className}>
      <button onClick={join} disabled={busy}
        className="w-full py-3.5 rounded-xl text-[15px] font-bold text-white
                   flex items-center justify-center gap-2.5
                   active:scale-[0.98] transition-all duration-150 disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #07C160 0%, #06AD56 100%)",
          boxShadow: "0 4px 14px -4px rgba(7,193,96,0.5)",
        }}>
        {/* โลโก้ LINE แบบเส้น (วาดเอง — ไม่ดึงไฟล์นอก) */}
        <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
          <path d="M12 3C6.48 3 2 6.64 2 11.13c0 4.03 3.58 7.4 8.41 8.04.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.01.89.55 1.09-.46 5.87-3.46 8.01-5.92C21.62 14.4 22 12.83 22 11.13 22 6.64 17.52 3 12 3z" />
        </svg>
        {busy ? "กำลังพาเข้ากลุ่ม…" : label}
      </button>

      {/* รหัสเข้าห้อง — โชว์เฉพาะเมื่อ server ยืนยันสิทธิ์แล้ว */}
      {info?.joinCode && (
        <button onClick={copyCode} type="button"
          className="w-full mt-2 rounded-xl px-4 py-2.5 text-left
                     active:scale-[0.99] transition-transform"
          style={{ backgroundColor: "#F0FDF4", border: "1.5px dashed #86EFAC" }}>
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[11.5px] font-bold" style={{ color: "#15803D" }}>
                รหัสเข้ากลุ่ม (LINE จะถามตอนกดเข้าร่วม)
              </span>
              <span className="block text-[20px] font-extrabold tracking-[0.2em]"
                style={{ color: "#166534" }}>
                {info.joinCode}
              </span>
            </span>
            <span className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
              style={{ backgroundColor: copied ? "#15803D" : "white",
                       color: copied ? "white" : "#15803D",
                       border: "1px solid #86EFAC" }}>
              {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
            </span>
          </span>
        </button>
      )}

      {err && (
        <p className="text-[12.5px] text-center mt-2" style={{ color: "#DC2626" }}>{err}</p>
      )}
    </div>
  );
}
