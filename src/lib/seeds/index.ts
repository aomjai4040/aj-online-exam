import type { ExamForm } from "@/lib/types";
import { EPI_SET2 } from "./epi-set2";

// ─── Seed catalog ─────────────────────────────────────────────────────────────
// เพิ่ม seed ชุดใหม่ที่นี่ แล้วจะปรากฏในหน้า Admin › Seed อัตโนมัติ

export interface SeedEntry {
  id:          string;   // unique key (ไม่ซ้ำ ใช้ match กับ Firestore title)
  label:       string;   // ชื่อที่แสดงในหน้า seed
  subject:     string;
  questionCount: number;
  form:        ExamForm;
}

export const SEEDS: SeedEntry[] = [
  {
    id:            "epi-set2",
    label:         "ระบาดวิทยา ชุดที่ 2 (สถานการณ์)",
    subject:       "ระบาดวิทยา",
    questionCount: EPI_SET2.questions.length,
    form:          EPI_SET2,
  },
];
