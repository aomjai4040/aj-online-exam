"use client";
/**
 * HomeCards — การ์ดย่อยที่เคยอยู่หน้าแรก ย้ายมารวมที่นี่เพื่อใช้ใน "หน้าคอร์ส"
 * (/course/[field]) ตามโครงใหม่ของ Aj 2026-08-21: หน้าแรกไม่มีเมนู
 * เมนู/การ์ดทั้งหมดอยู่ในหน้าคอร์สของแต่ละสนาม
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { subjectColor as dotColor, BRAND } from "@/lib/subjects";
import { getSubjectShort } from "@/lib/types";
import { COURSE_RESOURCES } from "@/lib/pricing";
import { FEEDBACK_REWARD } from "@/lib/feedback-types";
import { getUserAccess } from "@/lib/access";
import { daysToExam } from "@/lib/exam-config";
import LineJoinButton from "@/components/LineJoinButton";
import DriveFilesButton from "@/components/DriveFilesButton";

function isNewExam(exam: Exam): boolean {
  if (!exam.createdAt) return false;
  return Date.now() - exam.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;
}

/** Latest-exam card in the horizontal carousel */
export function LatestCard({ exam }: { exam: Exam }) {
  const color = dotColor(exam.subject);
  const isNew = isNewExam(exam);
  return (
    <Link
      href={`/exam/${exam.id}`}
      className="card-elev card-elev-hover flex-shrink-0 w-[172px] p-4
                 flex flex-col active:scale-[0.97]"
    >
      <div className="w-8 h-[3px] rounded-full mb-4" style={{ backgroundColor: color }} />
      <p className="font-semibold text-[16px] text-gray-900 leading-snug line-clamp-2 flex-1 mb-3">
        {exam.title}
      </p>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[14px]" style={{ color: "#A8A8A6" }}>
          {exam.questionCount}&nbsp;ข้อ
        </span>
        {isNew ? (
          <span
            className="text-[12px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}
          >
            ใหม่
          </span>
        ) : (
          <span className="text-[14px]" style={{ color }}>
            {getSubjectShort(exam.subject)}
          </span>
        )}
      </div>
    </Link>
  );
}

/** Skeleton for LatestCard */
export function LatestSkeleton() {
  return (
    <div className="card-elev flex-shrink-0 w-[158px] p-4 animate-pulse">
      <div className="w-7 h-[3px] rounded-full bg-gray-100 mb-3.5" />
      <div className="h-3.5 bg-gray-100 rounded-full w-full mb-1.5" />
      <div className="h-3.5 bg-gray-100 rounded-full w-4/5 mb-4" />
      <div className="flex justify-between">
        <div className="h-2.5 w-10 bg-gray-100 rounded-full" />
        <div className="h-2.5 w-8 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

/** การ์ด "ชีททวนก่อนสอบ" — สมาชิก สป.สธ. ทุกแพ็ก (ซ่อนเองหลังวันสอบ) */
export function PreExamSheetCard() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!user || COURSE_RESOURCES.preExamSheet === "" || daysToExam() < 0) {
      setShow(false);
      return;
    }
    getUserAccess(user.uid).then((a) => setShow(a.hasAny)).catch(() => setShow(false));
  }, [user]);
  if (!show) return null;
  return (
    <a href={COURSE_RESOURCES.preExamSheet} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-4
                 active:scale-[0.98] transition-transform"
      style={{ backgroundColor: "#FDF6E9", border: "2px solid #FCD34D" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "#F59E0B" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold leading-tight" style={{ color: "#7C2D12" }}>
          ชีททวนก่อนสอบ ✨ มาแล้ว
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "#B45309" }}>
          สรุป 21 หัวข้อ รวม 34 หน้า — กดดาวน์โหลดได้เลย
        </p>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="#B45309"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </a>
  );
}

/** การ์ดเข้ากลุ่ม LINE คอร์ส คร. — เฉพาะคนที่ซื้อแล้ว
 *  ลิงก์ไม่อยู่ในหน้า — LineJoinButton ขอจาก server ตอนกดเท่านั้น */
export function DcdLineCard() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!user) { setShow(false); return; }
    getUserAccess(user.uid).then((a) => setShow(a.hasDcd)).catch(() => setShow(false));
  }, [user]);
  if (!show) return null;
  return (
    <div className="card-elev px-4 py-3.5 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #07C160, #06AD56)" }}>
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
            <path d="M12 3C6.48 3 2 6.64 2 11.13c0 4.03 3.58 7.4 8.41 8.04.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.01.89.55 1.09-.46 5.87-3.46 8.01-5.92C21.62 14.4 22 12.83 22 11.13 22 6.64 17.52 3 12 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-bold text-gray-900 leading-tight">กลุ่ม LINE คอร์ส คร.</p>
          <p className="text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>
            ประกาศคลิปใหม่ · ถามพี่อ้อม · เฉพาะสมาชิกคอร์ส
          </p>
        </div>
      </div>
      <LineJoinButton field="dcd" label="เข้ากลุ่มเลย" />
      <DriveFilesButton field="dcd" className="mt-2" />
    </div>
  );
}

/** การ์ดแบบประเมิน / โค้ดส่วนลด — สมาชิกเท่านั้น มี 3 สถานะ
 *  ยังไม่ตอบ → ชวนทำ · ตอบแล้วโค้ดยังไม่ใช้ → โชว์โค้ด · ใช้แล้ว → ซ่อน */
export function FeedbackCard() {
  const { user } = useAuth();
  const [state, setState] = useState<
    { s: "hide" } | { s: "invite" } | { s: "code"; code: string }
  >({ s: "hide" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) { setState({ s: "hide" }); return; }
    let cancelled = false;
    user.getIdToken()
      .then((t) => fetch("/api/feedback", { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (d.done === false)               setState({ s: "invite" });
        else if (d.code && !d.used)         setState({ s: "code", code: d.code });
        else                                setState({ s: "hide" });
      })
      .catch(() => { if (!cancelled) setState({ s: "hide" }); });
    return () => { cancelled = true; };
  }, [user]);

  if (state.s === "hide") return null;

  if (state.s === "code") {
    return (
      <div className="card-elev px-4 py-3.5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #FBBF24, #F59E0B)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold" style={{ color: "#B45309" }}>
              โค้ดส่วนลด ฿{FEEDBACK_REWARD.amount} ของคุณ (ยังไม่ได้ใช้)
            </p>
            <p className="text-[19px] font-extrabold tracking-widest leading-tight"
              style={{ color: "#7C2D12" }}>
              {state.code}
            </p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(state.code)
                .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
                .catch(() => {});
            }}
            className="text-[12.5px] font-bold px-3 py-2 rounded-lg flex-shrink-0"
            style={{ backgroundColor: copied ? "#15803D" : "#FDF6E9",
                     color: copied ? "white" : "#B45309" }}>
            {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
          </button>
        </div>
        <p className="text-[11.5px] mt-2" style={{ color: "#A8A8A6" }}>
          กรอกตอนสมัครคอร์ส · ใช้ได้ถึง {FEEDBACK_REWARD.expiresLabel} · ไม่ต้องจด โค้ดอยู่ตรงนี้ตลอด
        </p>
      </div>
    );
  }

  return (
    <Link href="/feedback"
      className="card-elev card-elev-hover flex items-center gap-3 px-4 py-3.5 mb-4
                 active:scale-[0.98]">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #FBBF24, #F59E0B)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold leading-tight" style={{ color: "#7C2D12" }}>
          ช่วยประเมินการสอน · รับโค้ดลด ฿{FEEDBACK_REWARD.amount}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "#B45309" }}>
          2 นาที · ตอบแบบไม่ระบุตัวตน · ใช้กับคอร์สไหนก็ได้ที่เปิดต่อจากนี้
        </p>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="#B45309"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

/** การ์ด "ช่วยกันเก็บข้อสอบ" — โผล่หลังวันสอบ สป.สธ. 14 วัน */
export function RecallCard() {
  const { user } = useAuth();
  const d = daysToExam();
  if (!user || d > 0 || d < -14) return null;
  const left = 14 + d;
  return (
    <Link href="/recall"
      className="card-elev card-elev-hover flex items-center gap-3 px-4 py-3.5 mb-4
                 active:scale-[0.98]"
      style={{ borderLeft: "4px solid #0B6E65" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: BRAND.primary }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold leading-tight" style={{ color: "#0B4F48" }}>
          ช่วยกันเก็บข้อสอบ 69 🙏
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: BRAND.primary }}>
          จำข้อไหนได้ช่วยเติมหน่อย · เหลือเวลาอีก {left} วันก่อนความจำเลือน
        </p>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}
