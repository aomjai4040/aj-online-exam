/**
 * exam-server.ts — โหลดข้อสอบ + ตัดสินสิทธิ์ฝั่ง server (ใช้ใน /api/exam/* เท่านั้น)
 *
 * เหตุผล: เดิม client ดึง questions ทั้งชุด (มี correctAnswer+explanation ติดมา)
 * ก่อนเริ่มทำข้อสอบ → เปิด DevTools ก็ scrape คลังข้อสอบได้ทั้งหมด
 * ย้ายมาที่นี่: ส่งโจทย์ไม่มีเฉลย · ตรวจคะแนนบน server · เฉลยออกหลังส่งเท่านั้น
 *
 * กติกาสิทธิ์เดียวกับ decideExamAccess (lib/access.ts):
 *   isFree → ผู้ใช้ login ทุกคน · มี packageId → ต้องเป็นเจ้าของแพ็กนั้น
 *   ไม่มี packageId → legacy: มีคอร์สอะไรก็ได้
 */

import "server-only";
import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";

export interface LoadedExam {
  status:    "not-found" | "locked" | "empty" | "ok";
  examData?: Record<string, unknown>;
  qDocs?:    QueryDocumentSnapshot[];   // เรียงตาม order แล้ว
}

/** สิทธิ์ของ uid ต่อ exam หนึ่งชุด — ตรรกะเดียวกับ decideExamAccess ฝั่ง client */
export async function serverExamAllowed(
  db: Firestore, uid: string, exam: Record<string, unknown>
): Promise<boolean> {
  if (exam.isFree === true) return true;
  const snap = await db.collection("userCourses").where("userId", "==", uid).get();
  const packageIds = snap.docs.map((d) => String(d.data().courseId ?? "")).filter(Boolean);
  const packageId  = String(exam.packageId ?? "");
  if (packageId) return packageIds.includes(packageId);
  // legacy (ไม่ผูก packageId) = คลัง สป.สธ. เดิม — สนามใหม่ (dcd-) ไม่นับ
  // ตรงกับ hasAny ฝั่ง client (access.ts): แต่ละสนามแยกขาด ซื้อคอร์สไหนได้แค่คอร์สนั้น
  return packageIds.some((id) => !id.toLowerCase().startsWith("dcd-"));
}

/** โหลด exam + questions พร้อมตัดสินสิทธิ์ (ใช้ร่วม 3 endpoint) */
export async function loadExamForUser(
  db: Firestore, uid: string, examId: string
): Promise<LoadedExam> {
  const examSnap = await db.collection("exams").doc(examId).get();
  if (!examSnap.exists) return { status: "not-found" };
  const examData = examSnap.data()!;
  if (examData.isPublished !== true) return { status: "not-found" };

  if (!(await serverExamAllowed(db, uid, examData))) {
    return { status: "locked", examData };
  }

  const qSnap = await examSnap.ref.collection("questions").orderBy("order", "asc").get();
  if (qSnap.empty) return { status: "empty", examData };
  return { status: "ok", examData, qDocs: qSnap.docs };
}
