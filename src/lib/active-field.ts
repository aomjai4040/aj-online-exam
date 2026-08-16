"use client";
/**
 * active-field.ts — "สนามที่กำลังเรียน" จำค้างทั้งแอป (Aj 2026-08-16: แยกให้ขาด
 * ตั้งแต่กดเลือกคอร์สหน้าแรก — ไม่งั้นข้อสอบปนกัน แยกไม่ออกว่าของสนามไหน)
 *
 * กดการ์ดสนามบนหน้าแรก → จำไว้ → คลังข้อสอบ / Mock Exam / เพิ่มล่าสุด
 * โชว์เฉพาะของสนามนั้นจนกว่าจะสลับ (มีตัวสลับบนหัวหน้า list สำหรับคนมี 2 สนาม)
 */

import type { ExamFieldKey } from "./exam-fields";

const KEY = "active-exam-field";

export function getActiveField(): ExamFieldKey {
  if (typeof window === "undefined") return "moph";
  return localStorage.getItem(KEY) === "dcd" ? "dcd" : "moph";
}

export function setActiveField(field: ExamFieldKey): void {
  try { localStorage.setItem(KEY, field); } catch {}
}
