/**
 * exam-fields.ts — ทะเบียน "สนามสอบ" ทั้งหมดของแอป (แหล่งเดียว)
 *
 * แอปเริ่มจากสนาม สป.สธ. สนามเดียว แล้วขยายเป็นศูนย์รวมของคนเตรียมสอบ
 * สายสาธารณสุขและสิ่งแวดล้อม — เพิ่มสนามใหม่ = เติม 1 entry ใน EXAM_FIELDS
 * ไม่ต้องแก้หน้าแรก/หน้าแพ็กเกจอีก
 *
 * กติกาสิทธิ์: ผูกกับ courseId prefix (ownPrefixes) แบบเดียวกับ lib/access.ts
 *   สป.สธ. = app- / review- / full- (และ courseId เก่า moph69)
 *   กรมควบคุมโรค = dcd-
 * สนามใหม่ต้องใช้ prefix ของตัวเอง และต้องไปเพิ่มใน access.ts ด้วยถ้าจะแยก tier
 */

import type { UserAccess } from "./access";

export type FieldStatus =
  | "open"    // เปิดขายคอร์สอยู่
  | "soon"    // ประกาศไว้ ยังไม่เปิดขาย
  | "ended";  // สอบไปแล้ว (ยังเข้าทบทวนได้ถ้าเป็นสมาชิก)

export interface ExamField {
  id:      string;
  /** ป้ายสั้นบนการ์ด */
  code:    string;
  name:    string;
  blurb:   string;
  status:  FieldStatus;
  /** สีประจำสนาม — ใช้เป็นแถบ/ป้ายบนการ์ด */
  accent:  string;
  /** วันสอบข้อเขียน (ถ้าประกาศแล้ว) */
  examDate?:   string;   // YYYY-MM-DD
  examLabel?:  string;
  /** วันปิดรับสมัครสอบของหน่วยงาน (ไม่ใช่ของคอร์ส) */
  applyClose?: string;   // YYYY-MM-DD
  /** courseId prefix ที่นับว่าเป็นเจ้าของสนามนี้ */
  ownPrefixes: string[];
  /** ปลายทางเมื่อ "มีสิทธิ์แล้ว" */
  hrefOwned:   string;
  /** ปลายทางเมื่อ "ยังไม่มีสิทธิ์" — ไม่มี = ยังขายไม่ได้ */
  hrefBuy?:    string;
  price?:      number;
}

export const EXAM_FIELDS: ExamField[] = [
  {
    id: "dcd", code: "คร.",
    name:  "กรมควบคุมโรค",
    blurb: "นักวิชาการสาธารณสุขปฏิบัติการ",
    status: "open",
    accent: "#0B6E65",
    // Aj 2026-08-16: ยังไม่โชว์วันสอบ (กรมระบุว่าอาจปรับได้) — รอประกาศทางการ
    examLabel: "วันสอบข้อเขียน รอประกาศ",
    applyClose: "2026-09-04",
    ownPrefixes: ["dcd-"],
    hrefOwned: "/exams?field=dcd",
    hrefBuy:   "/checkout/dcd",
  },
  {
    id: "moph", code: "สป.สธ.",
    name:  "สำนักงานปลัดกระทรวงสาธารณสุข",
    blurb: "นักวิชาการสาธารณสุขปฏิบัติการ",
    status: "ended",
    accent: "#7C3AED",
    examDate: "2026-08-15", examLabel: "สอบไปแล้ว 15 ส.ค.",
    ownPrefixes: ["app-", "review-", "full-", "moph"],
    hrefOwned: "/exams",
    hrefBuy:   "/packages",
  },
  // ── สนามที่ประกาศไว้ ยังไม่เปิดขาย (Aj แจ้งแผน 2026-08-16) ────────────────
  // เปิดขายเมื่อไหร่: เปลี่ยน status เป็น "open" + ใส่ hrefBuy/price
  {
    id: "license", code: "ใบประกอบ",
    name:  "ใบประกอบวิชาชีพการสาธารณสุขชุมชน",
    blurb: "สอบขึ้นทะเบียนผู้ประกอบวิชาชีพ",
    status: "soon", accent: "#F59E0B",
    ownPrefixes: ["license-"],
    hrefOwned: "/exams",
  },
  {
    id: "local", code: "อปท.",
    name:  "องค์กรปกครองส่วนท้องถิ่น",
    blurb: "สายงานสาธารณสุขและสิ่งแวดล้อม",
    status: "soon", accent: "#EF4444",
    ownPrefixes: ["local-"],
    hrefOwned: "/exams",
  },
];

/** สนามที่ระบบรู้จักตอนนี้ (ใช้ทั้ง active-field และการกรองชุดข้อสอบ) */
export type ExamFieldKey = "moph" | "dcd";

export const FIELD_SHORT: Record<ExamFieldKey, string> = {
  moph: "สป.สธ.",
  dcd:  "กรมควบคุมโรค",
};

/** สนามของชุดข้อสอบ — ตัดสินจาก packageId prefix (ไม่มี = คลัง สป.สธ. เดิม) */
export function examSetField(exam: { packageId?: string }): ExamFieldKey {
  return String(exam.packageId ?? "").toLowerCase().startsWith("dcd-") ? "dcd" : "moph";
}

/** courseId ที่ชุดข้อสอบของแต่ละสนามต้องผูก ("" = ไม่ผูก = คลัง สป.สธ. เดิม ใช้ legacy access)
 *  ใช้ตอน admin สร้าง/import ชุดข้อสอบ — ต้องตรงกับ tierPlan ใน order-types.ts */
export const FIELD_PACKAGE: Record<ExamFieldKey, string> = {
  moph: "",
  dcd:  "dcd-2026",
};

// ─── Helpers (pure) ───────────────────────────────────────────────────────────

export function ownsField(field: ExamField, access: UserAccess): boolean {
  return access.packageIds.some((id) => {
    const low = id.toLowerCase();
    return field.ownPrefixes.some((p) => low.startsWith(p));
  });
}

/** จำนวนวันถึงวันที่กำหนด (0 = วันนี้, ติดลบ = ผ่านไปแล้ว) */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const a = new Date(now);            a.setHours(0, 0, 0, 0);
  const b = new Date(`${isoDate}T00:00:00+07:00`); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** เรียงลำดับที่ควรโชว์: สนามที่ซื้อแล้ว → เปิดขาย (ใกล้สอบก่อน) → เร็ว ๆ นี้ → จบแล้ว */
export function sortFields(fields: ExamField[], access: UserAccess): ExamField[] {
  const rank = (f: ExamField) => {
    if (ownsField(f, access)) return 0;
    if (f.status === "open")  return 1;
    if (f.status === "soon")  return 2;
    return 3;
  };
  return [...fields].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const da = a.examDate ? daysUntil(a.examDate) : 9999;
    const db = b.examDate ? daysUntil(b.examDate) : 9999;
    return da - db;
  });
}
