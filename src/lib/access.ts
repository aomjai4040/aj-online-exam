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
  hasDcd:     boolean;  // มีคอร์สสนามกรมควบคุมโรค (ตัวไหนก็ได้ — คุมสิทธิ์เข้า "สนาม")
  hasDcdFull: boolean;  // มี "ติวเข้ม คร." (dcd- ที่ไม่ใช่ dcd-app) → คลิป + LINE + เอกสาร
}

export const EMPTY_ACCESS: UserAccess = {
  packageIds: [], hasAny: false, hasReview: false, hasFull: false,
  hasDcd: false, hasDcdFull: false,
};

/**
 * กติกาแยก tier (ตกลงกับ Aj 2026-07-11, เพิ่ม review 2026-07-29):
 * - courseId ขึ้นต้น "app-"    = App Only (299)
 * - courseId ขึ้นต้น "review-" = แพ็กติวทบทวน (499): สิทธิ์ App + คลิปโค้งสุดท้าย
 * - courseId ขึ้นต้น "dcd-"    = สนามกรมควบคุมโรค (คนละสนามกับ สป.สธ. — 2026-08-16)
 * - courseId อื่นทั้งหมด        = คอร์สเต็ม (ลูกค้าเก่าทุกคนซื้อ 699 → ได้วิดีโออัตโนมัติ)
 *
 * ⚠️ dcd- ต้องถูกกันออกจาก isFullCourse ไม่งั้นคนซื้อคอร์ส คร. จะได้คอร์ส
 * วิดีโอ สป.สธ. 68 คลิป (ของแพ็ก 699) ไปด้วยโดยไม่ได้ตั้งใจ
 */
export function isAppOnlyCourse(courseId: string): boolean {
  return courseId.toLowerCase().startsWith("app-");
}
export function isReviewCourse(courseId: string): boolean {
  return courseId.toLowerCase().startsWith("review-");
}
export function isDcdCourse(courseId: string): boolean {
  return courseId.toLowerCase().startsWith("dcd-");
}
/** App Only ของสนาม คร. (299 — Aj 2026-08-27): ฝึกข้อสอบอย่างเดียว ไม่มีคลิป/LINE/เอกสาร */
export function isDcdAppCourse(courseId: string): boolean {
  return courseId.toLowerCase().startsWith("dcd-app");
}
export function isFullCourse(courseId: string): boolean {
  return !isAppOnlyCourse(courseId) && !isReviewCourse(courseId) && !isDcdCourse(courseId);
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
    // hasAny = legacy fallback ของ "คลัง สป.สธ. เดิม" (ชุดที่ยังไม่ผูก packageId)
    // Aj ยืนยัน 2026-08-16: แต่ละสนามแยกขาด ซื้อคอร์สไหนได้แค่คอร์สนั้น
    // → คอร์ส คร. (dcd-) ไม่นับ ไม่งั้นคนซื้อ คร. จะได้คลัง สป.สธ. 68 ชุดไปด้วย
    hasAny:    packageIds.some((id) => !isDcdCourse(id)),
    hasReview: packageIds.some(isReviewCourse),
    hasFull:   packageIds.some(isFullCourse),
    hasDcd:    packageIds.some(isDcdCourse),
    hasDcdFull: packageIds.some((id) => isDcdCourse(id) && !isDcdAppCourse(id)),
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
    if (access.packageIds.includes(exam.packageId)) return "allowed";
    // สนาม คร.: ข้อสอบเปิดให้ทุกแพ็กของสนาม (dcd-app ก็ทำได้ — ต่างกันที่คลิป/LINE)
    if (isDcdCourse(exam.packageId) && access.hasDcd) return "allowed";
    return "locked";
  }
  // ยังไม่ผูกแพ็ก → legacy: มีคอร์สอะไรก็ได้ก็เข้าได้
  return access.hasAny ? "allowed" : "locked";
}
