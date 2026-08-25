"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getExam, getQuestions, updateExam } from "@/lib/firestore";
import type { ExamForm, Question } from "@/lib/types";
import ExamEditor from "@/components/ExamEditor";

export default function EditExamPage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<ExamForm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getExam(id), getQuestions(id)]).then(([exam, qs]) => {
      if (exam) {
        setInitial({
          title: exam.title,
          description: exam.description,
          subject: exam.subject,
          timeLimit: exam.timeLimit,
          isPublished: exam.isPublished,
          isFree: exam.isFree ?? false,
          // ⚠ ทุกฟิลด์ของชุดต้องส่งเข้า initial ครบ — ฟิลด์ที่ขาดจะถูกเขียนทับ
          // เป็นค่า default ตอนกดบันทึก (บั๊ก Aj 2026-08-25: ธง Mock หลุดทุกครั้งที่เซฟ)
          isMock: exam.isMock ?? false,
          packageId: exam.packageId,
          questions: qs.map((q: Question) => ({
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            tags: q.tags, // แท็กข้อ (ประเภท/บริบทหน่วยงาน ฯลฯ) — ไม่ส่ง = โดนลบตอนเซฟ
          })),
        });
      }
      setLoading(false);
    });
  }, [id]);

  async function handleSave(form: ExamForm) {
    await updateExam(id, form);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: "#C3E5DE", borderTopColor: "#0B6E65" }} />
      </div>
    );
  }

  if (!initial) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>ไม่พบชุดข้อสอบนี้</p>
      </div>
    );
  }

  return <ExamEditor title="แก้ไขข้อสอบ" initial={initial} onSave={handleSave} />;
}
