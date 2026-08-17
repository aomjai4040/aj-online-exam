/**
 * course-plan.ts — ปฏิทินคอร์ส (Aj backlog ข้อ 2)
 *
 * ปัญหาจากผลประเมิน: 28% ไม่รู้ว่าควรไปทำอะไรต่อ + 9% หาเมนูไม่เจอ
 * = 1 ใน 3 หลงทาง ทั้งที่ทุกส่วนของเนื้อหาได้ 90%+
 *
 * แก้ด้วยปฏิทินที่ Aj แก้เองได้ (ไม่ฝังในโค้ด เพราะแผนเปลี่ยนระหว่างผลิต):
 *   - หน้าแรกดึง "งานของวันนี้" ไม่เกิน 3 อย่าง กดแล้วไปที่นั้นทันที
 *   - เห็นปฏิทินทั้งคอร์สได้ตั้งแต่วันแรก (รู้ว่าข้างหน้ามีอะไร)
 *   - แถบความคืบหน้ารวม
 *
 * เก็บเป็น doc เดียวต่อสนาม (coursePlans/{fieldId}) — อ่านครั้งเดียวจบ
 * ไม่เปลืองโควตาเหมือนแตกเป็น subcollection รายวัน
 */

export type PlanItemKind = "video" | "sheet" | "exam" | "flashcard" | "link";

export const ITEM_KIND_LABEL: Record<PlanItemKind, string> = {
  video:     "ดูคลิป",
  sheet:     "อ่านชีท",
  exam:      "ทำข้อสอบ",
  flashcard: "Flash Card",
  link:      "อื่น ๆ",
};

export interface PlanItem {
  kind:  PlanItemKind;
  /** ข้อความที่น้องเห็น เช่น "EP.1 ระบาดวิทยาเบื้องต้น" */
  label: string;
  /** ปลายทางเมื่อกด — ว่าง = ยังไม่พร้อม (แสดงเป็นสีเทา กดไม่ได้) */
  href:  string;
}

export interface PlanDay {
  /** วันที่ N ของคอร์ส (1 = วันแรก) */
  n:     number;
  /** หัวข้อของวัน เช่น "ระบาดวิทยาเบื้องต้น" */
  title: string;
  items: PlanItem[];
}

export interface CoursePlan {
  fieldId:   string;      // "dcd" | "moph"
  /** วันแรกของคอร์ส (YYYY-MM-DD เวลาไทย) */
  startDate: string;
  days:      PlanDay[];
}

/** วันเริ่มที่ Aj แจ้งไว้ล่วงหน้า — ใช้เป็นค่าตั้งต้นตอนยังไม่เคยบันทึกปฏิทิน
 *  (คร. เริ่มวันแรก 21 ส.ค. 69 — Aj แจ้ง 17 ส.ค. 69) */
const DEFAULT_START: Record<string, string> = { dcd: "2026-08-21" };

export const EMPTY_PLAN = (fieldId: string): CoursePlan => ({
  fieldId, startDate: DEFAULT_START[fieldId] ?? "", days: [],
});

// ─── Helpers (pure) ───────────────────────────────────────────────────────────

export function bkkToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/** วันที่จริงของวันที่ N ในคอร์ส */
export function dateOfDay(startDate: string, n: number): string {
  if (!startDate) return "";
  const d = new Date(`${startDate}T00:00:00+07:00`);
  d.setDate(d.getDate() + (n - 1));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
}

/** วันนี้เป็นวันที่เท่าไหร่ของคอร์ส — 0 = ยังไม่เริ่ม, >days.length = จบแล้ว */
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** วันที่แบบไทยสั้น ๆ เช่น "21 ส.ค." — ใช้โชว์ให้น้อง ไม่ใช่ 2026-08-21 */
export function thaiDate(startDate: string, n: number): string {
  const iso = dateOfDay(startDate, n);
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${TH_MONTH[Number(m) - 1]}`;
}

export function currentDayNumber(startDate: string, today = bkkToday()): number {
  if (!startDate) return 0;
  const a = new Date(`${startDate}T00:00:00+07:00`);
  const b = new Date(`${today}T00:00:00+07:00`);
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return diff < 0 ? 0 : diff + 1;
}

/** งานของวันนี้ (ไม่เกิน 3 อย่างตามที่ Aj กำหนด) */
export function todayItems(plan: CoursePlan, today = bkkToday()): {
  day: PlanDay | null; dayNumber: number; items: PlanItem[];
} {
  const n = currentDayNumber(plan.startDate, today);
  const day = plan.days.find((d) => d.n === n) ?? null;
  return { day, dayNumber: n, items: (day?.items ?? []).slice(0, 3) };
}

/** วันที่ผ่านมาแล้วและมีของ — ใช้คำนวณความคืบหน้ารวม */
export function releasedDays(plan: CoursePlan, today = bkkToday()): PlanDay[] {
  const n = currentDayNumber(plan.startDate, today);
  return plan.days.filter((d) => d.n <= n);
}

export function planProgress(plan: CoursePlan, today = bkkToday()) {
  const done  = releasedDays(plan, today).length;
  const total = plan.days.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}
