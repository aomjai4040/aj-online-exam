"use client";
/**
 * active-field.ts — "สนามที่กำลังเรียน" จำค้างทั้งแอป (Aj 2026-08-16: แยกให้ขาด
 * ตั้งแต่กดเลือกคอร์สหน้าแรก — ไม่งั้นข้อสอบปนกัน แยกไม่ออกว่าของสนามไหน)
 *
 * โครงใหม่ (Aj 2026-08-21): หน้าแรกไม่มีเมนูแล้ว — เมนูอยู่ใน "หน้าคอร์ส"
 * /course/moph และ /course/dcd แยกกัน · สมาชิกเปิดแอปแล้วเด้งเข้าคอร์สล่าสุดที่เปิดเลย
 * คลังข้อสอบ / Mock / วิดีโอ / Daily / บันทึก โชว์เฉพาะของสนามนั้น
 */

import type { ExamFieldKey } from "./exam-fields";
import type { UserAccess } from "./access";

const KEY = "active-exam-field";

export function getActiveField(): ExamFieldKey {
  if (typeof window === "undefined") return "moph";
  return localStorage.getItem(KEY) === "dcd" ? "dcd" : "moph";
}

export function setActiveField(field: ExamFieldKey): void {
  try { localStorage.setItem(KEY, field); } catch {}
}

/** หน้าคอร์สของสนามนั้น */
export function courseHref(field: ExamFieldKey): string {
  return `/course/${field}`;
}

/** ผู้ใช้มีสิทธิ์สนามนี้ไหม (สป.สธ. = แพ็กใดก็ได้ที่ไม่ใช่ dcd-) */
export function ownsFieldKey(access: UserAccess, field: ExamFieldKey): boolean {
  return field === "dcd" ? access.hasDcd : access.hasAny;
}

/** สนามที่เป็นเจ้าของทั้งหมด เรียง: สนามที่จำไว้ก่อน */
export function ownedFields(access: UserAccess): ExamFieldKey[] {
  const all: ExamFieldKey[] = ["moph", "dcd"];
  const owned = all.filter((f) => ownsFieldKey(access, f));
  const wanted = getActiveField();
  return owned.sort((a, b) => (a === wanted ? -1 : b === wanted ? 1 : 0));
}

/** สนามที่ "ควร" ใช้จริง = สนามที่จำไว้ ถ้ามีสิทธิ์ · ไม่งั้นสนามแรกที่มีสิทธิ์
 *  (กันเคสคนไม่มีคอร์ส คร. ไปกดการ์ด คร. แล้วทุกหน้าว่างเปล่า) */
export function effectiveField(access: UserAccess, wanted: ExamFieldKey = getActiveField()): ExamFieldKey {
  if (ownsFieldKey(access, wanted)) return wanted;
  return ownedFields(access)[0] ?? wanted;
}
