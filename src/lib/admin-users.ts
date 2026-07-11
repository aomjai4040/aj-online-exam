/**
 * admin-users.ts — สรุปสมาชิกสำหรับ /admin/users (admin เท่านั้น — rules บังคับ)
 *
 * ตอบ 3 คำถาม: มีกี่บัญชีที่ login แล้ว · กี่คนเปิดใช้คอร์ส (ผ่าน code ไหน)
 * · กี่คนทำข้อสอบจริง — และตรวจว่า code ใบไหนถูกใช้โดยกี่บัญชี (จับการแชร์)
 */

import {
  collection, collectionGroup, getDocs, deleteDoc, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/** ล้างรายการอุปกรณ์ของผู้ใช้ (ลูกค้าเปลี่ยนเครื่อง → ลงทะเบียนใหม่ได้) */
export async function deleteUserDevices(uid: string): Promise<number> {
  const snap = await getDocs(collection(db, "users", uid, "devices"));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}

export interface MemberRow {
  uid:         string;
  email:       string;
  displayName: string;
  lastSeenAt:  Date | null;
  activated:   boolean;   // มี userCourse อย่างน้อย 1
  codes:       string[];  // activation codes ที่ใช้
  examsTaken:  number;    // จำนวนชุดที่เคยทำ (history docs)
  attempts:    number;    // จำนวนครั้งรวม
  devices:     number;    // จำนวนอุปกรณ์ที่เคยใช้บัญชีนี้ (≥3 = น่าสงสัย)
  deviceLabels: string[]; // เช่น ["iPhone", "Windows"]
}

export interface CodeUsage {
  code:       string;
  courseName: string;
  users:      { email: string; uid: string }[];
}

export interface MemberStats {
  totalUsers:     number;   // บัญชีที่เคย login
  activatedUsers: number;   // คนที่เปิดใช้คอร์สแล้ว (distinct)
  examUsers:      number;   // คนที่ทำข้อสอบอย่างน้อย 1 ชุด
  totalAttempts:  number;   // จำนวนครั้งสอบรวมทั้งระบบ
  members:        MemberRow[];   // เรียง lastSeenAt ล่าสุดก่อน
  codeUsage:      CodeUsage[];   // เรียงจำนวนบัญชีที่ใช้มาก→น้อย
}

function toDate(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();
  return null;
}

export async function getMemberStats(): Promise<MemberStats> {
  const [usersSnap, coursesSnap, historySnap, devicesSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "userCourses")),
    getDocs(collectionGroup(db, "history")),
    getDocs(collectionGroup(db, "devices")),
  ]);

  // ── devices → ต่อ uid ──────────────────────────────────────────────────────
  const deviceMap = new Map<string, string[]>();
  devicesSnap.docs.forEach((d) => {
    const seg = d.ref.path.split("/");
    if (seg[0] !== "users") return;
    const uid = seg[1];
    deviceMap.set(uid, [...(deviceMap.get(uid) ?? []), String(d.data().label ?? "?")]);
  });

  // ── history → ต่อ uid: กี่ชุด กี่ครั้ง ─────────────────────────────────────
  const examMap = new Map<string, { exams: number; attempts: number }>();
  historySnap.docs.forEach((d) => {
    // path: users/{uid}/history/{examId}
    const seg = d.ref.path.split("/");
    if (seg[0] !== "users") return;
    const uid = seg[1];
    const cur = examMap.get(uid) ?? { exams: 0, attempts: 0 };
    cur.exams++;
    cur.attempts += Number(d.data().attempts) || 1;
    examMap.set(uid, cur);
  });

  // ── userCourses → ต่อ uid + ต่อ code ──────────────────────────────────────
  const courseMap = new Map<string, string[]>();          // uid → codes
  const codeMap   = new Map<string, CodeUsage>();          // code → usage
  coursesSnap.docs.forEach((d) => {
    const x = d.data();
    const uid   = String(x.userId ?? "");
    const email = String(x.email ?? "");
    const code  = String(x.activationCode ?? "(ไม่ระบุ)");
    if (uid) courseMap.set(uid, [...(courseMap.get(uid) ?? []), code]);
    const cu = codeMap.get(code) ?? {
      code, courseName: String(x.courseName ?? ""), users: [],
    };
    cu.users.push({ email, uid });
    codeMap.set(code, cu);
  });

  // ── รวมเป็นรายคน ───────────────────────────────────────────────────────────
  const members: MemberRow[] = usersSnap.docs.map((d) => {
    const x = d.data();
    const ex = examMap.get(d.id);
    return {
      uid:         d.id,
      email:       String(x.email ?? ""),
      displayName: String(x.displayName ?? ""),
      lastSeenAt:  toDate(x.lastSeenAt),
      activated:   courseMap.has(d.id),
      codes:       courseMap.get(d.id) ?? [],
      examsTaken:  ex?.exams ?? 0,
      attempts:    ex?.attempts ?? 0,
      devices:      deviceMap.get(d.id)?.length ?? 0,
      deviceLabels: deviceMap.get(d.id) ?? [],
    };
  }).sort((a, b) => (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0));

  return {
    totalUsers:     usersSnap.size,
    activatedUsers: courseMap.size,
    examUsers:      examMap.size,
    totalAttempts:  [...examMap.values()].reduce((s, x) => s + x.attempts, 0),
    members,
    codeUsage: [...codeMap.values()].sort((a, b) => b.users.length - a.users.length),
  };
}
