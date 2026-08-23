"use client";
/**
 * CourseQuickLinks — ลิงก์ด่วนของคอร์ส (กลุ่ม LINE · ชีท/ไฟล์เรียน) แบบ "ชิปแถวเดียว"
 * (Aj 2026-08-23 แบบ A: การ์ด LINE ใหญ่+รหัสตัวโตเคยโผล่ทุกครั้ง ทั้งที่เข้ากลุ่มแล้ว)
 *
 *   น้องใหม่ (เปิดสิทธิ์ ≤ NEW_DAYS วัน และยังไม่กด "เข้ากลุ่มแล้ว")
 *       → การ์ดเต็มใบ 1 ช่วง: ปุ่มเข้ากลุ่ม + รหัส + ปุ่ม "เข้ากลุ่มแล้ว ✓"
 *   คนอื่น → ชิป [💬 กลุ่ม LINE] [📂 ชีท/ไฟล์เรียน] — กด LINE แล้วค่อยเปิดแผ่นล่าง
 *
 * สถานะ "เข้ากลุ่มแล้ว" เก็บที่ users/{uid}.lineJoined[field] (ติดกับบัญชี ไม่ใช่เครื่อง)
 */
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getUserCourses } from "@/lib/activation";
import { isDcdCourse } from "@/lib/access";
import type { ExamFieldKey } from "@/lib/exam-fields";
import LineJoinButton from "@/components/LineJoinButton";

const NEW_DAYS = 3;

const LineIcon = ({ className = "w-4 h-4", fill = "white" }: { className?: string; fill?: string }) => (
  <svg viewBox="0 0 24 24" fill={fill} className={className}>
    <path d="M12 3C6.48 3 2 6.64 2 11.13c0 4.03 3.58 7.4 8.41 8.04.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.01.89.55 1.09-.46 5.87-3.46 8.01-5.92C21.62 14.4 22 12.83 22 11.13 22 6.64 17.52 3 12 3z" />
  </svg>
);

/** ลิงก์ Drive เอกสารของสนาม (null = Aj ยังไม่วางลิงก์) — ใช้ทำการ์ดเมนู "เอกสาร" */
export function useDriveUrl(field: ExamFieldKey): string | null {
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
  return url;
}

/** แผ่นล่าง "เข้ากลุ่ม LINE" — เปิดจากการ์ดเมนู */
export function LineJoinSheet({ field, open, onClose }: { field: ExamFieldKey; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  if (!open) return null;
  const markJoined = () => {
    onClose();
    if (user) setDoc(doc(db, "users", user.uid), { lineJoined: { [field]: true } }, { merge: true }).catch(() => {});
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-3 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: "#E0DFDC" }} />
        <p className="text-[15px] font-bold text-gray-900 mb-0.5">กลุ่ม LINE คอร์ส {field === "dcd" ? "คร." : "สป.สธ."}</p>
        <p className="text-[12.5px] mb-3" style={{ color: "#A8A8A6" }}>
          ประกาศคลิปใหม่ · ถามพี่อ้อม · เฉพาะสมาชิกคอร์ส
        </p>
        <LineJoinButton field={field} label="เข้ากลุ่มเลย" />
        <button type="button" onClick={markJoined}
          className="w-full mt-2 py-2.5 rounded-xl text-[13px] font-semibold"
          style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
          ✓ เข้ากลุ่มแล้ว
        </button>
        <button type="button" onClick={onClose}
          className="w-full mt-2 py-2.5 rounded-xl text-[13px] font-semibold" style={{ color: "#6B7280" }}>
          ปิด
        </button>
      </div>
    </div>
  );
}

/** การ์ดต้อนรับน้องใหม่ (≤ NEW_DAYS วัน และยังไม่กด "เข้ากลุ่มแล้ว") — นอกนั้นไม่แสดงอะไร */
export default function CourseQuickLinks({ field }: { field: ExamFieldKey }) {
  const { user } = useAuth();
  const [joined,   setJoined]   = useState<boolean | null>(null); // null = ยังไม่รู้
  const [isNew,    setIsNew]    = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [courses, udoc] = await Promise.all([
        getUserCourses(user.uid).catch(() => []),
        getDoc(doc(db, "users", user.uid)).catch(() => null),
      ]);
      if (cancelled) return;
      const mine = courses.filter((c) => (isDcdCourse(c.courseId) ? "dcd" : "moph") === field);
      const firstAt = mine.length ? Math.min(...mine.map((c) => c.activatedAt.getTime())) : 0;
      setIsNew(firstAt > 0 && Date.now() - firstAt <= NEW_DAYS * 86_400_000);
      setJoined(Boolean(udoc?.data()?.lineJoined?.[field]));
    })();
    return () => { cancelled = true; };
  }, [user, field]);

  async function markJoined() {
    if (!user) return;
    setJoined(true);
    await setDoc(doc(db, "users", user.uid), { lineJoined: { [field]: true } }, { merge: true }).catch(() => {});
  }

  if (!user || joined === null) return null;

  // ── น้องใหม่ยังไม่เข้ากลุ่ม → การ์ดเต็มใบ ──
  if (isNew && !joined) {
    return (
      <div className="card-elev px-4 py-3.5 mb-4" style={{ border: "1.5px solid #86EFAC" }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #07C160, #06AD56)" }}>
            <LineIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-bold text-gray-900 leading-tight">ยินดีต้อนรับ 🎉 เข้ากลุ่ม LINE คอร์สก่อนเลย</p>
            <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>ประกาศคลิปใหม่ · ถามพี่อ้อม · เฉพาะสมาชิกคอร์ส</p>
          </div>
        </div>
        <LineJoinButton field={field} label="เข้ากลุ่มเลย" />
        <button type="button" onClick={markJoined}
          className="w-full mt-2 py-2.5 rounded-xl text-[13px] font-semibold"
          style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
          ✓ เข้ากลุ่มแล้ว — ซ่อนการ์ดนี้
        </button>
      </div>
    );
  }

  // เข้ากลุ่มแล้ว / เลย 3 วัน → ไม่แสดงอะไร (LINE + เอกสาร อยู่ในแผงเมนูหลักแทน)
  return null;
}
