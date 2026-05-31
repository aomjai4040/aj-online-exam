"use client";
import { createExam } from "@/lib/firestore";
import type { ExamForm } from "@/lib/types";
import ExamEditor from "@/components/ExamEditor";

export default function NewExamPage() {
  async function handleSave(form: ExamForm) {
    await createExam(form);
  }

  return <ExamEditor title="สร้างข้อสอบใหม่" onSave={handleSave} />;
}
