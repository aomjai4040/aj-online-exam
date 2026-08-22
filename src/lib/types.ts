import type { QuestionTags } from "./question-tags";

// ─── Subject categories ──────────────────────────────────────────────────────

export const SUBJECTS = [
  { code: "BASIC",    label: "ความรู้ความสามารถพื้นฐานด้านสาธารณสุข" },
  { code: "APPLIED",  label: "ความรู้ความสามารถ ทักษะ สมรรถนะ การประยุกต์ความรู้ด้านสาธารณสุข" },
  { code: "POLICY",   label: "ความรู้เกี่ยวกับนโยบายของรัฐด้านการสาธารณสุข" },
  { code: "CURRENT",  label: "ความรู้เกี่ยวกับสถานการณ์ปัจจุบันของระบบสาธารณสุขและสุขภาพ" },
  { code: "REFORM",   label: "ความรู้เกี่ยวกับแผนการปฏิรูปประเทศด้านสาธารณสุข" },
  { code: "LAWIT",    label: "ความรู้เกี่ยวกับการใช้งานคอมพิวเตอร์และกฎหมายที่เกี่ยวข้อง" },
  { code: "MOPH",     label: "ความรู้เกี่ยวกับวิสัยทัศน์ พันธกิจ โครงสร้าง อำนาจหน้าที่ ภารกิจ นโยบายและยุทธศาสตร์ของ สป.สธ. และกระทรวงสาธารณสุข" },
  { code: "MOCK",     label: "Mock Exam — ข้อสอบเสมือนจริง คละทุกหมวด (เข้าเมนู Mock อัตโนมัติ)" },
] as const;

export type SubjectCode = typeof SUBJECTS[number]["code"];

/** หมวดวิชาสนามกรมควบคุมโรค — ตามบท 1–9 ของคอร์ส คร. (DCD_SYLLABUS) + MOCK ใช้ร่วม
 *  (Aj 2026-08-21: import ข้อสอบ คร. ต้องมีหมวดของตัวเอง ไม่ใช้ชุด สป.สธ.) */
export const DCD_SUBJECTS = [
  { code: "DDC",     label: "ความรู้เกี่ยวกับกรมควบคุมโรค (วิสัยทัศน์ พันธกิจ โครงสร้าง ภารกิจ)" },
  { code: "LAWPH",   label: "พ.ร.บ.การสาธารณสุข พ.ศ. 2535 และที่แก้ไขเพิ่มเติม" },
  { code: "LAWALC",  label: "พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ พ.ศ. 2551 และ (ฉบับที่ 2) พ.ศ. 2568" },
  { code: "LAWCD",   label: "พ.ร.บ.โรคติดต่อ พ.ศ. 2558" },
  { code: "LAWTOB",  label: "พ.ร.บ.ควบคุมผลิตภัณฑ์ยาสูบ พ.ศ. 2560" },
  { code: "LAWOCC",  label: "พ.ร.บ.ควบคุมโรคจากการประกอบอาชีพและโรคจากสิ่งแวดล้อม พ.ศ. 2562" },
  { code: "EPI",     label: "หลักระบาดวิทยา หลักสถิติเบื้องต้น การรวบรวม วิเคราะห์ และนำเสนอข้อมูล" },
  { code: "DISEASE", label: "โรคติดต่อ โรคไม่ติดต่อ โรคจากอาชีพ/สิ่งแวดล้อม และการเฝ้าระวัง ป้องกัน สอบสวน ควบคุมโรค" },
  { code: "RISKCOM", label: "การสื่อสารความเสี่ยงด้านสุขภาพ" },
  { code: "MOCK",    label: "Mock Exam — ข้อสอบเสมือนจริง คละทุกหมวด (เข้าเมนู Mock อัตโนมัติ)" },
] as const;

/** หมวดทั้งหมดที่ระบบรู้จัก (ใช้ validate ตอน import) */
export const ALL_SUBJECTS: ReadonlyArray<{ code: string; label: string }> = [
  ...SUBJECTS, ...DCD_SUBJECTS.filter((s) => s.code !== "MOCK"),
];

/** หมวดของสนามนั้น — ไว้โชว์ตารางอ้างอิง/ชิปเลือกหมวด */
export function subjectsForField(field: "moph" | "dcd"): ReadonlyArray<{ code: string; label: string }> {
  return field === "dcd" ? DCD_SUBJECTS : SUBJECTS;
}

export function getSubjectLabel(code: string): string {
  const found = ALL_SUBJECTS.find(s => s.code === code);
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
  MOCK:    "เสมือนจริง",
  // สนาม คร.
  DDC:     "กรม คร.",
  LAWPH:   "พ.ร.บ.สาธารณสุข",
  LAWALC:  "แอลกอฮอล์",
  LAWCD:   "โรคติดต่อ",
  LAWTOB:  "ยาสูบ",
  LAWOCC:  "โรคจากอาชีพ",
  EPI:     "ระบาด/สถิติ",
  DISEASE: "ควบคุมโรค",
  RISKCOM: "สื่อสารความเสี่ยง",
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

/** ชุดนี้เป็น Mock Exam ไหม — เชื่อทั้งธง isMock และ subject=MOCK (กันธงหลุด) */
export function isMockExam(e: { isMock?: boolean; subject?: string }): boolean {
  return e.isMock === true || normalizeSubject(e.subject ?? "") === "MOCK";
}

export interface Exam {
  id: string;
  title: string;       // ชื่อชุดข้อสอบ (= set_name)
  description: string;
  subject: string;     // SubjectCode หรือ legacy string
  timeLimit: number;   // minutes, 0 = no limit
  questionCount: number;
  isPublished: boolean;
  isFree?: boolean;    // true = ทดลองทำฟรี ไม่ต้องมีสิทธิ์คอร์ส
  isMock?: boolean;    // true = Mock Exam (แสดงในเมนู Mock ไม่ปนคลังข้อสอบปกติ)
  packageId?: string;  // แพ็กเกจที่ชุดนี้สังกัด (per-package entitlement); undefined = ยังไม่ผูก (ใช้ legacy access)
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
  /** แท็ก (หัวข้อ/ประเภท/ความยาก/ที่มา/บริบทหน่วยงาน) — ดู lib/question-tags.ts
   *  optional เพราะข้อเก่า 2,000+ ข้อยังไม่มี ไม่ต้อง migrate */
  tags?: QuestionTags;
}

export interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  userId?: string;      // uid ผู้สอบ — ใช้นับคนไม่ซ้ำแม่นยำ (เก่ากว่านี้ไม่มี)
  userEmail?: string;   // อีเมลผู้สอบ — อ้างอิงตัวตน (studentName เป็นชื่อโชว์ที่ซ้ำได้)
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
  tags?: QuestionTags;
}

export interface ExamForm {
  title: string;
  description: string;
  subject: string;
  timeLimit: number;
  isPublished: boolean;
  isFree?: boolean;
  isMock?: boolean;
  packageId?: string;
  questions: QuestionForm[];
}
