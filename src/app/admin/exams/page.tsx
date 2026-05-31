"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllExams, deleteExam, togglePublish } from "@/lib/firestore";
import type { Exam } from "@/lib/types";

export default function AdminExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    getAllExams().then(setExams).finally(() => setLoading(false));
  }

  async function handleDelete(exam: Exam) {
    if (!confirm(`ลบ "${exam.title}" และข้อสอบทั้งหมดออกจากระบบ?`)) return;
    await deleteExam(exam.id);
    setExams((prev) => prev.filter((e) => e.id !== exam.id));
  }

  async function handleToggle(exam: Exam) {
    await togglePublish(exam.id, !exam.isPublished);
    setExams((prev) =>
      prev.map((e) => (e.id === exam.id ? { ...e, isPublished: !e.isPublished } : e))
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">จัดการข้อสอบ</h1>
        <Link href="/admin/exams/new" className="btn-primary">
          + สร้างข้อสอบใหม่
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: "#C3E5DE", borderTopColor: "#0B6E65" }} />
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p>ยังไม่มีชุดข้อสอบในระบบ</p>
          <Link href="/admin/exams/new" className="btn-primary mt-4 inline-block">
            + สร้างข้อสอบใหม่
          </Link>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {exams.map((exam) => (
            <div key={exam.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 truncate">{exam.title}</p>
                  <span
                    className={`badge text-xs ${
                      exam.isPublished
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {exam.isPublished ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {exam.subject} · {exam.questionCount} ข้อ
                  {exam.timeLimit > 0 ? ` · ${exam.timeLimit} นาที` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggle(exam)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    exam.isPublished
                      ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                      : "border-green-300 text-green-700 hover:bg-green-50"
                  }`}
                >
                  {exam.isPublished ? "ซ่อน" : "เผยแพร่"}
                </button>
                <Link
                  href={`/admin/exams/${exam.id}/edit`}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  แก้ไข
                </Link>
                <button
                  onClick={() => handleDelete(exam)}
                  className="btn-danger text-xs py-1.5 px-3"
                >
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
