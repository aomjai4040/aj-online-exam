import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Exam } from "./types";

/**
 * access.ts — โมเดลสิทธิ์แบบ per-package
 *
 * แต่ละชุดข้อสอบสังกัดแพ็กเกจ (exam.packageId). ผู้ใช้เป็นเจ้าของแพ็กเกจ
 * ผ่าน userCourses (courseId = packageId). การเข้าถึง:
 *   - ชุด isFree → ใครที่ login แล้วเข้าได้
 *   - ชุดมี packageId → ต้องเป็นเจ้าของแพ็กนั้น
 *   - ชุดยังไม่มี packageId → fallback legacy: มีคอร์สอะไรก็ได้ = เข้าได้
 *     (กันไม่ให้ลูกค้าเก่าถูกล็อกออกก่อน Aj ผูก packageId ครบ)
 */

export interface UserAccess {
  packageIds: string[]; // courseId ทั้งหมดที่ผู้ใช้เป็นเจ้าของ
  hasAny:     boolean;  // มีคอร์ส/แพ็กอย่างน้อย 1 อัน (legacy fallback)
  hasReview:  boolean;  // มี "แพ็กติวทบทวน 499" → ดูคลิปโค้งสุดท้ายได้ (ไม่เห็นคอร์สวิดีโอเต็ม)
  hasFull:    boolean;  // มี "คอร์สเต็ม" → ดูวิดีโอได้ครบ
}

export const EMPTY_ACCESS: UserAccess = {
  packageIds: [], hasAny: false, hasReview: false, hasFull: false,
};

/**
 * กติกาแยก tier (ตกลงกับ Aj 2026-07-11, เพิ่ม review 2026-07-29):
 * - courseId ขึ้นต้น "app-"    = App Only (299)
 * - courseId ขึ้นต้น "review-" = แพ็กติวทบทวน (499): สิทธิ์ App + คลิปโค้งสุดท้าย
 * - courseId อื่นทั้งหมด        = คอร์สเต็ม (ลูกค้าเก่าทุกคนซื้อ 699 → ได้วิดีโออัตโนมัติ)
 */
export function isAppOnlyCourse(courseId: string): boolean {
  return courseId.toLowerCase().startsWith("app-");
}
export function isReviewCourse(courseId: string): boolean {
  return courseId.toLowerCase().startsWith("review-");
}
export function isFullCourse(courseId: string): boolean {
  return !isAppOnlyCourse(courseId) && !isReviewCourse(courseId);
}

/** ดึงสิทธิ์ทั้งหมดของผู้ใช้ในครั้งเดียว (แทน checkUserHasAnyAccess เดิม) */
export async function getUserAccess(uid: string): Promise<UserAccess> {
  const snap = await getDocs(
    query(collection(db, "userCourses"), where("userId", "==", uid))
  );
  const packageIds = snap.docs
    .map((d) => String(d.data().courseId ?? ""))
    .filter(Boolean);
  return {
    packageIds,
    hasAny:    !snap.empty,
    hasReview: packageIds.some(isReviewCourse),
    hasFull:   packageIds.some(isFullCourse),
  };
}

export type ExamAccess = "allowed" | "locked" | "need-login";

/** ตัดสินสิทธิ์เข้าชุดข้อสอบหนึ่งชุด (pure — เทสง่าย) */
export function decideExamAccess(
  exam:   Pick<Exam, "isFree" | "packageId">,
  userId: string | null,
  access: UserAccess
): ExamAccess {
  if (exam.isFree) return "allowed";        // ฟรี — แม้ยังไม่ login ก็ผ่านด่านนี้
  if (!userId)     return "need-login";
  if (exam.packageId) {
    return access.packageIds.includes(exam.packageId) ? "allowed" : "locked";
  }
  // ยังไม่ผูกแพ็ก → legacy: มีคอร์สอะไรก็ได้ก็เข้าได้
  return access.hasAny ? "allowed" : "locked";
}
