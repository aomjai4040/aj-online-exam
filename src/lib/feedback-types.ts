/**
 * feedback-types.ts — แบบประเมินการสอน + ของตอบแทน (โครงกลาง ใช้ทั้ง client/server)
 *
 * เจตนา: ให้ตอบจบใน 2-3 นาที เกือบทั้งหมดเป็นการ "แตะเลือก" — ยิ่งกรอกง่าย
 * ยิ่งได้จำนวนคนตอบเยอะ ซึ่งสำคัญกว่าความละเอียดของคำตอบรายคน
 *
 * คำถามถูกเลือกจากสิ่งที่ Aj ต้องใช้ตัดสินใจจริง:
 *  - ข้อสอบในแอปยากพอเทียบของจริงไหม (มีคนในกลุ่มบ่นว่า "ข้อที่ติวกันไม่ค่อยออก")
 *  - หมวดไหนต้องเติมเนื้อหา (ผังข้อสอบจริง 69 ชี้ว่า LAWIT/MOPH ขาด)
 *  - ส่วนไหนของคอร์สคุ้ม/ไม่คุ้ม (จะได้ตัดหรือเสริมรอบหน้า)
 *  - สนามถัดไปที่คนสนใจ (ใช้ตัดสินใจเปิดคอร์ส)
 *
 * เพิ่ม/แก้คำถาม = แก้ที่ SURVEY อย่างเดียว หน้าแบบประเมินกับหน้ารวมผลอ่านจากที่นี่
 */

// ─── ของตอบแทน ────────────────────────────────────────────────────────────────

export const FEEDBACK_REWARD = {
  amount:    100,
  /** any = ใช้กับคอร์สไหนก็ได้ที่ Aj เปิด (ไม่ล็อกสนาม — ล็อกแค่วันหมดอายุ)
   *  เหตุผล: ในกลุ่มสนใจ "ท้องถิ่น" (40 ครั้ง) มากกว่า "กรมควบคุมโรค" (26 ครั้ง)
   *  ถ้าล็อกสนามเดียว คนกลุ่มใหญ่กว่าจะไม่มีเหตุผลมาทำแบบประเมิน */
  scope:     "any" as const,
  expiresAt: "2027-12-31",
  expiresLabel: "31 ธ.ค. 2570",
  /** ที่มาของโค้ด — ใช้แยกแคมเปญตอนดูสถิติ */
  source:    "feedback-2026" as const,
} as const;

// ─── โครงคำถาม ────────────────────────────────────────────────────────────────

export type QuestionKind = "stars" | "single" | "grid" | "multi" | "text";

export interface Choice { value: string; label: string; hint?: string }

export interface SurveyQuestion {
  id:       string;
  kind:     QuestionKind;
  title:    string;
  sub?:     string;
  /** single / multi */
  choices?: Choice[];
  /** grid — ให้คะแนนหลายรายการด้วยตัวเลือกชุดเดียว */
  rows?:    Choice[];
  scale?:   Choice[];
  /** multi — จำกัดจำนวนที่เลือกได้ (ไม่ใส่ = ไม่จำกัด) */
  max?:     number;
  optional?: boolean;
}

export const SURVEY: SurveyQuestion[] = [
  {
    id: "overall", kind: "stars",
    title: "ภาพรวมคอร์สนี้ให้กี่ดาว",
    sub:  "ให้ตามความรู้สึกจริงได้เลย พี่อ้อมอยากรู้ของจริงมากกว่าคำชม",
  },
  {
    id: "difficulty", kind: "single",
    title: "ข้อสอบในแอป เทียบกับข้อสอบจริงที่เพิ่งเจอ",
    sub:  "ข้อนี้สำคัญที่สุด — ใช้ปรับความยากของคลังข้อสอบรอบหน้า",
    choices: [
      { value: "much-easier", label: "ง่ายกว่าของจริงมาก" },
      { value: "easier",      label: "ง่ายกว่านิดหน่อย" },
      { value: "same",        label: "พอ ๆ กัน" },
      { value: "harder",      label: "ยากกว่าของจริง" },
    ],
  },
  {
    id: "parts", kind: "grid",
    title: "แต่ละส่วนช่วยมากแค่ไหน",
    sub:  "ส่วนไหนไม่ได้ใช้ก็บอกได้ ไม่ต้องเกรงใจ",
    rows: [
      { value: "videos",     label: "คลิปติว" },
      { value: "sheets",     label: "ชีทสรุป / เอกสาร" },
      { value: "exams",      label: "ข้อสอบในแอป" },
      { value: "daily",      label: "Daily Quiz" },
      { value: "finalLap",   label: "ติวโค้งสุดท้าย 14 วัน" },
      { value: "games",      label: "เกมทบทวน" },
      { value: "line",       label: "กลุ่ม LINE ถามพี่อ้อม" },
    ],
    scale: [
      { value: "high",   label: "ช่วยมาก" },
      { value: "ok",     label: "พอใช้" },
      { value: "unused", label: "ไม่ได้ใช้" },
    ],
  },
  {
    id: "wantMore", kind: "multi", max: 3,
    title: "หมวดไหนอยากให้เพิ่มเนื้อหา / ข้อสอบ",
    sub:  "เลือกได้ไม่เกิน 3 หมวด",
    choices: [
      { value: "BASIC",   label: "พื้นฐานสาธารณสุข" },
      { value: "APPLIED", label: "ประยุกต์ใช้ / สถานการณ์" },
      { value: "POLICY",  label: "นโยบายของรัฐ" },
      { value: "CURRENT", label: "สถานการณ์ปัจจุบัน + เศรษฐศาสตร์สาธารณสุข" },
      { value: "REFORM",  label: "แผนปฏิรูปประเทศ" },
      { value: "LAWIT",   label: "กฎหมาย + คอมพิวเตอร์/ข้อมูล" },
      { value: "MOPH",    label: "วิสัยทัศน์ พันธกิจ โครงสร้าง สป.สธ." },
    ],
  },
  {
    id: "issues", kind: "multi",
    title: "เจอปัญหาตอนใช้แอปไหม",
    sub:  "เลือกได้หลายข้อ ถ้าไม่เจอเลยก็เลือกข้อสุดท้าย",
    choices: [
      { value: "login",    label: "เข้าสู่ระบบไม่ได้ / หมุนค้าง" },
      { value: "install",  label: "ติดตั้งลงหน้าจอมือถือไม่เป็น" },
      { value: "slow",     label: "ช้า ค้าง หรือเข้าไม่ได้บางเวลา" },
      { value: "navigate", label: "หาเมนูที่ต้องการไม่เจอ" },
      { value: "unclear",  label: "ไม่รู้ว่าควรไล่ทำอะไรก่อนหลัง" },
      { value: "none",     label: "ไม่เจอปัญหาเลย" },
    ],
  },
  {
    id: "nextExams", kind: "multi",
    title: "สนามถัดไปที่สนใจ",
    sub:  "พี่อ้อมจะใช้ตัดสินใจว่าจะเปิดคอร์สไหนต่อ",
    choices: [
      { value: "dcd",      label: "กรมควบคุมโรค" },
      { value: "local",    label: "ท้องถิ่น (อบต. / เทศบาล)" },
      { value: "pho",      label: "สสจ. / สสอ." },
      { value: "anamai",   label: "กรมอนามัย" },
      { value: "dms",      label: "กรมการแพทย์" },
      { value: "passed",   label: "รอบนี้น่าจะติดแล้ว ไม่สอบต่อ" },
      { value: "unsure",   label: "ยังไม่แน่ใจ" },
    ],
  },
  {
    id: "recommend", kind: "single",
    title: "จะแนะนำคอร์สพี่อ้อมให้เพื่อนไหม",
    choices: [
      { value: "sure",     label: "แนะนำแน่นอน" },
      { value: "probably", label: "น่าจะแนะนำ" },
      { value: "unsure",   label: "ยังไม่แน่ใจ" },
      { value: "no",       label: "คงไม่แนะนำ" },
    ],
  },
  {
    id: "comment", kind: "text", optional: true,
    title: "อยากบอกอะไรพี่อ้อมไหม",
    sub:  "จะติก็ได้นะคะ พี่อยากรู้เพื่อทำให้ดีขึ้นจริง ๆ (ข้ามได้)",
  },
];

// ─── ชนิดคำตอบ ────────────────────────────────────────────────────────────────

export type AnswerValue = number | string | string[] | Record<string, string>;
export type SurveyAnswers = Record<string, AnswerValue>;

export interface FeedbackDoc {
  userId:    string;
  userEmail: string;
  userName:  string;
  answers:   SurveyAnswers;
  code:      string;
  createdAt: Date | null;
}

/** ตอบครบหรือยัง — ข้อ optional ข้ามได้ */
export function missingQuestions(answers: SurveyAnswers): SurveyQuestion[] {
  return SURVEY.filter((q) => {
    if (q.optional) return false;
    const a = answers[q.id];
    if (a === undefined || a === null || a === "") return true;
    if (Array.isArray(a)) return a.length === 0;
    if (q.kind === "grid") {
      const rec = a as Record<string, string>;
      return (q.rows ?? []).some((r) => !rec[r.value]);
    }
    return false;
  });
}
