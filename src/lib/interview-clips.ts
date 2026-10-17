/**
 * interview-clips.ts — คลิปอวตาร์ "กรรมการถาม" ของเมนูภาค ค. (handoff Aj 2026-10-17)
 *
 * เก็บเมทาดาทาที่ Firestore: interviewClips/{code} (code = รหัสถาวรของคำถาม เช่น SPS-C-001)
 * ไฟล์จริงอยู่ GCS bucket aj-online-exam-media ใต้ path interview/
 *   - เมทาดาทาอ่านได้สาธารณะ (rules) — มีแค่ธง/ระยะเวลา ไม่มี URL ที่เปิดดูได้ตรง
 *   - ตัวคลิปเข้าถึงผ่าน /api/interview/clip เท่านั้น (signed URL อายุสั้น)
 *     ข้อ free preview ไม่ต้อง login · ข้ออื่นต้องเป็นสมาชิกคอร์สใดคอร์สหนึ่ง
 */

import {
  collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type ClipStatus = "draft" | "published";

export interface InterviewClip {
  /** = code ของคำถาม (doc id) */
  code: string;
  /** path ใน bucket เช่น interview/SPS-C-001.mp4 */
  videoPath: string;
  posterPath?: string;
  captionsPath?: string;
  durationSec?: number;
  isFreePreview: boolean;
  status: ClipStatus;
}

const COL = "interviewClips";

/** โหลดเมทาดาทาคลิปทั้งหมด (ครั้งเดียวต่อหน้า — คลังเล็ก ~60 ข้อ) */
export async function loadClips(): Promise<Map<string, InterviewClip>> {
  const snap = await getDocs(collection(db, COL));
  const map = new Map<string, InterviewClip>();
  snap.forEach((d) => {
    const x = d.data();
    map.set(d.id, {
      code: d.id,
      videoPath: String(x.videoPath ?? ""),
      posterPath: x.posterPath ? String(x.posterPath) : undefined,
      captionsPath: x.captionsPath ? String(x.captionsPath) : undefined,
      durationSec: typeof x.durationSec === "number" ? x.durationSec : undefined,
      isFreePreview: x.isFreePreview === true,
      status: x.status === "draft" ? "draft" : "published",
    });
  });
  return map;
}

/** admin: บันทึก/อัปเดตเมทาดาทาคลิป (rules ให้เขียนเฉพาะ admin) */
export async function saveClip(clip: InterviewClip): Promise<void> {
  const { code, ...rest } = clip;
  await setDoc(doc(db, COL, code), {
    ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** admin: ลบเมทาดาทา (ตัวไฟล์ลบผ่าน API) */
export async function removeClipDoc(code: string): Promise<void> {
  await deleteDoc(doc(db, COL, code));
}

/** ขอ URL เล่นคลิป (signed, อายุสั้น) — token = Firebase ID token (ไม่ส่ง = ขอแบบ guest
 *  ซึ่งได้เฉพาะข้อ free preview) · คืน null ถ้าไม่มีสิทธิ์/ไม่มีคลิป */
export async function fetchClipUrl(
  code: string, token?: string | null,
): Promise<{ videoUrl: string; posterUrl?: string; captionsUrl?: string } | null> {
  try {
    const res = await fetch(`/api/interview/clip?code=${encodeURIComponent(code)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
