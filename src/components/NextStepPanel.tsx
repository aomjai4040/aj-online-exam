"use client";
/**
 * NextStepPanel — "ทำต่อ" ใต้คลิปที่กำลังดู (Aj ข้อ 3: ปิดลูปการเรียน)
 *
 * ปัญหาจากผลประเมิน: ข้อสอบในแอปได้ 90% และเป็นส่วนเดียวที่ "ไม่ได้ใช้" = 0 คน
 * แปลว่าทุกคนใช้และชอบ — แต่มันไม่ได้อยู่ในเส้นทางการเรียน ต้องเดินไปหาเอง
 * และ 28% บอกว่าไม่รู้ว่าควรทำอะไรต่อ
 *
 * แก้: ดูคลิปจบแล้วมีทางเดินต่อชัดเจนในที่เดียว
 *   ① อ่านชีทสรุป → ② ทำข้อสอบท้ายบทนี้ → ③ คลิปถัดไป
 *
 * ข้อสอบท้ายบทหาเองจากชื่อบทของคลิป (chapter → subject → ชุดข้อสอบหมวดนั้น)
 * ไม่ต้องผูกข้อมูลเพิ่ม — ใช้ของที่มีอยู่แล้ว
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublishedExams } from "@/lib/firestore";
import { normalizeSubject, isMockExam, type Exam } from "@/lib/types";
import { isFinalLapExam } from "@/lib/final-review";
import { subjectForChapter } from "@/lib/curriculum";
import { COURSE_RESOURCES } from "@/lib/pricing";
import { BRAND } from "@/lib/subjects";

interface Props {
  /** ชื่อบทของคลิปที่กำลังดู เช่น "บทที่ 1 · EP.3 ..." */
  chapter:      string;
  /** คลิปถัดไปในลำดับ (ถ้ามี) */
  nextTitle?:   string;
  onNext?:      () => void;
  /** ดูคลิปนี้จบแล้วหรือยัง — จบแล้วเน้นปุ่มข้อสอบให้เด่นขึ้น */
  watched?:     boolean;
  showSheet?:   boolean;
}

function Step({
  n, title, sub, href, onClick, accent, external,
}: {
  n: number; title: string; sub?: string;
  href?: string; onClick?: () => void; accent: boolean; external?: boolean;
}) {
  const inner = (
    <>
      <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                       text-[12.5px] font-bold"
        style={accent
          ? { backgroundColor: BRAND.primary, color: "white" }
          : { backgroundColor: "#EBF5F3", color: BRAND.primary }}>
        {n}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold text-gray-900 truncate">{title}</span>
        {sub && <span className="block text-[12px] mt-0.5" style={{ color: "#A8A8A6" }}>{sub}</span>}
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="#C4C4C0" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </>
  );

  const cls = "w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-left active:scale-[0.99] transition-transform";
  const style = {
    backgroundColor: accent ? "#F5FAF9" : "#FAFAF8",
    border: `1px solid ${accent ? "#C3E5DE" : "#EBEBEA"}`,
  };

  if (href) {
    return external
      ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{inner}</a>
      : <Link href={href} className={cls} style={style}>{inner}</Link>;
  }
  return <button onClick={onClick} className={cls} style={style}>{inner}</button>;
}

export default function NextStepPanel({
  chapter, nextTitle, onNext, watched, showSheet = true,
}: Props) {
  const [exam, setExam] = useState<Exam | null>(null);
  const subject = subjectForChapter(chapter);

  // ชุดข้อสอบของหมวดเดียวกับบทนี้ — เลือกชุดแรกที่เผยแพร่
  useEffect(() => {
    if (!subject) { setExam(null); return; }
    let cancelled = false;
    getPublishedExams()
      .then((all) => {
        if (cancelled) return;
        const match = all
          .filter((e) => !isMockExam(e) && !isFinalLapExam(e))
          .filter((e) => normalizeSubject(e.subject) === subject)
          .sort((a, b) => a.title.localeCompare(b.title, "th"));
        setExam(match[0] ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [subject]);

  const hasSheet = showSheet && !!COURSE_RESOURCES.driveDocs;
  if (!hasSheet && !exam && !nextTitle) return null;

  let n = 0;
  return (
    <div className="card-elev px-4 py-4">
      <p className="text-[15.5px] font-bold text-gray-900 mb-0.5">
        {watched ? "ดูจบแล้ว — ทำต่อเลย" : "ทำต่อหลังดูคลิปนี้"}
      </p>
      <p className="text-[12.5px] mb-3" style={{ color: "#A8A8A6" }}>
        อ่านสรุป → ทำข้อสอบท้ายบท → ไปคลิปถัดไป
      </p>

      <div className="space-y-2">
        {hasSheet && (
          <Step n={++n} accent={false} external
            title="อ่านชีทสรุปของบทนี้"
            sub="เปิดโฟลเดอร์เอกสารคอร์ส"
            href={COURSE_RESOURCES.driveDocs} />
        )}

        {exam && (
          <Step n={++n} accent={!!watched}
            title={`ทำข้อสอบท้ายบท — ${exam.title}`}
            sub={`${exam.questionCount} ข้อ · วัดว่าเข้าใจบทนี้จริงไหม`}
            href={`/exam/${exam.id}`} />
        )}

        {nextTitle && onNext && (
          <Step n={++n} accent={false}
            title={`คลิปถัดไป — ${nextTitle}`}
            onClick={onNext} />
        )}
      </div>

      {!exam && subject && (
        <p className="text-[12px] mt-2.5" style={{ color: "#A8A8A6" }}>
          บทนี้ยังไม่มีชุดข้อสอบท้ายบท — พี่อ้อมกำลังทยอยเพิ่มให้
        </p>
      )}
    </div>
  );
}
