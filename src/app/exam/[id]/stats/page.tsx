"use client";
/**
 * /exam/[id]/stats — สถิติของ "ชุดนี้" ต่อผู้ใช้ (น้องขอ 2026-08-27 ข้อ 4+5)
 *
 *   ① ทำไปกี่รอบ รอบละกี่คะแนน (กราฟแท่ง + ตาราง — ข้อมูลจาก users/{uid}/results
 *      ที่เก็บอยู่แล้วทุกครั้งที่ส่งข้อสอบ ย้อนหลังได้ทั้งหมด)
 *   ② ข้อที่เคยผิดของชุดนี้ อ่านโจทย์+เฉลย+คำอธิบายได้เลย ไม่ต้องเริ่มทำใหม่
 *      (จากคลัง Smart Review — ข้อที่เคยตอบถูกในโหมดทบทวนแล้วจะไม่โชว์ซ้ำ)
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import BottomNav from "@/components/BottomNav";
import { getExam } from "@/lib/firestore";
import { getExamAttempts, type UserResult } from "@/lib/user-firestore";
import { getWrongQuestions, type WrongQuestion } from "@/lib/smart-review";
import { BRAND } from "@/lib/subjects";

const OPTS = ["ก", "ข", "ค", "ง"] as const;
const PASS = 60;

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

function pctColor(p: number) {
  return p >= 80 ? "#15803D" : p >= PASS ? "#B45309" : "#DC2626";
}

export default function ExamStatsPage() {
  const { id } = useParams<{ id: string }>();
  const guard = useLoginGuard();
  const { user } = useAuth();

  const [title,    setTitle]    = useState("");
  const [attempts, setAttempts] = useState<UserResult[] | null>(null);
  const [wrongs,   setWrongs]   = useState<WrongQuestion[]>([]);
  const [openQ,    setOpenQ]    = useState<string | null>(null); // ข้อที่กางเฉลยอยู่

  useEffect(() => {
    if (guard !== "allowed" || !user) return;
    let cancelled = false;
    Promise.all([
      getExam(id).catch(() => null),
      getExamAttempts(user.uid, id).catch(() => []),
      // ดึงคลังข้อผิดมาเผื่อเยอะแล้วกรองเฉพาะชุดนี้
      getWrongQuestions(user.uid, 300).catch(() => []),
    ]).then(([exam, at, wr]) => {
      if (cancelled) return;
      setTitle(exam?.title ?? "ชุดข้อสอบ");
      setAttempts(at);
      setWrongs(wr.filter((w) => w.examId === id));
    });
    return () => { cancelled = true; };
  }, [guard, user, id]);

  if (guard !== "allowed" || attempts === null) return <AccessGuardSpinner />;

  const best   = attempts.length ? Math.max(...attempts.map((a) => a.percentage)) : 0;
  const latest = attempts.at(-1);
  const trend  = attempts.length >= 2
    ? attempts[attempts.length - 1].percentage - attempts[attempts.length - 2].percentage
    : null;

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <div className="max-w-2xl mx-auto px-5 pt-5">

        {/* หัว */}
        <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: "#A8A8A6" }}>
          สถิติของฉัน · ชุดนี้
        </p>
        <h1 className="text-[19px] font-bold text-gray-900 leading-snug mb-4">{title}</h1>

        {attempts.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px dashed #E0DFDC" }}>
            <div className="text-4xl mb-3">📊</div>
            <p className="text-[15px] font-semibold text-gray-800 mb-1">ยังไม่เคยทำชุดนี้</p>
            <p className="text-[13px] mb-5" style={{ color: "#A8A8A6" }}>ทำครั้งแรกแล้วสถิติจะขึ้นที่นี่</p>
            <Link href={`/exam/${id}`} className="btn-primary inline-block px-6 py-3 text-[14px]">
              เริ่มทำข้อสอบ
            </Link>
          </div>
        ) : (
          <>
            {/* สรุปตัวเลข */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { v: `${attempts.length}`, l: "รอบที่ทำ", c: BRAND.primary },
                { v: `${best}%`, l: "ดีที่สุด", c: pctColor(best) },
                { v: trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`,
                  l: "เทียบรอบก่อน", c: trend === null ? "#A8A8A6" : trend >= 0 ? "#15803D" : "#DC2626" },
              ].map((s) => (
                <div key={s.l} className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #EBEBEA" }}>
                  <div className="text-[22px] font-extrabold leading-none mb-1" style={{ color: s.c }}>{s.v}</div>
                  <div className="text-[12px] font-semibold" style={{ color: "#6B7280" }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* กราฟพัฒนาการ */}
            <div className="bg-white rounded-2xl p-5 mb-4" style={{ border: "1px solid #EBEBEA" }}>
              <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                พัฒนาการรายรอบ
              </p>
              <div className="flex items-end gap-1.5" style={{ height: 120 }}>
                {attempts.slice(-12).map((a, i) => (
                  <div key={a.id ?? i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10.5px] font-bold" style={{ color: pctColor(a.percentage) }}>
                      {a.percentage}
                    </span>
                    <div className="w-full rounded-t-md relative" style={{ flex: 1 }}>
                      <div className="absolute bottom-0 left-0 right-0 rounded-t-md"
                        style={{ height: `${Math.max(a.percentage, 3)}%`, backgroundColor: pctColor(a.percentage) }} />
                    </div>
                    <span className="text-[9.5px] leading-tight text-center" style={{ color: "#C4C4C0" }}>
                      รอบ {attempts.length - Math.min(attempts.length, 12) + i + 1}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: "#C4C4C0" }}>
                เส้นเกณฑ์ผ่าน {PASS}% · โชว์ 12 รอบล่าสุด
              </p>
            </div>

            {/* ตารางรายรอบ */}
            <div className="bg-white rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid #EBEBEA" }}>
              {[...attempts].reverse().map((a, i) => (
                <div key={a.id ?? i} className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderTop: i > 0 ? "1px solid #F3F2F0" : "none" }}>
                  <span className="w-12 text-[12px] font-bold flex-shrink-0" style={{ color: "#A8A8A6" }}>
                    รอบ {attempts.length - i}
                  </span>
                  <span className="flex-1 text-[12.5px]" style={{ color: "#6B7280" }}>{fmtDate(a.doneAt)}</span>
                  <span className="text-[12.5px]" style={{ color: "#A8A8A6" }}>{a.score}/{a.totalQuestions}</span>
                  <span className="w-12 text-right text-[14px] font-extrabold" style={{ color: pctColor(a.percentage) }}>
                    {a.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ข้อที่เคยผิดของชุดนี้ ── */}
        <div className="section-head mb-1 mt-6">
          <h2 className="text-[16px] font-bold text-gray-900">
            ข้อที่เคยผิดในชุดนี้ {wrongs.length > 0 && `(${wrongs.length} ข้อ)`}
          </h2>
        </div>
        <p className="text-[12px] mb-3" style={{ color: "#A8A8A6" }}>
          อ่านโจทย์+เฉลยได้เลย ไม่ต้องเริ่มทำใหม่ · ข้อที่ตอบถูกในเมนู &quot;ทบทวน&quot; แล้วจะหายจากลิสต์นี้
        </p>

        {wrongs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center mb-4" style={{ border: "1px dashed #E0DFDC" }}>
            <p className="text-[14px] font-semibold text-gray-800">
              {attempts.length === 0 ? "ทำข้อสอบก่อน ข้อที่ผิดจะมารออยู่ที่นี่" : "🎉 ไม่มีข้อค้าง — เคลียร์หมดแล้ว"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 mb-4">
            {wrongs.map((w, qi) => {
              const open = openQ === w.id;
              return (
                <div key={w.id} className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #EBEBEA" }}>
                  <button type="button" onClick={() => setOpenQ(open ? null : w.id)}
                    className="w-full text-left px-4 py-3 flex items-start gap-2.5">
                    <span className="text-[12px] font-bold flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }}>
                      {qi + 1}.
                    </span>
                    <span className={`flex-1 text-[13.5px] leading-relaxed text-gray-800 font-exam ${open ? "" : "line-clamp-2"}`}>
                      {w.text}
                    </span>
                    <span className="text-[12px] flex-shrink-0 mt-0.5" style={{ color: "#C4C4C0" }}>
                      {open ? "ปิด ▴" : "เฉลย ▾"}
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4">
                      <div className="space-y-1.5 mb-3">
                        {w.options.map((o, oi) => (
                          <div key={oi} className="flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] font-exam"
                            style={oi === w.correctAnswer
                              ? { backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", fontWeight: 600 }
                              : { backgroundColor: "#FAFAF8", color: "#6B7280" }}>
                            <span className="font-bold flex-shrink-0">{OPTS[oi]}.</span>
                            <span>{o}</span>
                            {oi === w.correctAnswer && <span className="ml-auto flex-shrink-0">✓</span>}
                          </div>
                        ))}
                      </div>
                      {w.explanation && (
                        <p className="text-[12.5px] leading-relaxed rounded-xl px-3.5 py-2.5 font-exam"
                          style={{ backgroundColor: "#EBF5F3", color: "#0B4F48" }}>
                          💡 {w.explanation}
                        </p>
                      )}
                      <p className="text-[11px] mt-2" style={{ color: "#C4C4C0" }}>
                        ผิดมาแล้ว {w.wrongCount} ครั้ง · อยากให้หายจากลิสต์ ไปตอบให้ถูกที่เมนู{" "}
                        <Link href="/review" className="underline">ทบทวน</Link>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ปุ่มท้าย */}
        <div className="flex gap-3 mt-5">
          <Link href={`/exam/${id}`} className="btn-primary flex-1 py-3.5 text-[14.5px] text-center">
            {attempts.length > 0 ? "ทำอีกรอบ" : "เริ่มทำข้อสอบ"}
          </Link>
          <Link href="/exams" className="btn-secondary flex-1 py-3.5 text-[14.5px] text-center">
            คลังข้อสอบ
          </Link>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
