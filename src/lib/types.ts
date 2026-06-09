// ─── Subject categories (7 fixed values) ─────────────────────────────────────

export const SUBJECTS = [
  { code: "BASIC",    label: "ความรู้ความสามารถพื้นฐานด้านสาธารณสุข" },
  { code: "APPLIED",  label: "ความรู้ความสามารถ ทักษะ สมรรถนะ การประยุกต์ความรู้ด้านสาธารณสุข" },
  { code: "POLICY",   label: "ความรู้เกี่ยวกับนโยบายของรัฐด้านการสาธารณสุข" },
  { code: "CURRENT",  label: "ความรู้เกี่ยวกับสถานการณ์ปัจจุบันของระบบสาธารณสุขและสุขภาพ" },
  { code: "REFORM",   label: "ความรู้เกี่ยวกับแผนการปฏิรูปประเทศด้านสาธารณสุข" },
  { code: "LAWIT",    label: "ความรู้เกี่ยวกับการใช้งานคอมพิวเตอร์และกฎหมายที่เกี่ยวข้อง" },
  { code: "MOPH",     label: "ความรู้เกี่ยวกับวิสัยทัศน์ พันธกิจ โครงสร้าง อำนาจหน้าที่ ภารกิจ นโยบายและยุทธศาสตร์ของ สป.สธ. และกระทรวงสาธารณสุข" },
] as const;

export type SubjectCode = typeof SUBJECTS[number]["code"];

export function getSubjectLabel(code: string): string {
  const found = SUBJECTS.find(s => s.code === code);
  return found ? found.label : code; // fallback for legacy data
}

// Short display names for filter chips (อ่านง่ายบนมือถือ)
export const SUBJECT_DISPLAY: Record<string, string> = {
  BASIC:   "พื้นฐาน",
  APPLIED: "ประยุกต์",
  POLICY:  "นโยบาย",
  CURRENT: "สถานการณ์",
  REFORM:  "ปฏิรูป",
  LAWIT:   "กฎหมาย/IT",
  MOPH:    "กระทรวง",
};

// Legacy Thai subject names → new subject codes (backward compat)
export const LEGACY_SUBJECT_MAP: Record<string, string> = {
  "ระบาดวิทยา":         "BASIC",
  "อนามัยสิ่งแวดล้อม":  "BASIC",
  "กฎหมาย":             "LAWIT",
  "บริหารสาธารณสุข":    "APPLIED",
  "ชีวสถิติ":           "BASIC",
  "นโยบาย สป.สธ.":      "MOPH",
  "คณิตศาสตร์":         "BASIC",
  "ภาษาไทย":           "BASIC",
  "วิทยาศาสตร์":        "BASIC",
  "ภาษาอังกฤษ":        "BASIC",
};

/** แปลง subject (เก่าหรือใหม่) ให้เป็น code มาตรฐาน */
export function normalizeSubject(s: string): string {
  const upper = s?.toUpperCase?.() ?? "";
  if (SUBJECT_DISPLAY[upper]) return upper;
  return LEGACY_SUBJECT_MAP[s] ?? s;
}

export function getSubjectShort(code: string): string {
  return SUBJECT_DISPLAY[normalizeSubject(code)] ?? code;
}

export interface Exam {
  id: string;
  title: string;       // ชื่อชุดข้อสอบ (= set_name)
  description: string;
  subject: string;     // SubjectCode หรือ legacy string
  timeLimit: number;   // minutes, 0 = no limit
  questionCount: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  order: number;
  text: string;
  options: [string, string, string, string];
  correctAnswer: number; // 0–3
  explanation: string;
}

export interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  studentName: string;
  answers: number[]; // index = question order, value = chosen option (0–3), -1 = skipped
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent: number; // seconds
  submittedAt: Date;
}

export interface QuestionForm {
  text: string;
  options: [string, string, string, string];
  correctAnswer: number;
  explanation: string;
}

export interface ExamForm {
  title: string;
  description: string;
  subject: string;
  timeLimit: number;
  isPublished: boolean;
  questions: QuestionForm[];
}
