/**
 * question-tags.ts — แท็กประจำข้อสอบ (Aj backlog ข้อ 5, 17 ส.ค. 2569)
 *
 * ทุกข้อที่นำเข้าคลังต้องมีแท็กครบ เพื่อให้:
 *  - คุมสัดส่วน ความจำ:ประยุกต์ ≈ 60:40 ตามที่ Aj วางไว้
 *  - กรองข้อสอบเก่าแยกรายปี (มีคนขอในคอมเมนต์ผลประเมิน)
 *  - ⚠️ กรองข้อที่อ้าง อปท./เจ้าพนักงานท้องถิ่น ออกก่อนปล่อยให้สนาม คร.
 *    (จะนำข้อสอบสนามท้องถิ่นมาใช้ — บริบทหน่วยงานต่างกัน คำตอบเปลี่ยน)
 *
 * แท็กทั้งหมดเป็น optional ในโครงข้อมูล — ข้อเก่า 2,000+ ข้อไม่ต้อง migrate
 * ข้อไหนไม่มีแท็ก = "ยังไม่ระบุ" และมีตัวนับใน admin บอกว่าเหลือกี่ข้อ
 */

/** 8 หัวข้อหลักสูตรภาค ข กรมควบคุมโรค */
export const DCD_TOPICS = [
  { code: "epi",     label: "ระบาดวิทยา + เฝ้าระวังโรค" },
  { code: "cd",      label: "โรคติดต่อ + การควบคุมโรค" },
  { code: "ncd",     label: "โรคไม่ติดต่อ + ปัจจัยเสี่ยง" },
  { code: "law",     label: "กฎหมายสาธารณสุข + พ.ร.บ.โรคติดต่อ" },
  { code: "stat",    label: "สถิติ + วิจัย + ข้อคำนวณ" },
  { code: "org",     label: "ภารกิจ/โครงสร้างกรมควบคุมโรค" },
  { code: "health",  label: "ส่งเสริมสุขภาพ + อนามัยสิ่งแวดล้อม" },
  { code: "digital", label: "ข้อมูลสุขภาพ + ดิจิทัล" },
] as const;

export type TopicCode = typeof DCD_TOPICS[number]["code"];

/** หลักสูตรสอบ คร. 8 เรื่อง "ตามลำดับประกาศรับสมัคร" ข้อ 5.1–5.8 (Aj 2026-08-21)
 *  ใช้เป็นชื่อบทคลิป/โครงคอร์ส — ย่อจากชื่อเต็มในประกาศ แต่ลำดับต้องตรงประกาศ
 *  (คนละชุดกับ DCD_TOPICS ซึ่งเป็นรหัสแท็กข้อสอบ — ห้ามสลับกัน) */
export const DCD_SYLLABUS: { no: number; short: string; full: string }[] = [
  { no: 1, short: "พ.ร.บ.การสาธารณสุข พ.ศ. 2535",
    full:  "พระราชบัญญัติการสาธารณสุข พ.ศ. 2535 และที่แก้ไขเพิ่มเติม (ฉบับล่าสุด)" },
  { no: 2, short: "พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ พ.ศ. 2551",
    full:  "พระราชบัญญัติควบคุมเครื่องดื่มแอลกอฮอล์ พ.ศ. 2551 และ (ฉบับที่ 2) พ.ศ. 2568" },
  { no: 3, short: "พ.ร.บ.โรคติดต่อ พ.ศ. 2558",
    full:  "พระราชบัญญัติโรคติดต่อ พ.ศ. 2558" },
  { no: 4, short: "พ.ร.บ.ควบคุมผลิตภัณฑ์ยาสูบ พ.ศ. 2560",
    full:  "พระราชบัญญัติควบคุมผลิตภัณฑ์ยาสูบ พ.ศ. 2560" },
  { no: 5, short: "พ.ร.บ.ควบคุมโรคจากการประกอบอาชีพฯ พ.ศ. 2562",
    full:  "พระราชบัญญัติควบคุมโรคจากการประกอบอาชีพและโรคจากสิ่งแวดล้อม พ.ศ. 2562" },
  { no: 6, short: "ระบาดวิทยา สถิติ และการจัดการข้อมูล",
    full:  "หลักระบาดวิทยา หลักสถิติเบื้องต้น การรวบรวมข้อมูล วิเคราะห์ และการนำเสนอข้อมูล (การจัดการข้อมูล/สารสนเทศ)" },
  { no: 7, short: "โรคติดต่อ/ไม่ติดต่อ และการเฝ้าระวัง สอบสวน ควบคุมโรค",
    full:  "โรคติดต่อ โรคไม่ติดต่อ โรคจากการประกอบอาชีพและโรคจากสิ่งแวดล้อม และหลักการเฝ้าระวัง ป้องกัน สอบสวน ควบคุมโรคและภัยสุขภาพ" },
  { no: 8, short: "การสื่อสารความเสี่ยงด้านสุขภาพ",
    full:  "การสื่อสารความเสี่ยงด้านสุขภาพ" },
];

/** ชื่อบทมาตรฐานสำหรับคลิป คร. เช่น "3. พ.ร.บ.โรคติดต่อ พ.ศ. 2558" */
export const DCD_CHAPTERS: string[] = DCD_SYLLABUS.map((s) => `${s.no}. ${s.short}`);

/** ประเภทข้อ — เป้าหมายสัดส่วนราว 60:40 */
export const QUESTION_KINDS = [
  { code: "recall", label: "ความจำ",  hint: "ถามนิยาม/ตัวเลข/ชื่อ ตอบได้ทันทีถ้าจำได้" },
  { code: "apply",  label: "ประยุกต์", hint: "ให้สถานการณ์แล้วต้องวิเคราะห์/ตัดสินใจ" },
] as const;

export type QuestionKind = typeof QUESTION_KINDS[number]["code"];
export const TARGET_RECALL_RATIO = 0.6;

export const DIFFICULTIES = [
  { code: "easy",   label: "ง่าย" },
  { code: "medium", label: "ปานกลาง" },
  { code: "hard",   label: "ยาก" },
] as const;

export type DifficultyCode = typeof DIFFICULTIES[number]["code"];

/** บริบทหน่วยงานของโจทย์ — ตัวกรองสำคัญที่สุดตอนย้ายข้อข้ามสนาม */
export const AGENCY_CONTEXTS = [
  { code: "neutral", label: "ไม่ผูกหน่วยงาน", hint: "ใช้ได้ทุกสนาม" },
  { code: "dcd",     label: "กรมควบคุมโรค",   hint: "" },
  { code: "moph",    label: "สป.สธ. / รพ.",   hint: "" },
  { code: "local",   label: "อปท. / ท้องถิ่น", hint: "⚠️ ห้ามปล่อยเข้าสนาม คร. — เจ้าพนักงานท้องถิ่นคนละบริบท" },
] as const;

export type AgencyContext = typeof AGENCY_CONTEXTS[number]["code"];

/** แท็กที่แนบกับข้อสอบ 1 ข้อ — ทุกฟิลด์ optional (ข้อเก่ายังไม่มี) */
export interface QuestionTags {
  topic?:    TopicCode;
  kind?:     QuestionKind;
  level?:    DifficultyCode;
  /** แหล่งที่มา เช่น "ข้อสอบเก่า สป.สธ." */
  source?:   string;
  /** ปี พ.ศ. เช่น 2569 — ใช้กรองข้อสอบเก่าแยกรายปี */
  year?:     number;
  agency?:   AgencyContext;
}

/** ฟิลด์บังคับ (Aj ผ่อนเหลือ 2 ช่อง 2026-08-19): ประเภท + บริบทหน่วยงาน
 *  — สองตัวที่กระทบคุณภาพจริง (สัดส่วน 60:40 + กันข้อผิดสนาม)
 *  หัวข้อ/ความยาก/ที่มา/ปี เป็นทางเลือก (ความยากมีค่าเริ่มต้น "ปานกลาง" ตอนสร้างข้อใหม่) */
export const TAG_FIELDS: (keyof QuestionTags)[] = ["kind", "agency"];

/** แท็กครบหรือยัง (นับเฉพาะฟิลด์บังคับใน TAG_FIELDS) */
export function isFullyTagged(t: QuestionTags | undefined): boolean {
  if (!t) return false;
  return TAG_FIELDS.every((f) => !!t[f]);
}

/** ข้อนี้ปล่อยเข้าสนามนั้นได้ไหม — กันบริบทหน่วยงานผิดสนาม */
export function isSafeForField(t: QuestionTags | undefined, field: "dcd" | "moph"): boolean {
  const a = t?.agency;
  if (!a || a === "neutral") return true;
  if (a === "local") return false;          // ท้องถิ่น = ไม่ปล่อยเข้าสนามอื่นเลย
  return a === field;
}

export interface TagStats {
  total: number;
  tagged: number;
  recall: number;
  apply: number;
  /** สัดส่วนความจำจริง (0–1) — เทียบกับ TARGET_RECALL_RATIO */
  recallRatio: number;
  byTopic: Record<string, number>;
  /** ข้อที่ต้องกันออกจากสนาม คร. */
  localContext: number;
}

export function summarizeTags(list: (QuestionTags | undefined)[]): TagStats {
  const s: TagStats = {
    total: list.length, tagged: 0, recall: 0, apply: 0,
    recallRatio: 0, byTopic: {}, localContext: 0,
  };
  for (const t of list) {
    if (isFullyTagged(t)) s.tagged++;
    if (t?.kind === "recall") s.recall++;
    if (t?.kind === "apply")  s.apply++;
    if (t?.agency === "local") s.localContext++;
    if (t?.topic) s.byTopic[t.topic] = (s.byTopic[t.topic] ?? 0) + 1;
  }
  const kinded = s.recall + s.apply;
  s.recallRatio = kinded > 0 ? s.recall / kinded : 0;
  return s;
}
