/**
 * revenue.ts — ตรรกะรายงานยอดขาย (pure ทั้งไฟล์ ใช้ร่วม client/server)
 *
 * ที่มา (Aj 17 ส.ค. 2569): รายได้มาหลายทางแล้ว (สนาม สป.สธ. + กรมควบคุมโรค,
 * หลายแพ็ก, มีโค้ดส่วนลด, มีทั้งสลิปอัตโนมัติและแอดมินอนุมัติเอง)
 * แต่ /admin/insights บอกได้แค่ "ยอดรวมสะสมตั้งแต่เปิด" ตัวเดียว
 *
 * ไฟล์นี้แปลงออเดอร์ที่จ่ายแล้ว → แถวรายงาน แล้วสรุปได้หลายมุม:
 *   สนาม · แพ็ก · ช่องทางรับเงิน · โค้ดส่วนลด · ช่วงเวลา
 *
 * ⚠️ ครอบคลุมเฉพาะ "เงินที่ผ่านหน้าชำระเงินในเว็บ" — สิทธิ์ที่แจกด้วยโค้ด
 * (คนโอนตรง/ทักไลน์) ยังไม่มีการบันทึกยอดเงิน API จึงคืนจำนวนแยกไว้ให้เตือนบนหน้า
 */

import { EXAM_FIELDS } from "./exam-fields";
import { ADMIN_EMAILS } from "./admin-config";

// ─── วันที่แบบเวลาไทย ─────────────────────────────────────────────────────────

/** YYYY-MM-DD ตามเวลาไทย */
export const bkkDay = (d: Date | string | number): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(d));

/** เลื่อนวัน (ใช้เที่ยงวันเป็นฐาน กันเพี้ยนตอนแปลง timezone) */
export function shiftDay(day: string, delta: number): string {
  return bkkDay(new Date(`${day}T12:00:00+07:00`).getTime() + delta * 86_400_000);
}

/** จำนวนวันในช่วง (นับปลายทั้งสองข้าง) */
export function dayCount(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00+07:00`).getTime();
  const b = new Date(`${to}T12:00:00+07:00`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** วันแรกของเดือนนั้น */
export const monthStart = (day: string): string => `${day.slice(0, 7)}-01`;

/** วันสุดท้ายของเดือนนั้น */
export function monthEnd(day: string): string {
  const [y, m] = day.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return shiftDay(next, -1);
}

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** 2026-08-17 → "17 ส.ค." */
export function fmtDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${TH_MONTH[m - 1]}`;
}

/** 2026-08 → "ส.ค. 69" (พ.ศ. สองหลัก) */
export function fmtMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${TH_MONTH[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}`;
}

// ─── ประเภทข้อมูล ─────────────────────────────────────────────────────────────

/** ช่องทางที่เงินเข้าระบบ */
export type Channel = "auto" | "manual";

export const CHANNEL_META: Record<Channel, { label: string; color: string }> = {
  auto:   { label: "ตรวจสลิปอัตโนมัติ", color: "#0B6E65" },
  manual: { label: "แอดมินอนุมัติเอง",  color: "#B45309" },
};

/** หนึ่งแถวในรายงาน = ออเดอร์ที่จ่ายเงินสำเร็จ 1 รายการ */
export interface RevenueRow {
  id:         string;
  /** วันที่เงินเข้า (เวลาไทย) — ใช้จัดกลุ่มทุกอย่าง */
  day:        string;
  at:         string;      // ISO เต็ม (ไว้โชว์เวลา)
  email:      string;
  tier:       string;
  courseId:   string;
  courseName: string;
  /** ยอดที่รับจริง (หักส่วนลดแล้ว) */
  amount:     number;
  /** ยอดเต็มก่อนหักส่วนลด */
  fullAmount: number;
  discount:   number;
  /** โค้ดส่วนลดที่ใช้ ("" = ไม่ได้ใช้) */
  code:       string;
  /** ตระกูลโค้ดสำหรับจัดกลุ่มในรายงาน — API เป็นคนตัดสิน (ดู codeGroupOf) */
  codeGroup:  string;
  channel:    Channel;
  /** ออเดอร์ทดสอบของทีมเอง — ตัดออกจากยอดขายโดยปริยาย */
  isTest:     boolean;
}

/**
 * อีเมลที่นับเป็น "ออเดอร์ทดสอบ" ไม่ใช่ยอดขายจริง
 * เพิ่มเคสใหม่ = เติมอีเมลในลิสต์นี้ที่เดียว
 *   thongsriaomjai / ab0987035131 = บัญชีที่ Aj ใช้ทดสอบระบบจ่ายเงินด้วยเงินจริง
 */
export const TEST_EMAILS: string[] = [
  ...ADMIN_EMAILS,
  "thongsriaomjai@gmail.com",
  "ab0987035131@gmail.com",
].map((e) => e.toLowerCase());

export const isTestEmail = (email: string): boolean =>
  TEST_EMAILS.includes(String(email).trim().toLowerCase());

// ─── สนาม / แพ็ก ─────────────────────────────────────────────────────────────

/** สนามของออเดอร์ — ตัดสินจาก courseId prefix (ทะเบียนเดียวกับ exam-fields) */
export function fieldOfCourse(courseId: string): { id: string; code: string; name: string; accent: string } {
  const low = String(courseId).toLowerCase();
  const f = EXAM_FIELDS.find((x) => x.ownPrefixes.some((p) => low.startsWith(p)));
  return f
    ? { id: f.id, code: f.code, name: f.name, accent: f.accent }
    : { id: "other", code: "อื่น ๆ", name: "ไม่ระบุสนาม", accent: "#A8A8A6" };
}

export const TIER_META: Record<string, { label: string; color: string }> = {
  app:         { label: "App Only 299",            color: "#2563EB" },
  review:      { label: "ติวเข้ม 14 วัน 499",       color: "#B45309" },
  full:        { label: "คอร์สเต็ม 699",            color: "#0B6E65" },
  upgrade:     { label: "อัปเกรด App→เต็ม 400",     color: "#16A34A" },
  "up-review": { label: "อัปเกรด App→ติวเข้ม 200",  color: "#F59E0B" },
  "up-full2":  { label: "อัปเกรด ติวเข้ม→เต็ม 200", color: "#14B8A6" },
  dcd:         { label: "กรมควบคุมโรค",             color: "#7C3AED" },
};

const tierMeta = (t: string) => TIER_META[t] ?? { label: t || "ไม่ระบุ", color: "#A8A8A6" };

// ─── สรุปยอด ─────────────────────────────────────────────────────────────────

export interface Totals {
  count:    number;
  /** ยอดที่รับจริง */
  amount:   number;
  /** ยอดเต็มก่อนหักส่วนลด */
  gross:    number;
  discount: number;
  /** เฉลี่ยต่อออเดอร์ */
  avg:      number;
}

export function totalsOf(rows: RevenueRow[]): Totals {
  const amount   = rows.reduce((s, r) => s + r.amount, 0);
  const discount = rows.reduce((s, r) => s + r.discount, 0);
  return {
    count: rows.length,
    amount,
    gross: amount + discount,
    discount,
    avg: rows.length ? Math.round(amount / rows.length) : 0,
  };
}

export interface Bucket {
  key:      string;
  label:    string;
  color:    string;
  count:    number;
  amount:   number;
  discount: number;
}

/** จัดกลุ่มแถว → เรียงยอดมากไปน้อย */
export function bucketize(
  rows: RevenueRow[],
  keyOf: (r: RevenueRow) => string,
  metaOf: (key: string, r: RevenueRow) => { label: string; color: string },
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const key = keyOf(r);
    if (!key) continue;
    let b = map.get(key);
    if (!b) {
      const m = metaOf(key, r);
      b = { key, label: m.label, color: m.color, count: 0, amount: 0, discount: 0 };
      map.set(key, b);
    }
    b.count++;
    b.amount   += r.amount;
    b.discount += r.discount;
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export const byField = (rows: RevenueRow[]): Bucket[] =>
  bucketize(rows, (r) => fieldOfCourse(r.courseId).id, (_k, r) => {
    const f = fieldOfCourse(r.courseId);
    return { label: f.name, color: f.accent };
  });

export const byTier = (rows: RevenueRow[]): Bucket[] =>
  bucketize(rows, (r) => r.tier, (k) => tierMeta(k));

export const byChannel = (rows: RevenueRow[]): Bucket[] =>
  bucketize(rows, (r) => r.channel, (k) => CHANNEL_META[k as Channel]);

/**
 * ตระกูลโค้ดสำหรับรายงาน — "AJ100-*" สำหรับโค้ดรายบุคคล, ชื่อโค้ดเองสำหรับโค้ดกลาง
 *
 * โค้ดจากแบบประเมินออกให้คนละใบ (AJ100-XXXXX ตอนนี้ 100+ ใบ) ถ้าไม่ยุบกลุ่ม
 * รายงานจะขึ้นเป็นร้อยแถว แถวละ 1 ครั้ง อ่านไม่ได้เลย
 *
 * ⚠️ ห้ามเดาจากรูปแบบตัวอักษร — โค้ดกลางที่ Aj ตั้งเองอาจหน้าตาเหมือนกัน
 * (เช่น SUMMER-PROMO) API จึงดูจากฟิลด์ userId ใน discountCodes แล้วส่ง
 * codeGroup มาให้ ฟังก์ชันนี้เป็นแค่ทางสำรองตอนหาโค้ดต้นทางไม่เจอ
 */
export const codeGroupOf = (r: RevenueRow): string => r.codeGroup || r.code;

/** ป้ายที่โชว์ในรายงาน */
export const codeGroupLabel = (key: string): string =>
  key.endsWith("-*") ? `${key} (โค้ดรายบุคคล)` : key;

/** เฉพาะออเดอร์ที่ใช้โค้ด — ตัววัดว่าโค้ดไหนทำเงิน */
export const byCode = (rows: RevenueRow[]): Bucket[] =>
  bucketize(
    rows.filter((r) => r.code),
    codeGroupOf,
    (k) => ({ label: codeGroupLabel(k), color: "#7C3AED" }),
  );

// ─── ซีรีส์ตามเวลา ───────────────────────────────────────────────────────────

export type SeriesMode = "day" | "month";

/** ช่วงยาวเกิน 2 เดือน → สรุปเป็นรายเดือน (ไม่งั้นแท่งเล็กจนอ่านไม่ออก) */
export const pickMode = (from: string, to: string): SeriesMode =>
  dayCount(from, to) > 62 ? "month" : "day";

export interface SeriesPoint { key: string; label: string; amount: number; count: number }

/** สร้างช่องครบทุกวัน/เดือนในช่วง (วันที่ไม่มียอด = 0 ไม่ใช่หายไป) */
export function buildSeries(
  rows: RevenueRow[], from: string, to: string, mode: SeriesMode
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const push = (key: string, label: string) => out.push({ key, label, amount: 0, count: 0 });

  if (mode === "day") {
    for (let d = from; d <= to; d = shiftDay(d, 1)) push(d, fmtDay(d));
  } else {
    for (let m = monthStart(from); m <= to; m = shiftDay(monthEnd(m), 1)) {
      push(m.slice(0, 7), fmtMonth(m.slice(0, 7)));
    }
  }

  const idx = new Map(out.map((p, i) => [p.key, i]));
  for (const r of rows) {
    const i = idx.get(mode === "day" ? r.day : r.day.slice(0, 7));
    if (i === undefined) continue;
    out[i].amount += r.amount;
    out[i].count++;
  }
  return out;
}

// ─── ส่งออก CSV ──────────────────────────────────────────────────────────────

const csvCell = (v: string | number): string => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV เปิดใน Excel ภาษาไทยไม่เพี้ยน (ใส่ BOM ข้างหน้า)
 * หนึ่งแถว = หนึ่งออเดอร์ — เอาไปทำ pivot / ส่งให้คนทำบัญชีต่อได้เลย
 */
export function toCSV(rows: RevenueRow[]): string {
  const head = [
    "วันที่", "เวลา", "อีเมล", "สนาม", "แพ็ก", "courseId",
    "ยอดเต็ม", "ส่วนลด", "โค้ด", "ยอดสุทธิ", "ช่องทาง", "ทดสอบ", "orderId",
  ];
  const lines = rows.map((r) => {
    const time = new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
    }).format(new Date(r.at));
    return [
      r.day, time, r.email,
      fieldOfCourse(r.courseId).name,
      tierMeta(r.tier).label,
      r.courseId,
      r.fullAmount, r.discount, r.code, r.amount,
      CHANNEL_META[r.channel].label,
      r.isTest ? "ทดสอบ" : "",
      r.id,
    ].map(csvCell).join(",");
  });
  return "﻿" + [head.join(","), ...lines].join("\r\n");
}

/** ชื่อไฟล์ที่บอกช่วงเวลาในตัว */
export const csvFileName = (from: string, to: string): string =>
  `ยอดขาย-${from}-ถึง-${to}.csv`;
